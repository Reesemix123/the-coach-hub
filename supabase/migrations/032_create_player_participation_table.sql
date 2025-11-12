-- ============================================================================
-- Migration 032: Create player_participation Junction Table
-- ============================================================================
-- PURPOSE:
--   Replace array-based defensive participation tracking with normalized
--   junction table architecture.
--
-- PROBLEM WITH OLD ARCHITECTURE:
--   - Arrays (tackler_ids[], missed_tackle_ids[], pressure_player_ids[])
--     violate First Normal Form (1NF)
--   - Array containment queries are O(n*m) complexity vs O(log n) for B-tree
--   - Cannot enforce referential integrity with arrays
--   - GIN indexes help but still 5-50x slower than normalized foreign keys
--   - Caused statement timeouts even with 8 plays
--
-- NEW ARCHITECTURE:
--   - Junction table for many-to-many relationship (plays ↔ players)
--   - Each participation is a separate row
--   - B-tree indexes enable O(log n) lookups
--   - Foreign key constraints ensure data integrity
--   - Scales to 100,000+ plays
--
-- BACKWARDS COMPATIBILITY:
--   None needed - clean break from array-based approach per user request
-- ============================================================================

-- ============================================================================
-- Step 1: Create player_participation Junction Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_participation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  play_instance_id UUID NOT NULL REFERENCES play_instances(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Participation type (what the player did on this play)
  participation_type TEXT NOT NULL CHECK (participation_type IN (
    -- Defensive actions
    'primary_tackle',
    'assist_tackle',
    'missed_tackle',
    'pressure',
    'interception',
    'pass_breakup',
    'forced_fumble',
    'fumble_recovery',
    'tackle_for_loss',

    -- Offensive line (from Tier 3)
    'ol_lt',
    'ol_lg',
    'ol_c',
    'ol_rg',
    'ol_rt',

    -- Offensive line penalties
    'ol_penalty',

    -- Coverage assignments
    'coverage_assignment',

    -- Ball carrier/QB/target already in play_instances as single FKs
    -- (ball_carrier_id, qb_id, target_id) - no need to duplicate here

    -- Special teams (future expansion)
    'punt_return',
    'kickoff_return',
    'punt_coverage',
    'kickoff_coverage'
  )),

  -- Result of participation (context-dependent)
  result TEXT CHECK (result IN (
    -- For tackles
    'made',
    'missed',

    -- For OL blocks
    'win',
    'loss',

    -- For coverage
    'target_allowed',
    'completion_allowed',
    'incompletion',
    'interception',
    'pass_breakup',

    -- For pressures
    'sack',
    'hurry',
    'hit',
    'no_pressure',

    -- Generic
    'success',
    'failure',
    'neutral'
  )),

  -- Additional metadata (flexible JSONB for position-specific data)
  metadata JSONB,
  -- Examples:
  -- For coverage: {"zone": "deep_half", "target_depth": 15}
  -- For OL: {"gap_assignment": "A", "block_type": "zone"}
  -- For tackles: {"yards_after_contact": 3, "open_field": true}

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Step 2: Create Indexes for Optimal Query Performance
-- ============================================================================

-- Team ID index for RLS performance (critical for fast policy checks)
CREATE INDEX idx_player_participation_team
  ON player_participation(team_id);

-- Secondary query pattern: "Get all players who participated in a play"
CREATE INDEX idx_player_participation_play
  ON player_participation(play_instance_id);

-- Composite index for player stats queries (most common access pattern)
-- Example: "Get all tackles by player X"
-- Note: This also covers queries on just player_id (leftmost prefix)
CREATE INDEX idx_player_participation_player_type
  ON player_participation(player_id, participation_type);

-- Composite index for team-filtered queries
CREATE INDEX idx_player_participation_team_player
  ON player_participation(team_id, player_id);

-- For filtering by result (e.g., "block wins only")
CREATE INDEX idx_player_participation_result
  ON player_participation(result) WHERE result IS NOT NULL;

-- GIN index for metadata queries (optional, for advanced filtering)
CREATE INDEX idx_player_participation_metadata
  ON player_participation USING GIN (metadata);

-- ============================================================================
-- Step 3: Add RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE player_participation ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see participations for their own teams
-- Uses team_id directly for fast RLS evaluation (no JOIN needed)
CREATE POLICY "Users can view their team's player participations"
  ON player_participation FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = player_participation.team_id
        AND teams.user_id = auth.uid()
    )
  );

