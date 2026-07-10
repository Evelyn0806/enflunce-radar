-- Migration: add PM classification signal columns to kols
--   pm_brand_signal  — bio mentions of PM platform brands (Polymarket / Kalshi / Myriad / Predict.fun / …)
--   airdrop_signal   — bio mentions of airdrop / points / testnet terms (PM 撸毛 KOL signal)
--
-- Together they let the UI classify:
--   airdrop_signal >= 1                          → PM 撸毛 KOL
--   pm_brand_signal >= 1 AND airdrop_signal = 0  → PM Trader / PM 关注者
--   both zero                                    → 未分类
--
-- Run this in Supabase SQL Editor (safe to re-run: uses IF NOT EXISTS + CREATE OR REPLACE).

ALTER TABLE kols
  ADD COLUMN IF NOT EXISTS pm_brand_signal SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS airdrop_signal  SMALLINT NOT NULL DEFAULT 0;

-- Rebuild the view so SELECT * pulls the new columns and adds a derived kol_type.
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
    WHEN airdrop_signal >= 1 THEN 'pm_airdrop'
    WHEN pm_brand_signal >= 1 THEN 'pm_trader'
    ELSE 'unclassified'
  END AS kol_type,
  CASE
    WHEN xhunt_rank_zh IS NOT NULL AND xhunt_rank_zh <= 100 THEN true
    ELSE false
  END AS in_xhunt_zh_top100,
  CASE
    WHEN xhunt_rank_en IS NOT NULL AND xhunt_rank_en <= 100 THEN true
    ELSE false
  END AS in_xhunt_en_top100
FROM kols;
