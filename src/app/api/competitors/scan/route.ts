import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTwikitUser, getTwikitUserTweets } from '@/lib/twikit'

// Vercel serverless has 10s timeout. We scan a small batch per call.
// Frontend can call multiple times to scan more KOLs.

const BATCH_SIZE = 5

function isAffiliated(tweetText: string, competitorHandle: string): { affiliated: boolean; reason: string } {
  const lower = tweetText.toLowerCase()
  const handleLower = competitorHandle.toLowerCase()

  // 1. Paid partnership: tweet has paid/sponsored label AND mentions competitor
  const paidPatterns = ['paid partnership', 'paid promo', '#ad ', '#sponsored', 'sponsored by', 'in partnership with', 'promoted by', 'paid by', 'collab with']
  for (const p of paidPatterns) {
    if (lower.includes(p) && (lower.includes(handleLower) || new RegExp(`@${handleLower}\\b`, 'i').test(tweetText))) {
      return { affiliated: true, reason: 'Paid partnership' }
    }
  }

  // 2. @mention of competitor handle (direct tag = likely partnership or promotion)
  if (new RegExp(`@${handleLower}\\b`, 'i').test(tweetText)) {
    return { affiliated: true, reason: `@${competitorHandle}` }
  }

  // Plain text mention without @tag or paid label = NOT affiliated (could be casual discussion)
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

  // Get existing KOL handles for dedup detection
  const { data: existingKols } = await supabase
    .from('kols')
    .select('x_handle')
    .not('x_handle', 'like', '__competitor__%')
  const existingHandles = new Set((existingKols ?? []).map((k) => k.x_handle))

  const { data: kols } = await supabase
    .from('kols')
    .select('id, x_handle, display_name, avatar_url, bio, followers_count, following_count, posts_count, tier, language')
    .not('x_handle', 'like', '__competitor__%')
    .order('followers_count', { ascending: false })
    .range(offset, offset + BATCH_SIZE - 1)

  if (!kols || kols.length === 0) {
    return NextResponse.json({ scanned: 0, affiliated: [], done: true })
  }

  const affiliated: {
    kol_id: string
    x_handle: string
    display_name: string | null
    avatar_url: string | null
    bio: string | null
    followers_count: number
    following_count: number
    posts_count: number
    tier: string
    language: string
    reason: string
    tweet_text: string
    already_in_db: boolean
  }[] = []
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
            avatar_url: kol.avatar_url,
            bio: kol.bio,
            followers_count: kol.followers_count,
            following_count: kol.following_count ?? 0,
            posts_count: kol.posts_count ?? 0,
            tier: kol.tier,
            language: kol.language ?? 'en',
            reason: check.reason,
            tweet_text: tweet.text.substring(0, 200),
            already_in_db: existingHandles.has(kol.x_handle),
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
