-- ============================================================================
-- Migration 185: Add source/confidence to player_participation + 'on_field' type
-- ============================================================================

-- Source: 'sideline' (auto from depth chart), 'ai' (from film analysis),
--         'manual' (coach during film review)
-- Confidence: 0.0-1.0, used by AI attribution only, null for sideline/manual

ALTER TABLE player_participation
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS confidence REAL;

-- Update participation_type CHECK to include 'on_field'
ALTER TABLE player_participation
  DROP CONSTRAINT IF EXISTS player_participation_participation_type_check;

ALTER TABLE player_participation
  ADD CONSTRAINT player_participation_participation_type_check
  CHECK (participation_type IN (
    -- Offensive
    'passer', 'rusher', 'receiver', 'blocker',
    'ol_lt', 'ol_lg', 'ol_c', 'ol_rg', 'ol_rt', 'ol_penalty',
    -- Defensive
    'primary_tackle', 'assist_tackle', 'missed_tackle',
    'pressure', 'interception', 'pass_breakup',
    'forced_fumble', 'fumble_recovery', 'tackle_for_loss',
    'coverage_assignment',
    'dl_run_defense', 'lb_run_stop', 'db_run_support',
    'lb_pass_coverage', 'db_pass_coverage',
    -- Special teams
    'kicker', 'punter', 'long_snapper', 'holder',
    'returner', 'gunner', 'jammer', 'coverage_tackle', 'st_blocker',
    'punt_return', 'kickoff_return', 'punt_coverage', 'kickoff_coverage',
    -- New: sideline auto-attribution for all on-field players
    'on_field'
  ));

CREATE INDEX IF NOT EXISTS idx_player_participation_source
  ON player_participation(play_instance_id, source);
