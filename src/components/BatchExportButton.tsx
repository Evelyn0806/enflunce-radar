'use client'

import { Kol, LANGUAGE_CONFIG, STATUS_CONFIG, TIER_CONFIG } from '@/types'
import { ACCOUNT_TYPE_CONFIG, TRACKS, isTrack } from '@/lib/tracks'

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
      'tracks', 'track_labels', 'account_type',
      'followers_count', 'following_count', 'posts_count',
      'avg_engagement_rate', 'last_post_at',
      'has_private_community', 'community_platforms', 'community_links',
      'status', 'status_flag', 'notes',
      'competitor_affiliations', 'bio', 'created_at',
    ]
    const rows = kols.map((k) => {
      const tier = k.computed_tier ?? k.tier
      const tracks = (k.tracks ?? []).filter(isTrack)
      return [
        k.x_handle,
        k.display_name,
        LANGUAGE_CONFIG[k.language]?.label ?? k.language,
        tier,
        TIER_CONFIG[tier]?.label ?? '',
        tracks,
        tracks.map((t) => TRACKS[t].label),
        ACCOUNT_TYPE_CONFIG[k.account_type ?? 'personal']?.label ?? '',
        k.followers_count,
        k.following_count,
        k.posts_count,
        k.avg_engagement_rate,
        k.last_post_at,
        k.has_private_community,
        k.community_platforms,
        k.community_links,
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
