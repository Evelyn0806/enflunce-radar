import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTwikitUser, getTwikitUserTweets } from '@/lib/twikit'

// Vercel serverless has 10s timeout. We scan a small batch per call.
// Frontend can call multiple times to scan more KOLs.

const BATCH_SIZE = 5

function isAffiliated(tweetText: string, competitorHandle: string): { affiliated: boolean; reason: string } {
  const lower = tweetText.toLowerCase()
  const handleLower = competitorHandle.toLowerCase()

  const paidPatterns = ['paid partnership', 'paid promo', '#ad ', '#sponsored', 'sponsored by', 'in partnership with', 'promoted by']
  for (const p of paidPatterns) {
    if (lower.includes(p) && lower.includes(handleLower)) {
      return { affiliated: true, reason: 'Paid partnership' }
    }
  }

  if (new RegExp(`@${handleLower}\\b`, 'i').test(tweetText)) {
    return { affiliated: true, reason: `提及 @${competitorHandle}` }
  }

  // Also check if tweet mentions competitor name (not just handle)
  if (lower.includes(handleLower)) {
    return { affiliated: true, reason: `提及 ${competitorHandle}` }
  }

  return { affiliated: false, reason: '' }
}

export async function POST(req: NextRequest) {
  const { competitor_name, competitor_handle, offset = 0 }: {
    competitor_name: string
    competitor_handle: string
    offset?: number
  } = await req.json()

  if (!competitor_name || !competitor_handle) {
    return NextResponse.json({ error: '请提供竞品名称和 handle' }, { status: 400 })
  }

  const { data: kols } = await supabase
    .from('kols')
    .select('id, x_handle, display_name, followers_count')
    .not('x_handle', 'like', '__competitor__%')
    .order('followers_count', { ascending: false })
    .range(offset, offset + BATCH_SIZE - 1)

  if (!kols || kols.length === 0) {
    return NextResponse.json({ scanned: 0, affiliated: [], done: true })
  }

  const affiliated: { kol_id: string; x_handle: string; display_name: string | null; reason: string; tweet_text: string }[] = []
  let scanned = 0

  for (const kol of kols) {
    try {
      const user = await getTwikitUser(kol.x_handle)
      if (!user?.id) continue

      const tweets = await getTwikitUserTweets(user.id, 10)
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
          break
        }
      }
    } catch {
      // Skip on error
    }
  }

  return NextResponse.json({
    scanned,
    affiliated,
    affiliated_count: affiliated.length,
    offset,
    next_offset: offset + BATCH_SIZE,
    done: kols.length < BATCH_SIZE,
  })
}
