-- ============================================================================
-- TITAN FIRST READ - DATABASE MIGRATIONS (IDEMPOTENT VERSION)
-- ============================================================================
-- INSTRUCTIONS:
--   1. Copy ALL of this SQL
--   2. Open: https://supabase.com/dashboard/project/gvzdsuodulrdbitxfvjw/sql/new
--   3. Paste and click "Run"
--   4. Wait for completion (may take 30-60 seconds)
--   5. Refresh your app
--
-- NOTE: This version is safe to run multiple times (idempotent)
-- ============================================================================



-- ============================================================================
-- MIGRATION 1/4: 009_play_instances_tier12_fields.sql (FIXED)
-- ============================================================================

-- Migration 009: Play Instances - Tier 1 & 2 Fields
-- Adds essential analytics fields for Little League and HS Basic tiers
-- All columns are nullable for backward compatibility

-- Context fields (All tiers)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS quarter INTEGER CHECK (quarter BETWEEN 1 AND 5), -- 1-4, 5 = OT
  ADD COLUMN IF NOT EXISTS time_remaining INTEGER, -- Seconds remaining in quarter
  ADD COLUMN IF NOT EXISTS score_differential INTEGER; -- Our score - Their score

-- Drive linkage (Tier 2+)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS drive_id UUID REFERENCES drives(id) ON DELETE SET NULL;

-- Player attribution (Tier 1: ball_carrier only; Tier 2: adds QB and target)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS ball_carrier_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qb_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_id UUID REFERENCES players(id) ON DELETE SET NULL;

-- Play classification (Tier 2+, can be derived from playbook attributes)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS play_type TEXT CHECK (play_type IN ('run', 'pass', 'screen', 'rpo', 'trick', 'kick', 'pat', 'two_point'));

-- Direction (Tier 2+)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('left', 'middle', 'right'));

-- Derived metrics (computed on write)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS success BOOLEAN, -- On-schedule: 40%/60%/100% rule
  ADD COLUMN IF NOT EXISTS explosive BOOLEAN; -- 10+ yards (run), 15+ yards (pass)

-- Tagged by tracking (multi-coach support)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS tagged_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_play_instances_drive ON play_instances(drive_id);
CREATE INDEX IF NOT EXISTS idx_play_instances_ball_carrier ON play_instances(ball_carrier_id);
CREATE INDEX IF NOT EXISTS idx_play_instances_qb ON play_instances(qb_id);
CREATE INDEX IF NOT EXISTS idx_play_instances_target ON play_instances(target_id);
CREATE INDEX IF NOT EXISTS idx_play_instances_success ON play_instances(success) WHERE success = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_explosive ON play_instances(explosive) WHERE explosive = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_tagged_by ON play_instances(tagged_by_user_id);

