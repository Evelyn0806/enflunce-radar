import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeTier, detectLanguage } from '@/lib/utils'
import { Language, Tier } from '@/types'
import { getTwikitUserTweets, getTwikitUserFollowing, searchTwikitTweets, searchTwikitUsers, tryGetTwikitUser } from '@/lib/twikit'
import { fetchXRecentTweetsByHandle, fetchXUserByHandle, hasXApiFallback } from '@/lib/x-api-fallback'
import {
  PM_AIRDROP_TERMS,
  RESEARCH_TERMS,
  SPORTS_BLOCK_TERMS,
  STOCK_BLOCK_TERMS,
  TOOL_TERMS,
  countMatches,
  expandDiscoverKeywords,
  fallbackHandlesForKeywords,
  isLikelyBrandAccount,
  normalizeKeyword,
} from '@/lib/discover-profile'
import { ALL_TRACKS, AccountType, TRACKS, Track, isTrack, trackHitMap, trackHits } from '@/lib/tracks'

function isCommunityLink(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.includes('t.me/') ||
    lower.includes('telegram.me/') ||
    lower.includes('discord.gg/') ||
    lower.includes('discord.com/invite/') ||
    lower.includes('wa.me/') ||
    lower.includes('chat.whatsapp.com/') ||
    lower.includes('reddit.com/r/') ||
    lower.includes('circle.') ||
    lower.includes('guild.xyz') ||
    lower.includes('群') ||
    lower.includes('group')
  )
}

function detectCommunity(bio: string): { has: boolean; links: string[] } {
  // Extract community-specific links (not all URLs)
  const communityPatterns = [
    /https?:\/\/t\.me\/[\w-]+/g,
    /https?:\/\/telegram\.me\/[\w-]+/g,
    /https?:\/\/discord\.gg\/[\w-]+/g,
    /https?:\/\/discord\.com\/invite\/[\w-]+/g,
    /https?:\/\/wa\.me\/[\d]+/g,
    /https?:\/\/chat\.whatsapp\.com\/[\w]+/g,
    /https?:\/\/reddit\.com\/r\/[\w-]+/g,
    /t\.me\/[\w-]+/g,
    /discord\.gg\/[\w-]+/g,
    /discord\.com\/invite\/[\w-]+/g,
    /wa\.me\/[\d]+/g,
  ]
  const links: string[] = []
  for (const pattern of communityPatterns) {
    const matches = bio.match(pattern)
    if (matches) links.push(...matches)
  }

  // Extract tg: @handle mentions
  const tgMentions = bio.match(/tg:\s*@?([\w-]+)/gi)
  if (tgMentions) {
    for (const m of tgMentions) {
      const handle = m.replace(/^tg:\s*@?/i, '')
      links.push(`t.me/${handle}`)
    }
  }

  // Check generic URLs that might be community links based on surrounding text
  const genericUrls = bio.match(/https?:\/\/[^\s),\]]+/g) ?? []
  for (const url of genericUrls) {
    if (isCommunityLink(url)) {
      links.push(url)
    }
  }

  // Check for Chinese-context community mentions: "电报群：url" or "加入...群"
  const zhCommunityPattern = /(?:电报|telegram|tg|discord|群|社群|频道|channel)[^\n]*?(https?:\/\/[^\s),\]]+|t\.me\/[\w-]+|discord\.gg\/[\w-]+)/gi
  const zhMatches = bio.matchAll(zhCommunityPattern)
  for (const m of zhMatches) {
    if (m[1]) links.push(m[1])
  }

  const uniqueLinks = [...new Set(links)]
  // Strict rule: only count as private community when we actually extract a URL to click.
  // Keyword-only mentions ("join our community") without a link are NOT actionable → treated as no community.
  return { has: uniqueLinks.length > 0, links: uniqueLinks }
}


function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function buildSearchQuery(keyword: string, timeRange: number) {
  const until = new Date()
  const since = new Date()
  since.setDate(since.getDate() - timeRange)
  return `${keyword} -filter:replies -filter:retweets since:${formatDate(since)} until:${formatDate(until)}`
}

