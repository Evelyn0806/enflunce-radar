'use client'

import { useRouter, usePathname } from 'next/navigation'
import { KolStatus, Language, Tier } from '@/types'
import { ACCOUNT_TYPE_CONFIG, ALL_TRACKS, AccountType, TRACKS, Track } from '@/lib/tracks'

interface Props {
  params: {
    status?: KolStatus
    language?: Language
    tier?: Tier
    track?: Track
    account_type?: AccountType
    flag?: string
    q?: string
    silent?: string
    show_dead?: string
  }
}

export default function KolFilters({ params }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function update(key: string, value: string) {
    const sp = new URLSearchParams(params as Record<string, string>)
    if (value) sp.set(key, value)
    else sp.delete(key)
    router.push(`${pathname}?${sp.toString()}`)
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Search */}
      <input
        className="input"
        style={{ maxWidth: 220 }}
        placeholder="搜索 handle / 名字..."
        defaultValue={params.q ?? ''}
        onChange={(e) => update('q', e.target.value)}
      />

      {/* Status */}
      <select
        className="select"
        value={params.status ?? ''}
        onChange={(e) => update('status', e.target.value)}
      >
        <option value="">全部状态</option>
        <option value="pending">待接触</option>
        <option value="watching">观望中</option>
        <option value="negotiating">洽谈中</option>
        <option value="active">合作中</option>
        <option value="paused">暂缓</option>
        <option value="terminated">已终止</option>
      </select>

      {/* Language */}
      <select
        className="select"
        value={params.language ?? ''}
        onChange={(e) => update('language', e.target.value)}
      >
        <option value="">全部语区</option>
        <option value="zh">🇨🇳 中文</option>
        <option value="en">🇺🇸 English</option>
        <option value="ko">🇰🇷 한국어</option>
        <option value="tr">🇹🇷 Türkçe</option>
        <option value="vi">🇻🇳 Tiếng Việt</option>
        <option value="bilingual">🌐 双语</option>
      </select>

      {/* Tier */}
      <select
        className="select"
        value={params.tier ?? ''}
        onChange={(e) => update('tier', e.target.value)}
      >
        <option value="">全部 Tier</option>
        <option value="A">大V（≥3万粉）</option>
        <option value="B">KOL（5K–3万）</option>
        <option value="C">KOC（&lt;5K）</option>
      </select>

      {/* Track */}
      <select
        className="select"
        value={params.track ?? ''}
        onChange={(e) => update('track', e.target.value)}
      >
        <option value="">全部赛道</option>
        {ALL_TRACKS.map((t) => (
          <option key={t} value={t}>{TRACKS[t].label}</option>
        ))}
      </select>

      {/* Account type */}
      <select
        className="select"
        value={params.account_type ?? ''}
        onChange={(e) => update('account_type', e.target.value)}
      >
        <option value="">全部账号类型</option>
        {(Object.keys(ACCOUNT_TYPE_CONFIG) as AccountType[]).map((a) => (
          <option key={a} value={a}>{ACCOUNT_TYPE_CONFIG[a].label}</option>
        ))}
      </select>

      {/* Flag */}
      <select
        className="select"
        value={params.flag ?? ''}
        onChange={(e) => update('flag', e.target.value)}
      >
        <option value="">全部标记</option>
        <option value="star">⭐ 观望</option>
        <option value="urgent">❗ 尽快接触</option>
        <option value="stop">🚫 暂缓</option>
      </select>

      {/* Silent toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={params.silent === '1'}
          onChange={(e) => update('silent', e.target.checked ? '1' : '')}
        />
        仅看沉默账号
      </label>

      {/* Include dead accounts (default: hidden) */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={params.show_dead === '1'}
          onChange={(e) => update('show_dead', e.target.checked ? '1' : '')}
        />
        显示已失效账号
      </label>

      {/* Clear */}
      {Object.values(params).some(Boolean) && (
        <button
          className="btn btn-ghost"
          onClick={() => router.push(pathname)}
          style={{ fontSize: 12 }}
        >
          × 清除筛选
        </button>
      )}
    </div>
  )
}