-- Function to compute success (on-schedule rule)
CREATE OR REPLACE FUNCTION compute_play_success(
  p_down INTEGER,
  p_distance INTEGER,
  p_yards_gained INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Handle null inputs
  IF p_down IS NULL OR p_distance IS NULL OR p_yards_gained IS NULL THEN
    RETURN NULL;
  END IF;

  -- On-schedule rule
  IF p_down = 1 THEN
    RETURN p_yards_gained >= (p_distance * 0.40);
  ELSIF p_down = 2 THEN
    RETURN p_yards_gained >= (p_distance * 0.60);
  ELSE
    -- 3rd/4th down: need 100% (first down)
    RETURN p_yards_gained >= p_distance;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to compute explosive play
CREATE OR REPLACE FUNCTION compute_play_explosive(
  p_play_type TEXT,
  p_yards_gained INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Handle null inputs
  IF p_play_type IS NULL OR p_yards_gained IS NULL THEN
    RETURN NULL;
  END IF;

  -- Explosive: 10+ yards (run), 15+ yards (pass/screen)
  IF p_play_type = 'run' THEN
    RETURN p_yards_gained >= 10;
  ELSIF p_play_type IN ('pass', 'screen', 'rpo') THEN
    RETURN p_yards_gained >= 15;
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function to auto-compute derived fields
CREATE OR REPLACE FUNCTION auto_compute_play_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Compute success
  NEW.success := compute_play_success(NEW.down, NEW.distance, NEW.yards_gained);

  -- Compute explosive
  NEW.explosive := compute_play_explosive(NEW.play_type, NEW.yards_gained);

  -- Set tagged_by if not already set
  IF NEW.tagged_by_user_id IS NULL THEN
    NEW.tagged_by_user_id := auth.uid();
  END IF;

  -- Track last edit
  NEW.last_edited_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create it (idempotent)
DROP TRIGGER IF EXISTS auto_compute_play_metrics_trigger ON play_instances;

CREATE TRIGGER auto_compute_play_metrics_trigger
  BEFORE INSERT OR UPDATE ON play_instances
  FOR EACH ROW
  EXECUTE FUNCTION auto_compute_play_metrics();



-- ============================================================================
-- MIGRATION 2/4: 010_play_instances_ol_tracking.sql
-- ============================================================================

-- Migration 010: Play Instances - Offensive Line Tracking (Tier 3)
-- Adds OL position tracking and block win/loss grading
-- Enables block win rate analytics by position and player

-- Offensive line positions and results
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS lt_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lt_block_result TEXT CHECK (lt_block_result IN ('win', 'loss', 'neutral')),

  ADD COLUMN IF NOT EXISTS lg_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lg_block_result TEXT CHECK (lg_block_result IN ('win', 'loss', 'neutral')),

  ADD COLUMN IF NOT EXISTS c_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS c_block_result TEXT CHECK (c_block_result IN ('win', 'loss', 'neutral')),

  ADD COLUMN IF NOT EXISTS rg_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rg_block_result TEXT CHECK (rg_block_result IN ('win', 'loss', 'neutral')),

  ADD COLUMN IF NOT EXISTS rt_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rt_block_result TEXT CHECK (rt_block_result IN ('win', 'loss', 'neutral'));

-- Penalty tracking for OL
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS ol_penalty_player_id UUID REFERENCES players(id) ON DELETE SET NULL;

-- Indexes for OL queries
CREATE INDEX IF NOT EXISTS idx_play_instances_lt ON play_instances(lt_id) WHERE lt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_lg ON play_instances(lg_id) WHERE lg_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_c ON play_instances(c_id) WHERE c_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_rg ON play_instances(rg_id) WHERE rg_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_rt ON play_instances(rt_id) WHERE rt_id IS NOT NULL;

-- Composite index for OL analysis (all 5 positions)
CREATE INDEX IF NOT EXISTS idx_play_instances_ol_all
  ON play_instances(lt_id, lg_id, c_id, rg_id, rt_id)
  WHERE lt_id IS NOT NULL OR lg_id IS NOT NULL OR c_id IS NOT NULL OR rg_id IS NOT NULL OR rt_id IS NOT NULL;

-- Helper function: Calculate block win rate for a player
CREATE OR REPLACE FUNCTION calculate_block_win_rate(p_player_id UUID)
RETURNS TABLE (
  assignments BIGINT,
  wins BIGINT,
  losses BIGINT,
  neutral BIGINT,
  win_rate NUMERIC
) AS $$
DECLARE
  v_assignments BIGINT := 0;
  v_wins BIGINT := 0;
  v_losses BIGINT := 0;
  v_neutral BIGINT := 0;
BEGIN
  -- Count plays where player was at LT
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE lt_block_result = 'win'),
    COUNT(*) FILTER (WHERE lt_block_result = 'loss'),
    COUNT(*) FILTER (WHERE lt_block_result = 'neutral')
  INTO v_assignments, v_wins, v_losses, v_neutral
  FROM play_instances
  WHERE lt_id = p_player_id;

  -- Add plays where player was at LG
  SELECT
    v_assignments + COUNT(*),
    v_wins + COUNT(*) FILTER (WHERE lg_block_result = 'win'),
    v_losses + COUNT(*) FILTER (WHERE lg_block_result = 'loss'),
    v_neutral + COUNT(*) FILTER (WHERE lg_block_result = 'neutral')
  INTO v_assignments, v_wins, v_losses, v_neutral
  FROM play_instances
  WHERE lg_id = p_player_id;

  -- Add plays where player was at C
  SELECT
    v_assignments + COUNT(*),
    v_wins + COUNT(*) FILTER (WHERE c_block_result = 'win'),
    v_losses + COUNT(*) FILTER (WHERE c_block_result = 'loss'),
    v_neutral + COUNT(*) FILTER (WHERE c_block_result = 'neutral')
  INTO v_assignments, v_wins, v_losses, v_neutral
  FROM play_instances
  WHERE c_id = p_player_id;

  -- Add plays where player was at RG
  SELECT
    v_assignments + COUNT(*),
    v_wins + COUNT(*) FILTER (WHERE rg_block_result = 'win'),
    v_losses + COUNT(*) FILTER (WHERE rg_block_result = 'loss'),
    v_neutral + COUNT(*) FILTER (WHERE rg_block_result = 'neutral')
  INTO v_assignments, v_wins, v_losses, v_neutral
  FROM play_instances
  WHERE rg_id = p_player_id;

  -- Add plays where player was at RT
  SELECT
    v_assignments + COUNT(*),
    v_wins + COUNT(*) FILTER (WHERE rt_block_result = 'win'),
    v_losses + COUNT(*) FILTER (WHERE rt_block_result = 'loss'),
    v_neutral + COUNT(*) FILTER (WHERE rt_block_result = 'neutral')
  INTO v_assignments, v_wins, v_losses, v_neutral
  FROM play_instances
  WHERE rt_id = p_player_id;

  -- Calculate win rate
  RETURN QUERY SELECT
    v_assignments,
    v_wins,
    v_losses,
    v_neutral,
    CASE
      WHEN v_assignments > 0 THEN ROUND((v_wins::NUMERIC / v_assignments) * 100, 1)
      ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Get OL performance by position
CREATE OR REPLACE FUNCTION get_ol_position_stats(p_position TEXT, p_team_id UUID)
RETURNS TABLE (
  total_plays BIGINT,
  wins BIGINT,
  losses BIGINT,
  neutral BIGINT,
  win_rate NUMERIC
) AS $$
DECLARE
  v_col_id TEXT;
  v_col_result TEXT;
BEGIN
  -- Map position to column names
  v_col_id := p_position || '_id';
  v_col_result := p_position || '_block_result';

  -- Dynamic query based on position
  RETURN QUERY EXECUTE format('
    SELECT
      COUNT(*) FILTER (WHERE %I IS NOT NULL)::BIGINT as total_plays,
      COUNT(*) FILTER (WHERE %I = ''win'')::BIGINT as wins,
      COUNT(*) FILTER (WHERE %I = ''loss'')::BIGINT as losses,
      COUNT(*) FILTER (WHERE %I = ''neutral'')::BIGINT as neutral,
      CASE
        WHEN COUNT(*) FILTER (WHERE %I IS NOT NULL) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE %I = ''win'')::NUMERIC /
              COUNT(*) FILTER (WHERE %I IS NOT NULL)) * 100, 1)
        ELSE NULL
      END as win_rate
    FROM play_instances
    WHERE team_id = $1
  ', v_col_id, v_col_result, v_col_result, v_col_result, v_col_id, v_col_result, v_col_id)
  USING p_team_id;
