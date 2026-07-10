import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { clampEngagementRate } from '@/lib/utils'
import { getTwikitUser, getTwikitUserTweets } from '@/lib/twikit'
import { fetchXRecentTweetsByHandle, fetchXUserByHandle } from '@/lib/x-api-fallback'
import { CORE_PM_TERMS, countMatches } from '@/lib/discover-profile'

export async function POST(req: NextRequest) {
  const { kol_ids }: { kol_ids: string[] } = await req.json()

  if (!kol_ids || kol_ids.length === 0) {
    return NextResponse.json({ error: '请提供 KOL ID 列表' }, { status: 400 })
  }

  const results = []

  for (const kolId of kol_ids) {
    try {
      // Get KOL info
      const { data: kol } = await supabase
        .from('kols')
        .select('id, x_handle, followers_count')
        .eq('id', kolId)
        .single()

      if (!kol) continue

      let user = null
      try {
        user = await getTwikitUser(kol.x_handle)
      } catch {
        user = await fetchXUserByHandle(kol.x_handle)
      }

      const userId = user?.id
      if (!userId) continue

      // Fetch recent tweets
      let tweets = []
      try {
        tweets = await getTwikitUserTweets(userId, 10)
      } catch {
        tweets = await fetchXRecentTweetsByHandle(kol.x_handle, 10)
      }
      if (!tweets || tweets.length === 0) continue

      // Calculate avg engagement rate + count PM brand hits across recent tweets
      let totalEngagement = 0
      let lastPostAt = null
      let pmTweetSignal = 0
      // Scan the 5 most recent tweets for PM brand mentions → "非专业 PM KOL" classification.
      const recent5 = [...tweets]
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
        .slice(0, 5)
      const seenPmTermTweetCount = recent5.reduce((count, t) => {
        return count + (countMatches(t.text ?? '', CORE_PM_TERMS) > 0 ? 1 : 0)
      }, 0)
      pmTweetSignal = seenPmTermTweetCount

      for (const tweet of tweets) {
        const engagement = tweet.favorite_count + tweet.retweet_count + tweet.reply_count
        totalEngagement += engagement

        if (!lastPostAt || new Date(tweet.created_at ?? 0) > new Date(lastPostAt)) {
          lastPostAt = tweet.created_at
        }
      }

      const avgEngagement = totalEngagement / tweets.length
      const rawRate = (avgEngagement / kol.followers_count) * 100
      const engagementRate = clampEngagementRate(rawRate, kol.followers_count)

      // Update database
      await supabase
        .from('kols')
        .update({
          avg_engagement_rate: engagementRate,
          last_post_at: lastPostAt,
          pm_tweet_signal: pmTweetSignal,
        })
        .eq('id', kolId)

      results.push({ id: kolId, success: true })
    } catch (error) {
      results.push({ id: kolId, success: false })
    }
  }

  return NextResponse.json({ results, updated: results.filter(r => r.success).length })
}
