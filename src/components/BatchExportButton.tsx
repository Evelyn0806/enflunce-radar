'use client'

import { Kol, KOL_TYPE_CONFIG, LANGUAGE_CONFIG, STATUS_CONFIG, TIER_CONFIG } from '@/types'

interface Props { kols: Kol[] }

function csvEscape(v: unknown): string {
  if (v == null) return ''
  const s = Array.isArray(v) ? v.join('; ') : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function ymd(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function BatchExportButton({ kols }: Props) {
  function handleExport() {
    const headers = [
      'x_handle', 'display_name', 'language', 'tier', 'tier_label',
      'kol_type', 'kol_type_label',
      'followers_count', 'following_count', 'posts_count',
      'avg_engagement_rate', 'last_post_at',
      'has_private_community', 'community_platforms', 'community_links',
      'pm_brand_signal', 'airdrop_signal', 'pm_tweet_signal',
      'status', 'status_flag', 'notes',
      'competitor_affiliations', 'bio', 'created_at',
    ]
    const rows = kols.map((k) => {
      const tier = k.computed_tier ?? k.tier
      const kolType = k.kol_type ??
        ((k.airdrop_signal ?? 0) >= 1 ? 'pm_airdrop'
          : (k.pm_brand_signal ?? 0) >= 1 ? 'pm_trader'
            : (k.pm_tweet_signal ?? 0) >= 1 ? 'pm_generalist'
              : 'unclassified')
      return [
        k.x_handle,
        k.display_name,
        LANGUAGE_CONFIG[k.language]?.label ?? k.language,
        tier,
        TIER_CONFIG[tier]?.label ?? '',
        kolType,
        KOL_TYPE_CONFIG[kolType]?.label ?? '',
        k.followers_count,
        k.following_count,
        k.posts_count,
        k.avg_engagement_rate,
        k.last_post_at,
        k.has_private_community,
        k.community_platforms,
        k.community_links,
        k.pm_brand_signal ?? 0,
        k.airdrop_signal ?? 0,
        k.pm_tweet_signal ?? 0,
        STATUS_CONFIG[k.status]?.labelZh ?? k.status,
        k.status_flag,
        k.notes,
        k.competitor_affiliations,
        k.bio,
        k.created_at,
      ].map(csvEscape).join(',')
    })

    const csv = '﻿' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kols-${ymd()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      className="btn btn-secondary"
      onClick={handleExport}
      disabled={kols.length === 0}
      title={`导出当前筛选下的 ${kols.length} 位 KOL 为 CSV`}
    >
      批量导出
    </button>
  )
}
