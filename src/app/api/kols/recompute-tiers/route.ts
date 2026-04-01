import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeTier, clampEngagementRate, detectLanguage } from '@/lib/utils'

export async function POST() {
  const { data: kols, error } = await supabase
    .from('kols')
    .select('id, followers_count, avg_engagement_rate, bio, display_name, language')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!kols || kols.length === 0) {
    return NextResponse.json({ message: '无 KOL 数据', updated: 0 })
  }

  let updated = 0
  for (const kol of kols) {
    const rate = kol.avg_engagement_rate != null
      ? clampEngagementRate(kol.avg_engagement_rate, kol.followers_count)
      : null
    const newTier = computeTier(kol.followers_count, rate)
    const newLang = detectLanguage(kol.bio, kol.display_name)

    const updates: Record<string, unknown> = {}
    if (newTier !== kol.language) updates.tier = newTier
    if (rate !== kol.avg_engagement_rate) updates.avg_engagement_rate = rate
    // Only update language if current is 'en' and detection finds something else
    if (kol.language === 'en' && newLang !== 'en') updates.language = newLang

    updates.tier = newTier

    await supabase.from('kols').update(updates).eq('id', kol.id)
    updated++
  }

  return NextResponse.json({ updated, total: kols.length })
}
