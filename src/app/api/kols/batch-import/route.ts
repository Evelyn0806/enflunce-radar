import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeTier } from '@/lib/utils'

const BEARER = process.env.TWITTER_BEARER_TOKEN!

function xHeaders() {
  return { Authorization: `Bearer ${BEARER}` }
}

async function fetchUsersByHandles(handles: string[]) {
  if (handles.length === 0) return []

  const usernames = handles.map(h => h.replace('@', '').toLowerCase()).join(',')
  const params = new URLSearchParams({
    usernames,
    'user.fields': 'public_metrics,description,profile_image_url',
  })

  const res = await fetch(
    `https://api.twitter.com/2/users/by?${params}`,
    { headers: xHeaders() }
  )

  if (!res.ok) return []
  const json = await res.json()
  return json.data ?? []
}

export async function POST(req: NextRequest) {
  const { handles }: { handles: string[] } = await req.json()

  if (!handles || handles.length === 0) {
    return NextResponse.json({ error: '请提供 @handle 列表' }, { status: 400 })
  }

  const users = await fetchUsersByHandles(handles)

  const rows = users.map((u: any) => ({
    x_handle: u.username.toLowerCase(),
    display_name: u.name,
    avatar_url: u.profile_image_url?.replace('_normal', '_400x400') ?? null,
    bio: u.description ?? null,
    followers_count: u.public_metrics.followers_count,
    following_count: u.public_metrics.following_count,
    posts_count: u.public_metrics.tweet_count,
    tier: computeTier(u.public_metrics.followers_count, null),
    status: 'pending',
    status_flag: 'none',
    language: 'en',
  }))

  const { data, error } = await supabase
    .from('kols')
    .upsert(rows, { onConflict: 'x_handle' })
    .select('id, x_handle')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ imported: data?.length ?? 0, total: handles.length })
}
