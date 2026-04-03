import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { formatNumber } from '@/lib/utils'
import Anthropic from '@anthropic-ai/sdk'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

async function sendMessage(chatId: string, text: string) {
  if (!BOT_TOKEN) return
  // Telegram has 4096 char limit, truncate if needed
  const truncated = text.length > 4000 ? text.substring(0, 4000) + '...' : text
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: truncated, parse_mode: 'HTML' }),
  }).catch(async () => {
    // If HTML parse fails, retry without parse_mode
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: truncated }),
    })
  })
}

// ============================================================
// AI Chat - same brain as /chat page
// ============================================================
// Simple per-chat conversation history (in-memory, clears on cold start)
const chatHistory = new Map<string, { role: 'user' | 'assistant'; content: string }[]>()

async function handleAIChat(chatId: string, userMessage: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const baseURL = process.env.ANTHROPIC_BASE_URL
  if (!apiKey) {
    await sendMessage(chatId, '⚠️ AI 未配置（缺少 ANTHROPIC_API_KEY）')
    return
  }

  // Build KOL context
  const { data: kols } = await supabase
    .from('kols_with_computed')
    .select('x_handle, display_name, language, tier, followers_count, avg_engagement_rate, status, potential_roles, has_private_community')
    .not('x_handle', 'like', '__competitor__%')
    .order('followers_count', { ascending: false })
    .limit(50)

  const kolSummary = (kols ?? []).map((k) => {
    const roles = (k.potential_roles ?? []).join('/')
    return `@${k.x_handle} (${k.display_name ?? '—'}) | Tier ${k.tier} | ${k.followers_count} 粉 | ${k.avg_engagement_rate ?? 0}% 互动 | ${k.language} | ${k.status} | 角色:${roles || '未分析'}`
  }).join('\n')

  const { data: statsData } = await supabase.from('kols').select('id').not('x_handle', 'like', '__competitor__%')
  const totalKols = statsData?.length ?? 0

  const systemPrompt = `你是 En·flunce Radar 的 AI 助手，通过 Telegram Bot 与用户交互。你服务于一个 Prediction Market KOL 发现与 CRM 管理平台。

## 你的核心能力

1. **KOL 数据查询**：回答关于 KOL 数据库的问题（互动率、Tier、语区、合作状态等）
2. **合作策略建议**：根据 KOL 画像给出个性化合作建议
3. **操作指引**：告诉用户如何通过指令操作 Radar（/add、/search、/kols、/daily、/analyze）
4. **日报生成**：汇总 KOL 活跃度和合作进展

## 当前 KOL 数据库（共 ${totalKols} 位，Top 50）

${kolSummary}

## Telegram 可用指令
/kols - 最新10位KOL
/search <关键词> - 搜索KOL
/add <handle> - 添加KOL到名录
/analyze <handle> - AI分析KOL
/daily - 今日日报
/help - 查看帮助

## 回答规则
- 使用用户的语言（中文或英文）
- 引用具体 @handle 和数据
- 保持简洁（Telegram 消息不宜过长）
- 需要操作时给出具体指令`

  const client = new Anthropic({ apiKey, ...(baseURL && { baseURL }) })

  // Get or create history for this chat
  const history = chatHistory.get(chatId) ?? []
  history.push({ role: 'user', content: userMessage })

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: history.slice(-10), // Keep last 10 messages
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    history.push({ role: 'assistant', content: reply })
    chatHistory.set(chatId, history.slice(-20)) // Keep last 20 for context

    await sendMessage(chatId, reply)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    await sendMessage(chatId, `⚠️ AI 错误: ${msg.substring(0, 200)}`)
  }
}

