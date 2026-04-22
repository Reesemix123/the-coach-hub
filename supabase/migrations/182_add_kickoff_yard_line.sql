-- ============================================================================
-- Migration 182: Add kickoff_yard_line to teams
-- ============================================================================
-- Completes the league rules settings alongside field_length and
-- touchback_yard_line (added in migration 180).
-- ============================================================================

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS kickoff_yard_line INTEGER NOT NULL DEFAULT 40;

COMMENT ON COLUMN teams.kickoff_yard_line IS 'Kickoff starting yard line. 40 for NFHS, 35 for NCAA/NFL. Used by calculateBallPlacement.';
