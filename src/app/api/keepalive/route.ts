import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Supabase free-tier projects are paused after a stretch of no database activity.
// A Vercel Cron (see vercel.json) hits this route daily so the project stays awake.
// If CRON_SECRET is set, Vercel sends it as a Bearer token and we require it.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { count, error } = await supabase
    .from('kols')
    .select('id', { count: 'exact', head: true })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, kols: count, at: new Date().toISOString() })
}
