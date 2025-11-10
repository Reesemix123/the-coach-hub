-- Fix Drive Play Counts
-- Run this once to recalculate plays_count, yards_gained, and first_downs for all existing drives

-- Update all drives with correct stats
UPDATE drives d
SET
  plays_count = (
    SELECT COUNT(*)
    FROM play_instances pi
    WHERE pi.drive_id = d.id
  ),
  yards_gained = (
    SELECT COALESCE(SUM(yards_gained), 0)
    FROM play_instances pi
    WHERE pi.drive_id = d.id
  ),
  first_downs = (
    SELECT COUNT(*)
    FROM play_instances pi
    WHERE pi.drive_id = d.id AND pi.resulted_in_first_down = true
  ),
  reached_red_zone = (
    SELECT EXISTS(
      SELECT 1
      FROM play_instances pi
      WHERE pi.drive_id = d.id AND pi.yard_line >= 80
    )
  ),
  updated_at = now();

-- Verify the results
SELECT
  d.id,
  d.drive_number,
  d.quarter,
  d.possession_type,
  d.plays_count,
  d.yards_gained,
  d.first_downs,
  (SELECT COUNT(*) FROM play_instances WHERE drive_id = d.id) as actual_plays
FROM drives d
ORDER BY d.quarter, d.drive_number;
