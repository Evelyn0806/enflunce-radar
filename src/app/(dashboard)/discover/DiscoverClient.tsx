'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DiscoveryResult } from '@/app/api/discover/route'
import { formatNumber } from '@/lib/utils'
import { Language, StatusFlag, KolStatus } from '@/types'

const FLAG_OPTIONS: { value: StatusFlag; icon: string; label: string; status: KolStatus }[] = [
  { value: 'none',   icon: '—',  label: '待处理',  status: 'pending' },
  { value: 'star',   icon: '⭐', label: '观望',    status: 'watching' },
  { value: 'urgent', icon: '❗', label: '尽快接触', status: 'negotiating' },
  { value: 'stop',   icon: '🚫', label: '不合作',  status: 'terminated' },
]

const LANG_OPTIONS: { value: Language; label: string }[] = [
  { value: 'zh', label: '🇨🇳 中文' },
  { value: 'en', label: '🇺🇸 EN' },
  { value: 'ko', label: '🇰🇷 KO' },
  { value: 'tr', label: '🇹🇷 TR' },
  { value: 'vi', label: '🇻🇳 VI' },
  { value: 'bilingual', label: '🌐 双语' },
]

interface RowState {
  selected: boolean
  flag: StatusFlag
  language: Language
}

function scoreColor(score: number): string {
  if (score >= 70) return '#16a34a'
  if (score >= 50) return '#6366f1'
  return '#f59e0b'
}

