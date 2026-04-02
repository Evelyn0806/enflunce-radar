'use client'

import { useState } from 'react'
import { Kol } from '@/types'
import { formatNumber } from '@/lib/utils'

interface Props {
  kols: Pick<Kol, 'id' | 'x_handle' | 'display_name' | 'avatar_url' | 'followers_count' | 'competitor_affiliations'>[]
}

interface CompetitorTweet {
  id: string
  text: string
  created_at: string | null
  favorite_count: number
  retweet_count: number
  reply_count: number
}

const COMPETITORS: { name: string; handle: string; color: string }[] = [
  { name: 'Polymarket', handle: 'Polymarket', color: '#6366f1' },
  { name: 'Kalshi', handle: 'Kalshi', color: '#dc2626' },
  { name: 'Azuro', handle: 'AzuroProtocol', color: '#2563eb' },
  { name: 'Limitless', handle: 'LimitlessExch', color: '#16a34a' },
  { name: 'Drift', handle: 'DriftProtocol', color: '#f59e0b' },
]

export default function CompetitorClient({ kols }: Props) {
  const [filter, setFilter] = useState<string>('')
  const [scanning, setScanning] = useState<string | null>(null)
  const [tweets, setTweets] = useState<Map<string, CompetitorTweet[]>>(new Map())

  const filtered = filter
    ? kols.filter((k) => k.competitor_affiliations?.includes(filter))
    : kols

  async function scanCompetitor(handle: string, name: string) {
    setScanning(name)
    try {
      // Get user id
      const userRes = await fetch('/api/xbridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'user', screen_name: handle }),
      })
      const user = await userRes.json()
      if (!user?.id) { setScanning(null); return }

      // Get recent tweets
      const tweetsRes = await fetch('/api/xbridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'user-tweets', user_id: user.id, count: 10 }),
      })
      const data = await tweetsRes.json()
      if (Array.isArray(data)) {
        setTweets((prev) => new Map(prev).set(name, data))
      }
    } catch { /* ignore */ }
    setScanning(null)
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>竞品雷达</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          监控竞品动态、关联 KOL，识别合作机会
        </p>
      </div>

      {/* Competitor cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {COMPETITORS.map((c) => {
          const competitorTweets = tweets.get(c.name) ?? []
          const kolCount = kols.filter((k) => k.competitor_affiliations?.includes(c.name)).length
          return (
            <div key={c.name} className="card" style={{ borderLeft: `3px solid ${c.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                  <a href={`https://x.com/${c.handle}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#6366f1', textDecoration: 'none' }}>
                    @{c.handle} ↗
                  </a>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>关联 KOL</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{kolCount}</div>
                </div>
              </div>

              <button
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '4px 10px', width: '100%', marginBottom: competitorTweets.length > 0 ? 10 : 0 }}
                onClick={() => scanCompetitor(c.handle, c.name)}
                disabled={scanning === c.name}
              >
                {scanning === c.name ? '扫描中...' : '扫描最新动态'}
              </button>

              {competitorTweets.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {competitorTweets.slice(0, 5).map((t) => (
                    <div key={t.id} style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 6 }}>
                      <div style={{ fontSize: 12, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                        {t.text}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, display: 'flex', gap: 8 }}>
                        <span>❤ {t.favorite_count}</span>
                        <span>🔄 {t.retweet_count}</span>
                        <span>💬 {t.reply_count}</span>
                        {t.created_at && <span>{new Date(t.created_at).toLocaleDateString('zh-CN')}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* KOL affiliations section */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>KOL 竞品关联</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            className={`btn ${filter === '' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => setFilter('')}
          >
            全部 ({kols.length})
          </button>
          {COMPETITORS.map((c) => {
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
            <div style={{ overflowX: 'auto' }}>
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
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{k.display_name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>@{k.x_handle}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{formatNumber(k.followers_count)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {k.competitor_affiliations?.map((comp) => {
                            const cfg = COMPETITORS.find((c) => c.name === comp)
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
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
            <div>暂无竞品关联 KOL</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>使用上方「扫描最新动态」查看竞品在推什么</div>
          </div>
        )}
      </div>
    </div>
  )
}
