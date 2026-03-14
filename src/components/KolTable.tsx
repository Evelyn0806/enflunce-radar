'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Kol, STATUS_CONFIG, FLAG_CONFIG, LANGUAGE_CONFIG, TIER_CONFIG } from '@/types'
import { formatNumber, formatDate } from '@/lib/utils'

interface Props { kols: Kol[] }

export default function KolTable({ kols }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string, handle: string) {
    if (!confirm(`确定删除 @${handle}？`)) return

    setDeleting(id)
    await fetch(`/api/kols/${id}`, { method: 'DELETE' })
    setDeleting(null)
    router.refresh()
  }
  if (kols.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
        暂无数据 · No records
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}></th>
            <th>KOL / Handle</th>
            <th>语区</th>
            <th>Tier</th>
            <th>粉丝数</th>
            <th>互动率</th>
            <th>最近发帖</th>
            <th>角色</th>
            <th>状态</th>
            <th>标记</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {kols.map((kol) => {
            const tier = kol.computed_tier ?? kol.tier
            const statusCfg = STATUS_CONFIG[kol.status]
            const flagCfg = FLAG_CONFIG[kol.status_flag]
            const langCfg = LANGUAGE_CONFIG[kol.language]
            const tierCfg = TIER_CONFIG[tier]

            return (
              <tr key={kol.id}>
                {/* Avatar */}
                <td>
                  {kol.avatar_url
                    ? <img src={kol.avatar_url} alt="" className="avatar" />
                    : <div className="avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#94a3b8' }}>
                        {(kol.display_name ?? kol.x_handle)[0]?.toUpperCase()}
                      </div>
                  }
                </td>

                {/* Handle */}
                <td>
                  <div style={{ fontWeight: 500, color: '#0f172a' }}>
                    {kol.display_name ?? kol.x_handle}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>@{kol.x_handle}</div>
                </td>

                {/* Language */}
                <td>
                  <span style={{ fontSize: 13 }}>
                    {langCfg.flag} {langCfg.label}
                  </span>
                </td>

                {/* Tier */}
                <td>
                  <span className={`badge tier-${tier}`}>
                    {tier}
                  </span>
                </td>

                {/* Followers */}
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatNumber(kol.followers_count)}
                  {kol.is_silent && (
                    <span
                      title="30天无发帖"
                      className="silent-dot"
                      style={{ marginLeft: 6 }}
                    />
                  )}
                </td>

                {/* Engagement */}
                <td>
                  {kol.avg_engagement_rate != null
                    ? <span style={{ color: kol.avg_engagement_rate >= 3 ? '#16a34a' : '#64748b' }}>
                        {kol.avg_engagement_rate.toFixed(1)}%
                      </span>
                    : <span style={{ color: '#cbd5e1' }}>—</span>
                  }
                </td>

                {/* Last post */}
                <td style={{ fontSize: 12, color: '#64748b' }}>
                  {formatDate(kol.last_post_at)}
                </td>

                {/* Roles */}
                <td>
                  {kol.potential_roles?.slice(0, 2).map((r) => (
                    <span key={r} style={{
                      fontSize: 10,
                      background: '#f1f5f9',
                      color: '#475569',
                      padding: '1px 5px',
                      borderRadius: 3,
                      marginRight: 3,
                    }}>
                      {r}
                    </span>
                  ))}
                </td>

                {/* Status */}
                <td>
                  <span className={`badge ${statusCfg.color}`}>
                    {statusCfg.labelZh}
                  </span>
                </td>

                {/* Flag */}
                <td style={{ fontSize: 14 }}>
                  {flagCfg.icon || <span style={{ color: '#e2e8f0' }}>—</span>}
                </td>

                {/* Action */}
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Link href={`/kols/${kol.id}`} className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}>
                      详情
                    </Link>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '4px 8px', fontSize: 12, color: '#dc2626' }}
                      onClick={() => handleDelete(kol.id, kol.x_handle)}
                      disabled={deleting === kol.id}
                    >
                      {deleting === kol.id ? '...' : '删除'}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
