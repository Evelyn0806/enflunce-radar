import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeTier, detectLanguage } from '@/lib/utils'
import { getTwikitUser } from '@/lib/twikit'
import { fetchXUserByHandle } from '@/lib/x-api-fallback'
import { Language } from '@/types'

async function fetchXProfile(handle: string) {
  try {
    const u = await getTwikitUser(handle)
    return {
      display_name: u.name,
      avatar_url: u.profile_image_url?.replace('_normal', '_400x400') ?? null,
      bio: u.description,
      followers_count: u.followers_count,
      following_count: u.following_count,
      posts_count: u.statuses_count,
    }
  } catch {
    const u = await fetchXUserByHandle(handle)
    if (!u) return null
    return {
      display_name: u.name,
      avatar_url: u.profile_image_url?.replace('_normal', '_400x400') ?? null,
      bio: u.description,
      followers_count: u.followers_count,
      following_count: u.following_count,
      posts_count: u.statuses_count,
    }
  }
}

// ============================================================
// POST /api/kols — add a new KOL
// ============================================================
export async function POST(req: NextRequest) {
  const { x_handle, language }: { x_handle: string; language: Language } = await req.json()

  if (!x_handle) {
    return NextResponse.json({ error: '请填写 X handle' }, { status: 400 })
  }

  // Check duplicate
  const { data: existing } = await supabase
    .from('kols')
    .select('id')
    .eq('x_handle', x_handle.toLowerCase())
    .single()

  if (existing) {
    return NextResponse.json({ error: '该 KOL 已存在' }, { status: 409 })
  }

  // Try to fetch X profile
  const xData = await fetchXProfile(x_handle)

  const tier = xData
    ? computeTier(xData.followers_count, null)
    : 'C'

  const resolvedLanguage = language || (xData ? detectLanguage(xData.bio, xData.display_name) : 'en')

  const { data, error } = await supabase
    .from('kols')
    .insert({
      x_handle: x_handle.toLowerCase(),
      language: resolvedLanguage,
      tier,
      ...(xData ?? {}),
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}

// ============================================================
// GET /api/kols — list kols (used by CSV import)
// ============================================================
export async function GET() {
  const { data, error } = await supabase
    .from('kols_with_computed')
    .select('*')
    .order('followers_count', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
