-- Migration 133: Fix get_kicker_stats to properly count PATs and Kickoffs
-- ============================================================================
-- PURPOSE:
--   The get_kicker_stats function was hardcoding xpMade/xpAttempts to 0
--   and not counting kickoffs at all. This migration fixes the function
--   to properly join with play_instances and check is_extra_point_attempt,
--   is_field_goal_attempt, and is_kickoff flags.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_kicker_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH video_filter AS (
    SELECT v.id AS video_id
    FROM videos v
    INNER JOIN games g ON v.game_id = g.id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  kicker_participation AS (
    SELECT
      pp.player_id,
      p.first_name,
      p.last_name,
      p.jersey_number,
      p.primary_position,
      pp.participation_type,
      pp.yards_gained,
      pp.result AS pp_result,
      pi.kick_result,
      pi.kick_distance,
      pi.is_touchback,
      -- Join flags from play_instances to identify play type
      pi.is_kickoff,
      pi.is_field_goal_attempt,
      pi.is_field_goal_made,
      pi.is_extra_point_attempt,
      pi.is_extra_point_made
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN video_filter vf ON pi.video_id = vf.video_id
    WHERE pp.team_id = p_team_id
      AND pp.phase = 'special_teams'
      AND pp.participation_type IN ('kicker', 'punter')
  ),
  kicker_aggregated AS (
    SELECT
      player_id,
      first_name,
      last_name,
      jersey_number,
      primary_position,
      -- Field goals: use play_instances flags
      COUNT(*) FILTER (WHERE participation_type = 'kicker' AND is_field_goal_made = TRUE) AS fg_made,
      COUNT(*) FILTER (WHERE participation_type = 'kicker' AND is_field_goal_attempt = TRUE) AS fg_attempts,
      COALESCE(MAX(kick_distance) FILTER (WHERE participation_type = 'kicker' AND is_field_goal_made = TRUE), 0) AS fg_long,
      -- Extra points (PATs): use play_instances flags
      COUNT(*) FILTER (WHERE participation_type = 'kicker' AND is_extra_point_made = TRUE) AS xp_made,
      COUNT(*) FILTER (WHERE participation_type = 'kicker' AND is_extra_point_attempt = TRUE) AS xp_attempts,
      -- Kickoffs: use play_instances flags
      COUNT(*) FILTER (WHERE participation_type = 'kicker' AND is_kickoff = TRUE) AS kickoffs,
      COUNT(*) FILTER (WHERE participation_type = 'kicker' AND is_kickoff = TRUE AND is_touchback = TRUE) AS touchbacks,
      COALESCE(AVG(kick_distance) FILTER (WHERE participation_type = 'kicker' AND is_kickoff = TRUE), 0) AS kickoff_avg,
      -- Punts: punter participation
      COUNT(*) FILTER (WHERE participation_type = 'punter') AS punts,
      COALESCE(AVG(kick_distance) FILTER (WHERE participation_type = 'punter'), 0) AS punt_avg,
      COALESCE(MAX(kick_distance) FILTER (WHERE participation_type = 'punter'), 0) AS longest_punt,
      COALESCE(SUM(yards_gained) FILTER (WHERE participation_type = 'punter'), 0) AS punt_yards
    FROM kicker_participation
    GROUP BY player_id, first_name, last_name, jersey_number, primary_position
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'playerId', player_id,
      'playerName', first_name || ' ' || last_name,
      'jerseyNumber', COALESCE(jersey_number, ''),
      'position', primary_position,
      -- Field Goals
      'fgMade', fg_made,
      'fgAttempts', fg_attempts,
      'fgPct', ROUND(100.0 * fg_made / NULLIF(fg_attempts, 0), 1),
      'fgLong', fg_long,
      -- Extra Points (PATs)
      'xpMade', xp_made,
      'xpAttempts', xp_attempts,
      'xpPct', ROUND(100.0 * xp_made / NULLIF(xp_attempts, 0), 1),
      -- Kickoffs
      'kickoffs', kickoffs,
      'touchbacks', touchbacks,
      'touchbackPct', ROUND(100.0 * touchbacks / NULLIF(kickoffs, 0), 1),
      'kickoffAvg', ROUND(kickoff_avg::NUMERIC, 1),
      -- Punts
      'punts', punts,
      'puntAvg', ROUND(punt_avg::NUMERIC, 1),
      'longestPunt', longest_punt,
      'puntYards', punt_yards,
      -- Total Points
      'totalPoints', (fg_made * 3) + xp_made
    )
    ORDER BY (fg_made * 3) + xp_made DESC
  )
  INTO v_result
  FROM kicker_aggregated;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_kicker_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_kicker_stats(UUID, UUID) TO anon;

COMMENT ON FUNCTION get_kicker_stats IS 'Get kicker/punter stats including field goals, PATs, kickoffs, and punts. Fixed in migration 133 to properly count PATs and kickoffs by joining with play_instances flags.';
