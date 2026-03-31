import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeTier } from '@/lib/utils'
import { Language, Tier } from '@/types'
import { getTwikitUserTweets, searchTwikitTweets, searchTwikitUsers, tryGetTwikitUser } from '@/lib/twikit'
import { fetchXRecentTweetsByHandle, fetchXUserByHandle, hasXApiFallback } from '@/lib/x-api-fallback'
import {
  BRAND_HANDLE_HINTS,
  COMMUNITY_TERMS,
  CORE_PM_TERMS,
  PERSONAL_MARKERS,
  PROJECT_BLOCK_TERMS,
  RESEARCH_TERMS,
  TOOL_TERMS,
  TRADER_TERMS,
  countMatches,
  expandDiscoverKeywords,
  fallbackHandlesForKeywords,
  normalizeKeyword,
} from '@/lib/discover-profile'

function detectCommunity(bio: string): { has: boolean; links: string[] } {
  const lower = bio.toLowerCase()
  const has = COMMUNITY_TERMS.some((term) => lower.includes(term))
  const links = bio.match(/(https?:\/\/[^\s]+|t\.me\/[^\s]+|discord\.gg\/[^\s]+|reddit\.com\/[^\s]+)/g) || []
  return { has, links }
}

function detectLanguage(bio: string): Language {
  const zhChars = bio.match(/[\u4e00-\u9fa5]/g)
  return zhChars && zhChars.length > 10 ? 'zh' : 'en'
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

function makeCacheKey(keywords: string[], minFollowers: number, timeRange: number) {
  return JSON.stringify({
    keywords: keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean).sort(),
    minFollowers,
    timeRange,
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

function isLikelyProjectAccount(
  user: { screen_name: string; name: string; description: string; followers_count: number; following_count: number },
  originalKeywords: string[]
) {
  const text = `${user.name}\n${user.description}`.toLowerCase()
  const handle = user.screen_name.toLowerCase()
  const name = user.name.toLowerCase()
  const projectSignal = countMatches(text, PROJECT_BLOCK_TERMS)
  const personalSignal = countMatches(text, PERSONAL_MARKERS)
  const orgHandleSignal = /app|labs|official|team|news|intel|dev|sport|sports|fc|money|analytics|zone|bot|terminal|market(s)?$/.test(handle)
  const looksOrgByName = /official|analytics|news|developers|sports|money|terminal|bot|app|market/.test(name)
  const brandLead = originalKeywords.some((keyword) => {
    const normalized = normalizeKeyword(keyword)
    return normalized.length >= 4 && handle.startsWith(normalized)
  })

  if (personalSignal > 0 && projectSignal === 0 && !orgHandleSignal && !brandLead) return false
  if (brandLead && personalSignal === 0) return true
  if (projectSignal >= 2 && personalSignal === 0) return true
  if ((orgHandleSignal || looksOrgByName) && projectSignal >= 1) return true
  return false
}

const SEARCH_SAMPLE_COUNT = 50
const ENRICH_CANDIDATE_LIMIT = 20
const DISCOVER_CACHE_TTL_MS = 15 * 60 * 1000

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
  prediction_market_signal: number
  bio_tool_signal: number
  community_signal: number
  recent_topic_signal: number
  relevance_score: number
}

async function safeSearchUsers(term: string) {
  try {
    return { results: await searchTwikitUsers(term, SEARCH_SAMPLE_COUNT), limited: false }
  } catch {
    return { results: [], limited: true }
  }
}

async function safeSearchTweets(term: string, timeRange: number) {
  try {
    return { results: await searchTwikitTweets(buildSearchQuery(term, timeRange), SEARCH_SAMPLE_COUNT), limited: false }
  } catch {
    return { results: [], limited: true }
  }
}

async function fallbackUsersForTerms(keywords: string[]) {
  const handles = fallbackHandlesForKeywords(keywords)
  const users = await Promise.all(handles.map((handle) => tryGetTwikitUser(handle)))
  return users.filter(Boolean)
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
}): DiscoveryResult {
  const bio = user.description ?? ''
  const community = detectCommunity(bio)
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
    language: detectLanguage(bio),
    has_private_community: community.has,
    community_links: community.links,
    avg_engagement: 0,
    prediction_market_signal: 0,
    bio_tool_signal: countMatches(bio, TOOL_TERMS),
    community_signal: community.has ? 1 + community.links.length : 0,
    recent_topic_signal: 0,
    relevance_score: 0,
  }
}

function scoreBioAndIdentity(item: DiscoveryResult, text: string) {
  item.prediction_market_signal += countMatches(text, CORE_PM_TERMS)
  item.prediction_market_signal += countMatches(text, TRADER_TERMS)
  item.prediction_market_signal += countMatches(text, RESEARCH_TERMS)
  item.bio_tool_signal = Math.max(item.bio_tool_signal, countMatches(text, TOOL_TERMS))
}

