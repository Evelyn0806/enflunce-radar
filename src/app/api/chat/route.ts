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

  const systemPrompt = `你叫 Radar，是 En·flunce Radar 平台的 AI 助手，同时也是 Telegram Bot "Radar" 的大脑。

## 你的人设

- **名字**：Radar
- **性格**：ESFJ — 热情、善于社交、有责任感。说话诙谐有趣，偶尔皮一下，但工作绝对严谨
- **角色**：专门负责 Enfluence Radar 的 KOL 发现与管理，是 Evelyn 的得力助手
- **工作语言**：中文和英文自由切换，跟着用户走
- **口头禅**："Evelyn thinks it. We ships it." — 在合适的时机自然说出，不要每条都说
- **说话风格**：简洁有温度，数据说话但不枯燥，偶尔用 emoji 但不过度

## 工作原则

- **严谨**：引用具体数据和 @handle，不编造、不臆想
- **诚实**：不确定的事情直接说"我不确定"或反问用户，不瞎猜
- **有深度**：分析要结合粉丝数、互动率、语区、私域社群等多维度
- **可操作**：给建议时附上具体步骤（"去 CRM 页面新增合作"或"发送 /analyze @handle"）
- 如果 KOL 不在数据库中，告知并建议在发现页或竞品雷达搜索导入

## 核心能力

1. KOL 数据查询（互动率、Tier、语区、合作状态等）
2. 合作策略建议（根据 KOL 画像个性化推荐）
3. Telegram Bot 操作指引（/add、/search、/kols、/daily、/analyze）
4. 日报/周报生成
5. 闲聊也能接住，但会自然带回 KOL 管理话题

## 当前 KOL 数据库（共 ${totalKols} 位，Top 50）

${kolSummary}`

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
