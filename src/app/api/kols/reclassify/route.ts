import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { classifyProfile, isTrack } from '@/lib/tracks'

// One-shot backfill: recompute 赛道 + account type for every KOL from its stored bio/name.
// No X calls. Existing tracks (e.g. ones only seen in tweets during refresh-stats) are kept.
export async function POST() {
  const { data: kols, error } = await supabase
    .from('kols')
    .select('id, x_handle, display_name, bio, tracks')
    .not('x_handle', 'like', '__competitor__%')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!kols || kols.length === 0) {
    return NextResponse.json({ message: '无 KOL 数据', updated: 0 })
  }

  const trackCounts: Record<string, number> = {}
  let brand = 0
  let updated = 0
  for (const kol of kols) {
    const classification = classifyProfile(kol.x_handle, kol.display_name, kol.bio)
    const tracks = [...new Set([...((kol.tracks ?? []) as string[]).filter(isTrack), ...classification.tracks])]

    const { error: updateError } = await supabase
      .from('kols')
      .update({ tracks, account_type: classification.account_type })
      .eq('id', kol.id)
    if (updateError) continue

    updated++
    if (classification.account_type === 'brand') brand++
    for (const t of tracks) trackCounts[t] = (trackCounts[t] ?? 0) + 1
  }

  return NextResponse.json({ updated, total: kols.length, brand, tracks: trackCounts })
}
