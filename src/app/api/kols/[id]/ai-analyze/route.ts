import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { KolRole, RoleConfidence } from '@/types'

const ROLES: KolRole[] = ['evangelist', 'educator', 'trader', 'analyst', 'builder', 'influencer', 'ambassador']

const ROLE_DESCRIPTIONS: Record<KolRole, string> = {
  evangelist:  'Spreads belief in the project/ecosystem, drives narrative',
  educator:    'Creates tutorials, explainers, how-to content',
  trader:      'Focuses on trading signals, PnL, market movements',
  analyst:     'Deep research, on-chain data, market analysis',
  builder:     'Builds tools, protocols, or technical infrastructure',
  influencer:  'Large reach, brand awareness, viral content',
  ambassador:  'Formal partnership, represents the brand',
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const apiKey = process.env.ANTHROPIC_API_KEY
  const baseURL = process.env.ANTHROPIC_BASE_URL

  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API Key 未配置' }, { status: 500 })
  }

  // Fetch KOL data
  const { data: kol, error } = await supabase
    .from('kols_with_computed')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !kol) {
    return NextResponse.json({ error: 'KOL not found' }, { status: 404 })
  }

  const client = new Anthropic({
    apiKey,
    ...(baseURL && { baseURL })
  })

  const prompt = `You are an expert KOL analyst for a prediction market platform (Polymarket-like). Analyze this crypto KOL on X (Twitter).

KOL Profile:
- Handle: @${kol.x_handle}
- Display Name: ${kol.display_name ?? 'N/A'}
- Bio: ${kol.bio ?? 'No bio available'}
- Followers: ${kol.followers_count?.toLocaleString()}
- Following: ${kol.following_count?.toLocaleString()}
- Posts: ${kol.posts_count?.toLocaleString()}
- Language: ${kol.language}
- Engagement Rate: ${kol.avg_engagement_rate != null ? kol.avg_engagement_rate + '%' : 'Unknown'}
- Has Private Community: ${kol.has_private_community ? 'Yes' : 'No'}

Available roles: ${ROLES.map((r) => `${r} (${ROLE_DESCRIPTIONS[r]})`).join(', ')}

Tasks:
1. Identify 1-3 roles that best fit this KOL
2. Rate confidence: low, medium, or high
3. Write a 2-3 sentence summary (in the same language as the KOL's primary language)
4. Determine content style: one of "educational", "entertainment", "data-driven", "news", "opinion", "mixed"
5. Describe target audience in 1 sentence (demographics, interests, crypto experience level)
6. Rate collaboration value 1-10 (10 = highest value for prediction market partnership)
7. Suggest the best collaboration type: one of "sponsored_post", "ambassador", "content_series", "community_collab", "event_host", "data_partnership"
8. Brief analysis notes explaining your reasoning

IMPORTANT: Respond ONLY with valid JSON, no other text:
{
  "potential_roles": ["role1", "role2"],
  "role_confidence": "medium",
  "ai_summary": "...",
  "content_style": "educational",
  "audience_profile": "...",
  "collab_value_score": 7,
  "recommended_collab_type": "ambassador",
  "role_analysis_notes": "..."
}`

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  let parsed: {
    potential_roles: KolRole[]
    role_confidence: RoleConfidence
    ai_summary: string
    content_style?: string
    audience_profile?: string
    collab_value_score?: number
    recommended_collab_type?: string
    role_analysis_notes: string
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({
        error: 'AI 返回格式错误：未找到JSON',
        raw: text.substring(0, 500)
      }, { status: 500 })
    }
    parsed = JSON.parse(jsonMatch[0])
  } catch (e) {
    return NextResponse.json({
      error: 'AI 返回格式错误：JSON解析失败',
      raw: text.substring(0, 500),
      parseError: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }

  // Validate roles
  parsed.potential_roles = (parsed.potential_roles ?? []).filter((r) => ROLES.includes(r))

  // Store extended analysis in role_analysis_notes as JSON
  const extendedAnalysis = JSON.stringify({
    notes: parsed.role_analysis_notes,
    content_style: parsed.content_style ?? 'mixed',
    audience_profile: parsed.audience_profile ?? '',
    collab_value_score: parsed.collab_value_score ?? 5,
    recommended_collab_type: parsed.recommended_collab_type ?? 'sponsored_post',
  })

  // Save to DB
  await supabase.from('kols').update({
    potential_roles: parsed.potential_roles,
    role_confidence: parsed.role_confidence,
    role_analysis_notes: extendedAnalysis,
    role_analyzed_at: new Date().toISOString(),
    ai_summary: parsed.ai_summary,
    ai_summary_updated_at: new Date().toISOString(),
  }).eq('id', id)

  return NextResponse.json(parsed)
}
