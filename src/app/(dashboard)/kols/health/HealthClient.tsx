'use client'

import { useState } from 'react'
import { Kol } from '@/types'
import { formatNumber } from '@/lib/utils'

interface Props {
  kols: Pick<Kol, 'id' | 'x_handle' | 'display_name' | 'avatar_url' | 'followers_count' | 'tier'>[]
}

export default function HealthClient({ kols }: Props) {
  const [selectedKol, setSelectedKol] = useState<string>('')

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>健康监控</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          监控 KOL 粉丝增长趋势和活跃度
        </p>
      </div>

      <div className="card">
        <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 8 }}>
          选择 KOL
        </label>
        <select
          className="select"
          style={{ maxWidth: 300 }}
          value={selectedKol}
          onChange={(e) => setSelectedKol(e.target.value)}
        >
          <option value="">选择 KOL...</option>
          {kols.map((k) => (
            <option key={k.id} value={k.id}>
              @{k.x_handle} ({formatNumber(k.followers_count)} 粉丝)
            </option>
          ))}
        </select>
      </div>

      {selectedKol ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📈</div>
            <div>健康监控功能开发中</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              将展示：粉丝增长趋势、互动率变化、发帖频率
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
          <div>选择 KOL 查看健康数据</div>
        </div>
      )}
    </div>
  )
}
