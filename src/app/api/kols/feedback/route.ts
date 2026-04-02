import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Feedback signals are stored separately from the KOL directory.
// Negative signals (rejected KOLs) go into a blacklist that:
//   1. Filters them from future search results
//   2. Contributes bio keywords as negative features to profile scoring
// Positive signals = KOLs that get imported into the directory (implicit)
//
// Storage: we use the `competitor_kol_maps` table repurposed, or simpler:
// a dedicated lightweight approach using Supabase.
// Since we can't add tables, we store blacklist as JSON in a notes-based hack.
// Better: use a simple in-memory + Supabase row approach.

// We store rejected handles in a single JSON array in a config-like row.
// Using the health_snapshots table with a sentinel kol_id for storage.

const BLACKLIST_SENTINEL_ID = '00000000-0000-0000-0000-000000000000'

async function loadBlacklist(): Promise<{ x_handle: string; bio: string; followers_count: number }[]> {
  const { data } = await supabase
    .from('health_snapshots')
    .select('*')
    .eq('kol_id', BLACKLIST_SENTINEL_ID)
    .limit(1)
    .single()

  if (data?.engagement_rate === -999) {
    // Our sentinel row
    try {
      return JSON.parse(data.keyword_post_count?.toString() ?? '[]')
    } catch {
      return []
    }
  }
  return []
}

async function saveBlacklist(list: { x_handle: string; bio: string; followers_count: number }[]) {
  // Check if sentinel exists
  const { data } = await supabase
    .from('health_snapshots')
    .select('id')
    .eq('kol_id', BLACKLIST_SENTINEL_ID)
    .limit(1)
    .single()

  const payload = {
    kol_id: BLACKLIST_SENTINEL_ID,
    engagement_rate: -999, // sentinel marker
    keyword_post_count: list.length,
    followers_count: 0,
    posts_count: 0,
  }

  if (data?.id) {
    await supabase.from('health_snapshots').update(payload).eq('id', data.id)
  } else {
    await supabase.from('health_snapshots').insert(payload)
  }
}

// In-memory cache for fast access
let blacklistCache: Set<string> | null = null
let blacklistFull: { x_handle: string; bio: string; followers_count: number }[] | null = null

export async function POST(req: NextRequest) {
  const { x_handle, bio, followers_count, signal }: {
    x_handle: string
    bio: string
    followers_count: number
    signal: 'positive' | 'negative'
  } = await req.json()

  if (!x_handle || !signal) {
    return NextResponse.json({ error: 'Missing x_handle or signal' }, { status: 400 })
  }

  if (signal === 'negative') {
    // Add to blacklist (NOT to kols table)
    const handle = x_handle.toLowerCase()
    if (!blacklistFull) blacklistFull = await loadBlacklist()
    if (!blacklistFull.some((b) => b.x_handle === handle)) {
      blacklistFull.push({ x_handle: handle, bio: bio ?? '', followers_count: followers_count ?? 0 })
      await saveBlacklist(blacklistFull)
    }
    if (!blacklistCache) blacklistCache = new Set(blacklistFull.map((b) => b.x_handle))
    blacklistCache.add(handle)

    // Also remove from kols table if it was accidentally inserted before
    await supabase.from('kols').delete().eq('x_handle', handle).eq('status', 'terminated').eq('status_flag', 'stop')
  }

  return NextResponse.json({ ok: true, signal })
}

export async function GET() {
  if (!blacklistFull) blacklistFull = await loadBlacklist()
  const rejected = blacklistFull.map((b) => b.x_handle)
  return NextResponse.json({ rejected, count: rejected.length })
}