function averageEngagement(tweets: { favorite_count: number; retweet_count: number; reply_count: number }[]) {
  if (tweets.length === 0) return 0
  const total = tweets.reduce((sum, tweet) => sum + tweet.favorite_count + tweet.retweet_count + tweet.reply_count, 0)
  return Math.round(total / tweets.length)
}

function buildXUrl(handle: string) {
  return `https://x.com/${handle}`
}

function makeCacheKey(keywords: string[], minFollowers: number, timeRange: number, tracks: Track[], includeBrand: boolean) {
  return JSON.stringify({
    keywords: keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean).sort(),
    minFollowers,
    timeRange,
    tracks: [...tracks].sort(),
    includeBrand,
  })
}

function getCachedDiscoverResponse(cacheKey: string) {
  const cached = discoverCache.get(cacheKey)
  if (!cached) return null
  if (cached.expiresAt < Date.now()) return cached.payload
  return cached.payload
}

function setCachedDiscoverResponse(cacheKey: string, payload: DiscoverResponse) {
  discoverCache.set(cacheKey, {
    expiresAt: Date.now() + DISCOVER_CACHE_TTL_MS,
    payload,
  })
}

const SEARCH_SAMPLE_COUNT = 40
const ENRICH_CANDIDATE_LIMIT = 8
const DISCOVER_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour cache
const MAX_SEARCH_CALLS = 5 // max search API calls (rate-limited)
const GRAPH_EXPAND_SEEDS = 6 // expand following from top N seed KOLs
const GRAPH_FOLLOWING_PER_SEED = 100
const REQUEST_DELAY_MS = 1500
const PROFILE_SCORE_THRESHOLD = 28

type DiscoverResponse = {
  results: DiscoveryResult[]
  total: number
  rate_limited: boolean
  warning: string | null
}

const discoverCache = new Map<string, { expiresAt: number; payload: DiscoverResponse }>()