-- Policy: Users can insert participations for their own teams
CREATE POLICY "Users can create player participations for their teams"
  ON player_participation FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = player_participation.team_id
        AND teams.user_id = auth.uid()
    )
  );

-- Policy: Users can update participations for their own teams
CREATE POLICY "Users can update their team's player participations"
  ON player_participation FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = player_participation.team_id
        AND teams.user_id = auth.uid()
    )
  );

-- Policy: Users can delete participations for their own teams
CREATE POLICY "Users can delete their team's player participations"
  ON player_participation FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = player_participation.team_id
        AND teams.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Step 4: Create Updated At Trigger
-- ============================================================================

CREATE TRIGGER update_player_participation_updated_at
  BEFORE UPDATE ON player_participation
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Step 5: Migrate Existing Data from Arrays to Junction Table
-- ============================================================================

-- Migrate tackler_ids (primary tackle = first in array, rest are assists)
INSERT INTO player_participation (play_instance_id, team_id, player_id, participation_type, result)
SELECT
  pi.id,
  pi.team_id,
  pi.tackler_ids[1],
  'primary_tackle',
  'made'
FROM play_instances pi
WHERE pi.tackler_ids IS NOT NULL
  AND array_length(pi.tackler_ids, 1) >= 1;

-- Migrate assist tackles (indexes 2+)
INSERT INTO player_participation (play_instance_id, team_id, player_id, participation_type, result)
SELECT
  pi.id,
  pi.team_id,
  unnest(pi.tackler_ids[2:array_length(pi.tackler_ids, 1)]),
  'assist_tackle',
  'made'
FROM play_instances pi
WHERE pi.tackler_ids IS NOT NULL
  AND array_length(pi.tackler_ids, 1) >= 2;

-- Migrate missed tackles
INSERT INTO player_participation (play_instance_id, team_id, player_id, participation_type, result)
SELECT
  pi.id,
  pi.team_id,
  unnest(pi.missed_tackle_ids),
  'missed_tackle',
  'missed'
FROM play_instances pi
WHERE pi.missed_tackle_ids IS NOT NULL
  AND array_length(pi.missed_tackle_ids, 1) >= 1;

-- Migrate pressures (includes sacks via result field)
INSERT INTO player_participation (play_instance_id, team_id, player_id, participation_type, result)
SELECT
  pi.id,
  pi.team_id,
  unnest(pi.pressure_player_ids),
  'pressure',
  CASE
    WHEN pi.is_sack THEN 'sack'
    ELSE 'hurry'
  END
FROM play_instances pi
WHERE pi.pressure_player_ids IS NOT NULL
  AND array_length(pi.pressure_player_ids, 1) >= 1;

-- Migrate coverage assignments (single player)
INSERT INTO player_participation (play_instance_id, team_id, player_id, participation_type, result)
SELECT
  pi.id,
  pi.team_id,
  pi.coverage_player_id,
  'coverage_assignment',
  COALESCE(pi.coverage_result, 'neutral')
FROM play_instances pi
WHERE pi.coverage_player_id IS NOT NULL;

-- Migrate offensive line positions (Tier 3)
-- LT
INSERT INTO player_participation (play_instance_id, team_id, player_id, participation_type, result)
SELECT
  pi.id,
  pi.team_id,
  pi.lt_id,
  'ol_lt',
  COALESCE(pi.lt_block_result, 'neutral')
FROM play_instances pi
WHERE pi.lt_id IS NOT NULL;

-- LG
INSERT INTO player_participation (play_instance_id, team_id, player_id, participation_type, result)
SELECT
  pi.id,
  pi.team_id,
  pi.lg_id,
  'ol_lg',
  COALESCE(pi.lg_block_result, 'neutral')
FROM play_instances pi
WHERE pi.lg_id IS NOT NULL;

-- C
INSERT INTO player_participation (play_instance_id, team_id, player_id, participation_type, result)
SELECT
  pi.id,
  pi.team_id,
  pi.c_id,
  'ol_c',
  COALESCE(pi.c_block_result, 'neutral')
FROM play_instances pi
WHERE pi.c_id IS NOT NULL;

