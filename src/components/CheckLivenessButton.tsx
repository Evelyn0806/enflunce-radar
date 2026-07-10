'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  kolIds: string[]
}

interface CheckResult {
  total: number
  alive: number
  dead: number
  unknown: number
}

export default function CheckLivenessButton({ kolIds }: Props) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<CheckResult | null>(null)

  async function handleCheck() {
    if (kolIds.length === 0) return
    if (!confirm(`验活检查 ${kolIds.length} 位 KOL？会逐个探测 X 账号是否存在，大约 ${Math.ceil(kolIds.length * 1.5 / 60)} 分钟。`)) return

    setRunning(true)
    try {
      const res = await fetch('/api/kols/check-liveness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kol_ids: kolIds }),
      })
      const json = await res.json()
      if (res.ok) {
        setLastResult({ total: json.total, alive: json.alive, dead: json.dead, unknown: json.unknown })
        alert(`验活完成！共 ${json.total} 位：\n✅ 存活 ${json.alive}\n❌ 已失效 ${json.dead}\n❓ 无法判断 ${json.unknown}`)
        router.refresh()
      } else {
        alert(`失败：${json.error ?? '未知错误'}`)
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <button
      className="btn btn-secondary"
      onClick={handleCheck}
      disabled={running || kolIds.length === 0}
      title={lastResult ? `上次：存活 ${lastResult.alive} · 失效 ${lastResult.dead}` : '批量探测 X 账号是否失效'}
    >
      {running ? '验活中...' : '💓 验活检查'}
    </button>
  )
}
