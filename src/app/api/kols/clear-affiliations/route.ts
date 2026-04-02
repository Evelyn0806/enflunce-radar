import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// One-time cleanup: remove all old competitor_affiliations
export async function POST() {
  const { data: kols } = await supabase
    .from('kols')
    .select('id')
    .not('competitor_affiliations', 'is', null)

  if (!kols || kols.length === 0) {
    return NextResponse.json({ cleared: 0 })
  }

  for (const kol of kols) {
    await supabase.from('kols').update({ competitor_affiliations: null }).eq('id', kol.id)
  }

  return NextResponse.json({ cleared: kols.length })
}
