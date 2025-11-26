-- ============================================================================
-- Recalculate Drive Stats for Bears Game
-- ============================================================================
-- This updates the plays_count, yards_gained, and other stats for all drives
-- based on the actual play_instances data.
-- ============================================================================

-- Update all defensive drives for the Bears game
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
  AND g.opponent ILIKE '%Bears%'
  AND d.possession_type = 'defensive';

-- Verify the update
SELECT
  d.drive_number,
  d.quarter,
  d.possession_type,
  d.plays_count,
  d.yards_gained,
  d.first_downs
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE g.opponent ILIKE '%Bears%'
  AND d.possession_type = 'defensive'
ORDER BY d.drive_number;
