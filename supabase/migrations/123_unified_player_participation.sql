-- ============================================================================
-- Migration 123: Unified Player Participation Model
-- ============================================================================
-- PURPOSE:
--   Expand player_participation table to be the single source of truth for ALL
--   player involvement across offense, defense, and special teams.
--
-- CHANGES:
--   1. Add new participation types for offense (passer, rusher, receiver, blocker)
--   2. Add new participation types for special teams (kicker, punter, etc.)
--   3. Add 'phase' column to categorize: offense, defense, special_teams
--   4. Add denormalized result fields for self-contained queries
--   5. Add indexes for phase-based filtering
--   6. Backfill existing records with phase = 'defense'
--
-- MIGRATION STRATEGY:
--   This is part of a clean cutover approach - all data will be migrated to
--   the participation table, which becomes the single source of truth.
-- ============================================================================

-- ============================================================================
-- Step 1: Add Phase Column
-- ============================================================================

ALTER TABLE player_participation
ADD COLUMN IF NOT EXISTS phase TEXT;

-- Add check constraint for phase
ALTER TABLE player_participation
DROP CONSTRAINT IF EXISTS player_participation_phase_check;

ALTER TABLE player_participation
ADD CONSTRAINT player_participation_phase_check
CHECK (phase IN ('offense', 'defense', 'special_teams'));

-- ============================================================================
-- Step 2: Add Denormalized Result Fields
-- ============================================================================

-- These fields enable self-contained queries without JOINing back to play_instances
ALTER TABLE player_participation
ADD COLUMN IF NOT EXISTS yards_gained INTEGER;

ALTER TABLE player_participation
ADD COLUMN IF NOT EXISTS is_touchdown BOOLEAN DEFAULT FALSE;

ALTER TABLE player_participation
ADD COLUMN IF NOT EXISTS is_first_down BOOLEAN DEFAULT FALSE;

ALTER TABLE player_participation
ADD COLUMN IF NOT EXISTS is_turnover BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- Step 3: Update Participation Types Constraint
-- ============================================================================

-- Drop existing constraint
ALTER TABLE player_participation
DROP CONSTRAINT IF EXISTS player_participation_participation_type_check;

-- Add constraint with new offensive and special teams types
ALTER TABLE player_participation
ADD CONSTRAINT player_participation_participation_type_check
CHECK (participation_type IN (
  -- ========== OFFENSIVE ==========
  'passer',           -- QB throwing the ball
  'rusher',           -- Ball carrier on run plays
  'receiver',         -- Target/receiver on pass plays
  'blocker',          -- Any blocking assignment (non-OL, e.g., FB, TE, WR)

  -- Offensive line (existing)
  'ol_lt',
  'ol_lg',
  'ol_c',
  'ol_rg',
  'ol_rt',
  'ol_penalty',

  -- ========== DEFENSIVE ==========
  -- Universal actions (existing)
  'primary_tackle',
  'assist_tackle',
  'missed_tackle',
  'pressure',
  'interception',
  'pass_breakup',
  'forced_fumble',
  'fumble_recovery',
  'tackle_for_loss',
  'coverage_assignment',

  -- Position-specific run defense (existing)
  'dl_run_defense',
  'lb_run_stop',
  'db_run_support',

  -- Position-specific pass coverage (existing)
  'lb_pass_coverage',
  'db_pass_coverage',

  -- ========== SPECIAL TEAMS ==========
  -- Kicking specialists
  'kicker',           -- Field goal/PAT kicker, also kickoff
  'punter',           -- Punter
  'long_snapper',     -- Long snapper
  'holder',           -- Holder for FG/PAT

  -- Return specialists
  'returner',         -- Kick/punt returner (replaces punt_return/kickoff_return)

  -- Coverage team
  'gunner',           -- Punt coverage outside - first down field
  'jammer',           -- Blocks gunners on returns
  'coverage_tackle',  -- Made tackle on special teams coverage

  -- Blocking on returns
  'st_blocker',       -- Blocker on return teams

  -- Legacy special teams (keep for backward compatibility)
  'punt_return',
  'kickoff_return',
  'punt_coverage',
  'kickoff_coverage'
));

