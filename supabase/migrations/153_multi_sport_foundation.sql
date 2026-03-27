-- Migration 153: Multi-Sport Foundation
-- ============================================================================
-- PURPOSE:
--   Lay groundwork for multi-sport support without changing the football
--   experience. Adds sport field to teams and a placeholder program_id
--   for future athletic director program subscriptions.
--
-- FOOTBALL IMPACT: Zero. Every existing team defaults to 'football'.
-- ============================================================================

-- 1. Add sport column with football as the only supported value
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS sport VARCHAR(30) NOT NULL DEFAULT 'football';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teams_sport_check'
  ) THEN
    ALTER TABLE teams
    ADD CONSTRAINT teams_sport_check
    CHECK (sport IN ('football'));
    -- TODO: MULTI-SPORT — add 'basketball' to this CHECK when sport 2 launches
  END IF;
END $$;

COMMENT ON COLUMN teams.sport IS 'Sport this team plays. Currently only football is supported. Drives which config (formations, positions, rules) is loaded.';

-- 2. Add program_id for future athletic director program groupings
-- Plain nullable UUID — no FK constraint yet. The programs table does not
-- exist. Add FK when the programs table is established.
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS program_id UUID NULL;

COMMENT ON COLUMN teams.program_id IS 'Future FK to a programs table for athletic director subscriptions. Nullable — programs are optional. No FK constraint until the programs table is created.';
