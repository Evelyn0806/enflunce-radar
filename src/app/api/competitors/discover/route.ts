import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { searchTwikitTweets } from '@/lib/twikit'
import { computeTier, detectLanguage } from '@/lib/utils'

// Reverse discovery: search X for tweets mentioning competitor, find new KOLs

export async function POST(req: NextRequest) {
  const { competitor_name, competitor_handle, min_followers = 1000 }: {
    competitor_name: string
    competitor_handle: string
    min_followers?: number
  } = await req.json()

  if (!competitor_name || !competitor_handle) {
    return NextResponse.json({ error: '请提供竞品信息' }, { status: 400 })
  }

  // Get existing KOL handles for dedup
  const { data: existingKols } = await supabase
    .from('kols')
    .select('x_handle')
    .not('x_handle', 'like', '__competitor__%')
  const existingHandles = new Set((existingKols ?? []).map((k) => k.x_handle))

  // Search for tweets mentioning the competitor
  let tweets
  try {
    tweets = await searchTwikitTweets(`@${competitor_handle} OR "${competitor_name}"`, 30)
  } catch (e) {
    return NextResponse.json({ error: `搜索失败: ${e instanceof Error ? e.message : 'Unknown'}`, results: [] }, { status: 502 })
  }

  // Extract unique users from tweets
  const seen = new Map<string, {
    x_handle: string
    display_name: string
    avatar_url: string | null
    bio: string
    followers_count: number
    following_count: number
    posts_count: number
    tier: string
    language: string
    tweet_text: string
    reason: string
    already_in_db: boolean
    mention_count: number
  }>()

  for (const tweet of tweets) {
    const user = tweet.user
    if (!user?.id) continue
    if (user.followers_count < min_followers) continue

    const handle = user.screen_name.toLowerCase()
    // Skip competitor's own account
    if (handle === competitor_handle.toLowerCase()) continue

    const existing = seen.get(user.id)
    if (existing) {
      existing.mention_count++
      continue
    }

    const bio = user.description ?? ''
    const isPaid = /paid partnership|#ad |#sponsored|sponsored by/i.test(tweet.text)

    seen.set(user.id, {
      x_handle: handle,
      display_name: user.name,
      avatar_url: user.profile_image_url?.replace('_normal', '_400x400') ?? null,
      bio,
      followers_count: user.followers_count,
      following_count: user.following_count,
      posts_count: user.statuses_count,
      tier: computeTier(user.followers_count, null),
      language: detectLanguage(bio, user.name),
      tweet_text: tweet.text.substring(0, 200),
      reason: isPaid ? 'Paid partnership' : `提及 ${competitor_name}`,
      already_in_db: existingHandles.has(handle),
      mention_count: 1,
    })
  }

  const results = [...seen.values()]
    .sort((a, b) => b.followers_count - a.followers_count)

  return NextResponse.json({
    results,
    total: results.length,
    competitor: competitor_name,
  })
}
