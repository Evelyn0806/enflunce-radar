'use client'

import { useState } from 'react'
import { Kol } from '@/types'
import { formatNumber } from '@/lib/utils'

interface Props {
  kols: Pick<Kol, 'id' | 'x_handle' | 'display_name' | 'avatar_url' | 'followers_count' | 'competitor_affiliations'>[]
}

const COMPETITORS = ['Betmoar', 'PolyCop', 'Kreo', 'Azuro', 'Limitless']

export default function CompetitorClient({ kols }: Props) {
  const [filter, setFilter] = useState<string>('')

  const filtered = filter
    ? kols.filter((k) => k.competitor_affiliations?.includes(filter))
    : kols

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>竞品雷达</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          监控竞品合作 KOL，识别付费内容和用户体验反馈
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className={`btn ${filter === '' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={() => setFilter('')}
        >
          全部
        </button>
        {COMPETITORS.map((c) => (
          <button
            key={c}
            className={`btn ${filter === c ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
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
                        {k.competitor_affiliations?.map((c) => (
                          <span key={c} className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                            {c}
                          </span>
                        ))}
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
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div>暂无竞品关联 KOL</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            在 KOL 详情页标记竞品关联后，将在此显示
          </div>
        </div>
      )}
    </div>
  )
}