-- RG
INSERT INTO player_participation (play_instance_id, team_id, player_id, participation_type, result)
SELECT
  pi.id,
  pi.team_id,
  pi.rg_id,
  'ol_rg',
  COALESCE(pi.rg_block_result, 'neutral')
FROM play_instances pi
WHERE pi.rg_id IS NOT NULL;

-- RT
INSERT INTO player_participation (play_instance_id, team_id, player_id, participation_type, result)
SELECT
  pi.id,
  pi.team_id,
  pi.rt_id,
  'ol_rt',
  COALESCE(pi.rt_block_result, 'neutral')
FROM play_instances pi
WHERE pi.rt_id IS NOT NULL;

-- ============================================================================
-- Step 6: Create Helper Functions for Common Queries
-- ============================================================================

-- Function: Get tackle participation for a player
CREATE OR REPLACE FUNCTION get_player_tackle_stats(
  p_player_id UUID,
  p_team_id UUID
)
RETURNS TABLE (
  primary_tackles BIGINT,
  assist_tackles BIGINT,
  missed_tackles BIGINT,
  total_tackles BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE pp.participation_type = 'primary_tackle') AS primary_tackles,
    COUNT(*) FILTER (WHERE pp.participation_type = 'assist_tackle') AS assist_tackles,
    COUNT(*) FILTER (WHERE pp.participation_type = 'missed_tackle') AS missed_tackles,
    COUNT(*) FILTER (WHERE pp.participation_type IN ('primary_tackle', 'assist_tackle')) AS total_tackles
  FROM player_participation pp
  WHERE pp.player_id = p_player_id
    AND pp.team_id = p_team_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get pressure stats for a player
CREATE OR REPLACE FUNCTION get_player_pressure_stats(
  p_player_id UUID,
  p_team_id UUID
)
RETURNS TABLE (
  sacks BIGINT,
  hurries BIGINT,
  hits BIGINT,
  total_pressures BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE pp.participation_type = 'pressure' AND pp.result = 'sack') AS sacks,
    COUNT(*) FILTER (WHERE pp.participation_type = 'pressure' AND pp.result = 'hurry') AS hurries,
    COUNT(*) FILTER (WHERE pp.participation_type = 'pressure' AND pp.result = 'hit') AS hits,
    COUNT(*) FILTER (WHERE pp.participation_type = 'pressure') AS total_pressures
  FROM player_participation pp
  WHERE pp.player_id = p_player_id
    AND pp.team_id = p_team_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get OL block win rate for a player
CREATE OR REPLACE FUNCTION get_player_ol_block_stats(
  p_player_id UUID,
  p_team_id UUID
)
RETURNS TABLE (
  total_blocks BIGINT,
  block_wins BIGINT,
  block_losses BIGINT,
  block_win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_blocks,
    COUNT(*) FILTER (WHERE pp.result = 'win') AS block_wins,
    COUNT(*) FILTER (WHERE pp.result = 'loss') AS block_losses,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE pp.result = 'win')::NUMERIC / COUNT(*)) * 100, 1)
      ELSE 0
    END AS block_win_rate
  FROM player_participation pp
  WHERE pp.player_id = p_player_id
    AND pp.team_id = p_team_id
    AND pp.participation_type IN ('ol_lt', 'ol_lg', 'ol_c', 'ol_rg', 'ol_rt');
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Step 7: Verification Queries
-- ============================================================================

-- Count total participations migrated
DO $$
DECLARE
  total_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM player_participation;
  RAISE NOTICE 'Total player_participation records created: %', total_count;
END $$;

-- Show breakdown by participation type
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Breakdown by participation type:';
  FOR rec IN
    SELECT participation_type, COUNT(*) as count
    FROM player_participation
    GROUP BY participation_type
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  %: %', rec.participation_type, rec.count;
  END LOOP;
END $$;

-- ============================================================================
-- NOTES FOR NEXT STEPS:
-- ============================================================================
-- 1. Update advanced-analytics.service.ts to use junction table queries
-- 2. Update film tagging UI to write to player_participation
-- 3. After validation, drop old array columns:
--    - tackler_ids
--    - missed_tackle_ids
--    - pressure_player_ids
--    - sack_player_id
--    - coverage_player_id
--    - coverage_result
--    - lt_id, lg_id, c_id, rg_id, rt_id
--    - lt_block_result, lg_block_result, c_block_result, rg_block_result, rt_block_result
-- ============================================================================
