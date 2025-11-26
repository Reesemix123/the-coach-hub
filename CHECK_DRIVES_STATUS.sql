-- ============================================================================
-- Check current drive status in database
-- ============================================================================

-- STEP 1: Check what's actually in the drives table RIGHT NOW
SELECT
  d.id,
  d.drive_number,
  d.quarter,
  d.possession_type,
  d.plays_count AS current_plays_count_in_db,
  d.game_id,
  g.opponent
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE g.opponent ILIKE '%Bears%'
  AND d.possession_type = 'defensive'
ORDER BY d.drive_number;

-- STEP 2: Count ACTUAL plays for each drive from play_instances
SELECT
  d.drive_number,
  d.quarter,
  d.plays_count AS drives_table_says,
  COUNT(pi.id) AS actual_play_count
FROM drives d
JOIN games g ON g.id = d.game_id
LEFT JOIN play_instances pi ON pi.drive_id = d.id
WHERE g.opponent ILIKE '%Bears%'
  AND d.possession_type = 'defensive'
GROUP BY d.id, d.drive_number, d.quarter, d.plays_count
ORDER BY d.drive_number;

-- STEP 3: Check if the UPDATE query would match any rows
SELECT COUNT(*) as rows_that_would_be_updated
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE d.game_id = g.id
  AND g.opponent ILIKE '%Bears%'
  AND d.possession_type = 'defensive';
