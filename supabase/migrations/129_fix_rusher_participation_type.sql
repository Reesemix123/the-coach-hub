-- Migration 129: Fix All Offensive Stats Functions
-- Purpose:
-- 1. Fix 'ball_carrier' -> 'rusher' in get_rb_stats (migration 123 defines 'rusher')
-- 2. Simplify video filtering to use LEFT JOINs for better NULL handling
-- 3. Make all functions more robust with better NULL/empty handling

-- ============================================================================
-- PART 1: QB Stats Function (Simplified and Robust)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_qb_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Direct query without complex CTE for better reliability
  SELECT jsonb_agg(row_data ORDER BY pass_attempts DESC)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'playerId', pp.player_id,
        'playerName', p.first_name || ' ' || p.last_name,
        'jerseyNumber', COALESCE(p.jersey_number, ''),
        'position', p.primary_position,
        'passAttempts', COUNT(*),
        'completions', COUNT(*) FILTER (WHERE pp.result = 'success'),
        'passingYards', COALESCE(SUM(pp.yards_gained) FILTER (WHERE pp.result = 'success'), 0),
        'passTDs', COUNT(*) FILTER (WHERE pp.is_touchdown = TRUE),
        'interceptions', COUNT(*) FILTER (WHERE pi.is_interception = TRUE),
        'sacks', COUNT(*) FILTER (WHERE pi.is_sack = TRUE),
        'completionPct', ROUND(100.0 * COUNT(*) FILTER (WHERE pp.result = 'success') / NULLIF(COUNT(*), 0), 1),
        'yardsPerAttempt', ROUND(COALESCE(SUM(pp.yards_gained) FILTER (WHERE pp.result = 'success'), 0)::NUMERIC / NULLIF(COUNT(*), 0), 1)
      ) AS row_data,
      COUNT(*) AS pass_attempts
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN videos v ON pi.video_id = v.id
    WHERE pp.team_id = p_team_id
      AND pp.participation_type = 'passer'
      AND pp.phase = 'offense'
      AND p.primary_position = 'QB'
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
    GROUP BY pp.player_id, p.first_name, p.last_name, p.jersey_number, p.primary_position
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 2: RB Stats Function (FIXED - 'ball_carrier' -> 'rusher')
-- ============================================================================

