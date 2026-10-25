-- Migration: generalise from prediction-market-only to Crypto KOL tracks (赛道)
--   tracks        — multi-valued 赛道 tags detected from bio / name / recent tweets
--                   values: prediction_market, tokenized_stock, defi, meme, ai_agent, trading
--   account_type  — 'personal' (个人 KOL) or 'brand' (品牌型 KOL: project / exchange / media accounts)
--
-- The old PM-only kol_type classification (PM Trader / PM 撸毛 / 非专业 PM KOL) is dropped from the view.
-- pm_brand_signal / airdrop_signal / pm_tweet_signal columns are left in place (no longer written).
--
-- Run this in Supabase SQL Editor BEFORE deploying the app code that writes these columns
-- (safe to re-run: uses IF NOT EXISTS + DROP/CREATE VIEW).

ALTER TABLE kols
  ADD COLUMN IF NOT EXISTS tracks       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS account_type TEXT   NOT NULL DEFAULT 'personal';

CREATE INDEX IF NOT EXISTS kols_tracks_gin ON kols USING GIN (tracks);

-- Seed tracks for existing rows from the PM signals so the directory isn't empty before the backfill script runs.
UPDATE kols
SET tracks = ARRAY['prediction_market']
WHERE tracks = '{}' AND (pm_brand_signal >= 1 OR pm_tweet_signal >= 1);

-- Rebuild the view so SELECT * picks up the new columns; kol_type is removed.
DROP VIEW IF EXISTS kols_with_computed;

CREATE VIEW kols_with_computed AS
SELECT *,
  CASE
    WHEN followers_count >= 30000 THEN 'A'
    WHEN followers_count >= 15000 AND avg_engagement_rate >= 1 THEN 'A'
    WHEN followers_count >= 5000 OR (followers_count >= 3000 AND avg_engagement_rate >= 2) THEN 'B'
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
