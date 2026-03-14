import { supabase } from '@/lib/supabase'
import KolTable from '@/components/KolTable'
import KolFilters from '@/components/KolFilters'
import AddKolButton from '@/components/AddKolButton'
import RefreshStatsButton from '@/components/RefreshStatsButton'
import Link from 'next/link'
import { Kol, KolStatus, Language, Tier } from '@/types'

interface SearchParams {
  status?: KolStatus
  language?: Language
  tier?: Tier
  flag?: string
  q?: string
  silent?: string
}

export default async function KolsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  let query = supabase
    .from('kols_with_computed')
    .select('*')
    .order('followers_count', { ascending: false })

  if (params.status) query = query.eq('status', params.status)
  if (params.language) query = query.eq('language', params.language)
  if (params.tier) query = query.eq('tier', params.tier)
  if (params.flag && params.flag !== 'none') query = query.eq('status_flag', params.flag)
  if (params.silent === '1') query = query.eq('is_silent', true)
  if (params.q) {
    query = query.or(
      `x_handle.ilike.%${params.q}%,display_name.ilike.%${params.q}%,bio.ilike.%${params.q}%`
    )
  }

  const { data: kols, error } = await query
  if (error) console.error(error)

  const list = (kols ?? []) as Kol[]

  // Summary stats
  const total = list.length
  const active = list.filter((k) => k.status === 'active').length
  const tierA = list.filter((k) => k.computed_tier === 'A' || k.tier === 'A').length
  const rapidGrowth = list.filter((k) => k.followers_count >= 10000).slice(0, 5).length

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>KOL 名录</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            共 {total} 位 KOL / KOC
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <RefreshStatsButton kolIds={list.map(k => k.id)} />
          <Link href="/kols/batch-import" className="btn btn-secondary">
            📥 批量导入
          </Link>
          <AddKolButton />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: '总计', value: total, sub: 'KOL / KOC' },
          { label: '合作中', value: active, sub: 'Active' },
          { label: 'Tier A', value: tierA, sub: '高价值' },
          { label: '近期活跃', value: rapidGrowth, sub: '7天数据增长' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label} · {s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <KolFilters params={params} />

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <KolTable kols={list} />
      </div>
    </div>
  )
}
