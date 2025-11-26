-- ============================================================================
-- Migration 033: Add Multi-Player Defensive Tracking Types
-- ============================================================================
-- PURPOSE:
--   Enable tracking multiple defensive players per play with position-specific
--   and situation-specific (run vs pass) participation types.
--
-- BACKGROUND:
--   Previous system only tracked one LB or DB per play. Coaches need to track
--   multiple players (e.g., both inside LBs on inside run, both DBs in Cover 2).
--
-- NEW PARTICIPATION TYPES:
--   - dl_run_defense: DL gap control on run plays
--   - lb_run_stop: LB gap fill/run fits on run plays
--   - db_run_support: DB force/alley on run plays
--   - lb_pass_coverage: LB pass coverage (zone or man)
--   - db_pass_coverage: DB pass coverage (zone or man)
--
-- KEEPS EXISTING:
--   - 'pressure' for all pass rushers (DL, blitzing LB/DB)
--   - Tackles, assists, missed tackles (universal)
--
-- UI ORGANIZATION:
--   All defensive positions get two sections:
--   - DL: Run Defense + Pass Rush
--   - LB: Run Stop + Pass Coverage
--   - DB: Run Support + Pass Coverage
-- ============================================================================

-- ============================================================================
-- Step 1: Add New Participation Types
-- ============================================================================

-- Drop existing constraint
ALTER TABLE player_participation
DROP CONSTRAINT IF EXISTS player_participation_participation_type_check;

-- Add constraint with new types
ALTER TABLE player_participation
ADD CONSTRAINT player_participation_participation_type_check
CHECK (participation_type IN (
  -- Defensive actions (universal - apply to any position)
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
  'ol_penalty',

  -- Generic coverage (deprecated - use position-specific below)
  'coverage_assignment',

  -- NEW: Position-specific run defense
  'dl_run_defense',     -- DL gap control on run plays
  'lb_run_stop',        -- LB gap fill on run plays
  'db_run_support',     -- DB force/alley on run plays

  -- NEW: Position-specific pass coverage
  'lb_pass_coverage',   -- LB coverage on pass plays
  'db_pass_coverage',   -- DB coverage on pass plays

  -- Special teams (future expansion)
  'punt_return',
  'kickoff_return',
  'punt_coverage',
  'kickoff_coverage'
));

-- ============================================================================
-- Step 2: Add New Result Values
-- ============================================================================

-- Drop existing constraint
ALTER TABLE player_participation
DROP CONSTRAINT IF EXISTS player_participation_result_check;

-- Add constraint with new result values
ALTER TABLE player_participation
ADD CONSTRAINT player_participation_result_check
CHECK (result IN (
  -- For tackles
  'made',
  'missed',

  -- For OL blocks
  'win',
  'loss',

  -- For coverage (objective outcomes)
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

  -- NEW: For DL run defense
  'gap_penetration',    -- Penetrated into backfield
  'gap_control',        -- Controlled assigned gap
  'blown_gap',          -- Failed gap assignment
  'tfl',                -- Tackle for loss
  'contain',            -- Maintained contain responsibility

  -- NEW: For LB run stop
  'gap_fill',           -- Filled gap correctly
  'wrong_gap',          -- Filled wrong gap
  'scraped',            -- Successful scrape exchange
  'run_through',        -- Got run through

  -- NEW: For DB run support
  'force_set',          -- Set the force
  'alley_fill',         -- Filled the alley
  'overpursuit',        -- Over-pursued
  'cutback_allowed',    -- Allowed cutback

  -- Generic (keep for backward compatibility)
  'success',
  'failure',
  'neutral'
));

-- ============================================================================
-- Step 3: Add Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN player_participation.participation_type IS
'Type of player involvement on this play. Position-specific types enable separate tracking of run defense vs pass defense for each position group (DL/LB/DB).';

COMMENT ON COLUMN player_participation.result IS
'Objective outcome of this participation. Context-dependent based on participation_type.';

COMMENT ON COLUMN player_participation.metadata IS
'Position-specific contextual data stored as JSONB.

Examples by participation type:

