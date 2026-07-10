import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Aliveness detection via X.com public HTML.
//   Live account : <title>Name (@handle) / X</title>
//   Dead account : <title>Profile / X</title>   (X's generic placeholder)
// This works without any API auth and doesn't depend on the (currently disconnected) twikit bridge.

interface KolRow {
  id: string
  x_handle: string
}

interface PerResult {
  id: string
  handle: string
  status: 'alive' | 'dead' | 'unknown'
  error?: string
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const REQUEST_DELAY_MS = 800
const FETCH_TIMEOUT_MS = 12_000

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

async function probeXProfile(handle: string): Promise<{ status: 'alive' | 'dead' | 'unknown'; err?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`https://twitter.com/${handle}`, {
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
      signal: controller.signal,
    })
    if (res.status >= 500 || res.status === 429) {
      return { status: 'unknown', err: `HTTP ${res.status}` }
    }
    const html = await res.text()
    // Live profiles: title is "Name (@handle) / X"
    if (/<title>[^<]*\(@[\w-]+\)[^<]*<\/title>/i.test(html)) return { status: 'alive' }
    // Dead profiles: X shows a generic placeholder title.
    if (/<title>Profile\s*\/\s*X<\/title>|<title>X<\/title>|<meta property="og:title" content="X"\s*\/?>/i.test(html)) {
      return { status: 'dead' }
    }
    // Suspended/temporary redirect variants.
    if (/account (has been )?suspended|this account doesn.?t exist|user is not authorized/i.test(html)) {
      return { status: 'dead' }
    }
    return { status: 'unknown', err: 'ambiguous html' }
  } catch (e) {
    return { status: 'unknown', err: e instanceof Error ? e.message : String(e) }
  } finally {
    clearTimeout(timer)
  }
}

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
    const { status, err } = await probeXProfile(k.x_handle)

    if (status === 'alive') {
      await supabase.from('kols').update({ is_dead: false, last_alive_check_at: now }).eq('id', k.id)
    } else if (status === 'dead') {
      await supabase.from('kols').update({ is_dead: true, last_alive_check_at: now }).eq('id', k.id)
    }
    // status='unknown' → don't overwrite is_dead; will be retried next run.

    results.push({ id: k.id, handle: k.x_handle, status, error: err })
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
