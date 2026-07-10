-- Migration: add liveness tracking
--   is_dead              — true when the X account is deleted / suspended / can't be resolved
--   last_alive_check_at  — timestamp of the most recent liveness probe
--
-- Semantics:
--   is_dead=NULL           → never checked
--   is_dead=false          → last check succeeded (account alive)
--   is_dead=true           → last check confirmed the account no longer exists on X
--
-- Run this in Supabase SQL Editor (safe to re-run).

ALTER TABLE kols
  ADD COLUMN IF NOT EXISTS is_dead             BOOLEAN,
  ADD COLUMN IF NOT EXISTS last_alive_check_at TIMESTAMPTZ;

-- Rebuild the view so SELECT * picks up the new columns.
-- (Postgres freezes the column list at view-creation time; adding columns to the
-- underlying table alone does NOT propagate them to existing views.)
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
    WHEN airdrop_signal   >= 1 THEN 'pm_airdrop'
    WHEN pm_brand_signal  >= 1 THEN 'pm_trader'
    WHEN pm_tweet_signal  >= 1 THEN 'pm_generalist'
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
