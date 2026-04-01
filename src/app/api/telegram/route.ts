import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { formatNumber } from '@/lib/utils'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

async function sendMessage(chatId: string, text: string) {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

async function handleCommand(chatId: string, command: string, args: string) {
  switch (command) {
    case '/kols': {
      const { data } = await supabase
        .from('kols_with_computed')
        .select('x_handle, display_name, followers_count, tier, status, language')
        .order('created_at', { ascending: false })
        .limit(10)

      if (!data || data.length === 0) {
        await sendMessage(chatId, '暂无 KOL 数据')
        return
      }

      const lines = data.map((k, i) =>
        `${i + 1}. <b>${k.display_name ?? k.x_handle}</b> @${k.x_handle}\n   Tier ${k.tier} · ${formatNumber(k.followers_count)} 粉 · ${k.status}`
      )
      await sendMessage(chatId, `📋 <b>最新 KOL（${data.length}）</b>\n\n${lines.join('\n\n')}`)
      return
    }

    case '/search': {
      if (!args.trim()) {
        await sendMessage(chatId, '用法: /search <关键词>')
        return
      }
      const { data } = await supabase
        .from('kols_with_computed')
        .select('x_handle, display_name, followers_count, tier, bio')
        .or(`x_handle.ilike.%${args}%,display_name.ilike.%${args}%,bio.ilike.%${args}%`)
        .order('followers_count', { ascending: false })
        .limit(5)

      if (!data || data.length === 0) {
        await sendMessage(chatId, `未找到与「${args}」相关的 KOL`)
        return
      }

      const lines = data.map((k) =>
        `• <b>${k.display_name ?? k.x_handle}</b> @${k.x_handle}\n  Tier ${k.tier} · ${formatNumber(k.followers_count)} 粉`
      )
      await sendMessage(chatId, `🔍 搜索「${args}」结果：\n\n${lines.join('\n\n')}`)
      return
    }

    case '/analyze': {
      if (!args.trim()) {
        await sendMessage(chatId, '用法: /analyze <handle>')
        return
      }
      const handle = args.replace('@', '').trim().toLowerCase()
      const { data: kol } = await supabase
        .from('kols_with_computed')
        .select('id, x_handle, display_name, ai_summary, potential_roles, role_confidence')
        .eq('x_handle', handle)
        .single()

      if (!kol) {
        await sendMessage(chatId, `未找到 @${handle}，请先在平台中导入`)
        return
      }

      if (kol.ai_summary) {
        const roles = (kol.potential_roles ?? []).join(', ') || '未分析'
        await sendMessage(chatId, `🤖 <b>@${kol.x_handle} AI 分析</b>\n\n角色: ${roles}\n置信度: ${kol.role_confidence ?? '—'}\n\n${kol.ai_summary}`)
      } else {
        // Trigger analysis
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
        const res = await fetch(`${baseUrl}/api/kols/${kol.id}/ai-analyze`, { method: 'POST' })
        if (res.ok) {
          const json = await res.json()
          await sendMessage(chatId, `🤖 <b>@${kol.x_handle} AI 分析完成</b>\n\n角色: ${(json.potential_roles ?? []).join(', ')}\n\n${json.ai_summary ?? ''}`)
        } else {
          await sendMessage(chatId, `AI 分析失败，请在平台上重试`)
        }
      }
      return
    }

    case '/daily': {
      const { data: stats } = await supabase.from('kols').select('id', { count: 'exact' })
      const total = stats?.length ?? 0

      const { data: recent } = await supabase
        .from('kols')
        .select('x_handle, display_name')
        .order('created_at', { ascending: false })
        .limit(3)

      const { data: active } = await supabase
        .from('kols')
        .select('id')
        .eq('status', 'active')

      const recentNames = (recent ?? []).map((k) => `@${k.x_handle}`).join(', ') || '无'
      await sendMessage(chatId, `📊 <b>日报 · En·flunce Radar</b>\n\n总 KOL: ${total}\n合作中: ${active?.length ?? 0}\n最新入库: ${recentNames}`)
      return
    }

    default:
      await sendMessage(chatId, `可用指令:\n/kols - 最新10位KOL\n/search <关键词> - 搜索KOL\n/analyze <handle> - AI分析\n/daily - 日报`)
  }
}

export async function POST(req: NextRequest) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'Telegram Bot 未配置' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const message = body.message

    if (!message?.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = String(message.chat.id)

    // Optional: restrict to specific chat
    if (CHAT_ID && chatId !== CHAT_ID) {
      return NextResponse.json({ ok: true })
    }

    const text = message.text.trim()
    const [command, ...rest] = text.split(' ')
    const args = rest.join(' ')

    await handleCommand(chatId, command.toLowerCase(), args)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Telegram webhook error:', e)
    return NextResponse.json({ ok: true })
  }
}
