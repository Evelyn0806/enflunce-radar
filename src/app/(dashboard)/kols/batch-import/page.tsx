'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BatchImportPage() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; total: number } | null>(null)
  const [error, setError] = useState('')

  async function handleImport() {
    const handles = input
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    if (handles.length === 0) {
      setError('请输入至少一个 @handle')
      return
    }

    setImporting(true)
    setError('')
    setResult(null)

    const res = await fetch('/api/kols/batch-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handles }),
    })

    const json = await res.json()
    setImporting(false)

    if (res.ok) {
      setResult(json)
      setInput('')
    } else {
      setError(json.error ?? '导入失败')
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>批量导入 KOL</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          粘贴 @handle 列表，每行一个，自动从 X 获取详细信息
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 8 }}>
          @handle 列表（每行一个）
        </label>
        <textarea
          className="input"
          style={{ minHeight: 300, fontFamily: 'monospace', fontSize: 13 }}
          placeholder={'@gainzy222\n@farokh\n@PixOnChain\n@cobie\n@sanyi_eth_'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={importing}
        />
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={importing || input.trim().length === 0}
          >
            {importing ? '导入中...' : '开始导入'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/kols')}
          >
            返回名录
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ padding: 12, background: '#f0fdf4', color: '#16a34a', borderRadius: 8, fontSize: 13 }}>
          ✓ 成功导入 {result.imported} / {result.total} 位 KOL
        </div>
      )}
    </div>
  )
}