-- ============================================================================
-- Step 4: Create Indexes for Phase-Based Filtering
-- ============================================================================

-- Index for filtering by phase
CREATE INDEX IF NOT EXISTS idx_player_participation_phase
ON player_participation(phase);

-- Composite index for team + phase (common query pattern)
CREATE INDEX IF NOT EXISTS idx_player_participation_team_phase
ON player_participation(team_id, phase);

-- Composite index for play_instance + phase
CREATE INDEX IF NOT EXISTS idx_player_participation_play_phase
ON player_participation(play_instance_id, phase);

-- Composite index for player + phase (useful for player stats by phase)
CREATE INDEX IF NOT EXISTS idx_player_participation_player_phase
ON player_participation(player_id, phase);

-- ============================================================================
-- Step 5: Backfill Existing Records with Phase
-- ============================================================================

-- Set phase = 'defense' for all existing defensive participation types
UPDATE player_participation
SET phase = 'defense'
WHERE phase IS NULL
  AND participation_type IN (
    'primary_tackle', 'assist_tackle', 'missed_tackle',
    'pressure', 'interception', 'pass_breakup',
    'forced_fumble', 'fumble_recovery', 'tackle_for_loss',
    'coverage_assignment',
    'dl_run_defense', 'lb_run_stop', 'db_run_support',
    'lb_pass_coverage', 'db_pass_coverage'
  );

-- Set phase = 'offense' for OL participation types
UPDATE player_participation
SET phase = 'offense'
WHERE phase IS NULL
  AND participation_type IN (
    'ol_lt', 'ol_lg', 'ol_c', 'ol_rg', 'ol_rt', 'ol_penalty'
  );

-- Set phase = 'special_teams' for existing special teams types
UPDATE player_participation
SET phase = 'special_teams'
WHERE phase IS NULL
  AND participation_type IN (
    'punt_return', 'kickoff_return', 'punt_coverage', 'kickoff_coverage'
  );

-- Any remaining NULL phase records default to 'defense' (safety net)
UPDATE player_participation
SET phase = 'defense'
WHERE phase IS NULL;

-- ============================================================================
-- Step 6: Add Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN player_participation.phase IS
'The phase of play: offense, defense, or special_teams. Used to categorize and filter participations.';

COMMENT ON COLUMN player_participation.yards_gained IS
'Denormalized from play_instances - yards gained on this play. Enables self-contained queries.';

COMMENT ON COLUMN player_participation.is_touchdown IS
'Denormalized from play_instances - whether this play resulted in a touchdown.';

COMMENT ON COLUMN player_participation.is_first_down IS
'Denormalized from play_instances - whether this play resulted in a first down.';

COMMENT ON COLUMN player_participation.is_turnover IS
'Denormalized from play_instances - whether this play resulted in a turnover.';

-- ============================================================================
-- Step 7: Verification Queries
-- ============================================================================

DO $$
DECLARE
  total_count BIGINT;
  phase_rec RECORD;
BEGIN
  SELECT COUNT(*) INTO total_count FROM player_participation;
  RAISE NOTICE 'Total player_participation records: %', total_count;

  RAISE NOTICE 'Breakdown by phase:';
  FOR phase_rec IN
    SELECT phase, COUNT(*) as count
    FROM player_participation
    GROUP BY phase
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  %: %', phase_rec.phase, phase_rec.count;
  END LOOP;
END $$;

-- ============================================================================
-- NOTES FOR NEXT MIGRATION:
-- ============================================================================
-- Migration 124 will migrate existing ball_carrier_id, qb_id, target_id
-- from play_instances to player_participation records with:
--   - participation_type = 'rusher', 'passer', 'receiver'
--   - phase = 'offense'
--   - yards_gained, is_touchdown, is_first_down, is_turnover populated
-- ============================================================================
