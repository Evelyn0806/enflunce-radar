import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTwikitUser, getTwikitUserTweets } from '@/lib/twikit'

const DELAY_MS = 1500

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Detect if a tweet is a paid partnership or mentions the competitor handle
function isAffiliated(tweetText: string, competitorHandle: string): { affiliated: boolean; reason: string } {
  const lower = tweetText.toLowerCase()
  const handleLower = competitorHandle.toLowerCase()

  // Check for "Paid partnership" / "paid promo" / "ad" / "sponsored" labels
  const paidPatterns = ['paid partnership', 'paid promo', '#ad ', '#sponsored', 'sponsored by', 'in partnership with', 'promoted by']
  for (const p of paidPatterns) {
    if (lower.includes(p) && lower.includes(handleLower)) {
      return { affiliated: true, reason: 'Paid partnership' }
    }
  }

  // Check for @mention of competitor handle in tweet
  const mentionPattern = new RegExp(`@${handleLower}\\b`, 'i')
  if (mentionPattern.test(tweetText)) {
    return { affiliated: true, reason: `提及 @${competitorHandle}` }
  }

  return { affiliated: false, reason: '' }
}

export async function POST(req: NextRequest) {
  const { competitor_name, competitor_handle }: { competitor_name: string; competitor_handle: string } = await req.json()

  if (!competitor_name || !competitor_handle) {
    return NextResponse.json({ error: '请提供竞品名称和 handle' }, { status: 400 })
  }

  // Get all KOLs from directory
  const { data: kols } = await supabase
    .from('kols')
    .select('id, x_handle, display_name, followers_count')
    .order('followers_count', { ascending: false })
    .limit(50) // Scan top 50 by followers

  if (!kols || kols.length === 0) {
    return NextResponse.json({ scanned: 0, affiliated: [] })
  }

  const affiliated: { kol_id: string; x_handle: string; display_name: string | null; reason: string; tweet_text: string }[] = []
  let scanned = 0

  for (const kol of kols) {
    try {
      // Get twitter user id
      const user = await getTwikitUser(kol.x_handle)
      if (!user?.id) continue
      await delay(DELAY_MS)

      // Get recent tweets
      const tweets = await getTwikitUserTweets(user.id, 15)
      scanned++

      for (const tweet of tweets) {
        const check = isAffiliated(tweet.text, competitor_handle)
        if (check.affiliated) {
          affiliated.push({
            kol_id: kol.id,
            x_handle: kol.x_handle,
            display_name: kol.display_name,
            reason: check.reason,
            tweet_text: tweet.text.substring(0, 200),
          })

          // Update kols.competitor_affiliations
          const { data: currentKol } = await supabase
            .from('kols')
            .select('competitor_affiliations')
            .eq('id', kol.id)
            .single()

          const current = currentKol?.competitor_affiliations ?? []
          if (!current.includes(competitor_name)) {
            await supabase.from('kols').update({
              competitor_affiliations: [...current, competitor_name],
            }).eq('id', kol.id)
          }

          break // One affiliated tweet per KOL is enough
        }
      }

      await delay(DELAY_MS)
    } catch {
      // Skip KOL on error
    }
  }

  return NextResponse.json({
    scanned,
    total_kols: kols.length,
    affiliated,
    affiliated_count: affiliated.length,
  })
}