export default function DiscoverClient() {
  const router = useRouter()
  const [keywords, setKeywords] = useState<string[]>([])
  const [kwInput, setKwInput] = useState('')
  const [minFollowers, setMinFollowers] = useState(5000)
  const [timeRange, setTimeRange] = useState(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<DiscoveryResult[]>([])
  const [rowState, setRowState] = useState<Map<string, RowState>>(new Map())
  const [importing, setImporting] = useState(false)
  const [rejectedHandles, setRejectedHandles] = useState<Set<string>>(new Set())

  // Load rejected handles on mount
  useState(() => {
    fetch('/api/kols/feedback').then((r) => r.json()).then((d) => {
      setRejectedHandles(new Set(d.rejected ?? []))
    }).catch(() => {})
  })

  async function rejectCard(r: DiscoveryResult) {
    setResults((prev) => prev.filter((item) => item.twitter_id !== r.twitter_id))
    setRejectedHandles((prev) => new Set([...prev, r.x_handle]))
    await fetch('/api/kols/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x_handle: r.x_handle, bio: r.bio, followers_count: r.followers_count, signal: 'negative' }),
    })
  }

  async function search() {
    if (keywords.length === 0) return
    setLoading(true)
    setError('')
    setResults([])

    const res = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords, min_followers: minFollowers, time_range: timeRange }),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? '搜索失败')
    } else {
      setError(json.warning ?? '')
      const filtered = (json.results ?? []).filter((r: DiscoveryResult) => !rejectedHandles.has(r.x_handle))
      setResults(filtered)
      const map = new Map<string, RowState>()
      for (const r of filtered) {
        map.set(r.twitter_id, { selected: false, flag: 'none', language: r.language ?? 'en' })
      }
      setRowState(map)
    }
    setLoading(false)
  }

  function updateRow(id: string, patch: Partial<RowState>) {
    setRowState((prev) => {
      const next = new Map(prev)
      next.set(id, { ...next.get(id)!, ...patch })
      return next
    })
  }

  function toggleAll(selected: boolean) {
    setRowState((prev) => {
      const next = new Map(prev)
      for (const [k, v] of next) next.set(k, { ...v, selected })
      return next
    })
  }

  async function importSelected() {
    const selected = results
      .filter((r) => rowState.get(r.twitter_id)?.selected)
      .map((r) => {
        const rs = rowState.get(r.twitter_id)!
        const flagOpt = FLAG_OPTIONS.find((f) => f.value === rs.flag)!
        return {
          x_handle: r.x_handle,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
          bio: r.bio,
          followers_count: r.followers_count,
          following_count: r.following_count,
          posts_count: r.posts_count,
          language: rs.language,
          status_flag: rs.flag,
          status: flagOpt.status,
        }
      })

    if (selected.length === 0) return

    setImporting(true)
    const res = await fetch('/api/kols/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kols: selected }),
    })

    const json = await res.json()
    if (res.ok) {
      router.push('/kols')
    } else {
      setError(json.error ?? '导入失败')
      setImporting(false)
    }
  }

  const selectedCount = [...rowState.values()].filter((r) => r.selected).length

  function addKeyword() {
    const kw = kwInput.trim()
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw])
    }
    setKwInput('')
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>KOL 发现</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          输入关键词，AI 画像评分过滤项目方，精准锁定 KOL / KOC
        </p>
      </div>

      {/* Search Panel */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 8 }}>
            关键词（至少一个）
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {keywords.map((kw) => (
              <span key={kw} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#ffffff',
                borderRadius: 20, fontSize: 12,
              }}>
                {kw}
                <button
                  onClick={() => setKeywords(keywords.filter((k) => k !== kw))}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
                >×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              style={{ maxWidth: 240 }}
              placeholder="输入关键词，回车添加"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
            />
            <button className="btn btn-secondary" onClick={addKeyword}>+ 添加</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>时间范围</label>
            <select className="select" value={timeRange} onChange={(e) => setTimeRange(Number(e.target.value))}>
              <option value={30}>近1个月</option>
              <option value={60}>近2个月</option>
              <option value={90}>近3个月</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>最低粉丝数</label>
            <select className="select" value={minFollowers} onChange={(e) => setMinFollowers(Number(e.target.value))}>
              <option value={1000}>1,000+</option>
              <option value={5000}>5,000+</option>
              <option value={10000}>10,000+</option>
              <option value={50000}>50,000+</option>
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={search}
            disabled={loading || keywords.length === 0}
            style={{ alignSelf: 'flex-end' }}
          >
            {loading ? '搜索中...' : '🔍 搜索 KOL'}
          </button>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 6 }}>
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          {/* Actions bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
            padding: '10px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
          }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              找到 <strong style={{ color: '#0f172a' }}>{results.length}</strong> 位 KOL
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {selectedCount > 0 && (
                <span style={{ fontSize: 12, color: '#64748b' }}>已选 {selectedCount} 位</span>
              )}
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '5px 10px' }}
                onClick={() => toggleAll(selectedCount < results.length)}
              >
                {selectedCount === results.length ? '取消全选' : '全选'}
              </button>
              <button
                className="btn btn-primary"
                disabled={selectedCount === 0 || importing}
                onClick={importSelected}
              >
                {importing ? '导入中...' : `导入选中 (${selectedCount})`}
              </button>
            </div>
          </div>

          {/* Card grid */}
          <div className="discover-grid">
            {results.map((r) => {
              const rs = rowState.get(r.twitter_id)!
              const pScore = r.profile_score ?? 50
              return (
                <div
                  key={r.twitter_id}
                  className={`discover-card ${rs.selected ? 'selected' : ''}`}
                  style={{ opacity: r.already_in_db ? 0.55 : 1 }}
                  onClick={() => updateRow(r.twitter_id, { selected: !rs.selected })}
                >
                  {/* Top row: avatar + info */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    {r.avatar_url
                      ? <img src={r.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#94a3b8', flexShrink: 0 }}>
                          {r.display_name?.[0]?.toUpperCase()}
                        </div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.display_name}
                        </span>
                        <span className={`badge tier-${r.tier}`} style={{ fontSize: 10 }}>{r.tier}</span>
                        {r.already_in_db && <span style={{ fontSize: 9, color: '#94a3b8', background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>已入库</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>@{r.x_handle}</span>
                        <a href={r.profile_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 11 }}>
                          X ↗
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  {r.bio && (
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {r.bio}
                    </div>
                  )}

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12 }}>
                    <div>
                      <span style={{ color: '#94a3b8' }}>粉丝 </span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatNumber(r.followers_count)}</span>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>相关度 </span>
                      <span style={{ fontWeight: 600, color: '#6366f1' }}>{r.relevance_score}</span>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>互动 </span>
                      <span style={{ fontWeight: 600, color: r.avg_engagement >= 100 ? '#16a34a' : '#64748b' }}>{formatNumber(r.avg_engagement)}</span>
                    </div>
                    {r.has_private_community && (
                      <span className="community-icon">社群 {r.community_links.length > 0 && `(${r.community_links.length})`}</span>
                    )}
                  </div>

                  {/* Profile score bar */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: '#94a3b8' }}>画像评分</span>
                      <span style={{ fontWeight: 600, color: scoreColor(pScore) }}>{pScore}</span>
                    </div>
                    <div className="score-bar">
                      <div className="score-bar-fill" style={{ width: `${pScore}%`, background: scoreColor(pScore) }} />
                    </div>
                  </div>

                  {/* Bottom controls */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      title="排除此 KOL（不符合画像）"
                      onClick={() => rejectCard(r)}
                      style={{
                        width: 26, height: 26, borderRadius: 6,
                        border: '1px solid #fecaca', background: '#fef2f2',
                        cursor: 'pointer', fontSize: 12, color: '#dc2626',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      ✕
                    </button>
                    <select
                      className="select"
                      style={{ fontSize: 11, padding: '3px 24px 3px 6px', minWidth: 70 }}
                      value={rs.language}
                      onChange={(e) => updateRow(r.twitter_id, { language: e.target.value as Language })}
                    >
                      {LANG_OPTIONS.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {FLAG_OPTIONS.map((f) => (
                        <button
                          key={f.value}
                          title={f.label}
                          onClick={() => updateRow(r.twitter_id, { flag: f.value, selected: true })}
                          style={{
                            width: 26, height: 26,
                            borderRadius: 6,
                            border: rs.flag === f.value ? '2px solid #6366f1' : '1px solid #e2e8f0',
                            background: rs.flag === f.value ? '#eef2ff' : 'transparent',
                            cursor: 'pointer',
                            fontSize: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {f.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>🔍</div>
          <div style={{ fontSize: 14 }}>输入关键词开始发现 KOL</div>
          <div style={{ fontSize: 12, marginTop: 6, color: '#cbd5e1' }}>支持多关键词组合 · AI 画像评分自动过滤项目方</div>
        </div>
      )}
    </div>
  )
}