export interface DiscoveryResult {
  twitter_id: string
  x_handle: string
  display_name: string
  avatar_url: string
  bio: string
  profile_url: string
  followers_count: number
  following_count: number
  posts_count: number
  keyword_post_count: number
  tier: Tier
  already_in_db: boolean
  language: Language
  has_private_community: boolean
  community_links: string[]
  avg_engagement: number
  // 赛道: per-track term hits from bio/name + recent tweets; tracks = those with hits
  track_hits: Record<Track, number>
  tracks: Track[]
  account_type: AccountType
  // fine-grained signals for precise scoring
  topic_signal: number
  research_signal: number
  airdrop_signal: number
  sports_penalty: number
  stock_penalty: number
  bio_tool_signal: number
  community_signal: number
  recent_topic_signal: number
  relevance_score: number
  profile_score: number
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function safeSearchUsers(term: string) {
  try {
    const results = await searchTwikitUsers(term, SEARCH_SAMPLE_COUNT)
    await delay(REQUEST_DELAY_MS)
    return { results, limited: false }
  } catch (e) {
    console.error('[discover] user-search failed:', term, e instanceof Error ? e.message : e)
    return { results: [], limited: true }
  }
}

async function safeSearchTweets(term: string, timeRange: number) {
  try {
    const results = await searchTwikitTweets(buildSearchQuery(term, timeRange), SEARCH_SAMPLE_COUNT)
    await delay(REQUEST_DELAY_MS)
    return { results, limited: false }
  } catch (e) {
    console.error('[discover] tweet-search failed:', term, e instanceof Error ? e.message : e)
    return { results: [], limited: true }
  }
}

async function fallbackUsersForTerms(keywords: string[]) {
  const handles = fallbackHandlesForKeywords(keywords)
  const users = await Promise.all(handles.map((handle) => tryGetTwikitUser(handle)))
  return users.filter(Boolean)
}

async function expandViaFollowing(
  seedUserIds: string[],
  minFollowers: number,
  originalKeywords: string[],
  seen: Map<string, DiscoveryResult>,
) {
  for (const userId of seedUserIds) {
    try {
      await delay(REQUEST_DELAY_MS)
      const following = await getTwikitUserFollowing(userId, GRAPH_FOLLOWING_PER_SEED)
      for (const user of following) {
        if (seen.has(user.id)) continue
        if (user.followers_count < minFollowers) continue

        const result = baseResultFromUser(user, originalKeywords)
        result.keyword_post_count += 1 // found via social graph
        scoreBioAndIdentity(result, `${result.display_name}\n${result.bio}`)
        seen.set(user.id, result)
      }
    } catch {
      // user-following may not be supported, skip silently
    }
  }
}

async function expandFromDbKols(
  keywords: string[],
  minFollowers: number,
  seen: Map<string, DiscoveryResult>,
) {
  // Find existing KOLs related to keywords to use as graph seeds
  const clauses = keywords
    .flatMap((kw) => [`bio.ilike.%${kw}%`, `display_name.ilike.%${kw}%`])
  if (clauses.length === 0) return []

  const { data } = await supabase
    .from('kols')
    .select('x_handle')
    .or(clauses.join(','))
    .order('followers_count', { ascending: false })
    .limit(5)

  const seedIds: string[] = []
  for (const kol of data ?? []) {
    try {
      const user = await tryGetTwikitUser(kol.x_handle)
      if (user?.id) seedIds.push(user.id)
      await delay(500)
    } catch { /* skip */ }
  }

  if (seedIds.length > 0) {
    await expandViaFollowing(seedIds, minFollowers, keywords, seen)
  }
  return seedIds
}

function baseResultFromUser(user: {
  id: string
  screen_name: string
  name: string
  profile_image_url: string | null
  description: string
  followers_count: number
  following_count: number
  statuses_count: number
}, originalKeywords: string[] = []): DiscoveryResult {
  const bio = user.description ?? ''
  const community = detectCommunity(bio)
  const hits = trackHitMap(`${user.name}\n${bio}`)
  return {
    twitter_id: user.id,
    x_handle: user.screen_name.toLowerCase(),
    display_name: user.name,
    avatar_url: user.profile_image_url?.replace('_normal', '_400x400') ?? '',
    bio,
    profile_url: buildXUrl(user.screen_name),
    followers_count: user.followers_count,
    following_count: user.following_count,
    posts_count: user.statuses_count,
    keyword_post_count: 0,
    tier: computeTier(user.followers_count, null),
    already_in_db: false,
    language: detectLanguage(bio, user.name),
    has_private_community: community.has,
    community_links: community.links,
    avg_engagement: 0,
    track_hits: hits,
    tracks: ALL_TRACKS.filter((t) => hits[t] > 0),
    account_type: isLikelyBrandAccount(user, originalKeywords) ? 'brand' : 'personal',
    topic_signal: 0,
    research_signal: countMatches(bio, RESEARCH_TERMS),
    airdrop_signal: countMatches(bio, PM_AIRDROP_TERMS),
    sports_penalty: countMatches(bio, SPORTS_BLOCK_TERMS),
    stock_penalty: countMatches(bio, STOCK_BLOCK_TERMS),
    bio_tool_signal: countMatches(bio, TOOL_TERMS),
    community_signal: community.has ? 1 + community.links.length : 0,
    recent_topic_signal: 0,
    relevance_score: 0,
    profile_score: 50,
  }
}

function addTrackHits(item: DiscoveryResult, text: string) {
  for (const track of ALL_TRACKS) {
    item.track_hits[track] = Math.max(item.track_hits[track], trackHits(text, track))
  }
  item.tracks = ALL_TRACKS.filter((t) => item.track_hits[t] > 0)
}

// Hits in the operator-selected tracks (or any track when none are selected).
function selectedTrackHits(text: string, tracks: Track[]) {
  return (tracks.length > 0 ? tracks : ALL_TRACKS).reduce((sum, t) => sum + trackHits(text, t), 0)
}

function scoreBioAndIdentity(item: DiscoveryResult, text: string) {
  // Track each signal separately so scoring can weight them differently.
  addTrackHits(item, text)
  item.research_signal = Math.max(item.research_signal, countMatches(text, RESEARCH_TERMS))
  item.airdrop_signal = Math.max(item.airdrop_signal, countMatches(text, PM_AIRDROP_TERMS))
  item.bio_tool_signal = Math.max(item.bio_tool_signal, countMatches(text, TOOL_TERMS))
  item.sports_penalty = Math.max(item.sports_penalty, countMatches(text, SPORTS_BLOCK_TERMS))
  item.stock_penalty = Math.max(item.stock_penalty, countMatches(text, STOCK_BLOCK_TERMS))
}

function computeRelevance(item: DiscoveryResult, tracks: Track[]) {
  // Track hits in the selected 赛道 drive relevance; hits in other crypto tracks count a little.
  // Generic research/airdrop terms only count fully when there's crypto-track context.
  const focus = tracks.length > 0 ? tracks : ALL_TRACKS
  const focusHits = focus.reduce((sum, t) => sum + item.track_hits[t], 0)
  const otherHits = ALL_TRACKS.filter((t) => !focus.includes(t)).reduce((sum, t) => sum + item.track_hits[t], 0)
  const cryptoContext = focusHits + otherHits > 0 ? 1 : 0.25
  const positive =
    item.keyword_post_count * 3 +
    focusHits * 12 +
    otherHits * 3 +
    item.airdrop_signal * 4 * cryptoContext +
    item.research_signal * 3 * cryptoContext +
    item.bio_tool_signal * 4 +
    item.community_signal * 10 +              // Private TG/Discord — heavily rewarded
    item.recent_topic_signal * 5 +
    Math.min(12, Math.round(item.avg_engagement / 15))
  // Stock-trader terms are expected for tokenized-stock KOLs, so don't penalise them there.
  const stockPenalty = item.track_hits.tokenized_stock > 0 ? 0 : item.stock_penalty * 8
  const penalty = item.sports_penalty * 10 + stockPenalty
  return Math.max(0, positive - penalty)
}

interface ProfileStats {
  medianFollowers: number
  avgPostsCount: number
  bioKeywords: string[]
}

async function loadProfileStats(): Promise<ProfileStats> {
  const { data } = await supabase
    .from('kols')
    .select('followers_count, posts_count, bio')
    .order('followers_count', { ascending: true })

  if (!data || data.length === 0) {
    return { medianFollowers: 50_000, avgPostsCount: 1000, bioKeywords: [] }
  }

  const mid = Math.floor(data.length / 2)
  const medianFollowers = data[mid].followers_count ?? 50_000
  const avgPostsCount = Math.round(data.reduce((s, k) => s + (k.posts_count ?? 0), 0) / data.length)

  const wordFreq = new Map<string, number>()
  for (const k of data) {
    if (!k.bio) continue
    const words = k.bio.toLowerCase().match(/[a-z]{3,}/g) ?? []
    for (const w of words) wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1)
  }
  const bioKeywords = [...wordFreq.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([w]) => w)

