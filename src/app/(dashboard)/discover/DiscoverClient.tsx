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
  { value: 'en', label: '🇺🇸 English' },
  { value: 'ko', label: '🇰🇷 한국어' },
  { value: 'tr', label: '🇹🇷 Türkçe' },
  { value: 'vi', label: '🇻🇳 Tiếng Việt' },
  { value: 'bilingual', label: '🌐 双语' },
]

interface RowState {
  selected: boolean
  flag: StatusFlag
  language: Language
}

export default function DiscoverClient() {
  const router = useRouter()

  // Search state
  const [keywords, setKeywords] = useState<string[]>([])
  const [kwInput, setKwInput] = useState('')
  const [minFollowers, setMinFollowers] = useState(5000)
  const [timeRange, setTimeRange] = useState(30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Results
  const [results, setResults] = useState<DiscoveryResult[]>([])
  const [rowState, setRowState] = useState<Map<string, RowState>>(new Map())

  // Import state
  const [importing, setImporting] = useState(false)

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
      setResults(json.results ?? [])
      // Init row states with auto-detected language
      const map = new Map<string, RowState>()
      for (const r of json.results ?? []) {
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
          输入关键词，从 X 实时发现相关 KOL，打标后直接进入 CRM
        </p>
      </div>

      {/* Search Panel */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Keywords */}
        <div>
          <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 8 }}>
            关键词（至少一个）
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {keywords.map((kw) => (
              <span key={kw} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', background: '#1e293b', color: '#f1f5f9',
                borderRadius: 20, fontSize: 12,
              }}>
                {kw}
                <button
                  onClick={() => setKeywords(keywords.filter((k) => k !== kw))}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
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

        {/* Filters row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>
              时间范围
            </label>
            <select
              className="select"
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
            >
              <option value={30}>近1个月</option>
              <option value={60}>近2个月</option>
              <option value={90}>近3个月</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>
              最低粉丝数
            </label>
            <select
              className="select"
              value={minFollowers}
              onChange={(e) => setMinFollowers(Number(e.target.value))}
            >
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
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Table header actions */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
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

          {/* Results table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>KOL</th>
                  <th>粉丝数</th>
                  <th>Tier</th>
                  <th>关键词发帖</th>
                  <th>私域</th>
                  <th>语区</th>
                  <th>标识</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const rs = rowState.get(r.twitter_id)!
                  return (
                    <tr key={r.twitter_id} style={{ opacity: r.already_in_db ? 0.5 : 1 }}>
                      {/* Checkbox */}
                      <td>
                        <input
                          type="checkbox"
                          checked={rs.selected}
                          onChange={(e) => updateRow(r.twitter_id, { selected: e.target.checked })}
                        />
                      </td>

                      {/* KOL info */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {r.avatar_url
                            ? <img src={r.avatar_url} alt="" className="avatar" />
                            : <div className="avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#94a3b8' }}>
                                {r.display_name?.[0]?.toUpperCase()}
                              </div>
                          }
                          <div>
                            <div style={{ fontWeight: 500, color: '#0f172a', fontSize: 13 }}>
                              {r.display_name}
                              {r.already_in_db && (
                                <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>已入库</span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>@{r.x_handle}</div>
                            {r.bio && (
                              <div style={{ fontSize: 11, color: '#64748b', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r.bio}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Followers */}
                      <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                        {formatNumber(r.followers_count)}
                      </td>

                      {/* Tier */}
                      <td>
                        <span className={`badge tier-${r.tier}`}>{r.tier}</span>
                      </td>

                      {/* Keyword post count */}
                      <td style={{ fontSize: 13 }}>
                        <span style={{ color: r.keyword_post_count >= 3 ? '#16a34a' : '#64748b' }}>
                          {r.keyword_post_count} 条
                        </span>
                      </td>

                      {/* Private community */}
                      <td style={{ fontSize: 13, textAlign: 'center' }}>
                        {r.has_private_community ? (
                          <span title={r.community_links.join('\n')} style={{ cursor: 'help' }}>
                            ✅ {r.community_links.length > 0 && `(${r.community_links.length})`}
                          </span>
                        ) : (
                          <span style={{ color: '#cbd5e1' }}>—</span>
                        )}
                      </td>

                      {/* Language selector */}
                      <td>
                        <select
                          className="select"
                          style={{ fontSize: 12, padding: '4px 28px 4px 8px' }}
                          value={rs.language}
                          onChange={(e) => updateRow(r.twitter_id, { language: e.target.value as Language })}
                        >
                          {LANG_OPTIONS.map((l) => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                          ))}
                        </select>
                      </td>

                      {/* Flag selector */}
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {FLAG_OPTIONS.map((f) => (
                            <button
                              key={f.value}
                              title={f.label}
                              onClick={() => updateRow(r.twitter_id, { flag: f.value, selected: true })}
                              style={{
                                width: 28, height: 28,
                                borderRadius: 6,
                                border: rs.flag === f.value ? '2px solid #0f172a' : '1px solid #e2e8f0',
                                background: rs.flag === f.value ? '#f1f5f9' : 'transparent',
                                cursor: 'pointer',
                                fontSize: 13,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              {f.icon}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
          <div>输入关键词开始发现 KOL</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>支持多关键词组合，自动按 Tier / 粉丝数排序</div>
        </div>
      )}
    </div>
  )
}
