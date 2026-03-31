export const CORE_PM_TERMS = [
  'prediction market',
  'prediction markets',
  'forecast market',
  'forecast markets',
  'event market',
  'event markets',
  'polymarket',
  'kalshi',
  'manifold',
  'polycop',
]

export const TRADER_TERMS = [
  'trader',
  'copy trader',
  'copy trading',
  'edge',
  'alpha',
  'odds',
  'pricing',
  'position',
  'positions',
  'market maker',
  'arb',
  'arbitrage',
  'liquidity',
  'execution',
]

export const RESEARCH_TERMS = [
  'research',
  'researcher',
  'analysis',
  'analyst',
  'probability',
  'probabilities',
  'forecast',
  'forecasting',
  'signal',
  'signals',
  'model',
  'models',
  'backtest',
  'backtesting',
]

export const TOOL_TERMS = [
  'terminal',
  'bot',
  'tool',
  'tools',
  'tracker',
  'whale',
  'analytics',
  'dashboard',
  'api',
  'automation',
]

export const COMMUNITY_TERMS = [
  'telegram',
  'discord',
  'wechat',
  'reddit',
  'group',
  'community',
  'tg:',
  't.me',
  'discord.gg',
  'discord.com',
  '微信群',
  'wx',
]

export const PROJECT_BLOCK_TERMS = [
  'official',
  'official source',
  'app',
  'platform',
  'protocol',
  'foundation',
  'labs',
  'studio',
  'developers',
  'powered by',
  'source for updates',
  'home of',
  'largest prediction market',
  'find your edge',
  'access terminal',
  'built for',
  'premier execution layer',
  'breaking news',
  'news & insights',
  'community ran account',
]

export const PERSONAL_MARKERS = [
  'founder',
  'cofounder',
  'trader',
  'researcher',
  'analyst',
  'writer',
  'investor',
  'builder',
  'operator',
  'consultant',
  'advisor',
  'copy trader',
  'degen',
  'independent',
  'i write',
  'i look',
  'my takes',
  'my view',
  'my pov',
  'not advice',
  'dyor',
]

const BRAND_EXPANSIONS: Record<string, string[]> = {
  polycop: ['polycop', 'polymarket', 'prediction market', 'trading bot', 'terminal'],
  polymarket: ['polymarket', 'prediction market', 'event market', 'forecast market', 'trader'],
  kalshi: ['kalshi', 'prediction market', 'event market', 'forecast market', 'trader'],
  manifold: ['manifold', 'prediction market', 'forecast market', 'trader'],
}

export const BRAND_HANDLE_HINTS: Record<string, string[]> = {
  polycop: ['polycop_trader', 'polyzoneapp', 'polymarket', 'askpolymarket'],
  polymarket: ['polymarket', 'askpolymarket', 'polymarketmoney', 'polymarketintel', 'poly_data'],
  kalshi: ['kalshi', 'kalshiapp'],
}

export function normalizeKeyword(keyword: string) {
  return keyword.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function expandDiscoverKeywords(keywords: string[]) {
  const terms = new Set<string>()

  for (const keyword of keywords.slice(0, 5)) {
    const clean = keyword.trim()
    if (!clean) continue
    terms.add(clean)

    const normalized = normalizeKeyword(clean)
    for (const term of BRAND_EXPANSIONS[normalized] ?? []) {
      terms.add(term)
    }

    if (normalized.includes('poly') && normalized !== 'polymarket') {
      for (const term of BRAND_EXPANSIONS.polymarket) terms.add(term)
    }

    if (normalized.includes('predict')) {
      terms.add('prediction market')
      terms.add('forecast market')
      terms.add('event market')
    }
  }

  return [...terms].slice(0, 8)
}

export function fallbackHandlesForKeywords(keywords: string[]) {
  const handles = new Set<string>()

  for (const keyword of keywords) {
    const normalized = normalizeKeyword(keyword)
    if (!normalized) continue

    handles.add(normalized)
    handles.add(`${normalized}_trader`)
    handles.add(`${normalized}trader`)
    handles.add(`${normalized}app`)

    for (const handle of BRAND_HANDLE_HINTS[normalized] ?? []) {
      handles.add(handle)
    }
  }

  return [...handles].slice(0, 16)
}

export function countMatches(text: string, terms: string[]) {
  const lower = text.toLowerCase()
  return terms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0)
}
