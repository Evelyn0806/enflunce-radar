-- Migration: update tier boundaries to KOC / KOL / 大V system
--   大V (A): followers >= 30K  (was 50K)
--   KOL  (B): followers >= 5K   (was 10K)
--   KOC  (C): followers <  5K
-- Run this in Supabase SQL Editor once (safe to re-run).

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
