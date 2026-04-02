import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Competitors are stored in a simple table-like approach using kols table notes
// For lightweight storage without schema change, we use a JSON config row
// Better approach: use Supabase 'competitor_list' in a settings-like table
// For now: store as JSON in a simple key-value via the existing schema

// We'll use localStorage on client + a simple API that stores competitors
// as a JSON array in a single row of a generic config approach

// Simplest: store competitor list in memory + sync to a config endpoint

const COMPETITOR_STORE_KEY = 'competitor_list'

// In-memory store (persists across requests in same serverless instance)
let competitorCache: { name: string; handle: string; color: string }[] | null = null

async function loadCompetitors() {
  if (competitorCache) return competitorCache

  // Try loading from Supabase - using a "config" approach via competitor_kol_maps table
  // Or just use a simple approach: check if we have a stored list
  const { data } = await supabase
    .from('competitor_kol_maps')
    .select('competitor')
    .limit(100)

  const names = [...new Set((data ?? []).map((d) => d.competitor).filter(Boolean))]

  // Default competitors if none exist
  if (names.length === 0) {
    competitorCache = [
      { name: 'Polymarket', handle: 'Polymarket', color: '#6366f1' },
      { name: 'Kalshi', handle: 'Kalshi', color: '#dc2626' },
      { name: 'Azuro', handle: 'AzuroProtocol', color: '#2563eb' },
      { name: 'Limitless', handle: 'LimitlessExch', color: '#16a34a' },
      { name: 'Drift', handle: 'DriftProtocol', color: '#f59e0b' },
    ]
    return competitorCache
  }

  const colors = ['#6366f1', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6']
  competitorCache = names.map((name, i) => ({
    name,
    handle: name,
    color: colors[i % colors.length],
  }))
  return competitorCache
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

  const cleanHandle = handle.replace(/^@/, '').trim()
  const colors = ['#6366f1', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6']

  // Add to cache
  const current = await loadCompetitors()
  if (current.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
    return NextResponse.json({ error: '该竞品已存在' }, { status: 409 })
  }

  const newCompetitor = {
    name: name.trim(),
    handle: cleanHandle,
    color: colors[current.length % colors.length],
  }

  competitorCache = [...current, newCompetitor]

  return NextResponse.json(newCompetitor, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { name }: { name: string } = await req.json()
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  const current = await loadCompetitors()
  competitorCache = current.filter((c) => c.name !== name)

  // Also remove affiliations
  await supabase
    .from('competitor_kol_maps')
    .delete()
    .eq('competitor', name)

  return NextResponse.json({ ok: true })
}
