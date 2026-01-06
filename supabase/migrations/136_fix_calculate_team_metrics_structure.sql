-- Migration 136: Fix calculate_team_metrics structure (re-apply migration 135 fix)
-- ============================================================================
-- PURPOSE:
--   Re-applies the correct function structure from migration 132 with the
--   added p_game_ids parameter. Migration 135 was applied with wrong structure.
-- ============================================================================

-- Drop the existing function with its current signature
DROP FUNCTION IF EXISTS calculate_team_metrics(UUID, UUID, DATE, DATE, TEXT, UUID[]);
DROP FUNCTION IF EXISTS calculate_team_metrics(UUID, UUID, DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION calculate_team_metrics(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_opponent TEXT DEFAULT NULL,
  p_game_ids UUID[] DEFAULT NULL  -- Array of game IDs for cumulative filtering
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;

  -- Games tracking
  v_games_played INT;

  -- Offensive volume
  v_total_yards INT;
  v_rushing_yards INT;
  v_passing_yards INT;
  v_touchdowns INT;

  -- Offensive efficiency
  v_total_plays INT;
  v_rushing_attempts INT;
  v_completions INT;
  v_pass_attempts INT;
  v_third_down_attempts INT;
  v_third_down_conversions INT;
  v_red_zone_attempts INT;
  v_red_zone_touchdowns INT;

  -- Ball security
  v_turnovers INT;
  v_fumbles INT;
  v_interceptions INT;

  -- Possession
  v_total_top_seconds INT;

  -- Defensive volume (opponent stats)
  v_opponent_plays INT;
  v_yards_allowed INT;
  v_rushing_yards_allowed INT;
  v_passing_yards_allowed INT;
  v_points_allowed INT;

  -- Defensive efficiency
  v_opponent_third_down_attempts INT;
  v_opponent_third_down_conversions INT;
  v_opponent_red_zone_attempts INT;
  v_opponent_red_zone_touchdowns INT;

  -- Defensive disruptive
  v_takeaways INT;
  v_sacks INT;
  v_tfls INT;
  v_forced_fumbles INT;
  v_interceptions_def INT;
  v_pass_breakups INT;

  -- Special teams (existing)
  v_fg_made INT;
  v_fg_attempted INT;
  v_xp_made INT;
  v_xp_attempted INT;
  v_punt_returns INT;
  v_punt_return_yards INT;
  v_kickoff_returns INT;
  v_kickoff_return_yards INT;
  v_avg_start_field_position NUMERIC;

  -- Special teams (new for nested structure)
  v_kickoffs INT;
  v_touchbacks INT;
  v_punts INT;
  v_punt_yards INT;
  v_longest_return INT;
  v_fg_blocked INT;

BEGIN
  -- ============================================================================
  -- QUERY 1: Offensive Metrics (single query for efficiency)
  -- Game filter priority: p_game_ids > p_game_id > date range > all games
  -- ============================================================================
  SELECT
    COUNT(DISTINCT g.id),
    COALESCE(SUM(yards_gained), 0),
    COALESCE(SUM(yards_gained) FILTER (WHERE play_type = 'run'), 0),
    COALESCE(SUM(yards_gained) FILTER (WHERE play_type = 'pass' AND is_complete = TRUE), 0),
    COUNT(*) FILTER (WHERE is_touchdown = TRUE OR scoring_type = 'touchdown'),
    COUNT(*),
    COUNT(*) FILTER (WHERE play_type = 'run'),
    COUNT(*) FILTER (WHERE play_type = 'pass' AND is_complete = TRUE),
    COUNT(*) FILTER (WHERE play_type = 'pass'),
    COUNT(*) FILTER (WHERE down = 3),
    COUNT(*) FILTER (WHERE down = 3 AND resulted_in_first_down = TRUE),
    COUNT(*) FILTER (WHERE yard_line >= 80),
    COUNT(*) FILTER (WHERE yard_line >= 80 AND (is_touchdown = TRUE OR scoring_type = 'touchdown')),
    COUNT(*) FILTER (WHERE is_turnover = TRUE),
    COUNT(*) FILTER (WHERE is_fumble = TRUE AND is_turnover = TRUE),
    COUNT(*) FILTER (WHERE is_interception = TRUE),
    COALESCE(SUM(play_duration_seconds), 0)
  INTO
    v_games_played,
    v_total_yards, v_rushing_yards, v_passing_yards, v_touchdowns,
    v_total_plays, v_rushing_attempts, v_completions, v_pass_attempts,
    v_third_down_attempts, v_third_down_conversions,
    v_red_zone_attempts, v_red_zone_touchdowns,
    v_turnovers, v_fumbles, v_interceptions,
    v_total_top_seconds
  FROM play_instances pi
    LEFT JOIN videos v ON pi.video_id = v.id
    LEFT JOIN games g ON v.game_id = g.id
  WHERE pi.team_id = p_team_id
    AND pi.is_opponent_play = FALSE
    AND pi.play_type IN ('run', 'pass')
    -- Game filter priority: p_game_ids > p_game_id > date range
    AND (
      (p_game_ids IS NOT NULL AND array_length(p_game_ids, 1) > 0 AND g.id = ANY(p_game_ids))
      OR (p_game_ids IS NULL OR array_length(p_game_ids, 1) IS NULL) AND (
        (p_game_id IS NOT NULL AND g.id = p_game_id)
        OR (p_game_id IS NULL AND (p_start_date IS NULL OR g.date >= p_start_date))
      )
    )
    AND (p_game_ids IS NOT NULL AND array_length(p_game_ids, 1) > 0 OR p_end_date IS NULL OR g.date <= p_end_date)
    AND (p_opponent IS NULL OR g.opponent = p_opponent);

  -- ============================================================================
  -- QUERY 2: Defensive Volume Metrics
  -- ============================================================================
  SELECT
    COUNT(*),
    COALESCE(SUM(yards_gained), 0),
    COALESCE(SUM(yards_gained) FILTER (WHERE play_type = 'run'), 0),
    COALESCE(SUM(yards_gained) FILTER (WHERE play_type = 'pass' AND is_complete = TRUE), 0),
    COALESCE(SUM(
      CASE
        WHEN is_touchdown = TRUE OR scoring_type = 'touchdown' THEN 6
        WHEN is_field_goal_made = TRUE OR scoring_type = 'field_goal' THEN 3
        WHEN is_safety = TRUE OR scoring_type = 'safety' THEN 2
        WHEN is_two_point_made = TRUE OR scoring_type = 'two_point_conversion' THEN 2
        WHEN is_extra_point_made = TRUE OR scoring_type = 'extra_point' THEN 1
        ELSE 0
      END
    ), 0),
    COUNT(*) FILTER (WHERE down = 3),
    COUNT(*) FILTER (WHERE down = 3 AND resulted_in_first_down = TRUE),
    COUNT(*) FILTER (WHERE yard_line >= 80),
    COUNT(*) FILTER (WHERE yard_line >= 80 AND (is_touchdown = TRUE OR scoring_type = 'touchdown'))
  INTO
    v_opponent_plays,
    v_yards_allowed,
    v_rushing_yards_allowed,
    v_passing_yards_allowed,
    v_points_allowed,
    v_opponent_third_down_attempts,
    v_opponent_third_down_conversions,
    v_opponent_red_zone_attempts,
    v_opponent_red_zone_touchdowns
  FROM play_instances pi
    LEFT JOIN videos v ON pi.video_id = v.id
    LEFT JOIN games g ON v.game_id = g.id
  WHERE pi.team_id = p_team_id
    AND pi.is_opponent_play = TRUE
    AND (
      (p_game_ids IS NOT NULL AND array_length(p_game_ids, 1) > 0 AND g.id = ANY(p_game_ids))
      OR (p_game_ids IS NULL OR array_length(p_game_ids, 1) IS NULL) AND (
        (p_game_id IS NOT NULL AND g.id = p_game_id)
        OR (p_game_id IS NULL AND (p_start_date IS NULL OR g.date >= p_start_date))
      )
    )
    AND (p_game_ids IS NOT NULL AND array_length(p_game_ids, 1) > 0 OR p_end_date IS NULL OR g.date <= p_end_date)
    AND (p_opponent IS NULL OR g.opponent = p_opponent);

  -- ============================================================================
  -- QUERY 3: Defensive Disruptive Plays (from junction table)
  -- ============================================================================
  SELECT
    COUNT(*) FILTER (WHERE pp.participation_type IN ('interception', 'fumble_recovery')),
    COUNT(*) FILTER (WHERE pp.participation_type = 'pressure' AND pp.result = 'sack'),
    COUNT(*) FILTER (WHERE pp.participation_type IN ('tfl', 'tackle_for_loss')),
    COUNT(*) FILTER (WHERE pp.participation_type = 'forced_fumble'),
    COUNT(*) FILTER (WHERE pp.participation_type = 'interception'),
    COUNT(*) FILTER (WHERE pp.participation_type = 'pass_breakup')
  INTO
    v_takeaways,
    v_sacks,
    v_tfls,
    v_forced_fumbles,
    v_interceptions_def,
    v_pass_breakups
  FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    LEFT JOIN videos v ON pi.video_id = v.id
    LEFT JOIN games g ON v.game_id = g.id
  WHERE pi.team_id = p_team_id
    AND pi.is_opponent_play = TRUE
    AND (
      (p_game_ids IS NOT NULL AND array_length(p_game_ids, 1) > 0 AND g.id = ANY(p_game_ids))
      OR (p_game_ids IS NULL OR array_length(p_game_ids, 1) IS NULL) AND (
        (p_game_id IS NOT NULL AND g.id = p_game_id)
        OR (p_game_id IS NULL AND (p_start_date IS NULL OR g.date >= p_start_date))
      )
    )
    AND (p_game_ids IS NOT NULL AND array_length(p_game_ids, 1) > 0 OR p_end_date IS NULL OR g.date <= p_end_date)
    AND (p_opponent IS NULL OR g.opponent = p_opponent);

  -- ============================================================================
  -- QUERY 4: Special Teams Metrics (EXPANDED for nested structure)
  -- ============================================================================
  SELECT
    -- Field Goals and Extra Points
    COUNT(*) FILTER (WHERE is_field_goal_made = TRUE AND is_opponent_play = FALSE),
    COUNT(*) FILTER (WHERE is_field_goal_attempt = TRUE AND is_opponent_play = FALSE),
    COUNT(*) FILTER (WHERE is_extra_point_made = TRUE AND is_opponent_play = FALSE),
    COUNT(*) FILTER (WHERE is_extra_point_attempt = TRUE AND is_opponent_play = FALSE),
    -- Returns (our returns, not opponent's)
    COUNT(*) FILTER (WHERE is_punt_return = TRUE),
    COALESCE(SUM(return_yards) FILTER (WHERE is_punt_return = TRUE), 0),
    COUNT(*) FILTER (WHERE is_kickoff_return = TRUE),
    COALESCE(SUM(return_yards) FILTER (WHERE is_kickoff_return = TRUE), 0),
    -- Kickoffs (our kickoffs, not opponent's)
    COUNT(*) FILTER (WHERE is_kickoff = TRUE AND is_opponent_play = FALSE),
    COUNT(*) FILTER (WHERE is_touchback = TRUE AND is_kickoff = TRUE AND is_opponent_play = FALSE),
    -- Punts (our punts, not opponent's)
    COUNT(*) FILTER (WHERE is_punt = TRUE AND is_opponent_play = FALSE),
    COALESCE(SUM(kick_distance) FILTER (WHERE is_punt = TRUE AND is_opponent_play = FALSE), 0),
    -- Longest return
    COALESCE(MAX(return_yards), 0),
    -- FG Blocks (opponent FGs we blocked)
    COUNT(*) FILTER (WHERE is_field_goal_attempt = TRUE AND is_opponent_play = TRUE AND kick_result = 'blocked')
  INTO
    v_fg_made, v_fg_attempted,
    v_xp_made, v_xp_attempted,
    v_punt_returns, v_punt_return_yards,
    v_kickoff_returns, v_kickoff_return_yards,
    v_kickoffs, v_touchbacks,
    v_punts, v_punt_yards,
    v_longest_return,
    v_fg_blocked
  FROM play_instances pi
    LEFT JOIN videos v ON pi.video_id = v.id
    LEFT JOIN games g ON v.game_id = g.id
  WHERE pi.team_id = p_team_id
    AND (
      (p_game_ids IS NOT NULL AND array_length(p_game_ids, 1) > 0 AND g.id = ANY(p_game_ids))
      OR (p_game_ids IS NULL OR array_length(p_game_ids, 1) IS NULL) AND (
        (p_game_id IS NOT NULL AND g.id = p_game_id)
        OR (p_game_id IS NULL AND (p_start_date IS NULL OR g.date >= p_start_date))
      )
    )
    AND (p_game_ids IS NOT NULL AND array_length(p_game_ids, 1) > 0 OR p_end_date IS NULL OR g.date <= p_end_date)
    AND (p_opponent IS NULL OR g.opponent = p_opponent);

  -- ============================================================================
  -- QUERY 5: Average Starting Field Position (from drives)
  -- ============================================================================
  SELECT COALESCE(AVG(start_yard_line), 0)
  INTO v_avg_start_field_position
  FROM drives d
    LEFT JOIN games g ON d.game_id = g.id
  WHERE d.team_id = p_team_id
    AND d.possession_type = 'offense'
    AND (
      (p_game_ids IS NOT NULL AND array_length(p_game_ids, 1) > 0 AND g.id = ANY(p_game_ids))
      OR (p_game_ids IS NULL OR array_length(p_game_ids, 1) IS NULL) AND (
        (p_game_id IS NOT NULL AND g.id = p_game_id)
        OR (p_game_id IS NULL AND (p_start_date IS NULL OR g.date >= p_start_date))
      )
    )
    AND (p_game_ids IS NOT NULL AND array_length(p_game_ids, 1) > 0 OR p_end_date IS NULL OR g.date <= p_end_date)
    AND (p_opponent IS NULL OR g.opponent = p_opponent);

  -- ============================================================================
  -- BUILD COMPREHENSIVE JSONB RESULT (matches ComprehensiveTeamMetrics type)
  -- ============================================================================
  v_result := jsonb_build_object(
    'filters', jsonb_build_object(
      'teamId', p_team_id,
      'gameId', p_game_id,
      'startDate', p_start_date,
      'endDate', p_end_date,
      'opponent', p_opponent,
      'gamesPlayed', v_games_played
    ),

    'offense', jsonb_build_object(
      'volume', jsonb_build_object(
        'totalYardsPerGame', ROUND(v_total_yards::NUMERIC / NULLIF(v_games_played, 0), 1),
        'rushingYardsPerGame', ROUND(v_rushing_yards::NUMERIC / NULLIF(v_games_played, 0), 1),
        'passingYardsPerGame', ROUND(v_passing_yards::NUMERIC / NULLIF(v_games_played, 0), 1),
        'touchdowns', v_touchdowns,
        'touchdownsPerGame', ROUND(v_touchdowns::NUMERIC / NULLIF(v_games_played, 0), 2),
        'totalYards', v_total_yards,
        'rushingYards', v_rushing_yards,
        'passingYards', v_passing_yards
      ),

      'efficiency', jsonb_build_object(
        'yardsPerPlay', ROUND(v_total_yards::NUMERIC / NULLIF(v_total_plays, 0), 2),
        'yardsPerCarry', ROUND(v_rushing_yards::NUMERIC / NULLIF(v_rushing_attempts, 0), 2),
        'yardsPerCompletion', ROUND(v_passing_yards::NUMERIC / NULLIF(v_completions, 0), 2),
        'completionPercentage', ROUND(100.0 * v_completions / NULLIF(v_pass_attempts, 0), 1),
        'thirdDownConversionRate', ROUND(100.0 * v_third_down_conversions / NULLIF(v_third_down_attempts, 0), 1),
        'redZoneEfficiency', ROUND(100.0 * v_red_zone_touchdowns / NULLIF(v_red_zone_attempts, 0), 1),
        'redZoneAttempts', v_red_zone_attempts,
        'redZoneTouchdowns', v_red_zone_touchdowns,
        'totalPlays', v_total_plays,
        'thirdDownAttempts', v_third_down_attempts,
        'thirdDownConversions', v_third_down_conversions
      ),

      'ballSecurity', jsonb_build_object(
        'turnovers', v_turnovers,
        'turnoversPerGame', ROUND(v_turnovers::NUMERIC / NULLIF(v_games_played, 0), 2),
        'fumbles', v_fumbles,
        'interceptions', v_interceptions
      ),

      'possession', jsonb_build_object(
        'timeOfPossessionSeconds', v_total_top_seconds,
        'timeOfPossessionPerGame', ROUND(v_total_top_seconds::NUMERIC / NULLIF(v_games_played, 0), 0),
        'timeOfPossessionFormatted', LPAD((v_total_top_seconds / 60)::TEXT, 2, '0') || ':' || LPAD((v_total_top_seconds % 60)::TEXT, 2, '0'),
        'averagePlayDuration', ROUND(v_total_top_seconds::NUMERIC / NULLIF(v_total_plays, 0), 1)
      )
    ),

    'defense', jsonb_build_object(
      'volume', jsonb_build_object(
        'totalYardsAllowedPerGame', ROUND(v_yards_allowed::NUMERIC / NULLIF(v_games_played, 0), 1),
        'rushingYardsAllowedPerGame', ROUND(v_rushing_yards_allowed::NUMERIC / NULLIF(v_games_played, 0), 1),
        'passingYardsAllowedPerGame', ROUND(v_passing_yards_allowed::NUMERIC / NULLIF(v_games_played, 0), 1),
        'pointsAllowedPerGame', ROUND(v_points_allowed::NUMERIC / NULLIF(v_games_played, 0), 1),
        'totalYardsAllowed', v_yards_allowed,
        'rushingYardsAllowed', v_rushing_yards_allowed,
        'passingYardsAllowed', v_passing_yards_allowed,
        'pointsAllowed', v_points_allowed
      ),

      'efficiency', jsonb_build_object(
        'yardsPerPlayAllowed', ROUND(v_yards_allowed::NUMERIC / NULLIF(v_opponent_plays, 0), 2),
        'thirdDownStopPercentage', ROUND(100.0 * (v_opponent_third_down_attempts - v_opponent_third_down_conversions) / NULLIF(v_opponent_third_down_attempts, 0), 1),
        'redZoneDefense', ROUND(100.0 * v_opponent_red_zone_touchdowns / NULLIF(v_opponent_red_zone_attempts, 0), 1),
        'redZoneAttemptsFaced', v_opponent_red_zone_attempts,
        'redZoneTouchdownsAllowed', v_opponent_red_zone_touchdowns,
        'opponentThirdDownAttempts', v_opponent_third_down_attempts,
        'opponentThirdDownStops', v_opponent_third_down_attempts - v_opponent_third_down_conversions
      ),

      'disruptive', jsonb_build_object(
        'takeaways', v_takeaways,
        'takeawaysPerGame', ROUND(v_takeaways::NUMERIC / NULLIF(v_games_played, 0), 2),
        'interceptions', v_interceptions_def,
        'fumbleRecoveries', v_takeaways - v_interceptions_def,
        'sacks', v_sacks,
        'tacklesForLoss', v_tfls,
        'forcedFumbles', v_forced_fumbles,
        'passBreakups', v_pass_breakups,
        'havocRate', ROUND(100.0 * (v_sacks + v_tfls + v_forced_fumbles + v_pass_breakups) / NULLIF(v_opponent_plays, 0), 1)
      )
    ),

    'specialTeams', jsonb_build_object(
      -- Flat structure for backward compatibility
      'fieldGoalPercentage', ROUND(100.0 * v_fg_made / NULLIF(v_fg_attempted, 0), 1),
      'fieldGoalsMade', v_fg_made,
      'fieldGoalsAttempted', v_fg_attempted,
      'extraPointPercentage', ROUND(100.0 * v_xp_made / NULLIF(v_xp_attempted, 0), 1),
      'extraPointsMade', v_xp_made,
      'extraPointsAttempted', v_xp_attempted,
      'puntReturnAverage', ROUND(v_punt_return_yards::NUMERIC / NULLIF(v_punt_returns, 0), 1),
      'puntReturns', v_punt_returns,
      'puntReturnYards', v_punt_return_yards,
      'kickoffReturnAverage', ROUND(v_kickoff_return_yards::NUMERIC / NULLIF(v_kickoff_returns, 0), 1),
      'kickoffReturns', v_kickoff_returns,
      'kickoffReturnYards', v_kickoff_return_yards,
      'averageStartingFieldPosition', ROUND(v_avg_start_field_position, 1),

      -- Nested structure for SpecialTeamsReport.tsx
      'kickoff', jsonb_build_object(
        'kickoffs', v_kickoffs,
        'touchbacks', v_touchbacks,
        'touchbackRate', ROUND(100.0 * v_touchbacks / NULLIF(v_kickoffs, 0), 1),
        'averageKickoffYardLine', COALESCE(v_avg_start_field_position, 25)
      ),
      'punt', jsonb_build_object(
        'punts', v_punts,
        'totalYards', v_punt_yards,
        'averagePuntYards', ROUND(v_punt_yards::NUMERIC / NULLIF(v_punts, 0), 1),
        'netPuntAverage', ROUND((v_punt_yards - v_punt_return_yards)::NUMERIC / NULLIF(v_punts, 0), 1)
      ),
      'returns', jsonb_build_object(
        'returns', v_punt_returns + v_kickoff_returns,
        'kickReturns', v_kickoff_returns,
        'puntReturns', v_punt_returns,
        'totalYards', v_punt_return_yards + v_kickoff_return_yards,
        'averageReturnYards', ROUND((v_punt_return_yards + v_kickoff_return_yards)::NUMERIC / NULLIF(v_punt_returns + v_kickoff_returns, 0), 1),
        'longestReturn', v_longest_return
      ),
      'fieldGoal', jsonb_build_object(
        'made', v_fg_made,
        'attempted', v_fg_attempted,
        'percentage', ROUND(100.0 * v_fg_made / NULLIF(v_fg_attempted, 0), 1),
        'blocked', 0
      ),
      'pat', jsonb_build_object(
        'made', v_xp_made,
        'attempted', v_xp_attempted,
        'percentage', ROUND(100.0 * v_xp_made / NULLIF(v_xp_attempted, 0), 1)
      ),
      'fgBlock', jsonb_build_object(
        'blocks', v_fg_blocked,
        'blocksRecovered', 0,
        'blocksReturnedForTD', 0
      )
    ),

    'overall', jsonb_build_object(
      'turnoverDifferential', v_takeaways - v_turnovers,
      'turnoverMargin', v_takeaways - v_turnovers,
      'gamesPlayed', v_games_played
    )
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION calculate_team_metrics(UUID, UUID, DATE, DATE, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_team_metrics(UUID, UUID, DATE, DATE, TEXT, UUID[]) TO anon;

COMMENT ON FUNCTION calculate_team_metrics IS 'Calculate comprehensive team metrics with support for single game, cumulative (game_ids array), date range, and opponent filters. Output structure matches ComprehensiveTeamMetrics TypeScript type.';
