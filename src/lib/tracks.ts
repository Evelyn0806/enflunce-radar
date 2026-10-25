import { CORE_PM_TERMS, isLikelyBrandAccount } from '@/lib/discover-profile'

// Crypto KOL tracks (赛道). A KOL can belong to several tracks — each is detected
// independently from bio / name / recent tweet text.

export type Track = 'prediction_market' | 'tokenized_stock' | 'defi' | 'meme' | 'ai_agent' | 'trading'

export type AccountType = 'personal' | 'brand'

interface TrackDef {
  label: string
  color: string
  // Terms matched against lowercased text. Short ASCII terms (<5 chars) need a word boundary on
  // both sides ("rwa" must not hit "forward", "wif" not "wife"); longer ones only on the left so
  // run-together handles still match ("@MyriadMarkets"). CJK terms match as substrings.
  terms: string[]
  // Default search terms when the operator picks the track without typing keywords.
  seeds: string[]
}

export const TRACKS: Record<Track, TrackDef> = {
  prediction_market: {
    label: '预测市场',
    color: 'bg-indigo-100 text-indigo-700',
    terms: CORE_PM_TERMS,
    seeds: ['polymarket', 'kalshi', 'prediction market'],
  },
  tokenized_stock: {
    label: '代币化股票',
    color: 'bg-sky-100 text-sky-700',
    terms: [
      'tokenized stock', 'tokenized stocks', 'tokenized equities', 'tokenized equity', 'stock token', 'stock tokens',
      'onchain stocks', 'on-chain stocks', 'xstocks', 'backed finance', 'rwa', 'rwas', 'real world asset',
      'real world assets', 'ondo', 'ondo finance', 'robinhood chain', 'dinari', 'securitize', 'tokenization',
      '代币化股票', '美股代币', '股票代币', '代币化', '美股上链',
    ],
    seeds: ['tokenized stocks', 'xstocks', 'RWA'],
  },
  defi: {
    label: 'DeFi',
    color: 'bg-emerald-100 text-emerald-700',
    terms: [
      'defi', 'dex', 'yield', 'yields', 'lending', 'restaking', 'liquid staking', 'staking', 'stablecoin',
      'stablecoins', 'tvl', 'liquidity provider', 'amm', 'uniswap', 'aave', 'pendle', 'eigenlayer',
      'lido', 'morpho', 'ethena', 'makerdao',
      '流动性挖矿', '质押', '借贷', '收益率', '稳定币',
    ],
    seeds: ['DeFi', 'yield', 'restaking'],
  },
  meme: {
    label: 'Meme',
    color: 'bg-pink-100 text-pink-700',
    terms: [
      'memecoin', 'memecoins', 'meme coin', 'meme coins', 'pump.fun', 'pumpfun', 'shitcoin', 'shitcoins',
      'trenches', 'degen', 'degens', '100x', '1000x', 'gem', 'gems', 'ape', 'aping', 'bonk', 'wif', 'pepe',
      'onchain degen', 'sol memes',
      '土狗', '金狗', '打狗', 'meme币', '冲狗',
    ],
    seeds: ['memecoin', 'pump.fun', 'trenches'],
  },
  ai_agent: {
    label: 'AI Agent',
    color: 'bg-violet-100 text-violet-700',
    terms: [
      'ai agent', 'ai agents', 'agentic', 'virtuals', 'ai16z', 'elizaos', 'ai x crypto', 'crypto ai',
      'deai', 'agent token', 'agent tokens', 'aixbt', 'agent economy',
      'ai代理', '智能体', 'ai agent赛道',
    ],
    seeds: ['AI agents', 'virtuals', 'crypto AI'],
  },
  trading: {
    label: '交易/合约',
    color: 'bg-amber-100 text-amber-700',
    terms: [
      'trader', 'trading', 'perps', 'perp', 'perpetuals', 'futures', 'leverage', 'technical analysis', 'chart',
      'charts', 'scalp', 'scalper', 'swing trade', 'swing trading', 'price action', 'binance', 'bybit', 'okx',
      'bitget', 'hyperliquid', 'copy trading',
      '合约', '交易员', '喊单', '技术分析', '现货', '杠杆', '带单',
    ],
    seeds: ['perps', 'crypto trader', 'hyperliquid'],
  },
}

export const ALL_TRACKS = Object.keys(TRACKS) as Track[]

export const ACCOUNT_TYPE_CONFIG: Record<AccountType, { label: string; color: string }> = {
  personal: { label: '个人', color: 'bg-gray-100 text-gray-600' },
  brand:    { label: '品牌型', color: 'bg-orange-100 text-orange-700' },
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const ASCII = /^[\x00-\x7f]+$/

const MATCHERS: Record<Track, ((lower: string) => boolean)[]> = Object.fromEntries(
  ALL_TRACKS.map((track) => [
    track,
    TRACKS[track].terms.map((term) => {
      const t = term.toLowerCase()
      if (!ASCII.test(t)) return (lower: string) => lower.includes(t)
      const tail = t.length < 5 ? '($|[^a-z0-9])' : ''
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(t)}${tail}`)
      return (lower: string) => re.test(lower)
    }),
  ])
) as Record<Track, ((lower: string) => boolean)[]>

// Number of distinct track terms found in the text.
export function trackHits(text: string, track: Track): number {
  const lower = text.toLowerCase()
  return MATCHERS[track].reduce((sum, match) => sum + (match(lower) ? 1 : 0), 0)
}

export function trackHitMap(text: string): Record<Track, number> {
  return Object.fromEntries(ALL_TRACKS.map((t) => [t, trackHits(text, t)])) as Record<Track, number>
}

export function detectTracks(text: string): Track[] {
  return ALL_TRACKS.filter((t) => trackHits(text, t) > 0)
}

export function isTrack(value: string): value is Track {
  return value in TRACKS
}

// Columns written whenever a KOL row is created/refreshed from its X profile.
export function classifyProfile(handle: string, name: string | null, bio: string | null) {
  const text = `${name ?? ''}\n${bio ?? ''}`
  return {
    tracks: detectTracks(text),
    account_type: (isLikelyBrandAccount({ screen_name: handle, name: name ?? handle, description: bio ?? '' })
      ? 'brand'
      : 'personal') as AccountType,
  }
}
