'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BatchAnalyzeButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/kols/batch-analyze', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setResult(`已分析 ${json.analyzed}/${json.total} 位 KOL`)
        router.refresh()
      } else {
        setResult(json.error ?? '分析失败')
      }
    } catch {
      setResult('请求失败')
    }
    setLoading(false)
    setTimeout(() => setResult(null), 5000)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? 'AI 分析中...' : 'AI 批量分析'}
      </button>
      {result && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          padding: '6px 12px',
          background: '#0f172a',
          color: '#f8fafc',
          borderRadius: 6,
          fontSize: 12,
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}>
          {result}
        </div>
      )}
    </div>
  )
}
