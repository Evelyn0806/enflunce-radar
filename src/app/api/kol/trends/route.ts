import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTwikitUserTweets, TwikitTweet } from '@/lib/twikit'

interface KolTrend {
  kol_id: string
  x_handle: string
  display_name: string | null
  avatar_url: string | null
  tier: string
  followers_count: number
  tweets: {
    id: string
    text: string
    created_at: string | null
    favorite_count: number
    retweet_count: number
    reply_count: number
    view_count: number | string
  }[]
  tweet_count: number
  total_engagement: number
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
const DELAY_MS = 1000

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isWithin24h(dateStr: string | null): boolean {
  if (!dateStr) return false
  return Date.now() - new Date(dateStr).getTime() < TWENTY_FOUR_HOURS
}

function tweetToJson(t: TwikitTweet) {
  return {
    id: t.id,
    text: t.text,
    created_at: t.created_at,
    favorite_count: t.favorite_count,
    retweet_count: t.retweet_count,
    reply_count: t.reply_count,
    view_count: t.view_count,
  }
}

export async function GET() {
  // Get all KOLs that have a twitter_id-like identifier (we use x_handle to look up)
  const { data: kols, error } = await supabase
    .from('kols_with_computed')
    .select('id, x_handle, display_name, avatar_url, tier, followers_count')
    .order('followers_count', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!kols || kols.length === 0) {
    return NextResponse.json({ trends: [], total_kols: 0, message: '无 KOL 数据' })
  }

  const trends: KolTrend[] = []
  let fetchedCount = 0
  let errorCount = 0

  for (const kol of kols) {
    try {
      // We need user_id for getTwikitUserTweets, but we only have handle
      // getTwikitUserTweets needs twitter_id; fetch user first to get id
      const { getTwikitUser } = await import('@/lib/twikit')
      const user = await getTwikitUser(kol.x_handle)
      if (!user?.id) continue

      await delay(DELAY_MS)

      const allTweets = await getTwikitUserTweets(user.id, 20)
      const recentTweets = allTweets.filter((t) => isWithin24h(t.created_at))

      const totalEngagement = recentTweets.reduce(
        (sum, t) => sum + t.favorite_count + t.retweet_count + t.reply_count, 0
      )

      trends.push({
        kol_id: kol.id,
        x_handle: kol.x_handle,
        display_name: kol.display_name,
        avatar_url: kol.avatar_url,
        tier: kol.tier,
        followers_count: kol.followers_count,
        tweets: recentTweets.map(tweetToJson),
        tweet_count: recentTweets.length,
        total_engagement: totalEngagement,
      })

      fetchedCount++
      await delay(DELAY_MS)
    } catch {
      errorCount++
    }
  }

  // Sort by total engagement descending
  trends.sort((a, b) => b.total_engagement - a.total_engagement)

  return NextResponse.json({
    trends,
    total_kols: kols.length,
    fetched: fetchedCount,
    errors: errorCount,
    period: '24h',
  })
}
