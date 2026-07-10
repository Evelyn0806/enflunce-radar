import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { computeTier, detectLanguage } from '@/lib/utils'
import { getTwikitUser, TwikitUser } from '@/lib/twikit'
import { fetchXUsersByHandles } from '@/lib/x-api-fallback'
import { CORE_PM_TERMS, PM_AIRDROP_TERMS, countMatches } from '@/lib/discover-profile'

async function fetchUsersByHandles(handles: string[]) {
  const users = await Promise.all(
    handles.map(async (handle) => {
      try {
        return await getTwikitUser(handle)
      } catch {
        return null
      }
    })
  )

  const twikitUsers = users.filter((user): user is TwikitUser => Boolean(user))
  if (twikitUsers.length === handles.length) return twikitUsers

  const missingHandles = handles.filter((handle) => !twikitUsers.some((user) => user.screen_name.toLowerCase() === handle.replace(/^@/, '').toLowerCase()))
  const fallbackUsers = await fetchXUsersByHandles(missingHandles)
  return [...twikitUsers, ...fallbackUsers]
}

export async function POST(req: NextRequest) {
  const { handles }: { handles: string[] } = await req.json()

  if (!handles || handles.length === 0) {
    return NextResponse.json({ error: '请提供 @handle 列表' }, { status: 400 })
  }

  const users = await fetchUsersByHandles(handles)

  const rows = users.map((u) => {
    const scoringText = `${u.name ?? ''}\n${u.description ?? ''}`
    return {
      x_handle: u.screen_name.toLowerCase(),
      display_name: u.name,
      avatar_url: u.profile_image_url?.replace('_normal', '_400x400') ?? null,
      bio: u.description ?? null,
      followers_count: u.followers_count,
      following_count: u.following_count,
      posts_count: u.statuses_count,
      tier: computeTier(u.followers_count, null),
      status: 'pending',
      status_flag: 'none',
      language: detectLanguage(u.description ?? null, u.name),
      pm_brand_signal: countMatches(scoringText, CORE_PM_TERMS),
      airdrop_signal: countMatches(scoringText, PM_AIRDROP_TERMS),
    }
  })

  const { data, error } = await supabase
    .from('kols')
    .upsert(rows, { onConflict: 'x_handle' })
    .select('id, x_handle')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ imported: data?.length ?? 0, total: handles.length })
}
