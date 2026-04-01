import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Language, Tier } from '@/types'

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
  if (followers >= 100_000) return 'A'
  if (followers >= 50_000 && rate >= 1) return 'A'
  if (followers >= 10_000 || (followers >= 5_000 && rate >= 2)) return 'B'
  return 'C'
}

export function detectLanguage(bio: string | null, displayName: string | null): Language {
  const text = `${displayName ?? ''} ${bio ?? ''}`
  if (!text.trim()) return 'en'

  const zhChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g)?.length ?? 0
  const koChars = text.match(/[\uac00-\ud7af\u1100-\u11ff]/g)?.length ?? 0
  const viDiacritics = text.match(/[ăâđêôơư]/gi)?.length ?? 0
  const trChars = text.match(/[ğışçöüĞİŞÇÖÜ]/g)?.length ?? 0
  const totalLen = text.replace(/\s+/g, '').length || 1

  const zhRatio = zhChars / totalLen
  const koRatio = koChars / totalLen

  if (zhRatio > 0.15 && koRatio > 0.05) return 'bilingual'
  if (zhRatio > 0.1 || zhChars >= 5) return 'zh'
  if (koRatio > 0.1 || koChars >= 5) return 'ko'
  if (viDiacritics >= 3) return 'vi'
  if (trChars >= 3) return 'tr'
  return 'en'
}

export function clampEngagementRate(rate: number, followers: number): number {
  if (followers < 100) return 0
  return Math.min(Math.round(rate * 100) / 100, 20)
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
