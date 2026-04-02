import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeTier, detectLanguage, clampEngagementRate } from '@/lib/utils'
import { getTwikitUser, getTwikitUserTweets } from '@/lib/twikit'

function extractHandle(twitterUrl: string): string | null {
  // Support formats: https://x.com/cobie, https://twitter.com/cobie, @cobie, cobie
  const match = twitterUrl.match(/(?:x\.com|twitter\.com)\/(@?[\w]+)|^@?([\w]+)$/)
  if (match) return (match[1] ?? match[2]).replace(/^@/, '').toLowerCase()
  return null
}

export async function POST(req: NextRequest) {
  const { twitter_url }: { twitter_url: string } = await req.json()

  if (!twitter_url?.trim()) {
    return NextResponse.json({ error: '请提供 Twitter 用户链接或 handle' }, { status: 400 })
  }

  const handle = extractHandle(twitter_url.trim())
  if (!handle) {
    return NextResponse.json({ error: '无法解析 handle，支持格式：https://x.com/handle 或 @handle' }, { status: 400 })
  }

  // Check duplicate
  const { data: existing } = await supabase
    .from('kols')
    .select('id, x_handle')
    .eq('x_handle', handle)
    .single()

  if (existing) {
    return NextResponse.json({ error: `@${handle} 已存在`, id: existing.id }, { status: 409 })
  }

  // Fetch user profile via Twikit
  let user
  try {
    user = await getTwikitUser(handle)
  } catch (e) {
    return NextResponse.json({ error: `无法获取 @${handle} 的资料: ${e instanceof Error ? e.message : 'Unknown'}` }, { status: 502 })
  }

  if (!user?.id) {
    return NextResponse.json({ error: `用户 @${handle} 不存在` }, { status: 404 })
  }

  // Fetch recent tweets for engagement rate
  let engagementRate: number | null = null
  let lastPostAt: string | null = null
  try {
    const tweets = await getTwikitUserTweets(user.id, 10)
    if (tweets.length > 0) {
      const totalEngagement = tweets.reduce((sum, t) => sum + t.favorite_count + t.retweet_count + t.reply_count, 0)
      const avgEngagement = totalEngagement / tweets.length
      const rawRate = (avgEngagement / user.followers_count) * 100
      engagementRate = clampEngagementRate(rawRate, user.followers_count)

      for (const t of tweets) {
        if (t.created_at && (!lastPostAt || new Date(t.created_at) > new Date(lastPostAt))) {
          lastPostAt = t.created_at
        }
      }
    }
  } catch {
    // Engagement data optional, continue without it
  }

  const language = detectLanguage(user.description, user.name)
  const tier = computeTier(user.followers_count, engagementRate)

  const { data, error } = await supabase
    .from('kols')
    .insert({
      x_handle: handle,
      display_name: user.name,
      avatar_url: user.profile_image_url?.replace('_normal', '_400x400') ?? null,
      bio: user.description ?? null,
      followers_count: user.followers_count,
      following_count: user.following_count,
      posts_count: user.statuses_count,
      language,
      tier,
      avg_engagement_rate: engagementRate,
      last_post_at: lastPostAt,
      status: 'pending',
      status_flag: 'none',
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
