'use client'

import { useState } from 'react'
import { Kol, Language } from '@/types'
import { formatNumber } from '@/lib/utils'

interface Props {
  kols: Pick<Kol, 'id' | 'x_handle' | 'display_name' | 'avatar_url' | 'followers_count' | 'xhunt_rank_zh' | 'xhunt_rank_en' | 'language'>[]
}

export default function XHuntClient({ kols }: Props) {
  const [langFilter, setLangFilter] = useState<'all' | Language>('all')

  const filtered = langFilter === 'all'
    ? kols
    : kols.filter((k) => k.language === langFilter)

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>XHunt TOP100</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          XHunt 平台 TOP100 KOL 排名追踪
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className={`btn ${langFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={() => setLangFilter('all')}
        >
          全部
        </button>
        <button
          className={`btn ${langFilter === 'zh' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={() => setLangFilter('zh')}
        >
          🇨🇳 中文区
        </button>
        <button
          className={`btn ${langFilter === 'en' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={() => setLangFilter('en')}
        >
          🇺🇸 英文区
        </button>
      </div>

      {filtered.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>KOL</th>
                  <th>粉丝数</th>
                  <th>语区</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                        {k.xhunt_rank_zh && (
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>
                            🇨🇳 #{k.xhunt_rank_zh}
                          </span>
                        )}
                        {k.xhunt_rank_en && (
                          <span style={{ color: '#2563eb', fontWeight: 600 }}>
                            🇺🇸 #{k.xhunt_rank_en}
                          </span>
                        )}
                      </div>
                    </td>
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
                      <span className="badge">
                        {k.language === 'zh' ? '🇨🇳 中文' : k.language === 'en' ? '🇺🇸 English' : k.language}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>◐</div>
          <div>暂无 XHunt TOP100 数据</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            在 KOL 详情页手动录入 XHunt 排名后，将在此显示
          </div>
        </div>
      )}
    </div>
  )
}
