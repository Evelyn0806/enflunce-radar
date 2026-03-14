import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Tier } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function computeTier(followers: number, engagementRate: number | null): Tier {
  const rate = engagementRate ?? 0
  if (followers >= 50000 && rate >= 2) return 'A'
  if (followers >= 10000 || (followers >= 5000 && rate >= 3)) return 'B'
  return 'C'
}

export function isSilent(lastPostAt: string | null): boolean {
  if (!lastPostAt) return true
  const diff = Date.now() - new Date(lastPostAt).getTime()
  return diff > 30 * 24 * 60 * 60 * 1000 // 30 days
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  })
}

export function calcROI(
  paymentAmount: number | null,
  tradingVolume: number
): number | null {
  if (!paymentAmount || paymentAmount === 0) return null
  return (tradingVolume / paymentAmount) * 100
}