  return { medianFollowers, avgPostsCount, bioKeywords }
}

function scoreKolProfile(item: DiscoveryResult, stats: ProfileStats): number {
  let score = 50

  // Project account penalties
  const bioLower = item.bio.toLowerCase()
  const projectTerms = ['official', 'protocol', 'foundation', 'labs', 'platform', 'network', 'ecosystem']
  for (const term of projectTerms) {
    if (bioLower.includes(term)) score -= 12
  }
  const followRatio = item.followers_count / Math.max(item.following_count, 1)
  if (followRatio > 1000) score -= 20
  if (item.posts_count < 100) score -= 10

  // KOL positive signals
  if (item.has_private_community) score += 15
  if (item.community_links.length > 0) score += 5
  const personalTerms = ['founder', 'trader', 'investor', 'degen', 'my takes', 'opinions', 'alpha', 'research']
  for (const term of personalTerms) {
    if (bioLower.includes(term)) { score += 5; break }
  }
  if (item.posts_count > 500) score += 10
  if (item.posts_count > 2000) score += 5
  if (followRatio >= 5 && followRatio <= 200) score += 10
  if (item.bio.length > 50) score += 5

  // Similarity to existing KOLs
  const bioWords = bioLower.match(/[a-z]{3,}/g) ?? []
  const overlap = bioWords.filter((w) => stats.bioKeywords.includes(w)).length
  score += Math.min(20, overlap * 4)

  return Math.max(0, Math.min(100, score))
}

