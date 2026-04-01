import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const BATCH_LIMIT = 10

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API Key 未配置' }, { status: 500 })
  }

  // Find KOLs that haven't been analyzed yet
  const { data: kols, error } = await supabase
    .from('kols_with_computed')
    .select('id')
    .is('role_analyzed_at', null)
    .order('followers_count', { ascending: false })
    .limit(BATCH_LIMIT)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!kols || kols.length === 0) {
    return NextResponse.json({ message: '所有 KOL 均已分析', analyzed: 0 })
  }

  const results: { id: string; success: boolean; error?: string }[] = []

  for (const kol of kols) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/kols/${kol.id}/ai-analyze`,
        { method: 'POST' }
      )
      results.push({ id: kol.id, success: res.ok, error: res.ok ? undefined : 'API error' })
    } catch (e) {
      results.push({ id: kol.id, success: false, error: e instanceof Error ? e.message : 'Unknown' })
    }
  }

  return NextResponse.json({
    analyzed: results.filter((r) => r.success).length,
    total: kols.length,
    results,
  })
}
