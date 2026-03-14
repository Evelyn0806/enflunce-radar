-- ============================================
-- En·flunce Radar — Supabase Database Schema
-- ============================================

-- KOL 主表
CREATE TABLE kols (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 基本信息
  x_handle TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,

  -- 分类
  language TEXT DEFAULT 'en',            -- zh / en / ko / tr / vi / bilingual
  tier TEXT DEFAULT 'C',                 -- A / B / C（自动计算）

  -- X 数据（定期更新）
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  avg_engagement_rate DECIMAL(5,2),
  last_post_at TIMESTAMPTZ,
  is_silent BOOLEAN DEFAULT false,       -- 30天无发帖

  -- XHunt 数据
  xhunt_rank_zh INTEGER,                 -- 中文 TOP100 排名
  xhunt_rank_en INTEGER,                 -- 英文 TOP100 排名
  xhunt_score DECIMAL(8,2),             -- XHunt 综合评分
  xhunt_follower_overlap DECIMAL(5,2),  -- 与我方目标用户的粉丝重叠率 %
  xhunt_updated_at TIMESTAMPTZ,

  -- 私域
  has_private_community BOOLEAN DEFAULT false,
  community_platforms TEXT[],            -- ['telegram', 'wechat', 'discord']
  community_links TEXT[],

  -- 关键词追踪
  keyword_post_ratio DECIMAL(5,2),
  tracked_keywords TEXT[],

  -- 角色分析（KOL 在项目中可能担任的职务）
  potential_roles TEXT[],               -- ['evangelist','educator','trader','analyst','builder','influencer','ambassador']
  role_confidence TEXT,                 -- low / medium / high
  role_analysis_notes TEXT,            -- AI 分析说明
  role_analyzed_at TIMESTAMPTZ,

  -- 合作状态
  status TEXT DEFAULT 'pending',        -- pending / watching / negotiating / active / paused / terminated
  status_flag TEXT DEFAULT 'none',      -- none / star / stop / urgent
  notes TEXT,

  -- 竞品关联
  competitor_affiliations TEXT[],

  -- AI 自动摘要
  ai_summary TEXT,
  ai_summary_updated_at TIMESTAMPTZ
);

-- 合作记录表
CREATE TABLE collaborations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  type TEXT,                             -- post / thread / space / ambassador / review
  payment_method TEXT,                   -- fiat / token / ambassador / none
  payment_amount DECIMAL(10,2),
  payment_currency TEXT DEFAULT 'USD',

  start_date DATE,
  end_date DATE,
  renewal_reminder_at DATE,

  affiliate_link TEXT,
  clicks INTEGER DEFAULT 0,
  registrations INTEGER DEFAULT 0,
  trading_volume DECIMAL(15,2) DEFAULT 0,
  roi DECIMAL(10,2),

  status TEXT DEFAULT 'planned',        -- planned / active / completed / cancelled
  content_url TEXT,
  notes TEXT
);

-- 沟通记录表
CREATE TABLE communication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,
  collaboration_id UUID REFERENCES collaborations(id) ON DELETE SET NULL,

  channel TEXT,                          -- x_dm / telegram / email / wechat
  direction TEXT,                        -- inbound / outbound
  summary TEXT NOT NULL,
  next_action TEXT,
  next_action_due DATE
);

-- 健康度快照表
CREATE TABLE health_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,

  followers_count INTEGER,
  posts_count INTEGER,
  engagement_rate DECIMAL(5,2),
  keyword_post_count INTEGER
);

-- 竞品监控表
CREATE TABLE competitor_kol_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,

  competitor TEXT NOT NULL,
  evidence_url TEXT,
  detected_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- XHunt TOP100 快照表（定期存档）
CREATE TABLE xhunt_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,

  language TEXT NOT NULL,                -- zh / en
  rank INTEGER,
  score DECIMAL(8,2),
  follower_overlap DECIMAL(5,2),
  snapshot_date DATE DEFAULT CURRENT_DATE
);

-- 关键词配置表
CREATE TABLE tracked_keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  category TEXT,                         -- platform / topic / competitor
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO tracked_keywords (keyword, category) VALUES
  ('Polymarket', 'platform'),
  ('预测市场', 'platform'),
  ('PM', 'platform'),
  ('RWA', 'topic'),
  ('On-chain Stock', 'topic'),
  ('prediction market', 'platform'),
  ('Betmoar', 'competitor'),
  ('PolyCop', 'competitor'),
  ('Kreo', 'competitor');

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kols_updated_at
  BEFORE UPDATE ON kols
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Tier 自动计算视图
CREATE VIEW kols_with_computed AS
SELECT *,
  CASE
    WHEN followers_count >= 50000 AND avg_engagement_rate >= 2 THEN 'A'
    WHEN followers_count >= 10000 OR (followers_count >= 5000 AND avg_engagement_rate >= 3) THEN 'B'
    ELSE 'C'
  END AS computed_tier,
  CASE
    WHEN xhunt_rank_zh IS NOT NULL AND xhunt_rank_zh <= 100 THEN true
    ELSE false
  END AS in_xhunt_zh_top100,
  CASE
    WHEN xhunt_rank_en IS NOT NULL AND xhunt_rank_en <= 100 THEN true
    ELSE false
  END AS in_xhunt_en_top100
FROM kols;