async function loadRejectedHandles(): Promise<Set<string>> {
  // Load from feedback blacklist API (same server, direct fetch)
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL
    const origin = baseUrl ? (baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`) : 'http://localhost:3000'
    const res = await fetch(`${origin}/api/kols/feedback`, { cache: 'no-store' })
    const data = await res.json()
    return new Set(data.rejected ?? [])
  } catch {
    return new Set()
  }
}

async function annotateExistingKols(results: DiscoveryResult[]) {
  const handles = [...new Set(results.map((item) => item.x_handle).filter(Boolean))]
  if (handles.length === 0) return results

  const { data } = await supabase
    .from('kols')
    .select('x_handle')
    .in('x_handle', handles)

  const existing = new Set((data ?? []).map((item) => item.x_handle))
  for (const item of results) {
    item.already_in_db = existing.has(item.x_handle)
  }

  return results
}

async function fallbackDbResults(
  keywords: string[],
  minFollowers: number,
  tracks: Track[],
  includeBrand: boolean,
): Promise<DiscoveryResult[]> {
  const cleanKeywords = keywords.map((k) => k.trim()).filter(Boolean)

  // Build OR clauses: literal bio/handle/name match…
  const clauses = cleanKeywords.flatMap((keyword) => [
    `x_handle.ilike.%${keyword}%`,
    `display_name.ilike.%${keyword}%`,
    `bio.ilike.%${keyword}%`,
  ])
  // …plus: KOLs already tagged with a selected track, even if the keyword text isn't in their bio.
  if (tracks.length > 0) {
    clauses.push(`tracks.ov.{${tracks.join(',')}}`)
  }

  if (clauses.length === 0) return []

  // Do NOT filter by last_post_at — many KOLs haven't had refresh-stats run yet
  // and would be excluded even though they're valid candidates.
  let query = supabase
    .from('kols_with_computed')
    .select('*')
    .or(clauses.join(','))
    .not('x_handle', 'like', '__competitor__%')
    .gte('followers_count', minFollowers)
    .limit(150)
  if (!includeBrand) query = query.neq('account_type', 'brand')

  const { data } = await query

  return (data ?? [])
    .map((item) => {
      const result = baseResultFromUser({
        id: item.id,
        screen_name: item.x_handle,
        name: item.display_name ?? item.x_handle,
        profile_image_url: item.avatar_url ?? null,
        description: item.bio ?? '',
        followers_count: item.followers_count ?? 0,
        following_count: item.following_count ?? 0,
        statuses_count: item.posts_count ?? 0,
      }, keywords)
      result.already_in_db = true
      result.avg_engagement = item.avg_engagement_rate ?? 0
      if (item.account_type) result.account_type = item.account_type
      scoreBioAndIdentity(result, `${result.display_name}\n${result.bio}`)
      for (const t of (item.tracks ?? []) as Track[]) {
        if (isTrack(t) && !result.tracks.includes(t)) result.tracks.push(t)
      }
      result.relevance_score = computeRelevance(result, tracks)
      return result
    })
}

export async function POST(req: NextRequest) {
  const body: {
    keywords?: string[]
    tracks?: string[]
    include_brand?: boolean
    min_followers?: number
    time_range?: number
  } = await req.json()
  const { min_followers = 1000, time_range = 30, include_brand = true } = body
  const tracks = (body.tracks ?? []).filter(isTrack)
  const typedKeywords = (body.keywords ?? []).map((keyword) => keyword.trim()).filter(Boolean)

  if (typedKeywords.length === 0 && tracks.length === 0) {
    return NextResponse.json({ error: '请输入关键词或选择赛道' }, { status: 400 })
  }

  try {
    // No typed keywords → search with each selected track's seed terms.
    const originalKeywords = typedKeywords.length > 0
      ? typedKeywords
      : [...new Set(tracks.flatMap((t) => TRACKS[t].seeds))].slice(0, 5)
    const cacheKey = makeCacheKey(originalKeywords, min_followers, time_range, tracks, include_brand)
    const hotCache = discoverCache.get(cacheKey)
    if (hotCache && hotCache.expiresAt >= Date.now()) {
      return NextResponse.json({
        ...hotCache.payload,
        warning: hotCache.payload.warning ?? '已返回最近一次缓存结果。',
      })
    }
    const expandedTerms = expandDiscoverKeywords(originalKeywords)
    const seen = new Map<string, DiscoveryResult>()
    let rateLimited = false

    for (const user of await fallbackUsersForTerms(originalKeywords)) {
      if (!user || user.followers_count < min_followers) continue

      const result = baseResultFromUser(user, originalKeywords)
      result.keyword_post_count += 2
      scoreBioAndIdentity(result, `${result.display_name}\n${result.bio}`)
      seen.set(user.id, result)
    }

    if (hasXApiFallback()) {
      for (const keyword of originalKeywords.slice(0, 3)) {
        const normalized = normalizeKeyword(keyword)
        const handles = [normalized, `${normalized}_trader`, `${normalized}trader`, `${normalized}app`]
        for (const handle of handles) {
          const user = await fetchXUserByHandle(handle)
          if (!user || user.followers_count < min_followers) continue

          const current = seen.get(user.id) ?? baseResultFromUser(user, originalKeywords)
          current.keyword_post_count += 1
          scoreBioAndIdentity(current, `${current.display_name}\n${current.bio}\n${keyword}`)
          seen.set(user.id, current)
        }
      }
    }

    // === Phase 1: Limited search API calls (max 2, rate-limited by X) ===
    let searchCallsUsed = 0
    for (const term of expandedTerms) {
      if (rateLimited || searchCallsUsed >= MAX_SEARCH_CALLS) break

      const { results: users, limited: usersLimited } = await safeSearchUsers(term)
      searchCallsUsed++
      rateLimited = rateLimited || usersLimited

      for (const user of users) {
        if (user.followers_count < min_followers) continue
        const current = seen.get(user.id) ?? baseResultFromUser(user, originalKeywords)
        current.keyword_post_count += 2
        scoreBioAndIdentity(current, `${current.display_name}\n${current.bio}\n${term}`)
        seen.set(user.id, current)
      }

      if (rateLimited || searchCallsUsed >= MAX_SEARCH_CALLS) break

      const { results: tweets, limited: tweetsLimited } = await safeSearchTweets(term, time_range)
      searchCallsUsed++
      rateLimited = rateLimited || tweetsLimited

      for (const tweet of tweets) {
        const user = tweet.user
        if (!user) continue
        if (user.followers_count < min_followers) continue
        const current = seen.get(user.id) ?? baseResultFromUser(user, originalKeywords)
        current.keyword_post_count += 1
        addTrackHits(current, tweet.text)
        const topicHits = selectedTrackHits(tweet.text, tracks) + countMatches(tweet.text, RESEARCH_TERMS)
        current.topic_signal += topicHits
        current.recent_topic_signal += topicHits > 0 ? 1 : 0
        current.avg_engagement = Math.max(current.avg_engagement, tweet.favorite_count + tweet.retweet_count + tweet.reply_count)
        seen.set(user.id, current)
      }
    }

    // === Phase 2: Social graph expansion (user lookups = NOT rate-limited) ===
    // Use top seed results + existing DB KOLs to find more people via their following lists
    const seedIds = [...seen.values()]
      .sort((a, b) => b.keyword_post_count - a.keyword_post_count)
      .slice(0, GRAPH_EXPAND_SEEDS)
      .map((r) => r.twitter_id)

    await expandViaFollowing(seedIds, min_followers, originalKeywords, seen)
    await expandFromDbKols(originalKeywords, min_followers, seen)

    const list = [...seen.values()]
      .sort((a, b) => (b.keyword_post_count + b.topic_signal) - (a.keyword_post_count + a.topic_signal))

    // Enrich top candidates — serial with delays to avoid rate limits
    for (const item of list.slice(0, ENRICH_CANDIDATE_LIMIT)) {
      try {
        await delay(REQUEST_DELAY_MS)
        const tweets = await getTwikitUserTweets(item.twitter_id, 10)
        const topicHitsOf = (text: string) => selectedTrackHits(text, tracks) + countMatches(text, RESEARCH_TERMS)
        const relevantTweets = tweets.filter((tweet) => topicHitsOf(tweet.text) > 0)
        for (const tweet of tweets) addTrackHits(item, tweet.text)
        item.recent_topic_signal += relevantTweets.length
        item.avg_engagement = Math.max(item.avg_engagement, averageEngagement(relevantTweets.length > 0 ? relevantTweets : tweets))
        item.topic_signal += relevantTweets.reduce((sum, tweet) => sum + topicHitsOf(tweet.text), 0)
      } catch {
        // Skip enrichment on error, don't mark as rate limited
      }
    }

    const [profileStats, rejectedHandles] = await Promise.all([
      loadProfileStats(),
      loadRejectedHandles(),
    ])

    for (const item of list) {
      item.relevance_score = computeRelevance(item, tracks)
      item.profile_score = scoreKolProfile(item, profileStats)
    }

    const results = list
      .filter((item) => include_brand || item.account_type !== 'brand')
      // ICP rule: private TG/Discord community bypasses the generic profile-quality threshold
      // (a crypto KOL with a TG group is a MUST-KEEP even if its bio is thin).
      // Brand accounts are scored down by the profile heuristic by design, so they skip it too.
      .filter((item) =>
        item.community_signal >= 1 ||
        item.account_type === 'brand' ||
        item.profile_score >= PROFILE_SCORE_THRESHOLD
      )
      // Track filter: when 赛道 are selected, keep only KOLs that hit at least one of them.
      .filter((item) => tracks.length === 0 || item.tracks.some((t) => tracks.includes(t)))
      .filter((item) => !rejectedHandles.has(item.x_handle))
      // Hard block: obvious sports betting or stock trader with ZERO crypto-track context — NOT our ICP.
      // Community link does NOT bypass this — an NFL parlays handicapper with a Telegram is still noise.
      .filter((item) => !(
        (item.sports_penalty >= 2 || item.stock_penalty >= 2) &&
        item.tracks.length === 0 &&
        item.airdrop_signal === 0
      ))
      .sort((a, b) => {
        if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score
        return b.followers_count - a.followers_count
      })

    if (results.length > 0) {
      await annotateExistingKols(results)
      const payload = {
        results,
        total: results.length,
        rate_limited: rateLimited,
        warning: rateLimited ? 'X 搜索通道当前被限流，结果可能不完整。' : null,
      }
      setCachedDiscoverResponse(cacheKey, payload)
      return NextResponse.json(payload)
    }

    const fallbackResults = await fallbackDbResults(typedKeywords, min_followers, tracks, include_brand)
    const staleCache = getCachedDiscoverResponse(cacheKey)
    if (rateLimited && staleCache && staleCache.results.length > 0) {
      await annotateExistingKols(staleCache.results)
      return NextResponse.json({
        ...staleCache,
        rate_limited: true,
        warning: 'X 搜索通道当前被限流，已返回最近一次搜索缓存结果。',
      })
    }

    const payload = {
      results: fallbackResults,
      total: fallbackResults.length,
      rate_limited: rateLimited,
      warning: rateLimited
        ? 'X 搜索通道当前被限流，已切换为数据库候选兜底结果。'
        : '当前未找到符合条件的 KOL / KOC。',
    }
    if (fallbackResults.length > 0) {
      setCachedDiscoverResponse(cacheKey, payload)
    }
    return NextResponse.json(payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
