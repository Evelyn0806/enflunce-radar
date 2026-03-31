'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Language } from '@/types'

interface Props { onClose: () => void }

export default function AddKolModal({ onClose }: Props) {
  const router = useRouter()
  const [handle, setHandle] = useState('')
  const [language, setLanguage] = useState<Language>('en')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!handle.trim()) return
    setLoading(true)
    setError('')

    const cleanHandle = handle.trim().replace(/^@/, '')

    const res = await fetch('/api/kols', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x_handle: cleanHandle, language }),
    })

    if (res.ok) {
      const { id } = await res.json()
      router.push(`/kols/${id}`)
      onClose()
    } else {
      const { error: msg } = await res.json()
      setError(msg ?? '添加失败')
    }
    setLoading(false)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card" style={{ width: 420, padding: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>添加 KOL / KOC</h2>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>
              X Handle（Twitter @）
            </label>
            <input
              className="input"
              placeholder="@elonmusk 或 elonmusk"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>
              主要语区
            </label>
            <select
              className="select"
              style={{ width: '100%' }}
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              <option value="zh">🇨🇳 中文</option>
              <option value="en">🇺🇸 English</option>
              <option value="ko">🇰🇷 한국어</option>
              <option value="tr">🇹🇷 Türkçe</option>
              <option value="vi">🇻🇳 Tiếng Việt</option>
              <option value="bilingual">🌐 双语</option>
            </select>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 6 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? '添加中...' : '确认添加'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
          </div>
        </form>

        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 14, lineHeight: 1.6 }}>
          添加后系统会自动通过 Twikit 拉取基础数据（粉丝数、最近发帖时间等）
        </p>
      </div>
    </div>
  )
}
