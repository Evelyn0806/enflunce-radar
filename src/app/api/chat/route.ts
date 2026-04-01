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

  const systemPrompt = `你是 En·flunce Radar 的 AI 助手，一个专注于 Prediction Market KOL 的发现与管理平台。

当前 KOL 数据库摘要（共 ${totalKols} 位 KOL，以下为 Top 50）:
${kolSummary}

你的职责：
1. 回答关于 KOL 数据库的问题（谁是互动率最高的？哪些中文 KOL 适合合作？）
2. 提供合作策略建议
3. 分析 KOL 特征和优劣势
4. 帮助用户做决策（选择合作对象、评估ROI等）

回答时：
- 使用用户提问的语言（中文或英文）
- 引用具体数据，不要泛泛而谈
- 如果用户问的 KOL 不在数据库中，告知并建议在发现页搜索导入
- 保持简洁，但分析要有深度`

  const client = new Anthropic({
    apiKey,
    ...(baseURL && { baseURL })
  })

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...history.slice(-10),
    { role: 'user', content: message },
  ]

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const reply = response.content[0].type === 'text' ? response.content[0].text : ''

  return NextResponse.json({ reply })
}
