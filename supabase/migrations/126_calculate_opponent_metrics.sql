-- Migration 126: Calculate Opponent Metrics Function
-- Purpose: Same 28 metrics as calculate_team_metrics but for opponent analysis
-- Works with BOTH dedicated scouting games AND regular games where opponent plays were tagged
-- Used by Opponent Scouting Report to show comprehensive opponent analysis

-- ============================================================================
-- Calculate Opponent Metrics Function
-- Takes opponent name and returns their offensive/defensive metrics from scouting film
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_opponent_metrics(
  p_team_id UUID,
  p_opponent_name TEXT,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;

  -- Games tracking
  v_games_analyzed INT;

  -- Opponent Offensive volume (when opponent has ball)
  v_opp_total_yards INT;
  v_opp_rushing_yards INT;
  v_opp_passing_yards INT;
  v_opp_touchdowns INT;

  -- Opponent Offensive efficiency
  v_opp_total_plays INT;
  v_opp_rushing_attempts INT;
  v_opp_completions INT;
  v_opp_pass_attempts INT;
  v_opp_third_down_attempts INT;
  v_opp_third_down_conversions INT;
  v_opp_red_zone_attempts INT;
  v_opp_red_zone_touchdowns INT;

  -- Opponent Ball security (turnovers they commit)
  v_opp_turnovers INT;
  v_opp_fumbles INT;
  v_opp_interceptions INT;

  -- Opponent Possession
  v_opp_total_top_seconds INT;

  -- Opponent Defensive volume (what they allow when defending)
  v_opp_def_plays INT;
  v_opp_yards_allowed INT;
  v_opp_rushing_yards_allowed INT;
  v_opp_passing_yards_allowed INT;
  v_opp_points_allowed INT;

  -- Opponent Defensive efficiency
  v_opp_def_third_down_attempts INT;
  v_opp_def_third_down_conversions INT;
  v_opp_def_red_zone_attempts INT;
  v_opp_def_red_zone_touchdowns INT;

  -- Opponent Defensive disruptive (what they generate on defense)
  v_opp_takeaways INT;
  v_opp_sacks INT;
  v_opp_tfls INT;
  v_opp_forced_fumbles INT;
  v_opp_interceptions_def INT;
  v_opp_pass_breakups INT;

  -- Special teams (opponent's kicking/returning)
  v_opp_fg_made INT;
  v_opp_fg_attempted INT;
  v_opp_xp_made INT;
  v_opp_xp_attempted INT;
  v_opp_punt_returns INT;
  v_opp_punt_return_yards INT;
  v_opp_kickoff_returns INT;
  v_opp_kickoff_return_yards INT;

  -- Game IDs for opponent scouting games
  v_game_ids UUID[];

BEGIN
  -- ============================================================================
  -- STEP 1: Find games against this opponent
  -- Includes both regular games AND dedicated scouting games
  -- ============================================================================
  SELECT ARRAY_AGG(g.id)
  INTO v_game_ids
  FROM games g
  WHERE g.team_id = p_team_id
    AND (
      g.opponent ILIKE '%' || p_opponent_name || '%'
      OR g.opponent_team_name ILIKE '%' || p_opponent_name || '%'
    )
    AND (p_game_id IS NULL OR g.id = p_game_id);

  -- If no games found, return empty result
  IF v_game_ids IS NULL OR array_length(v_game_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'filters', jsonb_build_object(
        'teamId', p_team_id,
        'opponentName', p_opponent_name,
        'gamesAnalyzed', 0
      ),
      'offense', jsonb_build_object(
        'volume', jsonb_build_object('totalYardsPerGame', 0, 'rushingYardsPerGame', 0, 'passingYardsPerGame', 0, 'touchdowns', 0, 'touchdownsPerGame', 0),
        'efficiency', jsonb_build_object('yardsPerPlay', 0, 'yardsPerCarry', 0, 'yardsPerCompletion', 0, 'completionPercentage', 0, 'thirdDownConversionRate', 0, 'redZoneEfficiency', 0),
        'ballSecurity', jsonb_build_object('turnovers', 0, 'turnoversPerGame', 0, 'fumbles', 0, 'interceptions', 0),
        'possession', jsonb_build_object('timeOfPossessionSeconds', 0, 'timeOfPossessionPerGame', 0, 'timeOfPossessionFormatted', '00:00', 'averagePlayDuration', 0)
      ),
      'defense', jsonb_build_object(
        'volume', jsonb_build_object('totalYardsAllowedPerGame', 0, 'rushingYardsAllowedPerGame', 0, 'passingYardsAllowedPerGame', 0, 'pointsAllowedPerGame', 0),
        'efficiency', jsonb_build_object('yardsPerPlayAllowed', 0, 'thirdDownStopPercentage', 0, 'redZoneDefense', 0),
        'disruptive', jsonb_build_object('takeaways', 0, 'takeawaysPerGame', 0, 'sacks', 0, 'tacklesForLoss', 0, 'havocRate', 0)
      ),
      'specialTeams', jsonb_build_object(
        'fieldGoalPercentage', 0, 'fieldGoalsMade', 0, 'fieldGoalsAttempted', 0,
        'extraPointPercentage', 0, 'extraPointsMade', 0, 'extraPointsAttempted', 0,
        'puntReturnAverage', 0, 'puntReturns', 0,
        'kickoffReturnAverage', 0, 'kickoffReturns', 0
      ),
      'overall', jsonb_build_object('turnoverDifferential', 0, 'gamesAnalyzed', 0)
    );
  END IF;

  v_games_analyzed := array_length(v_game_ids, 1);

  -- ============================================================================
  -- QUERY 1: Opponent OFFENSIVE Metrics
  -- These are plays where is_opponent_play = TRUE (opponent had the ball)
  -- ============================================================================
  SELECT
    -- Volume
    COALESCE(SUM(yards_gained), 0),
    COALESCE(SUM(yards_gained) FILTER (WHERE play_type = 'run'), 0),
    COALESCE(SUM(yards_gained) FILTER (WHERE play_type = 'pass' AND is_complete = TRUE), 0),
    COUNT(*) FILTER (WHERE is_touchdown = TRUE),

    -- Efficiency
    COUNT(*),
    COUNT(*) FILTER (WHERE play_type = 'run'),
    COUNT(*) FILTER (WHERE play_type = 'pass' AND is_complete = TRUE),
    COUNT(*) FILTER (WHERE play_type = 'pass'),
    COUNT(*) FILTER (WHERE down = 3),
    COUNT(*) FILTER (WHERE down = 3 AND resulted_in_first_down = TRUE),

    -- Ball Security (opponent turnovers = bad for them)
    COUNT(*) FILTER (WHERE is_turnover = TRUE),
    COUNT(*) FILTER (WHERE is_fumble = TRUE AND is_turnover = TRUE),
    COUNT(*) FILTER (WHERE is_interception = TRUE),

    -- Time of Possession
    COALESCE(SUM(play_duration_seconds), 0),

    -- Red zone (plays starting inside 20)
    COUNT(*) FILTER (WHERE yard_line >= 80),
    COUNT(*) FILTER (WHERE yard_line >= 80 AND is_touchdown = TRUE)

  INTO
    v_opp_total_yards, v_opp_rushing_yards, v_opp_passing_yards, v_opp_touchdowns,
    v_opp_total_plays, v_opp_rushing_attempts, v_opp_completions, v_opp_pass_attempts,
    v_opp_third_down_attempts, v_opp_third_down_conversions,
    v_opp_turnovers, v_opp_fumbles, v_opp_interceptions,
    v_opp_total_top_seconds,
    v_opp_red_zone_attempts, v_opp_red_zone_touchdowns
  FROM play_instances pi
    LEFT JOIN videos v ON pi.video_id = v.id
  WHERE pi.team_id = p_team_id
    AND pi.is_opponent_play = TRUE
    AND v.game_id = ANY(v_game_ids);

  -- ============================================================================
  -- QUERY 2: Opponent DEFENSIVE Metrics
  -- These are plays where is_opponent_play = FALSE in scouting games
  -- (the other team had the ball, opponent was on defense)
  -- ============================================================================
  SELECT
    COUNT(*),
    COALESCE(SUM(yards_gained), 0),
    COALESCE(SUM(yards_gained) FILTER (WHERE play_type = 'run'), 0),
    COALESCE(SUM(yards_gained) FILTER (WHERE play_type = 'pass' AND is_complete = TRUE), 0),
    COALESCE(SUM(
      CASE
        WHEN is_touchdown THEN 6
        WHEN is_field_goal_made THEN 3
        WHEN is_safety THEN 2
        WHEN is_two_point_made THEN 2
        WHEN is_extra_point_made THEN 1
        ELSE 0
      END
    ), 0),
    COUNT(*) FILTER (WHERE down = 3),
    COUNT(*) FILTER (WHERE down = 3 AND resulted_in_first_down = TRUE),
    COUNT(*) FILTER (WHERE yard_line >= 80),
    COUNT(*) FILTER (WHERE yard_line >= 80 AND is_touchdown = TRUE)
  INTO
    v_opp_def_plays,
    v_opp_yards_allowed,
    v_opp_rushing_yards_allowed,
    v_opp_passing_yards_allowed,
    v_opp_points_allowed,
    v_opp_def_third_down_attempts,
    v_opp_def_third_down_conversions,
    v_opp_def_red_zone_attempts,
    v_opp_def_red_zone_touchdowns
  FROM play_instances pi
    LEFT JOIN videos v ON pi.video_id = v.id
  WHERE pi.team_id = p_team_id
    AND pi.is_opponent_play = FALSE
    AND v.game_id = ANY(v_game_ids);

  -- ============================================================================
  -- QUERY 3: Opponent Defensive Disruptive Plays
  -- When opponent is on defense, what do they generate?
  -- Since we don't have player_participation for opponents, estimate from play results
  -- ============================================================================
  SELECT
    -- Takeaways: plays where is_opponent_play = FALSE and is_turnover = TRUE
    COUNT(*) FILTER (WHERE is_turnover = TRUE),
    -- Sacks: plays where is_sack = TRUE
    COUNT(*) FILTER (WHERE is_sack = TRUE),
    -- TFLs: plays where is_tfl = TRUE
    COUNT(*) FILTER (WHERE is_tfl = TRUE),
    -- Forced fumbles (estimated from turnovers that are fumbles)
    COUNT(*) FILTER (WHERE is_fumble = TRUE AND is_turnover = TRUE),
    -- Interceptions: plays where is_interception = TRUE
    COUNT(*) FILTER (WHERE is_interception = TRUE),
    -- Pass breakups (if tracked)
    0 -- Not tracked at play level for opponents
  INTO
    v_opp_takeaways,
    v_opp_sacks,
    v_opp_tfls,
    v_opp_forced_fumbles,
    v_opp_interceptions_def,
    v_opp_pass_breakups
  FROM play_instances pi
    LEFT JOIN videos v ON pi.video_id = v.id
  WHERE pi.team_id = p_team_id
    AND pi.is_opponent_play = FALSE
    AND v.game_id = ANY(v_game_ids);

  -- ============================================================================
  -- QUERY 4: Opponent Special Teams
  -- ============================================================================
  SELECT
    COUNT(*) FILTER (WHERE is_field_goal_made = TRUE AND is_opponent_play = TRUE),
    COUNT(*) FILTER (WHERE is_field_goal_attempt = TRUE AND is_opponent_play = TRUE),
    COUNT(*) FILTER (WHERE is_extra_point_made = TRUE AND is_opponent_play = TRUE),
    COUNT(*) FILTER (WHERE is_extra_point_attempt = TRUE AND is_opponent_play = TRUE),
    COUNT(*) FILTER (WHERE is_punt_return = TRUE AND is_opponent_play = TRUE),
    COALESCE(SUM(return_yards) FILTER (WHERE is_punt_return = TRUE AND is_opponent_play = TRUE), 0),
    COUNT(*) FILTER (WHERE is_kickoff_return = TRUE AND is_opponent_play = TRUE),
    COALESCE(SUM(return_yards) FILTER (WHERE is_kickoff_return = TRUE AND is_opponent_play = TRUE), 0)
  INTO
    v_opp_fg_made, v_opp_fg_attempted,
    v_opp_xp_made, v_opp_xp_attempted,
    v_opp_punt_returns, v_opp_punt_return_yards,
    v_opp_kickoff_returns, v_opp_kickoff_return_yards
  FROM play_instances pi
    LEFT JOIN videos v ON pi.video_id = v.id
  WHERE pi.team_id = p_team_id
    AND v.game_id = ANY(v_game_ids);

  -- ============================================================================
  -- BUILD COMPREHENSIVE JSONB RESULT (same structure as calculate_team_metrics)
  -- ============================================================================
  v_result := jsonb_build_object(
    'filters', jsonb_build_object(
      'teamId', p_team_id,
      'opponentName', p_opponent_name,
      'gameId', p_game_id,
      'gamesAnalyzed', v_games_analyzed
    ),

    'offense', jsonb_build_object(
      'volume', jsonb_build_object(
        'totalYardsPerGame', ROUND(v_opp_total_yards::NUMERIC / NULLIF(v_games_analyzed, 0), 1),
        'rushingYardsPerGame', ROUND(v_opp_rushing_yards::NUMERIC / NULLIF(v_games_analyzed, 0), 1),
        'passingYardsPerGame', ROUND(v_opp_passing_yards::NUMERIC / NULLIF(v_games_analyzed, 0), 1),
        'touchdowns', v_opp_touchdowns,
        'touchdownsPerGame', ROUND(v_opp_touchdowns::NUMERIC / NULLIF(v_games_analyzed, 0), 2),
        'totalYards', v_opp_total_yards,
        'rushingYards', v_opp_rushing_yards,
        'passingYards', v_opp_passing_yards
      ),

      'efficiency', jsonb_build_object(
        'yardsPerPlay', ROUND(v_opp_total_yards::NUMERIC / NULLIF(v_opp_total_plays, 0), 2),
        'yardsPerCarry', ROUND(v_opp_rushing_yards::NUMERIC / NULLIF(v_opp_rushing_attempts, 0), 2),
        'yardsPerCompletion', ROUND(v_opp_passing_yards::NUMERIC / NULLIF(v_opp_completions, 0), 2),
        'completionPercentage', ROUND(100.0 * v_opp_completions / NULLIF(v_opp_pass_attempts, 0), 1),
        'thirdDownConversionRate', ROUND(100.0 * v_opp_third_down_conversions / NULLIF(v_opp_third_down_attempts, 0), 1),
        'redZoneEfficiency', ROUND(100.0 * v_opp_red_zone_touchdowns / NULLIF(v_opp_red_zone_attempts, 0), 1),
        'redZoneAttempts', v_opp_red_zone_attempts,
        'redZoneTouchdowns', v_opp_red_zone_touchdowns,
        'totalPlays', v_opp_total_plays,
        'thirdDownAttempts', v_opp_third_down_attempts,
        'thirdDownConversions', v_opp_third_down_conversions
      ),

      'ballSecurity', jsonb_build_object(
        'turnovers', v_opp_turnovers,
        'turnoversPerGame', ROUND(v_opp_turnovers::NUMERIC / NULLIF(v_games_analyzed, 0), 2),
        'fumbles', v_opp_fumbles,
        'interceptions', v_opp_interceptions
      ),

      'possession', jsonb_build_object(
        'timeOfPossessionSeconds', v_opp_total_top_seconds,
        'timeOfPossessionPerGame', ROUND(v_opp_total_top_seconds::NUMERIC / NULLIF(v_games_analyzed, 0), 0),
        'timeOfPossessionFormatted', LPAD((v_opp_total_top_seconds / 60)::TEXT, 2, '0') || ':' || LPAD((v_opp_total_top_seconds % 60)::TEXT, 2, '0'),
        'averagePlayDuration', ROUND(v_opp_total_top_seconds::NUMERIC / NULLIF(v_opp_total_plays, 0), 1)
      )
    ),

    'defense', jsonb_build_object(
      'volume', jsonb_build_object(
        'totalYardsAllowedPerGame', ROUND(v_opp_yards_allowed::NUMERIC / NULLIF(v_games_analyzed, 0), 1),
        'rushingYardsAllowedPerGame', ROUND(v_opp_rushing_yards_allowed::NUMERIC / NULLIF(v_games_analyzed, 0), 1),
        'passingYardsAllowedPerGame', ROUND(v_opp_passing_yards_allowed::NUMERIC / NULLIF(v_games_analyzed, 0), 1),
        'pointsAllowedPerGame', ROUND(v_opp_points_allowed::NUMERIC / NULLIF(v_games_analyzed, 0), 1),
        'totalYardsAllowed', v_opp_yards_allowed,
        'rushingYardsAllowed', v_opp_rushing_yards_allowed,
        'passingYardsAllowed', v_opp_passing_yards_allowed,
        'pointsAllowed', v_opp_points_allowed
      ),

      'efficiency', jsonb_build_object(
        'yardsPerPlayAllowed', ROUND(v_opp_yards_allowed::NUMERIC / NULLIF(v_opp_def_plays, 0), 2),
        'thirdDownStopPercentage', ROUND(100.0 * (v_opp_def_third_down_attempts - v_opp_def_third_down_conversions) / NULLIF(v_opp_def_third_down_attempts, 0), 1),
        'redZoneDefense', ROUND(100.0 * v_opp_def_red_zone_touchdowns / NULLIF(v_opp_def_red_zone_attempts, 0), 1),
        'redZoneAttemptsFaced', v_opp_def_red_zone_attempts,
        'redZoneTouchdownsAllowed', v_opp_def_red_zone_touchdowns,
        'opponentThirdDownAttempts', v_opp_def_third_down_attempts,
        'opponentThirdDownStops', v_opp_def_third_down_attempts - v_opp_def_third_down_conversions
      ),

      'disruptive', jsonb_build_object(
        'takeaways', v_opp_takeaways,
        'takeawaysPerGame', ROUND(v_opp_takeaways::NUMERIC / NULLIF(v_games_analyzed, 0), 2),
        'interceptions', v_opp_interceptions_def,
        'fumbleRecoveries', GREATEST(v_opp_takeaways - v_opp_interceptions_def, 0),
        'sacks', v_opp_sacks,
        'tacklesForLoss', v_opp_tfls,
        'forcedFumbles', v_opp_forced_fumbles,
        'passBreakups', v_opp_pass_breakups,
        'havocRate', ROUND(100.0 * (v_opp_sacks + v_opp_tfls + v_opp_forced_fumbles + v_opp_pass_breakups) / NULLIF(v_opp_def_plays, 0), 1)
      )
    ),

    'specialTeams', jsonb_build_object(
      'fieldGoalPercentage', ROUND(100.0 * v_opp_fg_made / NULLIF(v_opp_fg_attempted, 0), 1),
      'fieldGoalsMade', v_opp_fg_made,
      'fieldGoalsAttempted', v_opp_fg_attempted,
      'extraPointPercentage', ROUND(100.0 * v_opp_xp_made / NULLIF(v_opp_xp_attempted, 0), 1),
      'extraPointsMade', v_opp_xp_made,
      'extraPointsAttempted', v_opp_xp_attempted,
      'puntReturnAverage', ROUND(v_opp_punt_return_yards::NUMERIC / NULLIF(v_opp_punt_returns, 0), 1),
      'puntReturns', v_opp_punt_returns,
      'puntReturnYards', v_opp_punt_return_yards,
      'kickoffReturnAverage', ROUND(v_opp_kickoff_return_yards::NUMERIC / NULLIF(v_opp_kickoff_returns, 0), 1),
      'kickoffReturns', v_opp_kickoff_returns,
      'kickoffReturnYards', v_opp_kickoff_return_yards,
      'averageStartingFieldPosition', 0 -- Not tracked for opponents
    ),

    'overall', jsonb_build_object(
      'turnoverDifferential', v_opp_takeaways - v_opp_turnovers,
      'turnoverMargin', v_opp_takeaways - v_opp_turnovers,
      'gamesAnalyzed', v_games_analyzed
    )
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_opponent_metrics IS 'Calculate all 28 comprehensive football metrics for an opponent from scouting film. Returns same structure as calculate_team_metrics for UI consistency.';
