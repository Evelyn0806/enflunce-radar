import { NextRequest, NextResponse } from 'next/server'
import { computeTier } from '@/lib/utils'
import { Language, Tier } from '@/types'

const BEARER = process.env.TWITTER_BEARER_TOKEN!

// X API v2 headers
function xHeaders() {
  return { Authorization: `Bearer ${BEARER}` }
}

// Multi-strategy KOL discovery
async function discoverKols(keywords: string[], days: number = 7): Promise<string[]> {
  const authorIds = new Set<string>()

  // Note: X API recent search only supports last 7 days
  // The 'days' parameter is kept for future API upgrades

  // Strategy 1: Recent tweets
  for (const kw of keywords.slice(0, 2)) {
    try {
      const params = new URLSearchParams({
        query: `${kw} -is:retweet`,
        max_results: '100',
        'tweet.fields': 'author_id',
      })
      const res = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?${params}`,
        { headers: xHeaders() }
      )
      if (res.ok) {
        const json = await res.json()
        for (const t of (json.data ?? []) as { author_id: string }[]) {
          authorIds.add(t.author_id)
        }
      }
    } catch {}
  }

  // Strategy 2: Bio search (finds KOLs with keywords in bio)
  try {
    const bioQuery = keywords.slice(0, 2).map(k => `bio:"${k}"`).join(' OR ')
    const params = new URLSearchParams({
      query: `${bioQuery} -is:retweet`,
      max_results: '100',
      'tweet.fields': 'author_id',
    })
    const res = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?${params}`,
      { headers: xHeaders() }
    )
    if (res.ok) {
      const json = await res.json()
      for (const t of (json.data ?? []) as { author_id: string }[]) {
        authorIds.add(t.author_id)
      }
    }
  } catch {}

  return Array.from(authorIds)
}

// Detect private community from bio
function detectCommunity(bio: string): { has: boolean; links: string[] } {
  const lower = bio.toLowerCase()
  const keywords = ['telegram', 'discord', 'wechat', 'tg:', 't.me', 'discord.gg']
  const has = keywords.some(k => lower.includes(k))
  const links = bio.match(/(https?:\/\/[^\s]+|t\.me\/[^\s]+)/g) || []
  return { has, links }
}

// Detect language from bio
function detectLanguage(bio: string): Language {
  const zhChars = bio.match(/[\u4e00-\u9fa5]/g)
  return zhChars && zhChars.length > 10 ? 'zh' : 'en'
}

// Count per-author tweet frequency in search results
async function getAuthorTweetCounts(
  query: string,
  authorIds: string[]
): Promise<Map<string, number>> {
  const params = new URLSearchParams({
    query: `${query} -is:retweet`,
    max_results: '100',
    'tweet.fields': 'author_id',
  })

  const res = await fetch(
    `https://api.twitter.com/2/tweets/search/recent?${params}`,
    { headers: xHeaders(), next: { revalidate: 0 } }
  )

  const counts = new Map<string, number>()
  if (!res.ok) return counts

  const json = await res.json()
  for (const t of (json.data ?? []) as { author_id: string }[]) {
    counts.set(t.author_id, (counts.get(t.author_id) ?? 0) + 1)
  }
  return counts
}

// Fetch user profiles in batch (max 100 per request)
async function fetchUserProfiles(ids: string[]) {
  if (ids.length === 0) return []

  const params = new URLSearchParams({
    ids: ids.join(','),
    'user.fields': 'public_metrics,description,profile_image_url,created_at',
  })

  const res = await fetch(
    `https://api.twitter.com/2/users?${params}`,
    { headers: xHeaders(), next: { revalidate: 0 } }
  )

  if (!res.ok) return []
  const json = await res.json()
  return (json.data ?? []) as TwitterUser[]
}

interface TwitterUser {
  id: string
  name: string
  username: string
  description: string
  profile_image_url: string
  public_metrics: {
    followers_count: number
    following_count: number
    tweet_count: number
  }
}

export interface DiscoveryResult {
  twitter_id: string
  x_handle: string
  display_name: string
  avatar_url: string
  bio: string
  followers_count: number
  following_count: number
  posts_count: number
  keyword_post_count: number   // how many matched tweets in this search
  tier: Tier
  already_in_db: boolean
  language: Language
  has_private_community: boolean
  community_links: string[]
}

// POST /api/discover
export async function POST(req: NextRequest) {
  const { keywords, min_followers = 1000, time_range = 30 }: {
    keywords: string[]
    min_followers?: number
    time_range?: number
  } = await req.json()

  if (!keywords || keywords.length === 0) {
    return NextResponse.json({ error: '请输入关键词' }, { status: 400 })
  }

  if (!BEARER) {
    return NextResponse.json({ error: 'X API 未配置' }, { status: 500 })
  }

  try {
    const query = keywords.map((k) => `"${k}"`).join(' OR ')

    // 1. Discover KOLs using multi-strategy approach
    const authorIds = await discoverKols(keywords, time_range)

    // 2. Get tweet counts per author (keyword relevance signal)
    const tweetCounts = await getAuthorTweetCounts(query, authorIds)

    // 3. Fetch user profiles in batches of 100
    const batches: string[][] = []
    for (let i = 0; i < authorIds.length; i += 100) {
      batches.push(authorIds.slice(i, i + 100))
    }
    const usersNested = await Promise.all(batches.map(fetchUserProfiles))
    const users = usersNested.flat()

    // 4. Filter by min_followers + compute tier + sort
    const results: DiscoveryResult[] = users
      .filter((u) => u.public_metrics.followers_count >= min_followers)
      .map((u) => {
        const community = detectCommunity(u.description ?? '')
        return {
          twitter_id: u.id,
          x_handle: u.username.toLowerCase(),
          display_name: u.name,
          avatar_url: u.profile_image_url?.replace('_normal', '_400x400') ?? null,
          bio: u.description ?? null,
          followers_count: u.public_metrics.followers_count,
          following_count: u.public_metrics.following_count,
          posts_count: u.public_metrics.tweet_count,
          keyword_post_count: tweetCounts.get(u.id) ?? 1,
          tier: computeTier(u.public_metrics.followers_count, null),
          already_in_db: false,
          language: detectLanguage(u.description ?? ''),
          has_private_community: community.has,
          community_links: community.links,
        }
      })
      .sort((a, b) => {
        // Sort: tier A > B > C, then followers desc
        const tierOrder = { A: 0, B: 1, C: 2 }
        const td = tierOrder[a.tier] - tierOrder[b.tier]
        if (td !== 0) return td
        return b.followers_count - a.followers_count
      })

    return NextResponse.json({ results, total: results.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
