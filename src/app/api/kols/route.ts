import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeTier, isSilent } from '@/lib/utils'
import { Language } from '@/types'

// ============================================================
// X API v2 helper — fetches public user fields
// Requires: TWITTER_BEARER_TOKEN in env
// ============================================================
async function fetchXProfile(handle: string) {
  const token = process.env.TWITTER_BEARER_TOKEN
  if (!token) return null

  const url = `https://api.twitter.com/2/users/by/username/${handle}?user.fields=public_metrics,description,profile_image_url,created_at`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  })

  if (!res.ok) return null
  const json = await res.json()
  const u = json.data
  if (!u) return null

  return {
    display_name: u.name as string,
    avatar_url: (u.profile_image_url as string)?.replace('_normal', '_400x400'),
    bio: u.description as string,
    followers_count: u.public_metrics.followers_count as number,
    following_count: u.public_metrics.following_count as number,
    posts_count: u.public_metrics.tweet_count as number,
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

  const { data, error } = await supabase
    .from('kols')
    .insert({
      x_handle: x_handle.toLowerCase(),
      language,
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
