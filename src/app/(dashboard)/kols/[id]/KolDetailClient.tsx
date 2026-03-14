'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Kol, Collaboration, CommunicationLog,
  KolStatus, StatusFlag, KolRole,
  STATUS_CONFIG, FLAG_CONFIG, ROLE_CONFIG, LANGUAGE_CONFIG, TIER_CONFIG,
} from '@/types'
import { formatNumber, formatDate, calcROI } from '@/lib/utils'

interface Props {
  kol: Kol
  collabs: Collaboration[]
  logs: CommunicationLog[]
}

const FLAG_OPTIONS: { value: StatusFlag; icon: string; label: string }[] = [
  { value: 'none',   icon: '—',  label: '无标识' },
  { value: 'star',   icon: '⭐', label: '观望' },
  { value: 'urgent', icon: '❗', label: '尽快接触' },
  { value: 'stop',   icon: '🚫', label: '暂缓' },
]

const STATUS_OPTIONS: KolStatus[] = ['pending', 'watching', 'negotiating', 'active', 'paused', 'terminated']

export default function KolDetailClient({ kol, collabs, logs }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<KolStatus>(kol.status)
  const [flag, setFlag] = useState<StatusFlag>(kol.status_flag)
  const [notes, setNotes] = useState(kol.notes ?? '')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState(kol.ai_summary ?? '')
  const [roles, setRoles] = useState<KolRole[]>(kol.potential_roles ?? [])

  const tier = kol.computed_tier ?? kol.tier
  const tierCfg = TIER_CONFIG[tier]
  const langCfg = LANGUAGE_CONFIG[kol.language]
  const statusCfg = STATUS_CONFIG[status]

  async function save() {
    setSaving(true)
    await fetch(`/api/kols/${kol.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, status_flag: flag, notes }),
    })
    setSaving(false)
    router.refresh()
  }

  async function generateAI() {
    setAiLoading(true)
    try {
      const res = await fetch(`/api/kols/${kol.id}/ai-analyze`, { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setAiSummary(json.ai_summary ?? '')
        setRoles(json.potential_roles ?? [])
        router.refresh()
      } else {
        alert(`AI 分析失败: ${json.error ?? '未知错误'}`)
      }
    } catch (error) {
      alert('AI 分析请求失败，请检查网络连接')
    }
    setAiLoading(false)
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: '#94a3b8' }}>
        <Link href="/kols" style={{ color: '#94a3b8', textDecoration: 'none' }}>← KOL 名录</Link>
      </div>

      {/* Profile header */}
      <div className="card" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {kol.avatar_url
          ? <img src={kol.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e2e8f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#94a3b8' }}>
              {(kol.display_name ?? kol.x_handle)[0]?.toUpperCase()}
            </div>
        }

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
              {kol.display_name ?? kol.x_handle}
            </h1>
            <span className={`badge tier-${tier}`}>{tier}</span>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {langCfg.flag} {langCfg.label}
            </span>
            {kol.is_silent && (
              <span className="badge" style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
                沉默 30天+
              </span>
            )}
          </div>
          <a
            href={`https://x.com/${kol.x_handle}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: '#3b82f6', textDecoration: 'none' }}
          >
            @{kol.x_handle} ↗
          </a>
          {kol.bio && (
            <p style={{ fontSize: 13, color: '#475569', marginTop: 8, lineHeight: 1.6 }}>
              {kol.bio}
            </p>
          )}
        </div>

        {/* X metrics */}
        <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
          {[
            { label: '粉丝', value: formatNumber(kol.followers_count) },
            { label: '互动率', value: kol.avg_engagement_rate != null ? `${kol.avg_engagement_rate.toFixed(1)}%` : '—' },
            { label: '推文数', value: formatNumber(kol.posts_count) },
          ].map((m) => (
            <div key={m.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{m.value}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: Status & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Status management */}
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>合作状态</h3>

            {/* Status pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {STATUS_OPTIONS.map((s) => {
                const cfg = STATUS_CONFIG[s]
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`badge ${status === s ? cfg.color : 'bg-gray-50 text-gray-400'}`}
                    style={{ cursor: 'pointer', border: status === s ? '2px solid currentColor' : '1px solid #e2e8f0', padding: '4px 10px' }}
                  >
                    {cfg.labelZh}
                  </button>
                )
              })}
            </div>

            {/* Flag */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 8 }}>标识</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {FLAG_OPTIONS.map((f) => (
                  <button
                    key={f.value}
                    title={f.label}
                    onClick={() => setFlag(f.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: flag === f.value ? '2px solid #0f172a' : '1px solid #e2e8f0',
                      background: flag === f.value ? '#f1f5f9' : 'transparent',
                      cursor: 'pointer',
                      fontSize: 14,
                    }}
                  >
                    {f.icon} <span style={{ fontSize: 11, color: '#64748b' }}>{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>备注</label>
              <textarea
                className="input"
                style={{ minHeight: 80, resize: 'vertical' }}
                placeholder="备注信息、跟进要点..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button className="btn btn-primary" onClick={save} disabled={saving} style={{ width: '100%' }}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>

          {/* XHunt data */}
          {(kol.xhunt_rank_zh || kol.xhunt_rank_en || kol.xhunt_score) && (
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>XHunt 数据</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {kol.xhunt_rank_zh && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>中文排名</span>
                    <span style={{ fontWeight: 600, color: '#f59e0b' }}>#{kol.xhunt_rank_zh}</span>
                  </div>
                )}
                {kol.xhunt_rank_en && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>英文排名</span>
                    <span style={{ fontWeight: 600, color: '#3b82f6' }}>#{kol.xhunt_rank_en}</span>
                  </div>
                )}
                {kol.xhunt_score && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>综合评分</span>
                    <span style={{ fontWeight: 600 }}>{kol.xhunt_score}</span>
                  </div>
                )}
                {kol.xhunt_follower_overlap && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>粉丝重叠率</span>
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>{kol.xhunt_follower_overlap}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: AI Analysis + Collabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* AI Role Analysis */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>AI 角色分析</h3>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={generateAI}
                disabled={aiLoading}
              >
                {aiLoading ? '分析中...' : '重新分析'}
              </button>
            </div>

            {/* Roles */}
            {roles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {roles.map((r) => {
                  const cfg = ROLE_CONFIG[r]
                  return (
                    <span key={r} className={`badge ${cfg.color}`}>
                      {cfg.labelZh} · {cfg.label}
                    </span>
                  )
                })}
              </div>
            )}

            {/* Summary */}
            {aiSummary ? (
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{aiSummary}</p>
            ) : (
              <p style={{ fontSize: 13, color: '#94a3b8' }}>
                点击「重新分析」让 AI 根据 Bio 和发帖内容生成角色分析
              </p>
            )}

            {kol.role_analysis_notes && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#475569' }}>
                {kol.role_analysis_notes}
              </div>
            )}
          </div>

          {/* Recent collabs */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>合作记录</h3>
              <Link href={`/crm?kol=${kol.id}`} style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}>
                + 新增合作
              </Link>
            </div>

            {collabs.length === 0 ? (
              <p style={{ fontSize: 13, color: '#94a3b8' }}>暂无合作记录</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {collabs.slice(0, 3).map((c) => (
                  <div key={c.id} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{c.title}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{c.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {c.payment_amount != null && `${c.payment_currency} ${c.payment_amount}`}
                      {c.trading_volume > 0 && ` · 交易量 $${formatNumber(c.trading_volume)}`}
                      {calcROI(c.payment_amount, c.trading_volume) != null && (
                        <span style={{ color: '#16a34a', marginLeft: 6 }}>
                          ROI {calcROI(c.payment_amount, c.trading_volume)?.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent logs */}
          {logs.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>沟通记录</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {logs.slice(0, 5).map((l) => (
                  <div key={l.id} style={{ fontSize: 13, borderLeft: '2px solid #e2e8f0', paddingLeft: 12 }}>
                    <div style={{ color: '#0f172a' }}>{l.summary}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {l.direction === 'inbound' ? '↙ 对方' : '↗ 我方'} · {l.channel} · {formatDate(l.created_at)}
                    </div>
                    {l.next_action && (
                      <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>
                        下一步: {l.next_action}
                        {l.next_action_due && ` (${formatDate(l.next_action_due)})`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