END;
$$ LANGUAGE plpgsql STABLE;



-- ============================================================================
-- MIGRATION 3/4: 011_play_instances_defensive_tracking.sql
-- ============================================================================

-- Migration 011: Play Instances - Defensive Tracking (Tier 3)
-- Adds defensive player tracking for tackles, pressures, coverage
-- Enables defensive player analytics and havoc rate calculations

-- Defensive player attribution (arrays for multiple players)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS tackler_ids UUID[] DEFAULT '{}', -- Primary + assists
  ADD COLUMN IF NOT EXISTS missed_tackle_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pressure_player_ids UUID[] DEFAULT '{}';

-- Single player fields
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS sack_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coverage_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coverage_result TEXT CHECK (coverage_result IN ('win', 'loss', 'neutral'));

-- Defensive event flags (for havoc rate calculation)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS is_tfl BOOLEAN DEFAULT false, -- Tackle for loss
  ADD COLUMN IF NOT EXISTS is_sack BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_forced_fumble BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pbu BOOLEAN DEFAULT false, -- Pass breakup
  ADD COLUMN IF NOT EXISTS is_interception BOOLEAN DEFAULT false;

-- QB grading (Tier 3 - offensive perspective)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS qb_decision_grade INTEGER CHECK (qb_decision_grade BETWEEN 0 AND 2); -- 0=bad, 1=ok, 2=great

-- Contain/edge discipline
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS contain_set_edge BOOLEAN DEFAULT false;

