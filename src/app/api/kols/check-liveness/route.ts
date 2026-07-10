import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTwikitUser } from '@/lib/twikit'
import { fetchXUserByHandle } from '@/lib/x-api-fallback'

// Classify a fetch error into "user is gone" vs "transient issue we can't tell".
// Only the first case is safe to mark as is_dead=true.
function isUserGoneError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('user not found') ||
    msg.includes('does not exist') ||
    msg.includes('has been suspended') ||
    msg.includes('suspended') ||
    msg.includes('account has been deleted') ||
    msg.includes('deleted') ||
    msg.includes('404') ||
    msg.includes('no such user')
  )
}

function isTransientError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('ec') // ECONNRESET / ETIMEDOUT
  )
}

interface KolRow {
  id: string
  x_handle: string
}

interface PerResult {
  id: string
  handle: string
  status: 'alive' | 'dead' | 'unknown'
  followers_count?: number
  error?: string
}

const REQUEST_DELAY_MS = 1200

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export async function POST(req: NextRequest) {
  const { kol_ids }: { kol_ids: string[] } = await req.json()
  if (!Array.isArray(kol_ids) || kol_ids.length === 0) {
    return NextResponse.json({ error: '请提供 KOL ID 列表' }, { status: 400 })
  }

  const { data: kols, error: fetchErr } = await supabase
    .from('kols')
    .select('id, x_handle')
    .in('id', kol_ids)
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  const results: PerResult[] = []
  const now = new Date().toISOString()

  for (const k of (kols ?? []) as KolRow[]) {
    let status: 'alive' | 'dead' | 'unknown' = 'unknown'
    let followers: number | undefined
    let errMsg: string | undefined

    // Try twikit first (matches the app's other flows).
    try {
      const user = await getTwikitUser(k.x_handle)
      if (user?.id) {
        status = 'alive'
        followers = user.followers_count
      }
    } catch (e) {
      if (isUserGoneError(e)) {
        status = 'dead'
        errMsg = e instanceof Error ? e.message : String(e)
      } else if (!isTransientError(e)) {
        // Fall back to X API v2 for confirmation.
        try {
          const user = await fetchXUserByHandle(k.x_handle)
          if (user) {
            status = 'alive'
            followers = user.followers_count
          } else {
            status = 'dead'
          }
        } catch (e2) {
          if (isUserGoneError(e2)) status = 'dead'
          errMsg = e2 instanceof Error ? e2.message : String(e2)
        }
      } else {
        errMsg = e instanceof Error ? e.message : String(e)
      }
    }

    // Persist based on classification (never overwrite with 'unknown').
    if (status === 'alive') {
      await supabase.from('kols').update({
        is_dead: false,
        last_alive_check_at: now,
        ...(followers != null ? { followers_count: followers } : {}),
      }).eq('id', k.id)
    } else if (status === 'dead') {
      await supabase.from('kols').update({
        is_dead: true,
        last_alive_check_at: now,
      }).eq('id', k.id)
    }

    results.push({ id: k.id, handle: k.x_handle, status, followers_count: followers, error: errMsg })

    await delay(REQUEST_DELAY_MS)
  }

  const summary = {
    total: results.length,
    alive: results.filter((r) => r.status === 'alive').length,
    dead: results.filter((r) => r.status === 'dead').length,
    unknown: results.filter((r) => r.status === 'unknown').length,
  }
  return NextResponse.json({ ...summary, results })
}