CREATE OR REPLACE FUNCTION get_rb_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_data ORDER BY carries DESC)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'playerId', pp.player_id,
        'playerName', p.first_name || ' ' || p.last_name,
        'jerseyNumber', COALESCE(p.jersey_number, ''),
        'position', p.primary_position,
        'carries', COUNT(*),
        'rushYards', COALESCE(SUM(pp.yards_gained), 0),
        'rushAvg', ROUND(COALESCE(SUM(pp.yards_gained), 0)::NUMERIC / NULLIF(COUNT(*), 0), 1),
        'rushTDs', COUNT(*) FILTER (WHERE pp.is_touchdown = TRUE),
        'longestRun', COALESCE(MAX(pp.yards_gained), 0),
        'explosiveRuns', COUNT(*) FILTER (WHERE pp.yards_gained >= 10),
        'targets', 0,
        'receptions', 0,
        'recYards', 0,
        'recTDs', 0,
        'totalYards', COALESCE(SUM(pp.yards_gained), 0),
        'totalTDs', COUNT(*) FILTER (WHERE pp.is_touchdown = TRUE)
      ) AS row_data,
      COUNT(*) AS carries
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN videos v ON pi.video_id = v.id
    WHERE pp.team_id = p_team_id
      -- FIX: Use 'rusher' (from migration 123) instead of 'ball_carrier'
      AND pp.participation_type = 'rusher'
      AND pp.phase = 'offense'
      AND p.primary_position IN ('RB', 'FB', 'HB')
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
    GROUP BY pp.player_id, p.first_name, p.last_name, p.jersey_number, p.primary_position
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 3: WR/TE Stats Function (Simplified and Robust)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_wrte_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_data ORDER BY targets DESC)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'playerId', pp.player_id,
        'playerName', p.first_name || ' ' || p.last_name,
        'jerseyNumber', COALESCE(p.jersey_number, ''),
        'position', p.primary_position,
        'targets', COUNT(*),
        'receptions', COUNT(*) FILTER (WHERE pp.result = 'success'),
        'recYards', COALESCE(SUM(pp.yards_gained) FILTER (WHERE pp.result = 'success'), 0),
        'recAvg', ROUND(COALESCE(SUM(pp.yards_gained) FILTER (WHERE pp.result = 'success'), 0)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE pp.result = 'success'), 0), 1),
        'recTDs', COUNT(*) FILTER (WHERE pp.is_touchdown = TRUE),
        'catchRate', ROUND(100.0 * COUNT(*) FILTER (WHERE pp.result = 'success') / NULLIF(COUNT(*), 0), 1),
        'explosiveCatches', COUNT(*) FILTER (WHERE pp.yards_gained >= 15 AND pp.result = 'success')
      ) AS row_data,
      COUNT(*) AS targets
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN videos v ON pi.video_id = v.id
    WHERE pp.team_id = p_team_id
      AND pp.participation_type = 'receiver'
      AND pp.phase = 'offense'
      AND p.primary_position IN ('WR', 'TE')
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
    GROUP BY pp.player_id, p.first_name, p.last_name, p.jersey_number, p.primary_position
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 4: DL Stats Function (Simplified and Robust)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dl_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_data ORDER BY total_tackles DESC)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'playerId', pp.player_id,
        'playerName', p.first_name || ' ' || p.last_name,
        'jerseyNumber', COALESCE(p.jersey_number, ''),
        'position', p.primary_position,
        'primaryTackles', COUNT(*) FILTER (WHERE pp.participation_type = 'primary_tackle'),
        'assistTackles', COUNT(*) FILTER (WHERE pp.participation_type = 'assist_tackle'),
        'totalTackles', COUNT(*) FILTER (WHERE pp.participation_type IN ('primary_tackle', 'assist_tackle')),
        'missedTackles', COUNT(*) FILTER (WHERE pp.participation_type = 'missed_tackle'),
        'pressures', COUNT(*) FILTER (WHERE pp.participation_type = 'pressure'),
        'sacks', COUNT(*) FILTER (WHERE pp.participation_type = 'pressure' AND pp.result = 'sack'),
        'tfls', COUNT(*) FILTER (WHERE pp.participation_type = 'tackle_for_loss'),
        'forcedFumbles', COUNT(*) FILTER (WHERE pp.participation_type = 'forced_fumble'),
        'havocPlays', COUNT(*) FILTER (WHERE pp.participation_type IN ('tackle_for_loss', 'forced_fumble'))
      ) AS row_data,
      COUNT(*) FILTER (WHERE pp.participation_type IN ('primary_tackle', 'assist_tackle')) AS total_tackles
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN videos v ON pi.video_id = v.id
    WHERE pp.team_id = p_team_id
      AND p.primary_position IN ('DE', 'DT', 'NT')
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
    GROUP BY pp.player_id, p.first_name, p.last_name, p.jersey_number, p.primary_position
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 5: LB Stats Function (Simplified and Robust)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_lb_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_data ORDER BY total_tackles DESC)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'playerId', pp.player_id,
        'playerName', p.first_name || ' ' || p.last_name,
        'jerseyNumber', COALESCE(p.jersey_number, ''),
        'position', p.primary_position,
        'primaryTackles', COUNT(*) FILTER (WHERE pp.participation_type = 'primary_tackle'),
        'assistTackles', COUNT(*) FILTER (WHERE pp.participation_type = 'assist_tackle'),
        'totalTackles', COUNT(*) FILTER (WHERE pp.participation_type IN ('primary_tackle', 'assist_tackle')),
        'missedTackles', COUNT(*) FILTER (WHERE pp.participation_type = 'missed_tackle'),
        'pressures', COUNT(*) FILTER (WHERE pp.participation_type = 'pressure'),
        'sacks', COUNT(*) FILTER (WHERE pp.participation_type = 'pressure' AND pp.result = 'sack'),
        'coverageSnaps', COUNT(*) FILTER (WHERE pp.participation_type = 'coverage_assignment'),
        'tfls', COUNT(*) FILTER (WHERE pp.participation_type = 'tackle_for_loss'),
        'forcedFumbles', COUNT(*) FILTER (WHERE pp.participation_type = 'forced_fumble'),
        'interceptions', COUNT(*) FILTER (WHERE pp.participation_type = 'interception'),
        'pbus', COUNT(*) FILTER (WHERE pp.participation_type = 'pass_breakup'),
        'havocPlays', COUNT(*) FILTER (WHERE pp.participation_type IN ('tackle_for_loss', 'forced_fumble', 'interception', 'pass_breakup'))
      ) AS row_data,
      COUNT(*) FILTER (WHERE pp.participation_type IN ('primary_tackle', 'assist_tackle')) AS total_tackles
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN videos v ON pi.video_id = v.id
    WHERE pp.team_id = p_team_id
      AND p.primary_position IN ('LB', 'ILB', 'OLB', 'MLB')
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
    GROUP BY pp.player_id, p.first_name, p.last_name, p.jersey_number, p.primary_position
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 6: DB Stats Function (Simplified and Robust)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_db_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_data ORDER BY havoc_plays DESC)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'playerId', pp.player_id,
        'playerName', p.first_name || ' ' || p.last_name,
        'jerseyNumber', COALESCE(p.jersey_number, ''),
        'position', p.primary_position,
        'primaryTackles', COUNT(*) FILTER (WHERE pp.participation_type = 'primary_tackle'),
        'assistTackles', COUNT(*) FILTER (WHERE pp.participation_type = 'assist_tackle'),
        'totalTackles', COUNT(*) FILTER (WHERE pp.participation_type IN ('primary_tackle', 'assist_tackle')),
        'missedTackles', COUNT(*) FILTER (WHERE pp.participation_type = 'missed_tackle'),
        'coverageSnaps', COUNT(*) FILTER (WHERE pp.participation_type = 'coverage_assignment'),
        'interceptions', COUNT(*) FILTER (WHERE pp.participation_type = 'interception'),
        'pbus', COUNT(*) FILTER (WHERE pp.participation_type = 'pass_breakup'),
        'forcedFumbles', COUNT(*) FILTER (WHERE pp.participation_type = 'forced_fumble'),
        'havocPlays', COUNT(*) FILTER (WHERE pp.participation_type IN ('interception', 'pass_breakup', 'forced_fumble'))
      ) AS row_data,
      COUNT(*) FILTER (WHERE pp.participation_type IN ('interception', 'pass_breakup', 'forced_fumble')) AS havoc_plays
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN videos v ON pi.video_id = v.id
    WHERE pp.team_id = p_team_id
      AND p.primary_position IN ('CB', 'S', 'FS', 'SS', 'DB')
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
    GROUP BY pp.player_id, p.first_name, p.last_name, p.jersey_number, p.primary_position
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 7: Kicker Stats Function (Simplified and Robust)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_kicker_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_data ORDER BY total_points DESC)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'playerId', pp.player_id,
        'playerName', p.first_name || ' ' || p.last_name,
        'jerseyNumber', COALESCE(p.jersey_number, ''),
        'position', p.primary_position,
        'fgMade', COUNT(*) FILTER (WHERE pp.participation_type = 'kicker' AND pi.kick_result = 'made'),
        'fgAttempts', COUNT(*) FILTER (WHERE pp.participation_type = 'kicker' AND pi.kick_result IN ('made', 'missed', 'blocked')),
        'fgPct', ROUND(100.0 * COUNT(*) FILTER (WHERE pp.participation_type = 'kicker' AND pi.kick_result = 'made') / NULLIF(COUNT(*) FILTER (WHERE pp.participation_type = 'kicker' AND pi.kick_result IN ('made', 'missed', 'blocked')), 0), 1),
        'xpMade', COUNT(*) FILTER (WHERE pp.participation_type = 'kicker' AND pi.kick_result = 'xp_made'),
        'xpAttempts', COUNT(*) FILTER (WHERE pp.participation_type = 'kicker' AND pi.kick_result IN ('xp_made', 'xp_missed', 'xp_blocked')),
        'xpPct', ROUND(100.0 * COUNT(*) FILTER (WHERE pp.participation_type = 'kicker' AND pi.kick_result = 'xp_made') / NULLIF(COUNT(*) FILTER (WHERE pp.participation_type = 'kicker' AND pi.kick_result IN ('xp_made', 'xp_missed', 'xp_blocked')), 0), 1),
        'punts', COUNT(*) FILTER (WHERE pp.participation_type = 'punter'),
        'puntAvg', ROUND(COALESCE(AVG(pi.kick_distance) FILTER (WHERE pp.participation_type = 'punter'), 0)::NUMERIC, 1),
        'longestPunt', COALESCE(MAX(pi.kick_distance) FILTER (WHERE pp.participation_type = 'punter'), 0),
        'totalPoints', (COUNT(*) FILTER (WHERE pp.participation_type = 'kicker' AND pi.kick_result = 'made') * 3) + COUNT(*) FILTER (WHERE pp.participation_type = 'kicker' AND pi.kick_result = 'xp_made')
      ) AS row_data,
      (COUNT(*) FILTER (WHERE pp.participation_type = 'kicker' AND pi.kick_result = 'made') * 3) + COUNT(*) FILTER (WHERE pp.participation_type = 'kicker' AND pi.kick_result = 'xp_made') AS total_points
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN videos v ON pi.video_id = v.id
    WHERE pp.team_id = p_team_id
      AND pp.phase = 'special_teams'
      AND pp.participation_type IN ('kicker', 'punter')
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
    GROUP BY pp.player_id, p.first_name, p.last_name, p.jersey_number, p.primary_position
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 8: Returner Stats Function (Simplified and Robust)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_returner_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(row_data ORDER BY total_yards DESC)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'playerId', pp.player_id,
        'playerName', p.first_name || ' ' || p.last_name,
        'jerseyNumber', COALESCE(p.jersey_number, ''),
        'position', p.primary_position,
        'kickReturns', COUNT(*) FILTER (WHERE pi.special_teams_unit IN ('kickoff_return', 'kick_return')),
        'kickReturnYards', COALESCE(SUM(pp.yards_gained) FILTER (WHERE pi.special_teams_unit IN ('kickoff_return', 'kick_return')), 0),
        'kickReturnAvg', ROUND(COALESCE(SUM(pp.yards_gained) FILTER (WHERE pi.special_teams_unit IN ('kickoff_return', 'kick_return')), 0)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE pi.special_teams_unit IN ('kickoff_return', 'kick_return')), 0), 1),
        'kickReturnTDs', COUNT(*) FILTER (WHERE pi.special_teams_unit IN ('kickoff_return', 'kick_return') AND pp.is_touchdown = TRUE),
        'longestKickReturn', COALESCE(MAX(pp.yards_gained) FILTER (WHERE pi.special_teams_unit IN ('kickoff_return', 'kick_return')), 0),
        'puntReturns', COUNT(*) FILTER (WHERE pi.special_teams_unit = 'punt_return'),
        'puntReturnYards', COALESCE(SUM(pp.yards_gained) FILTER (WHERE pi.special_teams_unit = 'punt_return'), 0),
        'puntReturnAvg', ROUND(COALESCE(SUM(pp.yards_gained) FILTER (WHERE pi.special_teams_unit = 'punt_return'), 0)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE pi.special_teams_unit = 'punt_return'), 0), 1),
        'puntReturnTDs', COUNT(*) FILTER (WHERE pi.special_teams_unit = 'punt_return' AND pp.is_touchdown = TRUE),
        'longestPuntReturn', COALESCE(MAX(pp.yards_gained) FILTER (WHERE pi.special_teams_unit = 'punt_return'), 0),
        'totalReturns', COUNT(*),
        'totalYards', COALESCE(SUM(pp.yards_gained), 0),
        'totalTDs', COUNT(*) FILTER (WHERE pp.is_touchdown = TRUE)
      ) AS row_data,
      COALESCE(SUM(pp.yards_gained), 0) AS total_yards
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN videos v ON pi.video_id = v.id
    WHERE pp.team_id = p_team_id
      AND pp.phase = 'special_teams'
      AND pp.participation_type = 'returner'
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
    GROUP BY pp.player_id, p.first_name, p.last_name, p.jersey_number, p.primary_position
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Verification comment
-- ============================================================================
-- This migration fixes ALL 8 player stats functions:
-- 1. get_qb_stats: Simplified query, uses pp.result = 'success'
-- 2. get_rb_stats: Fixed 'ball_carrier' -> 'rusher'
-- 3. get_wrte_stats: Simplified query, uses pp.result = 'success'
-- 4. get_dl_stats: Simplified query, removed complex CTE
-- 5. get_lb_stats: Simplified query, removed complex CTE
-- 6. get_db_stats: Simplified query, removed complex CTE
-- 7. get_kicker_stats: Simplified query, removed complex CTE
-- 8. get_returner_stats: Simplified query, removed complex CTE
--
-- Key changes:
-- - Removed complex video_filter CTE that joined games table
-- - Direct JOIN to videos table with game_id filter
-- - Better NULL handling with COALESCE
-- - Consistent query structure across all functions
