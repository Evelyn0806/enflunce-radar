import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Competitors stored in kols table with x_handle prefix "__competitor__"
// This is a lightweight approach that doesn't require a new table.
// Fields used: x_handle = "__competitor__<name>", display_name = name, bio = handle, notes = color

interface Competitor {
  name: string
  handle: string
  color: string
}

const PREFIX = '__competitor__'
const COLORS = ['#6366f1', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6']

async function loadCompetitors(): Promise<Competitor[]> {
  const { data } = await supabase
    .from('kols')
    .select('display_name, bio, notes')
    .like('x_handle', `${PREFIX}%`)
    .order('created_at', { ascending: true })

  if (!data) return []

  return data.map((row, i) => ({
    name: row.display_name ?? '',
    handle: row.bio ?? '',
    color: row.notes ?? COLORS[i % COLORS.length],
  })).filter((c) => c.name && c.handle)
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
  const { data: existing } = await supabase
    .from('kols')
    .select('id')
    .eq('x_handle', `${PREFIX}${cleanName.toLowerCase()}`)
    .single()

  if (existing) {
    return NextResponse.json({ error: '该竞品已存在' }, { status: 409 })
  }

  const current = await loadCompetitors()
  const color = COLORS[current.length % COLORS.length]

  const { error } = await supabase.from('kols').insert({
    x_handle: `${PREFIX}${cleanName.toLowerCase()}`,
    display_name: cleanName,
    bio: cleanHandle,
    notes: color,
    followers_count: 0,
    following_count: 0,
    posts_count: 0,
    language: 'en',
    tier: 'C',
    status: 'terminated',
    status_flag: 'none',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ name: cleanName, handle: cleanHandle, color }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { name }: { name: string } = await req.json()
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  await supabase
    .from('kols')
    .delete()
    .eq('x_handle', `${PREFIX}${name.toLowerCase()}`)

  return NextResponse.json({ ok: true })
}
