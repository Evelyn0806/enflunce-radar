import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const BEARER = process.env.TWITTER_BEARER_TOKEN!

function xHeaders() {
  return { Authorization: `Bearer ${BEARER}` }
}

async function fetchUserTweets(userId: string) {
  const params = new URLSearchParams({
    max_results: '10',
    'tweet.fields': 'public_metrics,created_at',
  })

  const res = await fetch(
    `https://api.twitter.com/2/users/${userId}/tweets?${params}`,
    { headers: xHeaders() }
  )

  if (!res.ok) return null
  const json = await res.json()
  return json.data ?? []
}

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

      // Get user ID from X API
      const userRes = await fetch(
        `https://api.twitter.com/2/users/by/username/${kol.x_handle}`,
        { headers: xHeaders() }
      )
      if (!userRes.ok) continue

      const userData = await userRes.json()
      const userId = userData.data?.id
      if (!userId) continue

      // Fetch recent tweets
      const tweets = await fetchUserTweets(userId)
      if (!tweets || tweets.length === 0) continue

      // Calculate avg engagement rate
      let totalEngagement = 0
      let lastPostAt = null

      for (const tweet of tweets) {
        const metrics = tweet.public_metrics
        const engagement = (metrics.like_count + metrics.retweet_count + metrics.reply_count)
        totalEngagement += engagement

        if (!lastPostAt || new Date(tweet.created_at) > new Date(lastPostAt)) {
          lastPostAt = tweet.created_at
        }
      }

      const avgEngagement = totalEngagement / tweets.length
      const engagementRate = (avgEngagement / kol.followers_count) * 100

      // Update database
      await supabase
        .from('kols')
        .update({
          avg_engagement_rate: Math.round(engagementRate * 100) / 100,
          last_post_at: lastPostAt,
        })
        .eq('id', kolId)

      results.push({ id: kolId, success: true })
    } catch (error) {
      results.push({ id: kolId, success: false })
    }
  }

  return NextResponse.json({ results, updated: results.filter(r => r.success).length })
}
