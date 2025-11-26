-- ============================================================================
-- Verification: Auto Drive Stats System
-- ============================================================================
-- Run these queries to verify the automatic drive stats system is working
-- ============================================================================

-- ============================================================================
-- CHECK 1: Verify Triggers Are Installed
-- ============================================================================
-- Should return 3 rows (insert, update, delete triggers)
-- ============================================================================

SELECT
  trigger_name,
  event_manipulation AS "on_operation",
  action_timing AS "when_fires",
  tgenabled = 'O' AS "enabled"
FROM information_schema.triggers
JOIN pg_trigger ON pg_trigger.tgname = trigger_name
WHERE event_object_table = 'play_instances'
  AND trigger_name LIKE 'trigger_recalc_drive_stats%'
ORDER BY trigger_name;

-- Expected result:
-- trigger_recalc_drive_stats_delete | DELETE | AFTER | true
-- trigger_recalc_drive_stats_insert | INSERT | AFTER | true
-- trigger_recalc_drive_stats_update | UPDATE | AFTER | true


-- ============================================================================
-- CHECK 2: Verify Helper Functions Exist
-- ============================================================================
-- Should return 2 rows (main trigger function + helper function)
-- ============================================================================

SELECT
  routine_name AS "function_name",
  routine_type AS "type"
FROM information_schema.routines
WHERE routine_name IN ('recalculate_drive_stats', 'update_single_drive_stats')
ORDER BY routine_name;

-- Expected result:
-- recalculate_drive_stats      | FUNCTION
-- update_single_drive_stats    | FUNCTION


-- ============================================================================
-- CHECK 3: Verify Drive Stats Are Calculated
-- ============================================================================
-- All drives should have proper result, points, scoring_drive values
-- (not the default 'end_half' and 0 points if they have scoring plays)
-- ============================================================================

SELECT
  g.opponent AS "game",
  d.drive_number AS "drive_#",
  d.possession_type AS "possession",
  d.plays_count AS "plays",
  d.yards_gained AS "yards",
  d.result AS "result",
  d.points AS "points",
  d.scoring_drive AS "scoring?",
  d.three_and_out AS "3&out?",
  -- Show if there are scoring plays in this drive
  (
    SELECT COUNT(*)
    FROM play_instances pi
    WHERE pi.drive_id = d.id
      AND pi.result_type IN ('touchdown', 'pass_touchdown', 'field_goal')
  ) AS "scoring_plays",
  -- Show if there are turnovers in this drive
  (
    SELECT COUNT(*)
    FROM play_instances pi
    WHERE pi.drive_id = d.id
      AND pi.is_turnover = true
  ) AS "turnovers"
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE g.opponent = 'Bears'
ORDER BY d.drive_number;

-- What to look for:
-- ✅ If "scoring_plays" > 0, then "result" should be 'touchdown' or 'field_goal'
-- ✅ If "scoring_plays" > 0, then "points" should be 6 or 3
-- ✅ If "scoring_plays" > 0, then "scoring?" should be true
-- ✅ If "turnovers" > 0, then "result" should be 'turnover'
-- ❌ If "scoring_plays" > 0 but "points" = 0, triggers are NOT working


-- ============================================================================
-- CHECK 4: Test Trigger by Inserting/Updating a Play
-- ============================================================================
-- This will test if the trigger fires correctly
-- NOTE: Replace the IDs below with real values from your database
-- ============================================================================

-- First, check current stats for a specific drive
SELECT
  drive_number,
  plays_count,
  yards_gained,
  result,
  points
FROM drives
WHERE id = 'YOUR_DRIVE_ID_HERE';  -- Replace with actual drive ID

-- Then update a play in that drive (change yards_gained)
-- UPDATE play_instances
-- SET yards_gained = yards_gained + 1
-- WHERE id = 'YOUR_PLAY_ID_HERE';  -- Replace with actual play ID

-- Then check the drive stats again - they should have updated automatically
-- SELECT
--   drive_number,
--   plays_count,
--   yards_gained,
--   result,
--   points
-- FROM drives
-- WHERE id = 'YOUR_DRIVE_ID_HERE';

-- The yards_gained should have increased by 1 automatically!


-- ============================================================================
-- CHECK 5: Comprehensive Analytics Summary
-- ============================================================================
-- This shows the same data the analytics page uses
-- ============================================================================

SELECT
  'Defensive Drives' AS "metric",
  COUNT(*) AS "value"
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE g.opponent = 'Bears'
  AND d.possession_type = 'defense'

UNION ALL

SELECT
  'Total Plays',
  SUM(plays_count)::INTEGER
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE g.opponent = 'Bears'
  AND d.possession_type = 'defense'

UNION ALL

SELECT
  'Total Yards Allowed',
  SUM(yards_gained)::INTEGER
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE g.opponent = 'Bears'
  AND d.possession_type = 'defense'

UNION ALL

SELECT
  'Points Allowed',
  SUM(points)::INTEGER
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE g.opponent = 'Bears'
  AND d.possession_type = 'defense'

UNION ALL

SELECT
  'TDs Allowed',
  COUNT(*)::INTEGER
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE g.opponent = 'Bears'
  AND d.possession_type = 'defense'
  AND d.result = 'touchdown'

UNION ALL

SELECT
  'Turnovers Forced',
  COUNT(*)::INTEGER
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE g.opponent = 'Bears'
  AND d.possession_type = 'defense'
  AND d.result = 'turnover'

UNION ALL

SELECT
  'Three and Outs',
  COUNT(*)::INTEGER
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE g.opponent = 'Bears'
  AND d.possession_type = 'defense'
  AND d.three_and_out = true

ORDER BY metric;

-- These numbers should match what you see in the analytics dashboard
-- (after refreshing the page!)


-- ============================================================================
-- TROUBLESHOOTING: If Stats Are Still Wrong
-- ============================================================================

-- If CHECK 3 shows scoring_plays > 0 but points = 0, the trigger may not
-- have fired. Manually recalculate all drives:

-- DO $$
-- DECLARE
--   drive_record RECORD;
-- BEGIN
--   FOR drive_record IN SELECT id FROM drives LOOP
--     PERFORM update_single_drive_stats(drive_record.id);
--   END LOOP;
-- END $$;

-- Then re-run CHECK 3 and CHECK 5 to verify the stats are now correct.
