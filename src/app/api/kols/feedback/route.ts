import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Store KOL feedback (positive = imported, negative = rejected)
// Uses a simple JSON column approach - no schema change needed
// Stores in a 'kol_feedback' row in a generic settings-like approach
// We'll use the kols table's notes or a localStorage-synced approach

// For now, store feedback in Supabase using a simple key-value approach
// We'll create a lightweight feedback store

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

  // Store feedback by upserting into a feedback tracking approach
  // We use the existing kols table: if rejected, we mark it so future searches skip it
  // For positive signals, the import itself is the signal (already in DB)
  // For negative signals, we store a lightweight rejection record

  if (signal === 'negative') {
    // Store rejection in a simple approach: insert a minimal record with status 'terminated' and a flag
    const { error } = await supabase
      .from('kols')
      .upsert({
        x_handle: x_handle.toLowerCase(),
        bio: bio ?? null,
        followers_count: followers_count ?? 0,
        following_count: 0,
        posts_count: 0,
        language: 'en',
        tier: 'C',
        status: 'terminated',
        status_flag: 'stop',
        notes: `[auto-rejected] 在发现页被排除`,
      }, { onConflict: 'x_handle', ignoreDuplicates: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, signal })
}

export async function GET() {
  // Return list of rejected handles for filtering in discover
  const { data } = await supabase
    .from('kols')
    .select('x_handle')
    .eq('status_flag', 'stop')
    .eq('status', 'terminated')

  const rejected = new Set((data ?? []).map((k) => k.x_handle))
  return NextResponse.json({ rejected: [...rejected] })
}
