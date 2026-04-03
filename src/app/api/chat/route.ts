import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getTwikitUser, getTwikitUserTweets, TwikitTweet } from '@/lib/twikit'
import Anthropic from '@anthropic-ai/sdk'

// Detect if user is asking about recent trends/hot topics/tweets
function wantsTrends(msg: string): boolean {
  const lower = msg.toLowerCase()
  const keywords = ['热点', '趋势', '最近', '过去', '小时', 'trend', 'hot', 'recent', 'latest', '动态', '在聊什么', '在讨论', '推文', 'tweet', '发了什么', '说了什么']
  return keywords.some((k) => lower.includes(k))
}

// Fetch recent tweets from top KOLs
async function fetchRecentTrends(limit = 10): Promise<string> {
  const { data: kols } = await supabase
    .from('kols')
    .select('x_handle, display_name, followers_count, tier')
    .not('x_handle', 'like', '__competitor__%')
    .order('followers_count', { ascending: false })
    .limit(limit)

  if (!kols || kols.length === 0) return '暂无 KOL 数据'

  const allTweets: { handle: string; name: string; tier: string; tweet: TwikitTweet }[] = []

  for (const kol of kols) {
    try {
      const user = await getTwikitUser(kol.x_handle)
      if (!user?.id) continue
      const tweets = await getTwikitUserTweets(user.id, 5)
      for (const t of tweets) {
        allTweets.push({ handle: kol.x_handle, name: kol.display_name ?? kol.x_handle, tier: kol.tier, tweet: t })
      }
    } catch {
      // Skip on rate limit or error
    }
    // Stop if we have enough
    if (allTweets.length >= 30) break
  }

  if (allTweets.length === 0) return '未能获取到最近推文（可能触发限流），请稍后再试'

  // Sort by recency
  allTweets.sort((a, b) => {
    const da = a.tweet.created_at ? new Date(a.tweet.created_at).getTime() : 0
    const db = b.tweet.created_at ? new Date(b.tweet.created_at).getTime() : 0
    return db - da
  })

  return allTweets.slice(0, 10).map((t) => {
    const eng = t.tweet.favorite_count + t.tweet.retweet_count + t.tweet.reply_count
    return `@${t.handle}: ${t.tweet.text.substring(0, 100)} [互动:${eng}]`
  }).join('\n')
}

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
    .not('x_handle', 'like', '__competitor__%')
    .order('followers_count', { ascending: false })
    .limit(50)

  const kolSummary = (kols ?? []).slice(0, 30).map((k) => {
    return `@${k.x_handle} | Tier ${k.tier} | ${k.followers_count} 粉 | ${k.avg_engagement_rate ?? 0}% | ${k.language} | ${k.status}`
  }).join('\n')

  const { data: statsData } = await supabase.from('kols').select('id').not('x_handle', 'like', '__competitor__%')
  const totalKols = statsData?.length ?? 0

  // If user asks about trends, fetch real-time tweets
  let trendsContext = ''
  if (wantsTrends(message)) {
    trendsContext = await fetchRecentTrends(10)
  }

  const systemPrompt = `你叫 Radar，是 En·flunce Radar 平台的 AI 助手。

## 核心能力

1. KOL 数据查询（互动率、Tier、语区、合作状态等）
2. 合作策略建议
3. **实时热点分析**：你可以获取 KOL 最近的推文数据，分析赛道热点和趋势
4. 日报/周报生成

## 回答规则

- 使用用户的语言回答
- 引用具体 @handle 和数据，不编造
- 不确定就说不确定，不瞎猜
- 分析热点时要总结主题、情绪、关键事件，不要只罗列推文

## 当前 KOL 数据库（共 ${totalKols} 位，Top 50）

${kolSummary}
${trendsContext ? `\n## KOL 最近推文（实时数据）\n\n${trendsContext}` : ''}`

  const client = new Anthropic({
    apiKey,
    ...(baseURL && { baseURL })
  })

  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...history.slice(-10),
    { role: 'user', content: message },
  ]

  // Prepend context as first user message to avoid system prompt issues with some API proxies
  const contextMessage = { role: 'user' as const, content: `[Context for this conversation - do not repeat this back]\n${systemPrompt}\n\nNow respond to the conversation below.` }
  const contextReply = { role: 'assistant' as const, content: 'Understood. I will use this context to answer questions.' }

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [contextMessage, contextReply, ...messages],
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Chat API error:', msg)
    return NextResponse.json({ error: `AI 请求失败: ${msg}` }, { status: 500 })
  }
}
