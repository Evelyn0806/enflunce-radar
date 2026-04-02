import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Competitors persisted in Supabase via competitor_kol_maps table.
// Sentinel kol_id = all zeros means "this is a competitor config row, not a KOL affiliation".
// competitor = name, notes = X handle

interface Competitor {
  name: string
  handle: string
  color: string
}

const CONFIG_KOL_ID = '00000000-0000-0000-0000-000000000000'
const COLORS = ['#6366f1', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6']

async function loadCompetitors(): Promise<Competitor[]> {
  const { data } = await supabase
    .from('competitor_kol_maps')
    .select('competitor, notes')
    .eq('kol_id', CONFIG_KOL_ID)
    .order('created_at', { ascending: true })

  if (!data || data.length === 0) return []

  return data.map((row, i) => ({
    name: row.competitor,
    handle: row.notes ?? row.competitor,
    color: COLORS[i % COLORS.length],
  }))
}

export async function GET() {
  const competitors = await loadCompetitors()
  return NextResponse.json({ competitors })
}

export async function POST(req: NextRequest) {
  const { name, handle }: { name: string; handle: string } = await req.json()

  if (!name?.trim() || !handle?.trim()) {
    return NextResponse.json({ error: '请提供竞品名称和 X handle' }, { status: 400 })
  }

  const cleanName = name.trim()
  const cleanHandle = handle.replace(/^@/, '').trim()

  // Check duplicate
  const current = await loadCompetitors()
  if (current.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
    return NextResponse.json({ error: '该竞品已存在' }, { status: 409 })
  }

  // Insert config row
  const { error } = await supabase.from('competitor_kol_maps').insert({
    kol_id: CONFIG_KOL_ID,
    competitor: cleanName,
    notes: cleanHandle,
    detected_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const newCompetitor: Competitor = {
    name: cleanName,
    handle: cleanHandle,
    color: COLORS[current.length % COLORS.length],
  }

  return NextResponse.json(newCompetitor, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { name }: { name: string } = await req.json()
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  // Delete config row
  await supabase
    .from('competitor_kol_maps')
    .delete()
    .eq('kol_id', CONFIG_KOL_ID)
    .eq('competitor', name)

  // Also delete all KOL affiliation rows for this competitor
  await supabase
    .from('competitor_kol_maps')
    .delete()
    .neq('kol_id', CONFIG_KOL_ID)
    .eq('competitor', name)

  return NextResponse.json({ ok: true })
}
