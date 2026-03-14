-- ============================================
-- En·flunce Radar — Supabase Database Schema
-- ============================================

-- KOL 主表
CREATE TABLE kols (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- 基本信息
  x_handle TEXT NOT NULL UNIQUE,         -- @username
  display_name TEXT,                      -- 显示名称
  avatar_url TEXT,                        -- 头像 URL
  bio TEXT,                               -- 简介

  -- 分类
  language TEXT DEFAULT 'en',            -- zh / en / ko / tr / vi / bilingual
  tier TEXT DEFAULT 'C',                 -- A / B / C（自动计算）

  -- X 数据（定期更新）
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  avg_engagement_rate DECIMAL(5,2),      -- 平均互动率 %
  last_post_at TIMESTAMPTZ,              -- 最近发帖时间
  is_silent BOOLEAN DEFAULT false,       -- 沉默账号标记（30天无发帖）

  -- 私域
  has_private_community BOOLEAN DEFAULT false,
  community_platforms TEXT[],            -- ['telegram', 'wechat', 'discord']
  community_links TEXT[],                -- 私域链接

  -- 关键词追踪
  keyword_post_ratio DECIMAL(5,2),      -- PM相关推文占比 %
  tracked_keywords TEXT[],              -- 追踪的关键词列表

  -- 合作状态
  status TEXT DEFAULT 'pending',        -- pending / watching / negotiating / active / paused / terminated
  status_flag TEXT DEFAULT 'none',      -- none / star / stop / urgent
  notes TEXT,                           -- 备注

  -- 竞品关联
  competitor_affiliations TEXT[],       -- ['betmoar', 'polycop', 'kreo']

  -- 自动生成摘要（Claude API）
  ai_summary TEXT,
  ai_summary_updated_at TIMESTAMPTZ
);

-- 合作记录表
CREATE TABLE collaborations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,

  -- 合作基本信息
  title TEXT NOT NULL,
  type TEXT,                             -- post / thread / space / ambassador / review
  payment_method TEXT,                   -- fiat / token / ambassador / none
  payment_amount DECIMAL(10,2),
  payment_currency TEXT DEFAULT 'USD',

  -- 时间节点
  start_date DATE,
  end_date DATE,
  renewal_reminder_at DATE,

  -- 效果数据
  affiliate_link TEXT,
  clicks INTEGER DEFAULT 0,
  registrations INTEGER DEFAULT 0,
  trading_volume DECIMAL(15,2) DEFAULT 0,
  roi DECIMAL(10,2),                    -- 自动计算

  -- 状态
  status TEXT DEFAULT 'planned',        -- planned / active / completed / cancelled
  content_url TEXT,                     -- 内容链接
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

-- 健康度快照表（定期写入，用于趋势图）
CREATE TABLE health_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,

  followers_count INTEGER,
  posts_count INTEGER,
  engagement_rate DECIMAL(5,2),
  keyword_post_count INTEGER            -- 当期关键词相关推文数
);

-- 竞品监控表
CREATE TABLE competitor_kol_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  kol_id UUID REFERENCES kols(id) ON DELETE CASCADE,

  competitor TEXT NOT NULL,              -- betmoar / polycop / kreo / stand
  evidence_url TEXT,                     -- 发现合作的推文链接
  detected_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- 关键词配置表
CREATE TABLE tracked_keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  category TEXT,                         -- platform / topic / competitor
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 插入默认关键词
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
CREATE VIEW kols_with_tier AS
SELECT *,
  CASE
    WHEN followers_count >= 50000 AND avg_engagement_rate >= 2 THEN 'A'
    WHEN followers_count >= 10000 OR (followers_count >= 5000 AND avg_engagement_rate >= 3) THEN 'B'
    ELSE 'C'
  END AS computed_tier
FROM kols;
