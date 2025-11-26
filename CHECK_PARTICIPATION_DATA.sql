-- ============================================================================
-- Check if participation data is being saved correctly
-- ============================================================================

-- 1. Check if migration 033 was run (check for new participation types)
SELECT DISTINCT participation_type
FROM player_participation
ORDER BY participation_type;

-- Expected to see:
-- dl_run_defense, lb_run_stop, db_run_support, lb_pass_coverage, db_pass_coverage
-- If you DON'T see these, migration 033 hasn't been run yet!

-- 2. Check total participations
SELECT COUNT(*) as total_participations
FROM player_participation;

-- 3. Check participations by type
SELECT participation_type, COUNT(*) as count
FROM player_participation
GROUP BY participation_type
ORDER BY count DESC;

-- 4. Check recent participations (last 20)
SELECT
  pp.id,
  pp.participation_type,
  pp.result,
  pp.created_at,
  p.jersey_number,
  p.first_name,
  p.last_name,
  pi.down,
  pi.distance,
  pi.yards_gained
FROM player_participation pp
JOIN players p ON p.id = pp.player_id
JOIN play_instances pi ON pi.id = pp.play_instance_id
ORDER BY pp.created_at DESC
LIMIT 20;

-- 5. Check if your Strong Safety's tackle was saved
-- (Replace with actual player details)
SELECT
  pp.*,
  p.jersey_number,
  p.first_name,
  p.last_name,
  p.primary_position
FROM player_participation pp
JOIN players p ON p.id = pp.player_id
WHERE p.primary_position IN ('SS', 'FS', 'S')
  AND pp.participation_type IN ('primary_tackle', 'assist_tackle')
ORDER BY pp.created_at DESC
LIMIT 10;

-- 6. Check for any errors in the console (if saves failed)
-- This needs to be checked in browser console, not SQL

-- ============================================================================
-- If you see EMPTY or ZERO results:
-- ============================================================================
-- This means migration 033 hasn't been run yet!
-- The new participation types don't exist in the database constraints,
-- so inserts are failing silently.
--
-- Solution:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy/paste the contents of:
--    supabase/migrations/033_add_multi_player_defensive_tracking.sql
-- 3. Click "Run"
-- 4. Re-tag a few plays to test
-- 5. Run these queries again to verify data is saving
-- ============================================================================
