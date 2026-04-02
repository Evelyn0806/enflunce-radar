import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const baseURL = process.env.ANTHROPIC_BASE_URL

  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API Key 未配置' }, { status: 500 })
  }

  const { message, history } = await req.json() as {
    message: string
    history: { role: 'user' | 'assistant'; content: string }[]
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: '请输入问题' }, { status: 400 })
  }

  // Build KOL database context
  const { data: kols } = await supabase
    .from('kols_with_computed')
    .select('x_handle, display_name, language, tier, followers_count, avg_engagement_rate, status, status_flag, potential_roles, has_private_community, bio, ai_summary')
    .order('followers_count', { ascending: false })
    .limit(50)

  const kolSummary = (kols ?? []).map((k) => {
    const roles = (k.potential_roles ?? []).join('/')
    return `@${k.x_handle} (${k.display_name ?? '—'}) | Tier ${k.tier} | ${k.followers_count} 粉 | ${k.avg_engagement_rate ?? 0}% 互动 | ${k.language} | ${k.status} | 角色:${roles || '未分析'} | 私域:${k.has_private_community ? '有' : '无'}`
  }).join('\n')

  const { data: statsData } = await supabase.from('kols').select('id', { count: 'exact' })
  const totalKols = statsData?.length ?? 0

  const systemPrompt = `你是 En·flunce Radar 的 AI 助手，服务于一个 Prediction Market KOL 发现与 CRM 管理平台。你同时也是 Telegram Bot "Radar" 的大脑，与平台深度联动。

## 你的核心能力场景

1. **实时通知**：KOL 发新帖、合作状态变更时，你可以通过 Telegram Bot 推送到用户的 TG 群，确保团队第一时间知道动态。
2. **移动操作**：用户不开电脑也能通过 Telegram 发送 /add @handle 添加 KOL、/status 查看合作进度、/search 搜索 KOL，你负责理解指令并调用平台 API 执行。
3. **团队协作**：多人在同一个 TG 群里通过 Bot 操作同一个 Radar 数据库，你要确保回复清晰、操作准确，让团队高效协同。
4. **KOL 互动**：Bot 可以部署到 KOL 的社群里，你负责自动收集 KOL 对项目的反馈、情绪、合作意向，并汇总给运营团队。
5. **日报/周报**：你可以定时生成 KOL 活跃度报告、合作 ROI 摘要、新增 KOL 盘点，通过 Telegram 推送给团队。

## 当前 KOL 数据库（共 ${totalKols} 位，以下为 Top 50）

${kolSummary}

## 回答规则

- 使用用户提问的语言（中文或英文）
- 引用具体数据和 @handle，不要泛泛而谈
- 如果用户问的 KOL 不在数据库中，告知并建议在发现页搜索导入
- 涉及操作建议时，给出具体步骤（如"在 CRM 页面新增合作"或"在 TG 群发送 /analyze @handle"）
- 分析要有深度，结合粉丝数、互动率、语区、私域社群等多维度
- 当用户问合作策略时，结合 KOL 的 Tier、内容风格、受众画像给出个性化建议`

  const client = new Anthropic({
    apiKey,
    ...(baseURL && { baseURL })
  })

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...history.slice(-10),
    { role: 'user', content: message },
  ]

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Chat API error:', msg)
    return NextResponse.json({ error: `AI 请求失败: ${msg}` }, { status: 500 })
  }
}
