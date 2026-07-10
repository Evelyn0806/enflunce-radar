-- Migration: add pm_tweet_signal + expand kol_type to include pm_generalist
--   pm_tweet_signal  — count of PM brand mentions in recent tweets
--                      populated by /api/kols/refresh-stats (piggybacks on tweet fetch)
--
-- kol_type derivation priority:
--   airdrop_signal >= 1     → pm_airdrop     (PM 撸毛)
--   pm_brand_signal >= 1    → pm_trader      (bio-identified PM 玩家)
--   pm_tweet_signal >= 1    → pm_generalist  (非专业 PM KOL — 泛加密但推文提过 PM)
--   else                    → unclassified

ALTER TABLE kols
  ADD COLUMN IF NOT EXISTS pm_tweet_signal SMALLINT NOT NULL DEFAULT 0;

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