// ============================================================
// Command handlers
// ============================================================
async function handleCommand(chatId: string, command: string, args: string) {
  switch (command) {
    case '/start':
    case '/help': {
      await sendMessage(chatId, `🛰 <b>En·flunce Radar Bot</b>\n\n我是你的 KOL 管理助手，支持：\n\n<b>指令模式：</b>\n/kols - 查看最新 KOL\n/search 关键词 - 搜索 KOL\n/add handle - 添加 KOL 到名录\n/analyze handle - AI 分析 KOL\n/daily - 今日日报\n\n<b>对话模式：</b>\n直接发消息和我聊，例如：\n• 帮我找互动率最高的中文 KOL\n• @cobie 适合什么合作？\n• 本周有哪些新入库的 KOL？`)
      return
    }

    case '/kols': {
      const { data } = await supabase
        .from('kols_with_computed')
        .select('x_handle, display_name, followers_count, tier, status')
        .not('x_handle', 'like', '__competitor__%')
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
        .select('x_handle, display_name, followers_count, tier')
        .not('x_handle', 'like', '__competitor__%')
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

    case '/add': {
      if (!args.trim()) {
        await sendMessage(chatId, '用法: /add <handle>\n例如: /add cobie')
        return
      }
      const handle = args.replace('@', '').replace('https://x.com/', '').trim()
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

      const res = await fetch(`${baseUrl}/api/kol/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twitter_url: handle }),
      })
      const json = await res.json()

      if (res.status === 409) {
        await sendMessage(chatId, `@${handle} 已在名录中`)
      } else if (res.ok) {
        await sendMessage(chatId, `✅ 已添加 <b>@${handle}</b> 到名录\nTier ${json.tier} · ${formatNumber(json.followers_count)} 粉`)
      } else {
        await sendMessage(chatId, `❌ 添加失败: ${json.error ?? '未知错误'}`)
      }
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
        await sendMessage(chatId, `未找到 @${handle}，先用 /add ${handle} 添加`)
        return
      }

      if (kol.ai_summary) {
        const roles = (kol.potential_roles ?? []).join(', ') || '未分析'
        await sendMessage(chatId, `🤖 <b>@${kol.x_handle}</b>\n\n角色: ${roles}\n置信度: ${kol.role_confidence ?? '—'}\n\n${kol.ai_summary}`)
      } else {
        await sendMessage(chatId, `⏳ 正在分析 @${handle}...`)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
        const res = await fetch(`${baseUrl}/api/kols/${kol.id}/ai-analyze`, { method: 'POST' })
        if (res.ok) {
          const json = await res.json()
          await sendMessage(chatId, `🤖 <b>@${kol.x_handle} 分析完成</b>\n\n角色: ${(json.potential_roles ?? []).join(', ')}\n\n${json.ai_summary ?? ''}`)
        } else {
          await sendMessage(chatId, `AI 分析失败，请在平台重试`)
        }
      }
      return
    }

    case '/daily': {
      const { data: stats } = await supabase.from('kols').select('id').not('x_handle', 'like', '__competitor__%')
      const total = stats?.length ?? 0
      const { data: recent } = await supabase.from('kols').select('x_handle').not('x_handle', 'like', '__competitor__%').order('created_at', { ascending: false }).limit(3)
      const { data: active } = await supabase.from('kols').select('id').eq('status', 'active')
      const { data: collabs } = await supabase.from('collaborations').select('id').eq('status', 'active')

      const recentNames = (recent ?? []).map((k) => `@${k.x_handle}`).join(', ') || '无'
      await sendMessage(chatId, `📊 <b>日报 · En·flunce Radar</b>\n\n总 KOL: ${total}\n合作中 KOL: ${active?.length ?? 0}\n进行中合作: ${collabs?.length ?? 0}\n最新入库: ${recentNames}\n\n💡 发送任意消息和 AI 助手对话`)
      return
    }

    default:
      // Not a command — treat as AI chat
      await handleAIChat(chatId, `${command} ${args}`.trim())
  }
}

// ============================================================
// Webhook handler
// ============================================================
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

    if (text.startsWith('/')) {
      const [command, ...rest] = text.split(' ')
      await handleCommand(chatId, command.toLowerCase(), rest.join(' '))
    } else {
      // Natural language → AI chat
      await handleAIChat(chatId, text)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Telegram webhook error:', e)
    return NextResponse.json({ ok: true })
  }
}