function computeRelevance(item: DiscoveryResult) {
  return (
    item.keyword_post_count * 3 +
    item.prediction_market_signal * 4 +
    item.bio_tool_signal * 5 +
    item.community_signal * 6 +
    item.recent_topic_signal * 5 +
    Math.min(12, Math.round(item.avg_engagement / 15))
  )
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

async function fallbackDbResults(keywords: string[], minFollowers: number, timeRange: number): Promise<DiscoveryResult[]> {
  const clauses = keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .flatMap((keyword) => [
      `x_handle.ilike.%${keyword}%`,
      `display_name.ilike.%${keyword}%`,
      `bio.ilike.%${keyword}%`,
    ])

  if (clauses.length === 0) return []

  const since = new Date()
  since.setDate(since.getDate() - timeRange)

  const { data } = await supabase
    .from('kols_with_computed')
    .select('*')
    .or(clauses.join(','))
    .gte('followers_count', minFollowers)
    .gte('last_post_at', since.toISOString())
    .limit(150)

  return (data ?? [])
    .filter((item) => !isLikelyProjectAccount({
      screen_name: item.x_handle,
      name: item.display_name ?? item.x_handle,
      description: item.bio ?? '',
      followers_count: item.followers_count ?? 0,
      following_count: item.following_count ?? 0,
    }, keywords))
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
      })
      result.already_in_db = true
      result.avg_engagement = item.avg_engagement_rate ?? 0
      scoreBioAndIdentity(result, `${result.display_name}\n${result.bio}`)
      result.relevance_score = computeRelevance(result)
      return result
    })
}

export async function POST(req: NextRequest) {
  const { keywords, min_followers = 1000, time_range = 30 }: {
    keywords: string[]
    min_followers?: number
    time_range?: number
  } = await req.json()

  if (!keywords || keywords.length === 0) {
    return NextResponse.json({ error: '请输入关键词' }, { status: 400 })
  }

  try {
    const originalKeywords = keywords.map((keyword) => keyword.trim()).filter(Boolean)
    const cacheKey = makeCacheKey(originalKeywords, min_followers, time_range)
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
      if (isLikelyProjectAccount(user, originalKeywords)) continue

      const result = baseResultFromUser(user)
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
          if (isLikelyProjectAccount(user, originalKeywords)) continue

          const current = seen.get(user.id) ?? baseResultFromUser(user)
          current.keyword_post_count += 1
          scoreBioAndIdentity(current, `${current.display_name}\n${current.bio}\n${keyword}`)
          seen.set(user.id, current)
        }
      }
    }

    for (const term of expandedTerms) {
      const [{ results: users, limited: usersLimited }, { results: tweets, limited: tweetsLimited }] = await Promise.all([
        safeSearchUsers(term),
        safeSearchTweets(term, time_range),
      ])
      rateLimited = rateLimited || usersLimited || tweetsLimited

      for (const user of users) {
        if (user.followers_count < min_followers) continue
        if (isLikelyProjectAccount(user, originalKeywords)) continue

        const current = seen.get(user.id) ?? baseResultFromUser(user)
        current.keyword_post_count += 2
        scoreBioAndIdentity(current, `${current.display_name}\n${current.bio}\n${term}`)
        seen.set(user.id, current)
      }

      for (const tweet of tweets) {
        const user = tweet.user
        if (!user) continue
        if (user.followers_count < min_followers) continue
        if (isLikelyProjectAccount(user, originalKeywords)) continue

        const current = seen.get(user.id) ?? baseResultFromUser(user)
        current.keyword_post_count += 1
        const topicHits =
          countMatches(tweet.text, CORE_PM_TERMS) +
          countMatches(tweet.text, TRADER_TERMS) +
          countMatches(tweet.text, RESEARCH_TERMS)
        current.prediction_market_signal += topicHits
        current.recent_topic_signal += topicHits > 0 ? 1 : 0
        current.avg_engagement = Math.max(current.avg_engagement, tweet.favorite_count + tweet.retweet_count + tweet.reply_count)
        seen.set(user.id, current)
      }
    }

    const list = [...seen.values()]
      .sort((a, b) => (b.keyword_post_count + b.prediction_market_signal) - (a.keyword_post_count + a.prediction_market_signal))

    await Promise.all(
      list.slice(0, ENRICH_CANDIDATE_LIMIT).map(async (item) => {
        try {
          const tweets = await getTwikitUserTweets(item.twitter_id, 15)
          const relevantTweets = tweets.filter((tweet) => {
            const topicHits =
              countMatches(tweet.text, CORE_PM_TERMS) +
              countMatches(tweet.text, TRADER_TERMS) +
              countMatches(tweet.text, RESEARCH_TERMS)
            return topicHits > 0
          })
          item.recent_topic_signal += relevantTweets.length
          item.avg_engagement = Math.max(item.avg_engagement, averageEngagement(relevantTweets.length > 0 ? relevantTweets : tweets))
          item.prediction_market_signal += relevantTweets.reduce((sum, tweet) => {
            return sum +
              countMatches(tweet.text, CORE_PM_TERMS) +
              countMatches(tweet.text, TRADER_TERMS) +
              countMatches(tweet.text, RESEARCH_TERMS)
          }, 0)
        } catch {
          if (!hasXApiFallback()) return
          const tweets = await fetchXRecentTweetsByHandle(item.x_handle, 10)
          const relevantTweets = tweets.filter((tweet) => {
            const topicHits =
              countMatches(tweet.text, CORE_PM_TERMS) +
              countMatches(tweet.text, TRADER_TERMS) +
              countMatches(tweet.text, RESEARCH_TERMS)
            return topicHits > 0
          })
          item.recent_topic_signal += relevantTweets.length
          item.avg_engagement = Math.max(item.avg_engagement, averageEngagement(relevantTweets.length > 0 ? relevantTweets : tweets))
          item.prediction_market_signal += relevantTweets.reduce((sum, tweet) => {
            return sum +
              countMatches(tweet.text, CORE_PM_TERMS) +
              countMatches(tweet.text, TRADER_TERMS) +
              countMatches(tweet.text, RESEARCH_TERMS)
          }, 0)
        }
      })
    )

    for (const item of list) {
      item.relevance_score = computeRelevance(item)
    }

    const results = list.sort((a, b) => {
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

    const fallbackResults = await fallbackDbResults(originalKeywords, min_followers, time_range)
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