-- Indexes for defensive queries
CREATE INDEX IF NOT EXISTS idx_play_instances_tacklers ON play_instances USING GIN (tackler_ids);
CREATE INDEX IF NOT EXISTS idx_play_instances_missed_tackles ON play_instances USING GIN (missed_tackle_ids);
CREATE INDEX IF NOT EXISTS idx_play_instances_pressures ON play_instances USING GIN (pressure_player_ids);
CREATE INDEX IF NOT EXISTS idx_play_instances_sack_player ON play_instances(sack_player_id) WHERE sack_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_coverage_player ON play_instances(coverage_player_id) WHERE coverage_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_tfl ON play_instances(is_tfl) WHERE is_tfl = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_sacks ON play_instances(is_sack) WHERE is_sack = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_pbu ON play_instances(is_pbu) WHERE is_pbu = true;

-- Helper function: Calculate tackle participation rate for a player
CREATE OR REPLACE FUNCTION calculate_tackle_participation(p_player_id UUID, p_team_id UUID)
RETURNS TABLE (
  defensive_snaps BIGINT,
  primary_tackles BIGINT,
  assist_tackles BIGINT,
  total_tackles BIGINT,
  missed_tackles BIGINT,
  participation_rate NUMERIC,
  missed_tackle_rate NUMERIC
) AS $$
DECLARE
  v_defensive_snaps BIGINT;
  v_primary BIGINT;
  v_assists BIGINT;
  v_total BIGINT;
  v_missed BIGINT;
BEGIN
  -- Count total defensive snaps for this team
  SELECT COUNT(*)
  INTO v_defensive_snaps
  FROM play_instances
  WHERE team_id = p_team_id
    AND is_opponent_play = false; -- Defensive snaps from team's perspective

  -- Count tackles (player is first in tackler_ids array = primary)
  SELECT
    COUNT(*) FILTER (WHERE tackler_ids[1] = p_player_id),
    COUNT(*) FILTER (WHERE p_player_id = ANY(tackler_ids) AND tackler_ids[1] != p_player_id),
    COUNT(*) FILTER (WHERE p_player_id = ANY(tackler_ids)),
    COUNT(*) FILTER (WHERE p_player_id = ANY(missed_tackle_ids))
  INTO v_primary, v_assists, v_total, v_missed
  FROM play_instances
  WHERE team_id = p_team_id
    AND is_opponent_play = false;

  RETURN QUERY SELECT
    v_defensive_snaps,
    v_primary,
    v_assists,
    v_total,
    v_missed,
    CASE
      WHEN v_defensive_snaps > 0 THEN ROUND((v_total::NUMERIC / v_defensive_snaps) * 100, 1)
      ELSE NULL
    END as participation_rate,
    CASE
      WHEN (v_total + v_missed) > 0 THEN ROUND((v_missed::NUMERIC / (v_total + v_missed)) * 100, 1)
      ELSE NULL
    END as missed_tackle_rate;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Calculate pressure rate for a player
CREATE OR REPLACE FUNCTION calculate_pressure_rate(p_player_id UUID, p_team_id UUID)
RETURNS TABLE (
  defensive_snaps BIGINT,
  pressures BIGINT,
  sacks BIGINT,
  pressure_rate NUMERIC,
  sack_rate NUMERIC
) AS $$
DECLARE
  v_defensive_snaps BIGINT;
  v_pressures BIGINT;
  v_sacks BIGINT;
BEGIN
  -- Count total defensive snaps
  SELECT COUNT(*)
  INTO v_defensive_snaps
  FROM play_instances
  WHERE team_id = p_team_id
    AND is_opponent_play = false;

  -- Count pressures and sacks
  SELECT
    COUNT(*) FILTER (WHERE p_player_id = ANY(pressure_player_ids)),
    COUNT(*) FILTER (WHERE sack_player_id = p_player_id)
  INTO v_pressures, v_sacks
  FROM play_instances
  WHERE team_id = p_team_id
    AND is_opponent_play = false;

  RETURN QUERY SELECT
    v_defensive_snaps,
    v_pressures,
    v_sacks,
    CASE
      WHEN v_defensive_snaps > 0 THEN ROUND((v_pressures::NUMERIC / v_defensive_snaps) * 100, 1)
      ELSE NULL
    END as pressure_rate,
    CASE
      WHEN v_defensive_snaps > 0 THEN ROUND((v_sacks::NUMERIC / v_defensive_snaps) * 100, 1)
      ELSE NULL
    END as sack_rate;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Calculate havoc rate for a team
