-- ============================================================================
-- COMPLETE Drive Stats Recalculation - Including Result, Points, Scoring
-- ============================================================================
-- This recalculates ALL drive statistics from linked plays:
-- - plays_count, yards_gained, first_downs (basic)
-- - result, points, scoring_drive, three_and_out (scoring/outcome)
-- - reached_red_zone (field position)
-- ============================================================================

-- Update all drives for the Bears game with COMPLETE stats
UPDATE drives d
SET
  -- Basic stats
  plays_count = (
    SELECT COUNT(*)
    FROM play_instances pi
    WHERE pi.drive_id = d.id
  ),
  yards_gained = (
    SELECT COALESCE(SUM(pi.yards_gained), 0)
    FROM play_instances pi
    WHERE pi.drive_id = d.id
  ),
  first_downs = (
    SELECT COUNT(*)
    FROM play_instances pi
    WHERE pi.drive_id = d.id
      AND pi.resulted_in_first_down = true
  ),

  -- Red zone tracking (any play inside 20-yard line = yard_line >= 80)
  reached_red_zone = (
    SELECT COALESCE(
      bool_or(pi.yard_line >= 80),
      false
    )
    FROM play_instances pi
    WHERE pi.drive_id = d.id
  ),

  -- Drive result determination (priority order: turnover > TD > FG > last play type)
  result = (
    SELECT CASE
      -- Priority 1: Turnover
      WHEN EXISTS (
        SELECT 1 FROM play_instances pi
        WHERE pi.drive_id = d.id AND pi.is_turnover = true
      ) THEN 'turnover'

      -- Priority 2: Touchdown
      WHEN EXISTS (
        SELECT 1 FROM play_instances pi
        WHERE pi.drive_id = d.id
          AND (pi.result_type = 'touchdown' OR pi.result_type = 'pass_touchdown')
      ) THEN 'touchdown'

      -- Priority 3: Field Goal
      WHEN EXISTS (
        SELECT 1 FROM play_instances pi
        WHERE pi.drive_id = d.id AND pi.result_type = 'field_goal'
      ) THEN 'field_goal'

      -- Priority 4: Last play result
      WHEN (
        SELECT pi.result_type
        FROM play_instances pi
        WHERE pi.drive_id = d.id
        ORDER BY pi.created_at DESC
        LIMIT 1
      ) = 'punt' THEN 'punt'

      WHEN (
        SELECT pi.result_type
        FROM play_instances pi
        WHERE pi.drive_id = d.id
        ORDER BY pi.created_at DESC
        LIMIT 1
      ) = 'turnover_on_downs' THEN 'downs'

      -- Default
      ELSE 'end_half'
    END
    FROM (SELECT 1) as dummy  -- Needed for subquery
    LIMIT 1
  ),

  -- Points calculation based on result
  points = (
    SELECT CASE
      -- Turnover = 0 points
      WHEN EXISTS (
        SELECT 1 FROM play_instances pi
        WHERE pi.drive_id = d.id AND pi.is_turnover = true
      ) THEN 0

      -- Touchdown = 6 points (base, excludes PAT)
      WHEN EXISTS (
        SELECT 1 FROM play_instances pi
        WHERE pi.drive_id = d.id
          AND (pi.result_type = 'touchdown' OR pi.result_type = 'pass_touchdown')
      ) THEN 6

      -- Field Goal = 3 points
      WHEN EXISTS (
        SELECT 1 FROM play_instances pi
        WHERE pi.drive_id = d.id AND pi.result_type = 'field_goal'
      ) THEN 3

      -- All other results = 0 points
      ELSE 0
    END
    FROM (SELECT 1) as dummy
    LIMIT 1
  ),

  -- Three and out: exactly 3 plays with no first downs
  three_and_out = (
    SELECT CASE
      WHEN COUNT(*) = 3 AND COUNT(*) FILTER (WHERE resulted_in_first_down = true) = 0
      THEN true
      ELSE false
    END
    FROM play_instances pi
    WHERE pi.drive_id = d.id
  ),

  -- Scoring drive: any points scored (points > 0)
  scoring_drive = (
    SELECT CASE
      -- Check for any scoring plays
      WHEN EXISTS (
        SELECT 1 FROM play_instances pi
        WHERE pi.drive_id = d.id
          AND (
            pi.result_type = 'touchdown'
            OR pi.result_type = 'pass_touchdown'
            OR pi.result_type = 'field_goal'
          )
      ) THEN true
      ELSE false
    END
    FROM (SELECT 1) as dummy
    LIMIT 1
  ),

  updated_at = NOW()

FROM games g
WHERE d.game_id = g.id
  AND g.opponent = 'Bears';

-- ============================================================================
-- Verification Query - Check the recalculated stats
-- ============================================================================

SELECT
  d.drive_number,
  d.quarter,
  d.possession_type,
  d.plays_count,
  d.yards_gained,
  d.first_downs,
  d.reached_red_zone,
  d.result,
  d.points,
  d.three_and_out,
  d.scoring_drive,
  -- Verify actual play count matches
  COUNT(pi.id) AS verify_actual_plays,
  -- Show if any plays have scoring
  bool_or(pi.result_type IN ('touchdown', 'pass_touchdown', 'field_goal')) AS has_scoring_play,
  -- Show if any turnovers
  bool_or(pi.is_turnover = true) AS has_turnover
FROM drives d
JOIN games g ON g.id = d.game_id
LEFT JOIN play_instances pi ON pi.drive_id = d.id
WHERE g.opponent = 'Bears'
GROUP BY d.id, d.drive_number, d.quarter, d.possession_type, d.plays_count, d.yards_gained, d.first_downs, d.reached_red_zone, d.result, d.points, d.three_and_out, d.scoring_drive
ORDER BY d.drive_number;
