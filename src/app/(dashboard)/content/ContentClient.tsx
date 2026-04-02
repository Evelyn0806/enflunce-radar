'use client'

import { useState } from 'react'
import { Kol } from '@/types'
import { formatNumber } from '@/lib/utils'

interface Props {
  kols: Pick<Kol, 'id' | 'x_handle' | 'display_name' | 'avatar_url' | 'followers_count'>[]
}

interface TweetData {
  id: string
  text: string
  created_at: string | null
  favorite_count: number
  retweet_count: number
  reply_count: number
  view_count: number | string
}

export default function ContentClient({ kols }: Props) {
  const [selectedKol, setSelectedKol] = useState<string>('')
  const [tweets, setTweets] = useState<TweetData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function fetchTweets(kolId: string) {
    setSelectedKol(kolId)
    if (!kolId) { setTweets([]); return }

    const kol = kols.find((k) => k.id === kolId)
    if (!kol) return

    setLoading(true)
    setError('')
    setTweets([])

    try {
      // First get twitter user id
      const userRes = await fetch('/api/xbridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'user', screen_name: kol.x_handle }),
      })
      const user = await userRes.json()
      if (!userRes.ok || !user.id) {
        setError('无法获取用户信息')
        setLoading(false)
        return
      }

      // Then get tweets
      const tweetsRes = await fetch('/api/xbridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'user-tweets', user_id: user.id, count: 20 }),
      })
      const tweetsData = await tweetsRes.json()
      if (!tweetsRes.ok) {
        setError(tweetsData.error ?? '获取推文失败')
      } else {
        setTweets(Array.isArray(tweetsData) ? tweetsData : [])
      }
    } catch {
      setError('网络请求失败')
    }
    setLoading(false)
  }

  const totalLikes = tweets.reduce((s, t) => s + t.favorite_count, 0)
  const totalRetweets = tweets.reduce((s, t) => s + t.retweet_count, 0)
  const totalReplies = tweets.reduce((s, t) => s + t.reply_count, 0)
  const totalViews = tweets.reduce((s, t) => s + (typeof t.view_count === 'number' ? t.view_count : parseInt(String(t.view_count)) || 0), 0)

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>内容效果追踪</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          监控 KOL 推文表现：曝光、互动、交易转化
        </p>
      </div>

      <div className="card">
        <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 8 }}>选择 KOL</label>
        <select
          className="select"
          style={{ maxWidth: 300 }}
          value={selectedKol}
          onChange={(e) => fetchTweets(e.target.value)}
        >
          <option value="">选择 KOL...</option>
          {kols.map((k) => (
            <option key={k.id} value={k.id}>
              @{k.x_handle} ({formatNumber(k.followers_count)} 粉丝)
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 6 }}>{error}</div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>加载推文中...</div>
      )}

      {tweets.length > 0 && (
        <>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: '总曝光', value: formatNumber(totalViews), sub: 'Views' },
              { label: '总点赞', value: formatNumber(totalLikes), sub: 'Likes' },
              { label: '总转发', value: formatNumber(totalRetweets), sub: 'Retweets' },
              { label: '总评论', value: formatNumber(totalReplies), sub: 'Replies' },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label} · {s.sub}</div>
              </div>
            ))}
          </div>

          {/* Tweet list */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>推文内容</th>
                  <th>时间</th>
                  <th>曝光</th>
                  <th>点赞</th>
                  <th>转发</th>
                  <th>评论</th>
                </tr>
              </thead>
              <tbody>
                {tweets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontSize: 12, color: '#334155', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>
                        {t.text}
                      </div>
                    </td>
                    <td style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('zh-CN') : '—'}
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>{formatNumber(typeof t.view_count === 'number' ? t.view_count : parseInt(String(t.view_count)) || 0)}</td>
                    <td style={{ fontSize: 13, color: '#dc2626' }}>{formatNumber(t.favorite_count)}</td>
                    <td style={{ fontSize: 13, color: '#16a34a' }}>{formatNumber(t.retweet_count)}</td>
                    <td style={{ fontSize: 13, color: '#2563eb' }}>{formatNumber(t.reply_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && !selectedKol && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
          <div>选择 KOL 查看内容效果</div>
        </div>
      )}

      {!loading && selectedKol && tweets.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <div>暂无推文数据</div>
        </div>
      )}
    </div>
  )
}
