'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Collaboration, Kol, CollabStatus, PaymentMethod } from '@/types'
import { formatNumber, formatDate, calcROI } from '@/lib/utils'

type CollabWithKol = Collaboration & {
  kol: Pick<Kol, 'id' | 'x_handle' | 'display_name' | 'avatar_url' | 'tier' | 'status_flag'>
}

interface Props {
  collabs: CollabWithKol[]
  kols: Pick<Kol, 'id' | 'x_handle' | 'display_name' | 'status'>[]
  filterKolId?: string
}

const COLLAB_STATUS_COLOR: Record<CollabStatus, string> = {
  planned:   'bg-gray-100 text-gray-600',
  active:    'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-600',
}

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  fiat:       '法币',
  token:      '代币',
  ambassador: '大使',
  none:       '无偿',
}

const EMPTY_FORM = {
  kol_id: '',
  title: '',
  type: 'post',
  payment_method: 'fiat' as PaymentMethod,
  payment_amount: '',
  payment_currency: 'USD',
  start_date: '',
  end_date: '',
  affiliate_link: '',
  notes: '',
}

export default function CrmClient({ collabs, kols, filterKolId }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(!!filterKolId)
  const [form, setForm] = useState({ ...EMPTY_FORM, kol_id: filterKolId ?? '' })
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [kolSearch, setKolSearch] = useState(filterKolId ? `@${kols.find((k) => k.id === filterKolId)?.x_handle ?? ''}` : '')
  const [showKolDropdown, setShowKolDropdown] = useState(false)

  async function deleteCollab(id: string, title: string) {
    if (!confirm(`确定删除合作"${title}"？`)) return
    await fetch(`/api/collaborations/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  // Stats
  const totalSpend = collabs
    .filter((c) => c.payment_method !== 'none' && c.payment_amount)
    .reduce((s, c) => s + (c.payment_amount ?? 0), 0)
  const totalVolume = collabs.reduce((s, c) => s + (c.trading_volume ?? 0), 0)
  const activeCount = collabs.filter((c) => c.status === 'active').length

  const filtered = statusFilter
    ? collabs.filter((c) => c.status === statusFilter)
    : collabs

  function setField(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function saveCollab(e: React.FormEvent) {
    e.preventDefault()
    if (!form.kol_id || !form.title) return
    setSaving(true)

    const payload = {
      kol_id: form.kol_id,
      title: form.title,
      type: form.type,
      payment_method: form.payment_method,
      payment_amount: form.payment_amount ? parseFloat(form.payment_amount) : null,
      payment_currency: form.payment_currency,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      affiliate_link: form.affiliate_link || null,
      notes: form.notes || null,
      status: 'planned',
    }

    await fetch('/api/collaborations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)
    setShowForm(false)
    setForm({ ...EMPTY_FORM })
    setKolSearch('')
    router.refresh()
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>CRM 合作管理</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>跟踪每一笔合作的状态、付款和 ROI</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '收起' : '+ 新增合作'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: '合作总数', value: collabs.length, sub: 'Total' },
          { label: '进行中', value: activeCount, sub: 'Active' },
          { label: '总支出', value: `$${formatNumber(totalSpend)}`, sub: 'Spend' },
          { label: '带动交易量', value: `$${formatNumber(totalVolume)}`, sub: 'Volume' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label} · {s.sub}</div>
          </div>
        ))}
      </div>

      {/* New Collab Form */}
      {showForm && (
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>新增合作记录</h3>
          <form onSubmit={saveCollab} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* KOL - searchable input with autocomplete */}
            <div style={{ gridColumn: '1 / -1', position: 'relative' }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>KOL *（输入 handle 或名称）</label>
              {filterKolId ? (
                <div style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: 8, fontSize: 13, color: '#0f172a' }}>
                  @{kols.find((k) => k.id === filterKolId)?.x_handle ?? filterKolId}
                  <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>（来自 KOL 详情）</span>
                </div>
              ) : (
                <>
                  <input
                    className="input"
                    placeholder="输入 @handle 或名称搜索..."
                    value={kolSearch}
                    onChange={(e) => {
                      setKolSearch(e.target.value)
                      setField('kol_id', '')
                      setShowKolDropdown(true)
                    }}
                    onFocus={() => setShowKolDropdown(true)}
                    required={!form.kol_id}
                  />
                  {showKolDropdown && kolSearch.trim() && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                      maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}>
                      {kols
                        .filter((k) => {
                          const q = kolSearch.toLowerCase().replace('@', '')
                          return k.x_handle.includes(q) || (k.display_name ?? '').toLowerCase().includes(q)
                        })
                        .slice(0, 8)
                        .map((k) => (
                          <div
                            key={k.id}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}
                            onMouseDown={() => {
                              setField('kol_id', k.id)
                              setKolSearch(`@${k.x_handle}${k.display_name ? ` (${k.display_name})` : ''}`)
                              setShowKolDropdown(false)
                            }}
                          >
                            <span style={{ fontWeight: 500 }}>@{k.x_handle}</span>
                            {k.display_name && <span style={{ color: '#64748b', marginLeft: 6 }}>{k.display_name}</span>}
                          </div>
                        ))
                      }
                      {kols.filter((k) => {
                        const q = kolSearch.toLowerCase().replace('@', '')
                        return k.x_handle.includes(q) || (k.display_name ?? '').toLowerCase().includes(q)
                      }).length === 0 && (
                        <div style={{ padding: '8px 12px', fontSize: 12, color: '#94a3b8' }}>
                          未找到匹配的 KOL，请先在 KOL 名录中导入
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Title */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>合作名称 *</label>
              <input className="input" placeholder="e.g. @handle Q1 推文合作" value={form.title} onChange={(e) => setField('title', e.target.value)} required />
            </div>

            {/* Type */}
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>类型</label>
              <select className="select" style={{ width: '100%' }} value={form.type} onChange={(e) => setField('type', e.target.value)}>
                <option value="post">推文 Post</option>
                <option value="thread">长推 Thread</option>
                <option value="space">Space</option>
                <option value="ambassador">大使 Ambassador</option>
                <option value="review">测评 Review</option>
              </select>
            </div>

            {/* Payment method */}
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>付款方式</label>
              <select className="select" style={{ width: '100%' }} value={form.payment_method} onChange={(e) => setField('payment_method', e.target.value as PaymentMethod)}>
                <option value="fiat">法币 Fiat</option>
                <option value="token">代币 Token</option>
                <option value="ambassador">大使协议</option>
                <option value="none">无偿</option>
              </select>
            </div>

            {/* Amount */}
            {form.payment_method !== 'none' && (
              <>
                <div>
                  <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>金额</label>
                  <input className="input" type="number" placeholder="0" value={form.payment_amount} onChange={(e) => setField('payment_amount', e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>货币</label>
                  <select className="select" style={{ width: '100%' }} value={form.payment_currency} onChange={(e) => setField('payment_currency', e.target.value)}>
                    <option value="USD">USD</option>
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
              </>
            )}

            {/* Dates */}
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>开始日期</label>
              <input className="input" type="date" value={form.start_date} onChange={(e) => setField('start_date', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>结束日期</label>
              <input className="input" type="date" value={form.end_date} onChange={(e) => setField('end_date', e.target.value)} />
            </div>

            {/* Affiliate link */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>推广链接</label>
              <input className="input" placeholder="https://..." value={form.affiliate_link} onChange={(e) => setField('affiliate_link', e.target.value)} />
            </div>

            {/* Notes */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>备注</label>
              <textarea className="input" style={{ minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '保存中...' : '创建合作'}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['', 'planned', 'active', 'completed', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => setStatusFilter(s)}
          >
            {s === '' ? '全部' : s === 'planned' ? '计划中' : s === 'active' ? '进行中' : s === 'completed' ? '已完成' : '已取消'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>暂无合作记录</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>KOL</th>
                  <th>合作名称</th>
                  <th>类型</th>
                  <th>付款</th>
                  <th>交易量</th>
                  <th>ROI</th>
                  <th>时间</th>
                  <th>状态</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const roi = calcROI(c.payment_amount, c.trading_volume)
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/kols/${c.kol?.id}`} style={{ textDecoration: 'none', color: '#3b82f6', fontSize: 13 }}>
                          @{c.kol?.x_handle}
                        </Link>
                      </td>
                      <td style={{ fontWeight: 500, fontSize: 13 }}>{c.title}</td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{c.type}</td>
                      <td style={{ fontSize: 13 }}>
                        {c.payment_method === 'none' ? (
                          <span style={{ color: '#94a3b8' }}>无偿</span>
                        ) : (
                          <span>{c.payment_currency} {c.payment_amount ? formatNumber(c.payment_amount) : '—'}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {c.trading_volume > 0 ? `$${formatNumber(c.trading_volume)}` : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td>
                        {roi != null ? (
                          <span style={{ color: roi >= 100 ? '#16a34a' : '#f59e0b', fontWeight: 600, fontSize: 13 }}>
                            {roi.toFixed(0)}%
                          </span>
                        ) : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>
                        {formatDate(c.start_date)}
                        {c.end_date && ` → ${formatDate(c.end_date)}`}
                      </td>
                      <td>
                        <span className={`badge ${COLLAB_STATUS_COLOR[c.status]}`}>
                          {c.status === 'planned' ? '计划中' : c.status === 'active' ? '进行中' : c.status === 'completed' ? '已完成' : '已取消'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <CollabStatusToggle collab={c} />
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '3px 8px', color: '#dc2626' }}
                            onClick={() => deleteCollab(c.id, c.title)}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function CollabStatusToggle({ collab }: { collab: Collaboration }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const next: Record<CollabStatus, CollabStatus> = {
    planned: 'active',
    active: 'completed',
    completed: 'completed',
    cancelled: 'cancelled',
  }

  async function advance() {
    const nextStatus = next[collab.status]
    if (nextStatus === collab.status) return
    setLoading(true)
    await fetch(`/api/collaborations/${collab.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    setLoading(false)
    router.refresh()
  }

  if (collab.status === 'completed' || collab.status === 'cancelled') return null

  return (
    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={advance} disabled={loading}>
      {loading ? '...' : collab.status === 'planned' ? '→ 启动' : '→ 完成'}
    </button>
  )
}
