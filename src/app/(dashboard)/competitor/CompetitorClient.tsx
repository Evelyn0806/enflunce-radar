'use client'

import { useState, useEffect } from 'react'
import { Kol } from '@/types'
import { formatNumber } from '@/lib/utils'
import Link from 'next/link'

interface Props {
  kols: Pick<Kol, 'id' | 'x_handle' | 'display_name' | 'avatar_url' | 'followers_count' | 'competitor_affiliations'>[]
}

interface Competitor {
  name: string
  handle: string
  color: string
}

interface CompetitorTweet {
  id: string
  text: string
  created_at: string | null
  favorite_count: number
  retweet_count: number
  reply_count: number
}

interface ScanResult {
  kol_id: string
  x_handle: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  followers_count: number
  following_count: number
  posts_count: number
  tier: string
  language: string
  reason: string
  tweet_text: string
  already_in_db: boolean
}

export default function CompetitorClient({ kols }: Props) {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [filter, setFilter] = useState<string>('')
  const [scanning, setScanning] = useState<string | null>(null)
  const [tweets, setTweets] = useState<Map<string, CompetitorTweet[]>>(new Map())
  const [scanResults, setScanResults] = useState<Map<string, ScanResult[]>>(new Map())

  // Add competitor form
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newHandle, setNewHandle] = useState('')
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/competitors').then((r) => r.json()).then((d) => {
      setCompetitors(d.competitors ?? [])
    }).catch(() => {})
  }, [])

  const filtered = filter
    ? kols.filter((k) => k.competitor_affiliations?.includes(filter))
    : kols

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newHandle.trim()) return
    setAdding(true)
    const res = await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), handle: newHandle.replace('@', '').trim() }),
    })
    if (res.ok) {
      const c = await res.json()
      setCompetitors((prev) => [...prev, c])
      setNewName('')
      setNewHandle('')
      setShowAdd(false)
    }
    setAdding(false)
  }

  async function removeCompetitor(name: string) {
    if (!confirm(`确定删除竞品「${name}」？`)) return
    await fetch('/api/competitors', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setCompetitors((prev) => prev.filter((c) => c.name !== name))
  }

  async function scanCompetitorTweets(handle: string, name: string) {
    setScanning(name)
    try {
      const userRes = await fetch('/api/xbridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'user', screen_name: handle }),
      })
      const user = await userRes.json()
      if (user?.id) {
        const tweetsRes = await fetch('/api/xbridge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'user-tweets', user_id: user.id, count: 10 }),
        })
        const data = await tweetsRes.json()
        if (Array.isArray(data)) {
          setTweets((prev) => new Map(prev).set(name, data))
        }
      }
    } catch { /* ignore */ }
    setScanning(null)
  }

  async function scanKolAffiliations(name: string, handle: string) {
    setScanning(`${name}-kol`)
    const allAffiliated: ScanResult[] = []
    let offset = 0
    let done = false

    while (!done) {
      try {
        const res = await fetch('/api/competitors/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competitor_name: name, competitor_handle: handle, offset }),
        })
        const data = await res.json()
        if (res.ok) {
          allAffiliated.push(...(data.affiliated ?? []))
          setScanResults((prev) => new Map(prev).set(name, [...allAffiliated]))
          done = data.done
          offset = data.next_offset ?? offset + 5
        } else {
          done = true
        }
      } catch {
        done = true
      }
    }

    setScanning(null)
  }

  async function importKol(r: ScanResult, competitorName: string) {
    setImporting((prev) => new Set([...prev, r.x_handle]))
    await fetch('/api/kols/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kols: [{
          x_handle: r.x_handle,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
          bio: r.bio,
          followers_count: r.followers_count,
          following_count: r.following_count,
          posts_count: r.posts_count,
          language: r.language,
          status_flag: 'none',
          status: 'pending',
          competitor_affiliations: [competitorName],
        }],
      }),
    })
    // Mark as already in db in scan results
    setScanResults((prev) => {
      const next = new Map(prev)
      for (const [key, results] of next) {
        next.set(key, results.map((item) =>
          item.x_handle === r.x_handle ? { ...item, already_in_db: true } : item
        ))
      }
      return next
    })
    setImporting((prev) => { const n = new Set(prev); n.delete(r.x_handle); return n })
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>竞品雷达</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            监控竞品动态、自动识别 Paid Partnership 关联 KOL
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? '收起' : '+ 添加竞品'}
        </button>
      </div>

      {/* Add competitor form */}
      {showAdd && (
        <form onSubmit={addCompetitor} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>竞品名称</label>
            <input className="input" placeholder="例如 Polymarket" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>X Handle</label>
            <input className="input" placeholder="例如 @Polymarket" value={newHandle} onChange={(e) => setNewHandle(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={adding} style={{ flexShrink: 0 }}>
            {adding ? '添加中...' : '添加'}
          </button>
        </form>
      )}

      {/* Competitor cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {competitors.map((c) => {
          const competitorTweets = tweets.get(c.name) ?? []
          const kolCount = kols.filter((k) => k.competitor_affiliations?.includes(c.name)).length
          const results = scanResults.get(c.name) ?? []
          const isScanningTweets = scanning === c.name
          const isScanningKols = scanning === `${c.name}-kol`
          return (
            <div key={c.name} className="card" style={{ borderLeft: `3px solid ${c.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                  <a href={`https://x.com/${c.handle}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}>
                    @{c.handle} ↗
                  </a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>关联 KOL</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{kolCount}</div>
                  </div>
                  <button onClick={() => removeCompetitor(c.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14 }} title="删除竞品">✕</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: competitorTweets.length > 0 || results.length > 0 ? 10 : 0 }}>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '4px 10px', flex: 1 }}
                  onClick={() => scanCompetitorTweets(c.handle, c.name)}
                  disabled={!!scanning}
                >
                  {isScanningTweets ? '扫描中...' : '查看动态'}
                </button>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 11, padding: '4px 10px', flex: 1 }}
                  onClick={() => scanKolAffiliations(c.name, c.handle)}
                  disabled={!!scanning}
                >
                  {isScanningKols ? '扫描 KOL 中...' : '扫描关联 KOL'}
                </button>
              </div>

              {/* Scan result count */}
              {results.length > 0 && (
                <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>
                  发现 {results.length} 个关联 KOL ↓
                </div>
              )}

              {/* Competitor tweets */}
              {competitorTweets.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {competitorTweets.slice(0, 5).map((t) => (
                    <div key={t.id} style={{ padding: '6px 8px', background: '#f8fafc', borderRadius: 6 }}>
                      <div style={{ fontSize: 11, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                        {t.text}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, display: 'flex', gap: 6 }}>
                        <span>❤ {t.favorite_count}</span>
                        <span>🔄 {t.retweet_count}</span>
                        <span>💬 {t.reply_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Scan results as KOL cards */}
      {[...scanResults.entries()].map(([compName, results]) => {
        if (results.length === 0) return null
        const comp = competitors.find((c) => c.name === compName)
        return (
          <div key={compName}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              <span style={{ color: comp?.color ?? '#6366f1' }}>●</span> {compName} 关联 KOL（{results.length}）
            </h2>
            <div className="discover-grid" style={{ marginBottom: 20 }}>
              {results.map((r) => (
                <div key={r.x_handle} className="discover-card" style={{ opacity: r.already_in_db ? 0.7 : 1 }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                    {r.avatar_url
                      ? <img src={r.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#94a3b8', flexShrink: 0 }}>{r.display_name?.[0]?.toUpperCase()}</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>{r.display_name}</span>
                        <span className={`badge tier-${r.tier}`} style={{ fontSize: 10 }}>{r.tier}</span>
                        <span className="badge" style={{ background: `${comp?.color ?? '#6366f1'}20`, color: comp?.color ?? '#6366f1', border: `1px solid ${comp?.color ?? '#6366f1'}40`, fontSize: 9 }}>
                          {compName}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', gap: 8 }}>
                        <span>@{r.x_handle}</span>
                        <a href={`https://x.com/${r.x_handle}`} target="_blank" rel="noreferrer" style={{ color: '#6366f1', textDecoration: 'none', fontSize: 11 }}>X ↗</a>
                      </div>
                    </div>
                  </div>
                  {r.bio && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{r.bio}</div>}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 12 }}>
                    <span><span style={{ color: '#94a3b8' }}>粉丝 </span><span style={{ fontWeight: 600 }}>{formatNumber(r.followers_count)}</span></span>
                    <span><span style={{ color: '#94a3b8' }}>推文 </span><span style={{ fontWeight: 600 }}>{formatNumber(r.posts_count)}</span></span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', padding: '6px 8px', borderRadius: 6, marginBottom: 10 }}>
                    <span style={{ color: '#16a34a', fontWeight: 500 }}>{r.reason}</span>
                    <div style={{ marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tweet_text}</div>
                  </div>
                  {r.already_in_db ? (
                    <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '4px 0' }}>已在名录中</div>
                  ) : (
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', fontSize: 12, padding: '5px 0' }}
                      disabled={importing.has(r.x_handle)}
                      onClick={() => importKol(r, compName)}
                    >
                      {importing.has(r.x_handle) ? '导入中...' : `导入名录（带 ${compName} 标签）`}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* KOL affiliations table */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>KOL 竞品关联</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            className={`btn ${filter === '' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => setFilter('')}
          >
            全部 ({kols.length})
          </button>
          {competitors.map((c) => {
            const count = kols.filter((k) => k.competitor_affiliations?.includes(c.name)).length
            return (
              <button
                key={c.name}
                className={`btn ${filter === c.name ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 12, padding: '5px 12px' }}
                onClick={() => setFilter(c.name)}
              >
                {c.name} ({count})
              </button>
            )
          })}
        </div>

        {filtered.length > 0 ? (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>KOL</th>
                  <th>粉丝数</th>
                  <th>竞品关联</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {k.avatar_url && <img src={k.avatar_url} alt="" className="avatar" />}
                        <div>
                          <Link href={`/kols/${k.id}`} style={{ fontWeight: 500, fontSize: 13, color: '#0f172a', textDecoration: 'none' }}>{k.display_name}</Link>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>@{k.x_handle}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{formatNumber(k.followers_count)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {k.competitor_affiliations?.map((comp) => {
                          const cfg = competitors.find((c) => c.name === comp)
                          return (
                            <span key={comp} className="badge" style={{ background: `${cfg?.color ?? '#94a3b8'}15`, color: cfg?.color ?? '#94a3b8', border: `1px solid ${cfg?.color ?? '#e2e8f0'}30` }}>
                              {comp}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
            <div>暂无竞品关联 KOL</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>点击竞品卡片上的「扫描关联 KOL」自动检测</div>
          </div>
        )}
      </div>
    </div>
  )
}
