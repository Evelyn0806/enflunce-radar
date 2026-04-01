'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Kol, STATUS_CONFIG, FLAG_CONFIG, LANGUAGE_CONFIG, TIER_CONFIG } from '@/types'
import { formatNumber, formatDate } from '@/lib/utils'

interface Props { kols: Kol[] }

function engagementClass(rate: number | null): string {
  if (rate == null) return ''
  if (rate >= 3) return 'engagement-high'
  if (rate >= 1) return 'engagement-mid'
  return 'engagement-low'
}

function communityIcons(platforms: string[] | null, links: string[] | null) {
  if (!platforms?.length && !links?.length) return null
  const allText = [...(platforms ?? []), ...(links ?? [])].join(' ').toLowerCase()
  const icons: { label: string; icon: string }[] = []
  if (allText.includes('telegram') || allText.includes('t.me')) icons.push({ label: 'TG', icon: '✈' })
  if (allText.includes('discord')) icons.push({ label: 'DC', icon: '💬' })
  if (allText.includes('wechat') || allText.includes('微信')) icons.push({ label: 'WX', icon: '💚' })
  if (allText.includes('whatsapp') || allText.includes('wa.me')) icons.push({ label: 'WA', icon: '📱' })
  if (icons.length === 0 && (platforms?.length || links?.length)) icons.push({ label: '社群', icon: '👥' })
  return icons
}

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
            <th>私域</th>
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
            const icons = communityIcons(kol.community_platforms, kol.community_links)

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

                {/* Handle + X link */}
                <td>
                  <div style={{ fontWeight: 500, color: '#0f172a' }}>
                    {kol.display_name ?? kol.x_handle}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>@{kol.x_handle}</span>
                    <a
                      href={`https://x.com/${kol.x_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="X 主页"
                      style={{ color: '#6366f1', textDecoration: 'none', fontSize: 11 }}
                    >
                      ↗
                    </a>
                  </div>
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
                    ? <span className={engagementClass(kol.avg_engagement_rate)}>
                        {kol.avg_engagement_rate.toFixed(1)}%
                      </span>
                    : <span style={{ color: '#cbd5e1' }}>—</span>
                  }
                </td>

                {/* Community */}
                <td>
                  {kol.has_private_community && icons ? (
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {icons.map((ic) => (
                        <span key={ic.label} className="community-icon">
                          {ic.icon} {ic.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: '#e2e8f0' }}>—</span>
                  )}
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