dl_run_defense:
  {"gap_assignment": "A", "double_teamed": true, "technique": "4i"}

lb_run_stop:
  {"gap_assignment": "B", "scrape_exchange": false, "depth": 5}

db_run_support:
  {"force_contain": true, "alley_fill": false, "alignment": "cloud"}

lb_pass_coverage:
  {"coverage_zone": "hook_curl", "target_depth": 10, "assignment_type": "zone"}

db_pass_coverage:
  {"coverage_zone": "deep_half", "alignment": "2_high", "assignment_type": "zone"}

pressure:
  {"rush_technique": "speed_rush", "qb_impact": true, "gap": "B"}
';

-- ============================================================================
-- Step 4: Create Indexes for New Participation Types
-- ============================================================================

-- Note: Existing composite index on (player_id, participation_type) already
-- covers queries for the new types. No additional indexes needed.

-- ============================================================================
-- Step 5: Migration of Existing Data
-- ============================================================================

-- Migrate existing coverage_assignment records to position-specific types
-- (This requires knowing the player's position, so we join with players table)

-- Migrate LB coverage
UPDATE player_participation pp
SET participation_type = 'lb_pass_coverage'
FROM players p
WHERE pp.player_id = p.id
  AND pp.participation_type = 'coverage_assignment'
  AND p.primary_position IN ('MLB', 'ILB', 'OLB', 'WILL', 'MIKE', 'SAM');

-- Migrate DB coverage
UPDATE player_participation pp
SET participation_type = 'db_pass_coverage'
FROM players p
WHERE pp.player_id = p.id
  AND pp.participation_type = 'coverage_assignment'
  AND p.primary_position IN ('CB', 'FS', 'SS', 'S', 'NB');

-- Note: Any remaining 'coverage_assignment' records (e.g., DL in zone) stay as-is
-- for backward compatibility. New UI will use position-specific types.

-- ============================================================================
-- Step 6: Create Helper Functions for New Stats
-- ============================================================================

-- Function: Get DL run defense stats
CREATE OR REPLACE FUNCTION get_player_dl_run_stats(
  p_player_id UUID,
  p_team_id UUID
)
RETURNS TABLE (
  total_snaps BIGINT,
  gap_penetrations BIGINT,
  gap_controls BIGINT,
  blown_gaps BIGINT,
  tfls BIGINT,
  contains BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_snaps,
    COUNT(*) FILTER (WHERE pp.result = 'gap_penetration') AS gap_penetrations,
    COUNT(*) FILTER (WHERE pp.result = 'gap_control') AS gap_controls,
    COUNT(*) FILTER (WHERE pp.result = 'blown_gap') AS blown_gaps,
    COUNT(*) FILTER (WHERE pp.result = 'tfl') AS tfls,
    COUNT(*) FILTER (WHERE pp.result = 'contain') AS contains,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE pp.result IN ('gap_penetration', 'gap_control', 'tfl', 'contain'))::NUMERIC / COUNT(*)) * 100, 1)
      ELSE 0
    END AS success_rate
  FROM player_participation pp
  WHERE pp.player_id = p_player_id
    AND pp.team_id = p_team_id
    AND pp.participation_type = 'dl_run_defense';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get LB run stop stats
CREATE OR REPLACE FUNCTION get_player_lb_run_stats(
  p_player_id UUID,
  p_team_id UUID
)
RETURNS TABLE (
  total_snaps BIGINT,
  gap_fills BIGINT,
  wrong_gaps BIGINT,
  scrapes BIGINT,
  run_throughs BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_snaps,
    COUNT(*) FILTER (WHERE pp.result = 'gap_fill') AS gap_fills,
    COUNT(*) FILTER (WHERE pp.result = 'wrong_gap') AS wrong_gaps,
    COUNT(*) FILTER (WHERE pp.result = 'scraped') AS scrapes,
    COUNT(*) FILTER (WHERE pp.result = 'run_through') AS run_throughs,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE pp.result IN ('gap_fill', 'scraped'))::NUMERIC / COUNT(*)) * 100, 1)
      ELSE 0
    END AS success_rate
  FROM player_participation pp
  WHERE pp.player_id = p_player_id
    AND pp.team_id = p_team_id
    AND pp.participation_type = 'lb_run_stop';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get DB run support stats
