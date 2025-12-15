-- Migration 097: Add scoring_type and penalty_type fields to play_instances
-- Separates scoring events (TD, FG, PAT, 2PT, Safety) from play results
-- Separates penalty tracking from play results
-- These fields work independently of result_type for better data modeling

-- ============================================================================
-- 1. Add scoring_type column
-- ============================================================================
ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS scoring_type VARCHAR(30);

-- Add scoring_points for quick aggregation
ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS scoring_points INTEGER DEFAULT 0;

COMMENT ON COLUMN play_instances.scoring_type IS 'Type of score: touchdown, extra_point, two_point_conversion, field_goal, safety';
COMMENT ON COLUMN play_instances.scoring_points IS 'Points scored on this play (6 for TD, 3 for FG, etc.)';

-- ============================================================================
-- 2. Add penalty_type column (penalty_on_play boolean already exists)
-- ============================================================================
ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS penalty_type VARCHAR(50);

-- Add penalty_yards for tracking
ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS penalty_yards INTEGER;

-- Add penalty_on_us to distinguish offensive vs defensive penalties
ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS penalty_on_us BOOLEAN DEFAULT false;

COMMENT ON COLUMN play_instances.penalty_type IS 'Specific penalty type (false_start, holding_offense, etc.)';
COMMENT ON COLUMN play_instances.penalty_yards IS 'Yards assessed for the penalty';
COMMENT ON COLUMN play_instances.penalty_on_us IS 'True if penalty was on our team, false if on opponent';

-- ============================================================================
-- 3. Create indexes for common queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_play_instances_scoring ON play_instances(scoring_type) WHERE scoring_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_penalty ON play_instances(penalty_type) WHERE penalty_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_scoring_points ON play_instances(scoring_points) WHERE scoring_points > 0;

-- ============================================================================
-- 4. Migrate existing data
-- ============================================================================

-- Migrate plays with result_type = 'touchdown' to use scoring_type
UPDATE play_instances
SET
  scoring_type = 'touchdown',
  scoring_points = 6,
  is_touchdown = true,
  result_type = CASE
    WHEN result_type = 'touchdown' THEN NULL  -- Clear result_type, user can re-tag with proper result
    ELSE result_type
  END
WHERE result_type = 'touchdown' OR is_touchdown = true;

-- Migrate plays with result_type = 'penalty' to use penalty_on_play
UPDATE play_instances
SET
  penalty_on_play = true,
  result_type = CASE
    WHEN result_type = 'penalty' THEN NULL  -- Clear result_type, user can re-tag with proper result
    ELSE result_type
  END
WHERE result_type = 'penalty';

-- ============================================================================
-- 5. Update calculate_team_metrics function to include scoring breakdown
-- ============================================================================

-- Add helper function to get scoring breakdown
CREATE OR REPLACE FUNCTION get_team_scoring_breakdown(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  touchdowns INTEGER,
  field_goals INTEGER,
  extra_points INTEGER,
  two_point_conversions INTEGER,
  safeties INTEGER,
  total_points INTEGER,
  rushing_tds INTEGER,
  passing_tds INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE pi.scoring_type = 'touchdown')::INTEGER as touchdowns,
    COUNT(*) FILTER (WHERE pi.scoring_type = 'field_goal')::INTEGER as field_goals,
    COUNT(*) FILTER (WHERE pi.scoring_type = 'extra_point')::INTEGER as extra_points,
    COUNT(*) FILTER (WHERE pi.scoring_type = 'two_point_conversion')::INTEGER as two_point_conversions,
    COUNT(*) FILTER (WHERE pi.scoring_type = 'safety')::INTEGER as safeties,
    COALESCE(SUM(pi.scoring_points), 0)::INTEGER as total_points,
    COUNT(*) FILTER (WHERE pi.scoring_type = 'touchdown' AND pi.result_type IN ('rush_gain', 'rush_no_gain'))::INTEGER as rushing_tds,
    COUNT(*) FILTER (WHERE pi.scoring_type = 'touchdown' AND pi.result_type IN ('pass_complete'))::INTEGER as passing_tds
  FROM play_instances pi
  JOIN games g ON pi.game_id = g.id
  WHERE pi.team_id = p_team_id
    AND pi.is_opponent_play = false
    AND (p_game_id IS NULL OR pi.game_id = p_game_id)
    AND (p_start_date IS NULL OR g.date >= p_start_date)
    AND (p_end_date IS NULL OR g.date <= p_end_date);
END;
$$ LANGUAGE plpgsql STABLE;

-- Add helper function to get penalty breakdown
CREATE OR REPLACE FUNCTION get_team_penalty_breakdown(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_penalties INTEGER,
  total_penalty_yards INTEGER,
  penalties_on_us INTEGER,
  penalties_on_opponent INTEGER,
  most_common_penalty VARCHAR(50),
  most_common_count INTEGER
) AS $$
DECLARE
  v_most_common VARCHAR(50);
  v_most_common_count INTEGER;
BEGIN
  -- Find most common penalty
  SELECT pi.penalty_type, COUNT(*)::INTEGER
  INTO v_most_common, v_most_common_count
  FROM play_instances pi
  JOIN games g ON pi.game_id = g.id
  WHERE pi.team_id = p_team_id
    AND pi.penalty_on_play = true
    AND pi.penalty_type IS NOT NULL
    AND (p_game_id IS NULL OR pi.game_id = p_game_id)
    AND (p_start_date IS NULL OR g.date >= p_start_date)
    AND (p_end_date IS NULL OR g.date <= p_end_date)
  GROUP BY pi.penalty_type
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE pi.penalty_on_play = true)::INTEGER as total_penalties,
    COALESCE(SUM(pi.penalty_yards) FILTER (WHERE pi.penalty_on_play = true), 0)::INTEGER as total_penalty_yards,
    COUNT(*) FILTER (WHERE pi.penalty_on_play = true AND pi.penalty_on_us = true)::INTEGER as penalties_on_us,
    COUNT(*) FILTER (WHERE pi.penalty_on_play = true AND pi.penalty_on_us = false)::INTEGER as penalties_on_opponent,
    v_most_common as most_common_penalty,
    v_most_common_count as most_common_count
  FROM play_instances pi
  JOIN games g ON pi.game_id = g.id
  WHERE pi.team_id = p_team_id
    AND (p_game_id IS NULL OR pi.game_id = p_game_id)
    AND (p_start_date IS NULL OR g.date >= p_start_date)
    AND (p_end_date IS NULL OR g.date <= p_end_date);
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_team_scoring_breakdown TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_penalty_breakdown TO authenticated;
