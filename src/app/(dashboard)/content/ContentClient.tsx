'use client'

import { useState } from 'react'
import { Kol } from '@/types'
import { formatNumber } from '@/lib/utils'

interface Props {
  kols: Pick<Kol, 'id' | 'x_handle' | 'display_name' | 'avatar_url' | 'followers_count'>[]
}

export default function ContentClient({ kols }: Props) {
  const [selectedKol, setSelectedKol] = useState<string>('')

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>内容效果追踪</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          监控 KOL 推文表现：曝光、互动、交易转化
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
            <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
            <div>内容效果追踪功能开发中</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              将展示：推文主题、摘要、曝光量、点赞、评论、转发、交易量、用户数
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
          <div>选择 KOL 查看内容效果</div>
        </div>
      )}
    </div>
  )
}