CREATE OR REPLACE FUNCTION calculate_havoc_rate(p_team_id UUID)
RETURNS TABLE (
  defensive_snaps BIGINT,
  havoc_plays BIGINT,
  havoc_rate NUMERIC,
  tfls BIGINT,
  sacks BIGINT,
  forced_fumbles BIGINT,
  interceptions BIGINT,
  pbus BIGINT
) AS $$
DECLARE
  v_defensive_snaps BIGINT;
  v_havoc BIGINT;
  v_tfls BIGINT;
  v_sacks BIGINT;
  v_ff BIGINT;
  v_int BIGINT;
  v_pbu BIGINT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_tfl OR is_sack OR is_forced_fumble OR is_interception OR is_pbu),
    COUNT(*) FILTER (WHERE is_tfl),
    COUNT(*) FILTER (WHERE is_sack),
    COUNT(*) FILTER (WHERE is_forced_fumble),
    COUNT(*) FILTER (WHERE is_interception),
    COUNT(*) FILTER (WHERE is_pbu)
  INTO v_defensive_snaps, v_havoc, v_tfls, v_sacks, v_ff, v_int, v_pbu
  FROM play_instances
  WHERE team_id = p_team_id
    AND is_opponent_play = false;

  RETURN QUERY SELECT
    v_defensive_snaps,
    v_havoc,
    CASE
      WHEN v_defensive_snaps > 0 THEN ROUND((v_havoc::NUMERIC / v_defensive_snaps) * 100, 1)
      ELSE NULL
    END as havoc_rate,
    v_tfls,
    v_sacks,
    v_ff,
    v_int,
    v_pbu;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Coverage success rate
CREATE OR REPLACE FUNCTION calculate_coverage_success(p_player_id UUID, p_team_id UUID)
RETURNS TABLE (
  targets BIGINT,
  successes BIGINT, -- Incompletion, INT, PBU, or sack
  success_rate NUMERIC
) AS $$
DECLARE
  v_targets BIGINT;
  v_successes BIGINT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE coverage_result = 'win')
  INTO v_targets, v_successes
  FROM play_instances
  WHERE coverage_player_id = p_player_id
    AND team_id = p_team_id;

  RETURN QUERY SELECT
    v_targets,
    v_successes,
    CASE
      WHEN v_targets > 0 THEN ROUND((v_successes::NUMERIC / v_targets) * 100, 1)
      ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql STABLE;



-- ============================================================================
-- MIGRATION 4/4: 012_play_instances_situational_data.sql
-- ============================================================================

-- Migration 012: Play Instances - Situational Data (Tier 3)
-- Adds advanced situational fields for context-aware analytics
-- Motion, play action, blitz, box count, etc.

-- Motion tracking
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS has_motion BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS motion_direction TEXT CHECK (motion_direction IN ('left', 'right', 'across', 'orbit', 'jet'));

-- Play action / screen
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS is_play_action BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_screen BOOLEAN DEFAULT false;

-- Defensive alignment
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS facing_blitz BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS box_count INTEGER CHECK (box_count BETWEEN 4 AND 11), -- Defenders in box
  ADD COLUMN IF NOT EXISTS defensive_front TEXT; -- '4-3', '3-4', 'Bear', etc.

-- Personnel grouping (can also be derived from playbook)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS offensive_personnel TEXT, -- '11', '12', '21', etc.
  ADD COLUMN IF NOT EXISTS defensive_personnel TEXT; -- 'Base', 'Nickel', 'Dime', etc.

-- Game situation
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS is_two_minute_drill BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_goal_line BOOLEAN DEFAULT false, -- Inside 5-yard line
  ADD COLUMN IF NOT EXISTS is_red_zone BOOLEAN DEFAULT false; -- Inside 20-yard line

-- Indexes for situational queries
CREATE INDEX IF NOT EXISTS idx_play_instances_motion ON play_instances(has_motion) WHERE has_motion = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_play_action ON play_instances(is_play_action) WHERE is_play_action = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_blitz ON play_instances(facing_blitz) WHERE facing_blitz = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_red_zone ON play_instances(is_red_zone) WHERE is_red_zone = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_goal_line ON play_instances(is_goal_line) WHERE is_goal_line = true;



-- ============================================================================
-- ✅ MIGRATIONS COMPLETE!
-- ============================================================================
-- If you see no errors above, the migrations were applied successfully.
-- Refresh your Titan First Read app to see player stats working.
-- ============================================================================
