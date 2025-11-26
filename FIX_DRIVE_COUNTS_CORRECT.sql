-- ============================================================================
-- CORRECT Update Script - Fix Drive Play Counts
-- ============================================================================
-- This uses 'defense' (not 'defensive') which is the actual value!
-- ============================================================================

-- Update all drives for the Bears game
UPDATE drives d
SET
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
  )
FROM games g
WHERE d.game_id = g.id
  AND g.opponent = 'Bears';

-- Verify the update worked
SELECT
  d.drive_number,
  d.quarter,
  d.possession_type,
  d.plays_count AS updated_plays_count,
  COUNT(pi.id) AS verify_actual_count
FROM drives d
JOIN games g ON g.id = d.game_id
LEFT JOIN play_instances pi ON pi.drive_id = d.id
WHERE g.opponent = 'Bears'
GROUP BY d.id, d.drive_number, d.quarter, d.possession_type, d.plays_count
ORDER BY d.drive_number;
