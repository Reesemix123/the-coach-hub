-- Migration 035: Add Comprehensive Metrics Tracking
-- Purpose: Enable calculation of all 28 football metrics for season/game/drive analysis
-- Note: No backward compatibility needed - fresh start for better testing

-- ============================================================================
-- PART 1: Add Scoring and Result Tracking Fields
-- ============================================================================

-- Add explicit touchdown and scoring flags
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS is_touchdown BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_field_goal_attempt BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_field_goal_made BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_extra_point_attempt BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_extra_point_made BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_safety BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_two_point_attempt BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_two_point_made BOOLEAN DEFAULT FALSE;

-- Add fumble tracking (separate from interceptions)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS is_fumble BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_fumble_recovery BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN play_instances.is_touchdown IS 'Explicit TD flag - any scoring play (rush/pass/return/defensive)';
COMMENT ON COLUMN play_instances.is_field_goal_attempt IS 'Field goal was attempted';
COMMENT ON COLUMN play_instances.is_field_goal_made IS 'Field goal was successful';
COMMENT ON COLUMN play_instances.is_fumble IS 'Ball was fumbled on this play';
COMMENT ON COLUMN play_instances.is_fumble_recovery IS 'Fumble was recovered (may or may not be turnover)';

-- ============================================================================
-- PART 2: Add Time of Possession Tracking
-- ============================================================================

ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS play_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS clock_start VARCHAR(10),  -- Format: "12:45" or "2:30"
  ADD COLUMN IF NOT EXISTS clock_end VARCHAR(10);    -- Format: "12:30" or "2:15"

COMMENT ON COLUMN play_instances.play_duration_seconds IS 'Actual time elapsed during play (for TOP calculation)';
COMMENT ON COLUMN play_instances.clock_start IS 'Game clock at snap (MM:SS format)';
COMMENT ON COLUMN play_instances.clock_end IS 'Game clock after play (MM:SS format)';

-- ============================================================================
-- PART 3: Add Special Teams Tracking
-- ============================================================================

ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS is_punt BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_kickoff BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_punt_return BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_kickoff_return BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS return_yards INTEGER,
  ADD COLUMN IF NOT EXISTS kick_distance INTEGER,
  ADD COLUMN IF NOT EXISTS punt_hang_time NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS is_touchback BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_fair_catch BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_blocked_kick BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN play_instances.is_punt IS 'Play is a punt';
COMMENT ON COLUMN play_instances.is_kickoff IS 'Play is a kickoff';
COMMENT ON COLUMN play_instances.is_punt_return IS 'Play is a punt return';
COMMENT ON COLUMN play_instances.is_kickoff_return IS 'Play is a kickoff return';
COMMENT ON COLUMN play_instances.return_yards IS 'Yards gained on punt/kickoff return';
COMMENT ON COLUMN play_instances.kick_distance IS 'Field goal attempt distance in yards';
COMMENT ON COLUMN play_instances.punt_hang_time IS 'Punt hang time in seconds';

-- ============================================================================
-- PART 4: Add Completion Tracking for Pass Efficiency
-- ============================================================================

ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS is_complete BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_drop BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN play_instances.is_complete IS 'Pass was completed (NULL for non-pass plays)';
COMMENT ON COLUMN play_instances.is_drop IS 'Pass was dropped by receiver';

-- ============================================================================
-- PART 5: Performance Indexes for Fast Queries
-- ============================================================================

