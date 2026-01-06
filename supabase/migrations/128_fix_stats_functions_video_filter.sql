-- Migration 128: Fix Player Stats Functions - Video Filter Bug
-- Purpose: The video_filter CTE was missing team filtering, causing full table scans
-- when p_game_id was NULL. This fix adds team filtering via games table join.

-- ============================================================================
-- PART 1: QB Stats Function (FIXED)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_qb_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH video_filter AS (
    -- FIX: Filter videos by team via games table join
    SELECT v.id AS video_id
    FROM videos v
    INNER JOIN games g ON v.game_id = g.id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  qb_participation AS (
    SELECT
      pp.player_id,
      p.first_name,
      p.last_name,
      p.jersey_number,
      p.primary_position,
      pp.yards_gained,
      pp.is_touchdown,
      pi.play_type,
      pi.is_complete,
      pi.result,
      pi.is_sack,
      pi.is_interception
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN video_filter vf ON pi.video_id = vf.video_id
    WHERE pp.team_id = p_team_id
      AND pp.phase = 'offense'
      AND pp.participation_type = 'passer'
      AND p.primary_position = 'QB'
  ),
  qb_aggregated AS (
    SELECT
      player_id,
      first_name,
      last_name,
      jersey_number,
      primary_position,
      COUNT(*) AS pass_attempts,
      COUNT(*) FILTER (WHERE
        is_complete = TRUE OR
        result = 'pass_complete' OR
        result LIKE '%complete%'
      ) AS completions,
      COALESCE(SUM(yards_gained) FILTER (WHERE
        is_complete = TRUE OR
        result = 'pass_complete' OR
        result LIKE '%complete%'
      ), 0) AS passing_yards,
      COUNT(*) FILTER (WHERE is_touchdown = TRUE) AS pass_tds,
      COUNT(*) FILTER (WHERE
        is_interception = TRUE OR
        result = 'pass_interception' OR
        result LIKE '%interception%'
      ) AS interceptions,
      COUNT(*) FILTER (WHERE is_sack = TRUE) AS sacks
    FROM qb_participation
    GROUP BY player_id, first_name, last_name, jersey_number, primary_position
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'playerId', player_id,
      'playerName', first_name || ' ' || last_name,
      'jerseyNumber', COALESCE(jersey_number, ''),
      'position', primary_position,
      'passAttempts', pass_attempts,
      'completions', completions,
      'passingYards', passing_yards,
      'passTDs', pass_tds,
      'interceptions', interceptions,
      'sacks', sacks,
      'completionPct', ROUND(100.0 * completions / NULLIF(pass_attempts, 0), 1),
      'yardsPerAttempt', ROUND(passing_yards::NUMERIC / NULLIF(pass_attempts, 0), 1),
      'qbRating', ROUND(
        CASE
          WHEN pass_attempts = 0 THEN 0
          ELSE (
            LEAST(2.375, GREATEST(0, (completions::NUMERIC / pass_attempts - 0.3) * 5)) +
            LEAST(2.375, GREATEST(0, (passing_yards::NUMERIC / pass_attempts - 3) * 0.25)) +
            LEAST(2.375, GREATEST(0, (pass_tds::NUMERIC / pass_attempts) * 20)) +
            LEAST(2.375, GREATEST(0, 2.375 - (interceptions::NUMERIC / pass_attempts * 25)))
          ) / 6 * 100
        END, 1
      )
    )
    ORDER BY pass_attempts DESC
  )
  INTO v_result
  FROM qb_aggregated;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 2: RB Stats Function (FIXED)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_rb_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH video_filter AS (
    -- FIX: Filter videos by team via games table join
    SELECT v.id AS video_id
    FROM videos v
    INNER JOIN games g ON v.game_id = g.id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  rb_rushing AS (
    SELECT
      pp.player_id,
      p.first_name,
      p.last_name,
      p.jersey_number,
      p.primary_position,
      pp.yards_gained,
      pp.is_touchdown
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN video_filter vf ON pi.video_id = vf.video_id
    WHERE pp.team_id = p_team_id
      AND pp.phase = 'offense'
      AND pp.participation_type = 'ball_carrier'
      AND p.primary_position IN ('RB', 'FB', 'HB')
  ),
  rb_receiving AS (
    SELECT
      pp.player_id,
      pp.yards_gained,
      pp.is_touchdown,
      pi.is_complete,
      pi.result
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN video_filter vf ON pi.video_id = vf.video_id
    WHERE pp.team_id = p_team_id
      AND pp.phase = 'offense'
      AND pp.participation_type = 'receiver'
      AND p.primary_position IN ('RB', 'FB', 'HB')
  ),
  rb_aggregated AS (
    SELECT
      r.player_id,
      r.first_name,
      r.last_name,
      r.jersey_number,
      r.primary_position,
      COUNT(*) AS carries,
      COALESCE(SUM(r.yards_gained), 0) AS rush_yards,
      COUNT(*) FILTER (WHERE r.is_touchdown = TRUE) AS rush_tds,
      MAX(r.yards_gained) AS longest_run,
      COUNT(*) FILTER (WHERE r.yards_gained >= 10) AS explosive_runs,
      COALESCE(rec.targets, 0) AS targets,
      COALESCE(rec.receptions, 0) AS receptions,
      COALESCE(rec.rec_yards, 0) AS rec_yards,
      COALESCE(rec.rec_tds, 0) AS rec_tds
    FROM rb_rushing r
    LEFT JOIN (
      SELECT
        player_id,
        COUNT(*) AS targets,
        COUNT(*) FILTER (WHERE
          is_complete = TRUE OR
          result = 'pass_complete' OR
          result LIKE '%complete%' OR
          is_touchdown = TRUE
        ) AS receptions,
        COALESCE(SUM(yards_gained) FILTER (WHERE
          is_complete = TRUE OR
          result = 'pass_complete' OR
          result LIKE '%complete%' OR
          is_touchdown = TRUE
        ), 0) AS rec_yards,
        COUNT(*) FILTER (WHERE is_touchdown = TRUE) AS rec_tds
      FROM rb_receiving
      GROUP BY player_id
    ) rec ON r.player_id = rec.player_id
    GROUP BY r.player_id, r.first_name, r.last_name, r.jersey_number, r.primary_position,
             rec.targets, rec.receptions, rec.rec_yards, rec.rec_tds
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'playerId', player_id,
      'playerName', first_name || ' ' || last_name,
      'jerseyNumber', COALESCE(jersey_number, ''),
      'position', primary_position,
      'carries', carries,
      'rushYards', rush_yards,
      'rushAvg', ROUND(rush_yards::NUMERIC / NULLIF(carries, 0), 1),
      'rushTDs', rush_tds,
      'longestRun', longest_run,
      'explosiveRuns', explosive_runs,
      'targets', targets,
      'receptions', receptions,
      'recYards', rec_yards,
      'recTDs', rec_tds,
      'totalYards', rush_yards + rec_yards,
      'totalTDs', rush_tds + rec_tds
    )
    ORDER BY carries DESC
  )
  INTO v_result
  FROM rb_aggregated;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 3: WR/TE Stats Function (FIXED)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_wrte_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH video_filter AS (
    -- FIX: Filter videos by team via games table join
    SELECT v.id AS video_id
    FROM videos v
    INNER JOIN games g ON v.game_id = g.id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  receiver_participation AS (
    SELECT
      pp.player_id,
      p.first_name,
      p.last_name,
      p.jersey_number,
      p.primary_position,
      pp.yards_gained,
      pp.is_touchdown,
      pi.is_complete,
      pi.result
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN video_filter vf ON pi.video_id = vf.video_id
    WHERE pp.team_id = p_team_id
      AND pp.phase = 'offense'
      AND pp.participation_type = 'receiver'
      AND p.primary_position IN ('WR', 'TE')
  ),
  receiver_aggregated AS (
    SELECT
      player_id,
      first_name,
      last_name,
      jersey_number,
      primary_position,
      COUNT(*) AS targets,
      COUNT(*) FILTER (WHERE
        is_complete = TRUE OR
        result = 'pass_complete' OR
        result LIKE '%complete%' OR
        is_touchdown = TRUE
      ) AS receptions,
      COALESCE(SUM(yards_gained) FILTER (WHERE
        is_complete = TRUE OR
        result = 'pass_complete' OR
        result LIKE '%complete%' OR
        is_touchdown = TRUE
      ), 0) AS rec_yards,
      COUNT(*) FILTER (WHERE is_touchdown = TRUE) AS rec_tds,
      COUNT(*) FILTER (WHERE
        yards_gained >= 15 AND (
          is_complete = TRUE OR
          result = 'pass_complete' OR
          result LIKE '%complete%' OR
          is_touchdown = TRUE
        )
      ) AS explosive_catches
    FROM receiver_participation
    GROUP BY player_id, first_name, last_name, jersey_number, primary_position
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'playerId', player_id,
      'playerName', first_name || ' ' || last_name,
      'jerseyNumber', COALESCE(jersey_number, ''),
      'position', primary_position,
      'targets', targets,
      'receptions', receptions,
      'recYards', rec_yards,
      'recAvg', ROUND(rec_yards::NUMERIC / NULLIF(receptions, 0), 1),
      'recTDs', rec_tds,
      'catchRate', ROUND(100.0 * receptions / NULLIF(targets, 0), 1),
      'explosiveCatches', explosive_catches
    )
    ORDER BY targets DESC
  )
  INTO v_result
  FROM receiver_aggregated;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 4: DL Stats Function (FIXED)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dl_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH video_filter AS (
    -- FIX: Filter videos by team via games table join
    SELECT v.id AS video_id
    FROM videos v
    INNER JOIN games g ON v.game_id = g.id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  dl_participation AS (
    SELECT
      pp.player_id,
      p.first_name,
      p.last_name,
      p.jersey_number,
      p.primary_position,
      pp.participation_type,
      pp.result
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN video_filter vf ON pi.video_id = vf.video_id
    WHERE pp.team_id = p_team_id
      AND pp.phase = 'defense'
      AND p.primary_position IN ('DE', 'DT', 'NT')
  ),
  dl_aggregated AS (
    SELECT
      player_id,
      first_name,
      last_name,
      jersey_number,
      primary_position,
      COUNT(*) FILTER (WHERE participation_type = 'primary_tackle') AS primary_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'assist_tackle') AS assist_tackles,
      COUNT(*) FILTER (WHERE participation_type IN ('primary_tackle', 'assist_tackle')) AS total_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'missed_tackle') AS missed_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'pressure') AS pressures,
      COUNT(*) FILTER (WHERE participation_type = 'pressure' AND result = 'sack') AS sacks,
      COUNT(*) FILTER (WHERE participation_type = 'tackle_for_loss') AS tfls,
      COUNT(*) FILTER (WHERE participation_type = 'forced_fumble') AS forced_fumbles,
      COUNT(*) FILTER (WHERE participation_type IN ('tackle_for_loss', 'forced_fumble')) AS havoc_plays
    FROM dl_participation
    GROUP BY player_id, first_name, last_name, jersey_number, primary_position
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'playerId', player_id,
      'playerName', first_name || ' ' || last_name,
      'jerseyNumber', COALESCE(jersey_number, ''),
      'position', primary_position,
      'primaryTackles', primary_tackles,
      'assistTackles', assist_tackles,
      'totalTackles', total_tackles,
      'missedTackles', missed_tackles,
      'pressures', pressures,
      'sacks', sacks,
      'tfls', tfls,
      'forcedFumbles', forced_fumbles,
      'havocPlays', havoc_plays
    )
    ORDER BY total_tackles DESC
  )
  INTO v_result
  FROM dl_aggregated;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 5: LB Stats Function (FIXED)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_lb_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH video_filter AS (
    -- FIX: Filter videos by team via games table join
    SELECT v.id AS video_id
    FROM videos v
    INNER JOIN games g ON v.game_id = g.id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  lb_participation AS (
    SELECT
      pp.player_id,
      p.first_name,
      p.last_name,
      p.jersey_number,
      p.primary_position,
      pp.participation_type,
      pp.result
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN video_filter vf ON pi.video_id = vf.video_id
    WHERE pp.team_id = p_team_id
      AND pp.phase = 'defense'
      AND p.primary_position IN ('LB', 'ILB', 'OLB', 'MLB')
  ),
  lb_aggregated AS (
    SELECT
      player_id,
      first_name,
      last_name,
      jersey_number,
      primary_position,
      COUNT(*) FILTER (WHERE participation_type = 'primary_tackle') AS primary_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'assist_tackle') AS assist_tackles,
      COUNT(*) FILTER (WHERE participation_type IN ('primary_tackle', 'assist_tackle')) AS total_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'missed_tackle') AS missed_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'pressure') AS pressures,
      COUNT(*) FILTER (WHERE participation_type = 'pressure' AND result = 'sack') AS sacks,
      COUNT(*) FILTER (WHERE participation_type = 'coverage_assignment') AS coverage_snaps,
      COUNT(*) FILTER (WHERE participation_type = 'tackle_for_loss') AS tfls,
      COUNT(*) FILTER (WHERE participation_type = 'forced_fumble') AS forced_fumbles,
      COUNT(*) FILTER (WHERE participation_type = 'interception') AS interceptions,
      COUNT(*) FILTER (WHERE participation_type = 'pass_breakup') AS pbus,
      COUNT(*) FILTER (WHERE participation_type IN ('tackle_for_loss', 'forced_fumble', 'interception', 'pass_breakup')) AS havoc_plays
    FROM lb_participation
    GROUP BY player_id, first_name, last_name, jersey_number, primary_position
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'playerId', player_id,
      'playerName', first_name || ' ' || last_name,
      'jerseyNumber', COALESCE(jersey_number, ''),
      'position', primary_position,
      'primaryTackles', primary_tackles,
      'assistTackles', assist_tackles,
      'totalTackles', total_tackles,
      'missedTackles', missed_tackles,
      'pressures', pressures,
      'sacks', sacks,
      'coverageSnaps', coverage_snaps,
      'tfls', tfls,
      'forcedFumbles', forced_fumbles,
      'interceptions', interceptions,
      'pbus', pbus,
      'havocPlays', havoc_plays
    )
    ORDER BY total_tackles DESC
  )
  INTO v_result
  FROM lb_aggregated;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 6: DB Stats Function (FIXED)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_db_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH video_filter AS (
    -- FIX: Filter videos by team via games table join
    SELECT v.id AS video_id
    FROM videos v
    INNER JOIN games g ON v.game_id = g.id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  db_participation AS (
    SELECT
      pp.player_id,
      p.first_name,
      p.last_name,
      p.jersey_number,
      p.primary_position,
      pp.participation_type,
      pp.result
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN video_filter vf ON pi.video_id = vf.video_id
    WHERE pp.team_id = p_team_id
      AND pp.phase = 'defense'
      AND p.primary_position IN ('CB', 'S', 'FS', 'SS', 'DB')
  ),
  db_aggregated AS (
    SELECT
      player_id,
      first_name,
      last_name,
      jersey_number,
      primary_position,
      COUNT(*) FILTER (WHERE participation_type = 'primary_tackle') AS primary_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'assist_tackle') AS assist_tackles,
      COUNT(*) FILTER (WHERE participation_type IN ('primary_tackle', 'assist_tackle')) AS total_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'missed_tackle') AS missed_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'coverage_assignment') AS coverage_snaps,
      COUNT(*) FILTER (WHERE participation_type = 'interception') AS interceptions,
      COUNT(*) FILTER (WHERE participation_type = 'pass_breakup') AS pbus,
      COUNT(*) FILTER (WHERE participation_type = 'forced_fumble') AS forced_fumbles,
      COUNT(*) FILTER (WHERE participation_type IN ('interception', 'pass_breakup', 'forced_fumble')) AS havoc_plays
    FROM db_participation
    GROUP BY player_id, first_name, last_name, jersey_number, primary_position
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'playerId', player_id,
      'playerName', first_name || ' ' || last_name,
      'jerseyNumber', COALESCE(jersey_number, ''),
      'position', primary_position,
      'primaryTackles', primary_tackles,
      'assistTackles', assist_tackles,
      'totalTackles', total_tackles,
      'missedTackles', missed_tackles,
      'coverageSnaps', coverage_snaps,
      'interceptions', interceptions,
      'pbus', pbus,
      'forcedFumbles', forced_fumbles,
      'havocPlays', havoc_plays
    )
    ORDER BY havoc_plays DESC
  )
  INTO v_result
  FROM db_aggregated;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 7: Kicker Stats Function (FIXED)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_kicker_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH video_filter AS (
    -- FIX: Filter videos by team via games table join
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
      pi.kick_result,
      pi.kick_distance
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
      COUNT(*) FILTER (WHERE participation_type = 'kicker' AND kick_result = 'made') AS fg_made,
      COUNT(*) FILTER (WHERE participation_type = 'kicker' AND kick_result IN ('made', 'missed', 'blocked')) AS fg_attempts,
      COUNT(*) FILTER (WHERE participation_type = 'kicker' AND kick_result = 'xp_made') AS xp_made,
      COUNT(*) FILTER (WHERE participation_type = 'kicker' AND kick_result IN ('xp_made', 'xp_missed', 'xp_blocked')) AS xp_attempts,
      COUNT(*) FILTER (WHERE participation_type = 'punter') AS punts,
      COALESCE(AVG(kick_distance) FILTER (WHERE participation_type = 'punter'), 0) AS punt_avg,
      MAX(kick_distance) FILTER (WHERE participation_type = 'punter') AS longest_punt
    FROM kicker_participation
    GROUP BY player_id, first_name, last_name, jersey_number, primary_position
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'playerId', player_id,
      'playerName', first_name || ' ' || last_name,
      'jerseyNumber', COALESCE(jersey_number, ''),
      'position', primary_position,
      'fgMade', fg_made,
      'fgAttempts', fg_attempts,
      'fgPct', ROUND(100.0 * fg_made / NULLIF(fg_attempts, 0), 1),
      'xpMade', xp_made,
      'xpAttempts', xp_attempts,
      'xpPct', ROUND(100.0 * xp_made / NULLIF(xp_attempts, 0), 1),
      'punts', punts,
      'puntAvg', ROUND(punt_avg::NUMERIC, 1),
      'longestPunt', COALESCE(longest_punt, 0),
      'totalPoints', (fg_made * 3) + xp_made
    )
    ORDER BY (fg_made * 3) + xp_made DESC
  )
  INTO v_result
  FROM kicker_aggregated;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 8: Returner Stats Function (FIXED)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_returner_stats(
  p_team_id UUID,
  p_game_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH video_filter AS (
    -- FIX: Filter videos by team via games table join
    SELECT v.id AS video_id
    FROM videos v
    INNER JOIN games g ON v.game_id = g.id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  returner_participation AS (
    SELECT
      pp.player_id,
      p.first_name,
      p.last_name,
      p.jersey_number,
      p.primary_position,
      pp.participation_type,
      pp.yards_gained,
      pp.is_touchdown,
      pi.special_teams_unit
    FROM player_participation pp
    INNER JOIN play_instances pi ON pp.play_instance_id = pi.id
    INNER JOIN players p ON pp.player_id = p.id
    INNER JOIN video_filter vf ON pi.video_id = vf.video_id
    WHERE pp.team_id = p_team_id
      AND pp.phase = 'special_teams'
      AND pp.participation_type = 'returner'
  ),
  returner_aggregated AS (
    SELECT
      player_id,
      first_name,
      last_name,
      jersey_number,
      primary_position,
      COUNT(*) FILTER (WHERE special_teams_unit IN ('kickoff_return', 'kick_return')) AS kick_returns,
      COALESCE(SUM(yards_gained) FILTER (WHERE special_teams_unit IN ('kickoff_return', 'kick_return')), 0) AS kick_return_yards,
      COUNT(*) FILTER (WHERE special_teams_unit IN ('kickoff_return', 'kick_return') AND is_touchdown = TRUE) AS kick_return_tds,
      MAX(yards_gained) FILTER (WHERE special_teams_unit IN ('kickoff_return', 'kick_return')) AS longest_kick_return,
      COUNT(*) FILTER (WHERE special_teams_unit = 'punt_return') AS punt_returns,
      COALESCE(SUM(yards_gained) FILTER (WHERE special_teams_unit = 'punt_return'), 0) AS punt_return_yards,
      COUNT(*) FILTER (WHERE special_teams_unit = 'punt_return' AND is_touchdown = TRUE) AS punt_return_tds,
      MAX(yards_gained) FILTER (WHERE special_teams_unit = 'punt_return') AS longest_punt_return
    FROM returner_participation
    GROUP BY player_id, first_name, last_name, jersey_number, primary_position
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'playerId', player_id,
      'playerName', first_name || ' ' || last_name,
      'jerseyNumber', COALESCE(jersey_number, ''),
      'position', primary_position,
      'kickReturns', kick_returns,
      'kickReturnYards', kick_return_yards,
      'kickReturnAvg', ROUND(kick_return_yards::NUMERIC / NULLIF(kick_returns, 0), 1),
      'kickReturnTDs', kick_return_tds,
      'longestKickReturn', COALESCE(longest_kick_return, 0),
      'puntReturns', punt_returns,
      'puntReturnYards', punt_return_yards,
      'puntReturnAvg', ROUND(punt_return_yards::NUMERIC / NULLIF(punt_returns, 0), 1),
      'puntReturnTDs', punt_return_tds,
      'longestPuntReturn', COALESCE(longest_punt_return, 0),
      'totalReturns', kick_returns + punt_returns,
      'totalYards', kick_return_yards + punt_return_yards,
      'totalTDs', kick_return_tds + punt_return_tds
    )
    ORDER BY (kick_return_yards + punt_return_yards) DESC
  )
  INTO v_result
  FROM returner_aggregated;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PART 9: Add Index for Video-Game Join Performance
-- ============================================================================

-- This index helps the video_filter CTE perform faster
CREATE INDEX IF NOT EXISTS idx_videos_game_id ON videos(game_id);
CREATE INDEX IF NOT EXISTS idx_games_team_id ON games(team_id);
