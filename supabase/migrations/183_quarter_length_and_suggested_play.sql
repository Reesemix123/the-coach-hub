-- ============================================================================
-- Migration 183: Quarter length setting + suggested play code reservation
-- ============================================================================

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS quarter_length_minutes INTEGER NOT NULL DEFAULT 12;

COMMENT ON COLUMN teams.quarter_length_minutes IS 'Quarter length in minutes. 12 for NFHS/HS, 10 for youth, 8 for younger youth leagues.';

ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS suggested_play_code VARCHAR(50) NULL;

COMMENT ON COLUMN play_instances.suggested_play_code IS 'Reserved for suggestion acceptance rate analytics. Not written at MVP.';