CREATE OR REPLACE FUNCTION get_player_db_run_stats(
  p_player_id UUID,
  p_team_id UUID
)
RETURNS TABLE (
  total_snaps BIGINT,
  force_sets BIGINT,
  alley_fills BIGINT,
  overpursuits BIGINT,
  cutbacks_allowed BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_snaps,
    COUNT(*) FILTER (WHERE pp.result = 'force_set') AS force_sets,
    COUNT(*) FILTER (WHERE pp.result = 'alley_fill') AS alley_fills,
    COUNT(*) FILTER (WHERE pp.result = 'overpursuit') AS overpursuits,
    COUNT(*) FILTER (WHERE pp.result = 'cutback_allowed') AS cutbacks_allowed,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE pp.result IN ('force_set', 'alley_fill'))::NUMERIC / COUNT(*)) * 100, 1)
      ELSE 0
    END AS success_rate
  FROM player_participation pp
  WHERE pp.player_id = p_player_id
    AND pp.team_id = p_team_id
    AND pp.participation_type = 'db_run_support';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get position-specific coverage stats (LB or DB)
CREATE OR REPLACE FUNCTION get_player_coverage_stats(
  p_player_id UUID,
  p_team_id UUID,
  p_participation_type TEXT DEFAULT NULL  -- 'lb_pass_coverage' or 'db_pass_coverage'
)
RETURNS TABLE (
  total_snaps BIGINT,
  targets BIGINT,
  completions_allowed BIGINT,
  incompletions BIGINT,
  interceptions BIGINT,
  pass_breakups BIGINT,
  coverage_success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_snaps,
    COUNT(*) FILTER (WHERE pp.result IN ('target_allowed', 'completion_allowed', 'incompletion', 'interception', 'pass_breakup')) AS targets,
    COUNT(*) FILTER (WHERE pp.result = 'completion_allowed') AS completions_allowed,
    COUNT(*) FILTER (WHERE pp.result = 'incompletion') AS incompletions,
    COUNT(*) FILTER (WHERE pp.result = 'interception') AS interceptions,
    COUNT(*) FILTER (WHERE pp.result = 'pass_breakup') AS pass_breakups,
    CASE
      WHEN COUNT(*) FILTER (WHERE pp.result IN ('target_allowed', 'completion_allowed', 'incompletion', 'interception', 'pass_breakup')) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE pp.result IN ('incompletion', 'interception', 'pass_breakup'))::NUMERIC /
               COUNT(*) FILTER (WHERE pp.result IN ('target_allowed', 'completion_allowed', 'incompletion', 'interception', 'pass_breakup'))) * 100, 1)
      ELSE 0
    END AS coverage_success_rate
  FROM player_participation pp
  WHERE pp.player_id = p_player_id
    AND pp.team_id = p_team_id
    AND (
      p_participation_type IS NULL
      OR pp.participation_type = p_participation_type
    )
    AND pp.participation_type IN ('lb_pass_coverage', 'db_pass_coverage', 'coverage_assignment');
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Step 7: Verification Queries
-- ============================================================================

-- Show updated breakdown by participation type
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Updated breakdown by participation type:';
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
-- NOTES FOR IMPLEMENTATION:
-- ============================================================================
-- 1. Update film tagging UI to include new sections:
--    - DL Run Defense section (run plays only)
--    - DL Pass Rush section (uses existing 'pressure' type)
--    - LB Run Stop section (run plays only)
--    - LB Pass Coverage section (pass plays only)
--    - DB Run Support section (run plays only)
--    - DB Pass Coverage section (pass plays only)
--
-- 2. All sections use multi-select checkboxes (following existing pattern)
--
-- 3. Each selected player gets:
--    - Result dropdown (position and situation-specific)
--    - Metadata fields (gap assignment, coverage zone, etc.)
--
-- 4. Move QB evaluation fields to "Play Context & Outcome" section
--    (outside defensive stats box)
--
-- 5. Update analytics services to use new participation types
-- ============================================================================
