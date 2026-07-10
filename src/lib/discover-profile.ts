export const CORE_PM_TERMS = [
  'prediction market',
  'prediction markets',
  'forecast market',
  'forecast markets',
  'event market',
  'event markets',
  // Platforms — main PM brands (including Polymarket competitors)
  'polymarket',
  'kalshi',
  'manifold',
  'polycop',
  'predict.fun',
  'predictfun',
  'predictdotfun',
  'limitless',
  'limitless exchange',
  'myriad',
  'myriad markets',
  'augur',
  'zeitgeist',
  '预测市场',
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

// Sports-betting accounts (NFL/NBA picks, parlays) — NOT the prediction-market audience we want.
export const SPORTS_BLOCK_TERMS = [
  'nfl',
  'nba',
  'mlb',
  'nhl',
  'ufc',
  'sportsbook',
  'draftkings',
  'fanduel',
  'parlay',
  'parlays',
  'moneyline',
  'spread pick',
  'lock of the day',
  'bet slip',
  'college football',
  'soccer picks',
  'football picks',
  'basketball picks',
  'sports betting',
  'sports bettor',
  'sports handicapper',
  'handicapper',
  'over/under',
  'prop bets',
  'game picks',
  'daily picks',
  'best bets',
]

// PM 撸毛 (airdrop farmer) — hunters of Polymarket / Limitless / Myriad points, testnets, referral programs.
// Broad term list covers Chinese + English airdrop farming slang so we don't miss either audience.
export const PM_AIRDROP_TERMS = [
  // English — core
  'airdrop',
  'airdrops',
  'airdrop hunter',
  'airdrop farmer',
  'points',
  'points program',
  'points hunter',
  'farming',
  'farmer',
  'farming alpha',
  'alpha hunter',
  'testnet',
  'mainnet',
  'referral',
  'referral code',
  'early access',
  'early adopter',
  'early user',
  'incentive',
  'incentives',
  'quest',
  'quests',
  'launchpad',
  'whitelist',
  'ido',
  'ieo',
  'eligible',
  'degen airdrop',
  // Chinese — core
  '空投',
  '撸毛',
  '积分',
  '早期',
  '交互',
  '内测',
  // Chinese — slang
  '空投猎手',
  '羊毛党',
  '撸空投',
  '捡毛',
  '打新',
  '首发',
  '内测号',
  '早鸟',
  '白名单',
  '预留',
]

// Stock/crypto trader accounts — also NOT prediction markets.
export const STOCK_BLOCK_TERMS = [
  'stocks trader',
  'options trader',
  'call options',
  'put options',
  'wallstreetbets',
  'wsb',
  'day trading',
  'day trader',
  'stock alerts',
  'stock picks',
  'penny stocks',
  'swing trader',
  'shitcoin',
  'memecoin',
  'defi degen',
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

// PM_ECOSYSTEM: the 4 primary platforms + prediction-market topic word.
// Searching any one of them should surface KOLs from the others too — they're all competitors sharing the same audience.
const PM_ECOSYSTEM = ['polymarket', 'kalshi', 'myriad markets', 'predict.fun', 'prediction market']

const BRAND_EXPANSIONS: Record<string, string[]> = {
  polycop:    ['polycop', 'polymarket', 'prediction market', 'trading bot', 'terminal'],
  polymarket: [...PM_ECOSYSTEM, 'event market', 'forecast market', 'trader'],
  kalshi:     [...PM_ECOSYSTEM, 'event market', 'forecast market', 'trader'],
  myriad:     [...PM_ECOSYSTEM, 'event market', 'forecast market', 'trader'],
  predictfun: [...PM_ECOSYSTEM, 'event market', 'forecast market', 'trader'],
  manifold:   [...PM_ECOSYSTEM, 'manifold', 'forecast market', 'trader'],
  limitless:  [...PM_ECOSYSTEM, 'limitless exchange', 'trader'],
  predict:    [...PM_ECOSYSTEM, 'limitless exchange', 'forecast market'],
  prediction: [...PM_ECOSYSTEM, 'event market', 'forecast market'],
}

export const BRAND_HANDLE_HINTS: Record<string, string[]> = {
  polycop: ['polycop_trader', 'polyzoneapp', 'polymarket', 'askpolymarket'],
  polymarket: ['polymarket', 'askpolymarket', 'polymarketmoney', 'polymarketintel', 'poly_data'],
  kalshi: ['kalshi', 'kalshiapp'],
  predictfun: ['predictdotfun', 'predict_fun', 'predictfun', 'predict_dot_fun'],
  predict: ['predictdotfun', 'predict_fun', 'polymarket', 'kalshi'],
  limitless: ['limitless_exchange', 'limitlessapp', 'trylimitless'],
  myriad: ['myriad_markets', 'myriadmarkets'],
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
      terms.add('polymarket')
      terms.add('kalshi')
      terms.add('predict.fun')
      terms.add('prediction market')
      terms.add('event market')
      terms.add('limitless exchange')
    }
  }

  return [...terms].slice(0, 12)
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
