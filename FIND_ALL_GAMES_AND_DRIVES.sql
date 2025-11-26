-- ============================================================================
-- Find ALL games and drives to see what exists
-- ============================================================================

-- STEP 1: Find all games with "Bear" in the name (any variation)
SELECT
  id,
  name,
  opponent,
  date,
  team_id
FROM games
WHERE opponent ILIKE '%bear%'
ORDER BY date DESC;

-- STEP 2: Find ALL drives for those games (regardless of possession_type)
SELECT
  d.id,
  d.drive_number,
  d.quarter,
  d.possession_type,
  d.plays_count,
  g.opponent,
  g.name as game_name
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE g.opponent ILIKE '%bear%'
ORDER BY d.drive_number;

-- STEP 3: Check what possession_type values exist (maybe it's not 'defensive'?)
SELECT DISTINCT possession_type
FROM drives;

-- STEP 4: Count plays linked to each drive (to see if data exists)
SELECT
  d.drive_number,
  d.possession_type,
  d.plays_count AS table_says,
  COUNT(pi.id) AS actual_count,
  g.opponent
FROM drives d
JOIN games g ON g.id = d.game_id
LEFT JOIN play_instances pi ON pi.drive_id = d.id
WHERE g.opponent ILIKE '%bear%'
GROUP BY d.id, d.drive_number, d.possession_type, d.plays_count, g.opponent
ORDER BY d.drive_number;
