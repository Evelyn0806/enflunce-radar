import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkTwikitHealth } from '@/lib/twikit'
import { sendTelegramAlert } from '@/lib/telegram-alert'

// Daily Vercel Cron (see vercel.json):
//   1. Touches Supabase so the free-tier project isn't paused for inactivity.
//   2. Probes every twikit cookie account — twikit is the only working X channel, so a dead
//      cookie silently breaks discovery. Any failure is pushed to the Radar Telegram chat.
// If CRON_SECRET is set, Vercel sends it as a Bearer token and we require it.

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const problems: string[] = []

  const { count, error } = await supabase
    .from('kols')
    .select('id', { count: 'exact', head: true })
  if (error) problems.push(`Supabase 查询失败：${error.message}`)

  let twikit: { accounts: { index: number; ok: boolean; error?: string }[] } | { error: string }
  try {
    twikit = await checkTwikitHealth()
    if (twikit.accounts.length === 0) {
      problems.push('Twikit 没有配置任何 cookie 账号（TWIKIT_COOKIES_JSON）')
    }
    for (const account of twikit.accounts) {
      if (!account.ok) problems.push(`Twikit 账号 ${account.index} 失效：${account.error ?? '搜索无结果'}`)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    twikit = { error: message }
    problems.push(`Twikit 桥无法访问：${message}`)
  }

  let alert: { sent: boolean; reason?: string } = { sent: false, reason: 'no problems' }
  if (problems.length > 0) {
    alert = await sendTelegramAlert(
      `⚠️ En·flunce Radar 每日健康检查发现问题\n\n${problems.map((p) => `• ${p}`).join('\n')}\n\n` +
      'Twikit cookie 失效时：重新登录对应 X 小号，导出 cookie，更新 Vercel 环境变量后重新部署。'
    )
  }

  return NextResponse.json(
    {
      ok: problems.length === 0,
      kols: count,
      twikit,
      problems,
      alerted: alert.sent,
      alert_error: alert.sent ? undefined : alert.reason,
      at: new Date().toISOString(),
    },
    { status: error ? 500 : 200 }
  )
}
