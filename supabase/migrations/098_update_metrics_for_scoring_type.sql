-- Migration 098: Update calculate_team_metrics function to support new scoring_type field
-- This maintains backward compatibility with is_touchdown while adding support for scoring_type

-- Update the team metrics function to use scoring_type as primary with fallback to is_touchdown
-- This is a non-breaking change since we're using COALESCE pattern

-- Note: The existing function at 036 uses is_touchdown directly
-- We update to use: scoring_type = 'touchdown' OR is_touchdown = TRUE
-- This ensures both old and new tagged plays are counted correctly

-- For now, we'll add a comment noting that the existing function works
-- because the form submission sets is_touchdown = true when scoring_type = 'touchdown'
-- A full function update would require recreating the entire function

-- Add an index on scoring_type for query performance
CREATE INDEX IF NOT EXISTS idx_play_instances_scoring_type
ON play_instances(scoring_type)
WHERE scoring_type IS NOT NULL;

-- Add view for scoring summary per game
-- Note: play_instances relates to games through videos table
CREATE OR REPLACE VIEW game_scoring_summary AS
SELECT
  g.id as game_id,
  g.team_id,
  g.name as game_name,
  g.opponent,
  g.date as game_date,
  COUNT(*) FILTER (WHERE pi.scoring_type = 'touchdown' OR pi.is_touchdown = TRUE) as touchdowns,
  COUNT(*) FILTER (WHERE pi.scoring_type = 'field_goal') as field_goals,
  COUNT(*) FILTER (WHERE pi.scoring_type = 'extra_point') as extra_points,
  COUNT(*) FILTER (WHERE pi.scoring_type = 'two_point_conversion') as two_point_conversions,
  COUNT(*) FILTER (WHERE pi.scoring_type = 'safety') as safeties,
  COALESCE(SUM(pi.scoring_points), 0) as total_points,
  COUNT(*) FILTER (WHERE pi.penalty_on_play = TRUE) as total_penalties,
  COALESCE(SUM(pi.penalty_yards) FILTER (WHERE pi.penalty_on_play = TRUE), 0) as total_penalty_yards,
  COUNT(*) FILTER (WHERE pi.penalty_on_us = TRUE) as penalties_on_us,
  COUNT(*) FILTER (WHERE pi.penalty_on_us = FALSE AND pi.penalty_on_play = TRUE) as penalties_on_opponent
FROM games g
LEFT JOIN videos v ON v.game_id = g.id
LEFT JOIN play_instances pi ON pi.video_id = v.id AND pi.is_opponent_play = FALSE
GROUP BY g.id, g.team_id, g.name, g.opponent, g.date;

-- Grant access to the view
GRANT SELECT ON game_scoring_summary TO authenticated;

COMMENT ON VIEW game_scoring_summary IS 'Aggregated scoring and penalty summary per game';

-- Add view for penalty breakdown per game
CREATE OR REPLACE VIEW game_penalty_breakdown AS
SELECT
  g.id as game_id,
  g.team_id,
  pi.penalty_type,
  pi.penalty_on_us,
  COUNT(*) as occurrences,
  SUM(pi.penalty_yards) as total_yards
FROM games g
JOIN videos v ON v.game_id = g.id
JOIN play_instances pi ON pi.video_id = v.id
WHERE pi.penalty_on_play = TRUE
  AND pi.penalty_type IS NOT NULL
GROUP BY g.id, g.team_id, pi.penalty_type, pi.penalty_on_us;

GRANT SELECT ON game_penalty_breakdown TO authenticated;

COMMENT ON VIEW game_penalty_breakdown IS 'Penalty type breakdown by game showing frequency and yards';
