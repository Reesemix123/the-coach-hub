-- ============================================================================
-- Migration 181: Sideline enrichment columns for play_instances
-- ============================================================================
-- PURPOSE:
--   Add columns for capturing opponent tendency and defensive context
--   from the sideline tracker's post-play enrichment prompts.
--
--   Existing columns reused:
--     facing_blitz (BOOLEAN)  — already exists (migration 012)
--     direction (TEXT)        — already exists (migration 009)
--     pass_location (TEXT)    — already exists (migration 012)
--     formation (VARCHAR)     — already exists (migration 045)
--     personnel (VARCHAR)     — already exists (migration 045)
--     run_concept (VARCHAR)   — already exists (migration 045)
--     pass_concept (VARCHAR)  — already exists (migration 045)
--     play_concept (TEXT)     — already exists (migration 012)
--
--   New columns:
--     coverage_shell     — opponent's coverage call (Man/Zone/Cover 2 etc)
--     defensive_front    — our defensive front (4-3/3-4/Nickel/Dime)
--     press_level        — our pressure level
-- ============================================================================

ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS coverage_shell TEXT;

ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS defensive_front TEXT;

ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS press_level TEXT;

COMMENT ON COLUMN play_instances.coverage_shell IS 'Opponent coverage shell (Man, Zone, Cover 2, etc) or our coverage call when on defense';
COMMENT ON COLUMN play_instances.defensive_front IS 'Our defensive front alignment (4-3, 3-4, Nickel, Dime)';
COMMENT ON COLUMN play_instances.press_level IS 'Our defensive pressure level';

CREATE INDEX IF NOT EXISTS idx_play_instances_coverage_shell
  ON play_instances(coverage_shell) WHERE coverage_shell IS NOT NULL;