-- Primary composite index for team + video filtering (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_play_instances_team_video
  ON play_instances(team_id, video_id);

-- Composite index for offense vs defense filtering
CREATE INDEX IF NOT EXISTS idx_play_instances_team_opponent
  ON play_instances(team_id, is_opponent_play)
  WHERE is_opponent_play IS NOT NULL;

-- Partial index for down-specific analysis (3rd down conversions, etc.)
CREATE INDEX IF NOT EXISTS idx_play_instances_down
  ON play_instances(team_id, down, resulted_in_first_down)
  WHERE down IS NOT NULL;

-- Partial index for scoring plays (TDs, FGs - only ~5% of plays)
CREATE INDEX IF NOT EXISTS idx_play_instances_scoring
  ON play_instances(team_id, is_touchdown, is_field_goal_made)
  WHERE is_touchdown = TRUE OR is_field_goal_made = TRUE;

-- Partial index for red zone analysis (inside 20-yard line - ~10% of plays)
CREATE INDEX IF NOT EXISTS idx_play_instances_red_zone
  ON play_instances(team_id, yard_line, is_touchdown)
  WHERE yard_line >= 80;

-- Partial index for turnovers (only ~3% of plays)
CREATE INDEX IF NOT EXISTS idx_play_instances_turnovers
  ON play_instances(team_id, is_turnover, is_interception, is_fumble)
  WHERE is_turnover = TRUE OR is_interception = TRUE OR is_fumble = TRUE;

-- Index for special teams plays
CREATE INDEX IF NOT EXISTS idx_play_instances_special_teams
  ON play_instances(team_id, is_punt, is_kickoff, is_field_goal_attempt)
  WHERE is_punt = TRUE OR is_kickoff = TRUE OR is_field_goal_attempt = TRUE;

-- Composite index for play type filtering (run vs pass)
CREATE INDEX IF NOT EXISTS idx_play_instances_play_type
  ON play_instances(team_id, play_type, is_opponent_play)
  WHERE play_type IS NOT NULL;

-- ============================================================================
-- PART 6: Player Participation Indexes (for defensive stats)
-- ============================================================================

-- Composite index for participation type queries (sacks, TFLs, etc.)
CREATE INDEX IF NOT EXISTS idx_player_participation_type_result
  ON player_participation(participation_type, result, play_instance_id);

-- Index for player-specific queries
CREATE INDEX IF NOT EXISTS idx_player_participation_player_type
  ON player_participation(player_id, participation_type, result);

-- ============================================================================
-- PART 7: Drive-Level Indexes
-- ============================================================================

-- Index for drive queries by team and game
CREATE INDEX IF NOT EXISTS idx_drives_team_game
  ON drives(team_id, game_id, possession_type);

-- Index for drive results (for PPD, 3-and-out rate, etc.)
CREATE INDEX IF NOT EXISTS idx_drives_result
  ON drives(team_id, result, scoring_drive)
  WHERE result IS NOT NULL;

-- ============================================================================
-- PART 8: Add Constraints for Data Quality
-- ============================================================================

-- Field goal constraints
ALTER TABLE play_instances
  ADD CONSTRAINT chk_field_goal_logic
  CHECK (
    (is_field_goal_made = FALSE OR is_field_goal_attempt = TRUE) AND
    (is_field_goal_attempt = FALSE OR kick_distance IS NOT NULL)
  );

-- Extra point constraints
ALTER TABLE play_instances
  ADD CONSTRAINT chk_extra_point_logic
  CHECK (is_extra_point_made = FALSE OR is_extra_point_attempt = TRUE);

-- Two point conversion constraints
ALTER TABLE play_instances
  ADD CONSTRAINT chk_two_point_logic
  CHECK (is_two_point_made = FALSE OR is_two_point_attempt = TRUE);

-- Scoring plays must have positive yards or be special teams
ALTER TABLE play_instances
  ADD CONSTRAINT chk_touchdown_logic
  CHECK (
    is_touchdown = FALSE OR
    yards_gained > 0 OR
    is_punt_return = TRUE OR
    is_kickoff_return = TRUE OR
    is_interception = TRUE OR
    is_fumble_recovery = TRUE
  );

-- ============================================================================
-- PART 9: Update Existing Data (Optional - for teams with existing data)
-- ============================================================================

-- Infer touchdowns from result text (if result contains 'touchdown' or 'td')
UPDATE play_instances
SET is_touchdown = TRUE
WHERE result ILIKE '%touchdown%' OR result ILIKE '%td%';

-- Infer interceptions from existing flag
UPDATE play_instances
SET is_turnover = TRUE
WHERE is_interception = TRUE;

-- ============================================================================
-- PART 10: Add Helper Functions
-- ============================================================================

-- Function to parse clock time to seconds
CREATE OR REPLACE FUNCTION clock_to_seconds(clock_time VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  parts TEXT[];
  minutes INTEGER;
  seconds INTEGER;
BEGIN
  IF clock_time IS NULL THEN
    RETURN NULL;
  END IF;

  parts := string_to_array(clock_time, ':');
  minutes := parts[1]::INTEGER;
  seconds := parts[2]::INTEGER;

  RETURN (minutes * 60) + seconds;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION clock_to_seconds IS 'Convert MM:SS clock format to total seconds';

-- ============================================================================
-- PART 11: Create View for Quick Metrics Access
-- ============================================================================

-- Materialized view for season-level metrics (optional - for performance)
-- This can be refreshed nightly or on-demand
-- Note: Joins through videos table to get to games
CREATE MATERIALIZED VIEW IF NOT EXISTS team_season_summary AS
SELECT
  pi.team_id,
  EXTRACT(YEAR FROM g.date) as season_year,
  COUNT(DISTINCT g.id) as games_played,
  COUNT(*) as total_plays,
  SUM(yards_gained) as total_yards,
  COUNT(*) FILTER (WHERE play_type = 'run') as rushing_attempts,
  SUM(yards_gained) FILTER (WHERE play_type = 'run') as rushing_yards,
  COUNT(*) FILTER (WHERE play_type = 'pass') as pass_attempts,
  COUNT(*) FILTER (WHERE is_complete = TRUE) as completions,
  SUM(yards_gained) FILTER (WHERE play_type = 'pass' AND is_complete = TRUE) as passing_yards,
  COUNT(*) FILTER (WHERE is_touchdown = TRUE) as touchdowns,
  COUNT(*) FILTER (WHERE is_turnover = TRUE) as turnovers,
  COUNT(*) FILTER (WHERE down = 3) as third_down_attempts,
  COUNT(*) FILTER (WHERE down = 3 AND resulted_in_first_down = TRUE) as third_down_conversions,
  COUNT(*) FILTER (WHERE yard_line >= 80) as red_zone_attempts,
  COUNT(*) FILTER (WHERE yard_line >= 80 AND is_touchdown = TRUE) as red_zone_touchdowns
FROM play_instances pi
  LEFT JOIN videos v ON pi.video_id = v.id
  LEFT JOIN games g ON v.game_id = g.id
WHERE is_opponent_play = FALSE
GROUP BY pi.team_id, EXTRACT(YEAR FROM g.date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_season_summary_pk
  ON team_season_summary(team_id, season_year);

COMMENT ON MATERIALIZED VIEW team_season_summary IS 'Pre-calculated season metrics for fast dashboard loads';

-- ============================================================================
-- ANALYSIS
-- ============================================================================

-- Query to verify indexes were created
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE tablename = 'play_instances'
  AND indexname LIKE 'idx_play_instances_%'
ORDER BY indexname;

COMMENT ON TABLE play_instances IS 'Individual play tracking with comprehensive metrics for season/game/drive analysis. Updated in Migration 035.';
