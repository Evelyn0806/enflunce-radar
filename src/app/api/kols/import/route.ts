import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeTier } from '@/lib/utils'
import { Language, StatusFlag, KolStatus } from '@/types'

interface ImportPayload {
  x_handle: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  followers_count: number
  following_count: number
  posts_count: number
  language: Language
  status_flag: StatusFlag
  status: KolStatus
  notes?: string | null
  competitor_affiliations?: string[] | null
}

// POST /api/kols/import — bulk import from discovery results
export async function POST(req: NextRequest) {
  const { kols }: { kols: ImportPayload[] } = await req.json()

  if (!kols || kols.length === 0) {
    return NextResponse.json({ error: '无数据' }, { status: 400 })
  }

  const rows = kols.map((k) => ({
    x_handle: k.x_handle.toLowerCase(),
    display_name: k.display_name,
    avatar_url: k.avatar_url,
    bio: k.bio,
    followers_count: k.followers_count,
    following_count: k.following_count,
    posts_count: k.posts_count,
    language: k.language,
    tier: computeTier(k.followers_count, null),
    status: k.status,
    status_flag: k.status_flag,
    notes: k.notes ?? null,
    competitor_affiliations: k.competitor_affiliations ?? null,
  }))

  const { data, error } = await supabase
    .from('kols')
    .upsert(rows, { onConflict: 'x_handle', ignoreDuplicates: false })
    .select('id, x_handle')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ imported: data?.length ?? 0, data })
}
