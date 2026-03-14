'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  kolIds: string[]
}

export default function RefreshStatsButton({ kolIds }: Props) {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    if (kolIds.length === 0) return
    if (!confirm(`刷新 ${kolIds.length} 位 KOL 的互动率和发帖数据？这可能需要几分钟。`)) return

    setRefreshing(true)
    await fetch('/api/kols/refresh-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kol_ids: kolIds }),
    })
    setRefreshing(false)
    router.refresh()
  }

  return (
    <button
      className="btn btn-secondary"
      onClick={handleRefresh}
      disabled={refreshing || kolIds.length === 0}
    >
      {refreshing ? '刷新中...' : '🔄 刷新数据'}
    </button>
  )
}
