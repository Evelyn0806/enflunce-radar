export type Language = 'zh' | 'en' | 'ko' | 'tr' | 'vi' | 'bilingual'
export type Tier = 'A' | 'B' | 'C'
export type KolStatus = 'pending' | 'watching' | 'negotiating' | 'active' | 'paused' | 'terminated'
export type StatusFlag = 'none' | 'star' | 'stop' | 'urgent'
export type RoleConfidence = 'low' | 'medium' | 'high'
export type CollabStatus = 'planned' | 'active' | 'completed' | 'cancelled'
export type PaymentMethod = 'fiat' | 'token' | 'ambassador' | 'none'

export type KolRole =
  | 'evangelist'
  | 'educator'
  | 'trader'
  | 'analyst'
  | 'builder'
  | 'influencer'
  | 'ambassador'

export interface Kol {
  id: string
  created_at: string
  updated_at: string

  // 基本信息
  x_handle: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null

  // 分类
  language: Language
  tier: Tier

  // X 数据
  followers_count: number
  following_count: number
  posts_count: number
  avg_engagement_rate: number | null
  last_post_at: string | null
  is_silent: boolean

  // XHunt
  xhunt_rank_zh: number | null
  xhunt_rank_en: number | null
  xhunt_score: number | null
  xhunt_follower_overlap: number | null
  xhunt_updated_at: string | null

  // 私域
  has_private_community: boolean
  community_platforms: string[] | null
  community_links: string[] | null

  // 关键词
  keyword_post_ratio: number | null
  tracked_keywords: string[] | null

  // 角色分析
  potential_roles: KolRole[] | null
  role_confidence: RoleConfidence | null
  role_analysis_notes: string | null
  role_analyzed_at: string | null

  // 合作状态
  status: KolStatus
  status_flag: StatusFlag
  notes: string | null

  // 竞品
  competitor_affiliations: string[] | null

  // AI 摘要
  ai_summary: string | null
  ai_summary_updated_at: string | null

  // 视图计算字段
  computed_tier?: Tier
  in_xhunt_zh_top100?: boolean
  in_xhunt_en_top100?: boolean
}

export interface Collaboration {
  id: string
  created_at: string
  kol_id: string
  title: string
  type: string | null
  payment_method: PaymentMethod | null
  payment_amount: number | null
  payment_currency: string
  start_date: string | null
  end_date: string | null
  renewal_reminder_at: string | null
  affiliate_link: string | null
  clicks: number
  registrations: number
  trading_volume: number
  roi: number | null
  status: CollabStatus
  content_url: string | null
  notes: string | null
}

export interface CommunicationLog {
  id: string
  created_at: string
  kol_id: string
  collaboration_id: string | null
  channel: string | null
  direction: 'inbound' | 'outbound'
  summary: string
  next_action: string | null
  next_action_due: string | null
}

export interface HealthSnapshot {
  id: string
  recorded_at: string
  kol_id: string
  followers_count: number | null
  posts_count: number | null
  engagement_rate: number | null
  keyword_post_count: number | null
}

export interface CompetitorKolMap {
  id: string
  created_at: string
  kol_id: string
  competitor: string
  evidence_url: string | null
  detected_at: string
  notes: string | null
}

// UI 常量
export const STATUS_CONFIG: Record<KolStatus, { label: string; labelZh: string; color: string }> = {
  pending:     { label: 'Pending',     labelZh: '待接触', color: 'bg-gray-100 text-gray-600' },
  watching:    { label: 'Watching',    labelZh: '观望中', color: 'bg-yellow-100 text-yellow-700' },
  negotiating: { label: 'Negotiating', labelZh: '洽谈中', color: 'bg-blue-100 text-blue-700' },
  active:      { label: 'Active',      labelZh: '合作中', color: 'bg-green-100 text-green-700' },
  paused:      { label: 'Paused',      labelZh: '暂缓',   color: 'bg-orange-100 text-orange-700' },
  terminated:  { label: 'Terminated',  labelZh: '已终止', color: 'bg-red-100 text-red-700' },
}

export const FLAG_CONFIG: Record<StatusFlag, { icon: string; label: string }> = {
  none:   { icon: '',  label: '' },
  star:   { icon: '⭐', label: '观望' },
  stop:   { icon: '🚫', label: '暂缓' },
  urgent: { icon: '❗', label: '尽快接触' },
}

export const ROLE_CONFIG: Record<KolRole, { label: string; labelZh: string; color: string }> = {
  evangelist: { label: 'Evangelist',  labelZh: '布道者',   color: 'bg-purple-100 text-purple-700' },
  educator:   { label: 'Educator',    labelZh: '教育者',   color: 'bg-blue-100 text-blue-700' },
  trader:     { label: 'Trader',      labelZh: '交易者',   color: 'bg-green-100 text-green-700' },
  analyst:    { label: 'Analyst',     labelZh: '分析师',   color: 'bg-cyan-100 text-cyan-700' },
  builder:    { label: 'Builder',     labelZh: '建设者',   color: 'bg-orange-100 text-orange-700' },
  influencer: { label: 'Influencer',  labelZh: '影响者',   color: 'bg-pink-100 text-pink-700' },
  ambassador: { label: 'Ambassador',  labelZh: '大使',     color: 'bg-yellow-100 text-yellow-700' },
}

export const TIER_CONFIG: Record<Tier, { color: string; bg: string }> = {
  A: { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  B: { color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  C: { color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200' },
}

export const LANGUAGE_CONFIG: Record<Language, { label: string; flag: string }> = {
  zh:       { label: '中文',   flag: '🇨🇳' },
  en:       { label: 'English', flag: '🇺🇸' },
  ko:       { label: '한국어',  flag: '🇰🇷' },
  tr:       { label: 'Türkçe', flag: '🇹🇷' },
  vi:       { label: 'Tiếng Việt', flag: '🇻🇳' },
  bilingual:{ label: '双语',   flag: '🌐' },
}
