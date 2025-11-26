-- ============================================================================
-- Comprehensive Diagnostic: Why aren't analytics showing?
-- ============================================================================

-- STEP 1: Verify migration ran
-- ============================================================================
SELECT 'Step 1: Check participation types exist' as step;

SELECT DISTINCT participation_type
FROM player_participation
ORDER BY participation_type;

-- Expected: Should see dl_run_defense, lb_run_stop, db_run_support, etc.
-- If you DON'T see these, migration 033 didn't run!

-- STEP 2: Check if ANY participations exist
-- ============================================================================
SELECT 'Step 2: Total participations count' as step;

SELECT COUNT(*) as total_participations
FROM player_participation;

-- If this is 0, nothing was saved at all!

-- STEP 3: Check participations for the Bears game specifically
-- ============================================================================
SELECT 'Step 3: Participations for Bears game' as step;

-- First, find the Bears game ID
SELECT
  g.id,
  g.name,
  g.opponent,
  g.date
FROM games g
WHERE g.opponent ILIKE '%Bears%'
ORDER BY g.date DESC
LIMIT 5;

-- Use the game ID from above and replace 'YOUR_GAME_ID' below
SELECT
  pi.id as play_id,
  pi.down,
  pi.distance,
  pi.yards_gained,
  COUNT(pp.id) as participations_count
FROM play_instances pi
LEFT JOIN player_participation pp ON pp.play_instance_id = pi.id
WHERE pi.video_id IN (
  SELECT v.id FROM videos v
  WHERE v.game_id = 'YOUR_GAME_ID'  -- Replace with actual game ID
)
GROUP BY pi.id, pi.down, pi.distance, pi.yards_gained
ORDER BY pi.created_at DESC
LIMIT 20;

-- This shows: How many participations per play
-- If participations_count = 0 for all plays, data isn't saving!

-- STEP 4: Check what participation types were saved
-- ============================================================================
SELECT 'Step 4: Participation types breakdown' as step;

SELECT
  pp.participation_type,
  COUNT(*) as count,
  COUNT(DISTINCT pp.player_id) as unique_players
FROM player_participation pp
WHERE pp.play_instance_id IN (
  SELECT pi.id FROM play_instances pi
  WHERE pi.video_id IN (
    SELECT v.id FROM videos v
    WHERE v.game_id = 'YOUR_GAME_ID'  -- Replace with actual game ID
  )
)
GROUP BY pp.participation_type
ORDER BY count DESC;

-- This shows: What types of participations were saved
-- Expected: assist_tackle, primary_tackle, maybe dl_run_defense, lb_run_stop

-- STEP 5: Check Strong Safety specifically
-- ============================================================================
SELECT 'Step 5: Find your Strong Safety' as step;

-- Find all safeties on your team
SELECT
  id,
  jersey_number,
  first_name,
  last_name,
  primary_position
FROM players
WHERE primary_position IN ('SS', 'FS', 'S')
  AND team_id = (SELECT team_id FROM games WHERE opponent ILIKE '%Bears%' LIMIT 1)
ORDER BY jersey_number;

-- Now check their participations (replace PLAYER_ID)
SELECT 'Step 5b: Strong Safety participations' as step;

SELECT
  pp.participation_type,
  pp.result,
  pp.created_at,
  pi.down,
  pi.distance,
  pi.yards_gained
FROM player_participation pp
JOIN play_instances pi ON pi.id = pp.play_instance_id
WHERE pp.player_id = 'YOUR_SS_PLAYER_ID'  -- Replace with actual player ID
ORDER BY pp.created_at DESC
LIMIT 10;

-- If this returns 0 rows, the Strong Safety's tackle wasn't saved!

-- STEP 6: Check defensive drives
-- ============================================================================
SELECT 'Step 6: Defensive drives for Bears game' as step;

SELECT
  d.id,
  d.drive_number,
  d.quarter,
  d.plays_count,
  d.yards_gained,
  d.result,
  d.points,
  d.possession_type
FROM drives d
WHERE d.game_id = 'YOUR_GAME_ID'  -- Replace with actual game ID
  AND d.possession_type = 'defensive'
ORDER BY d.drive_number;

-- If this returns 0 rows, no defensive drives exist!
-- Defensive drives must be created manually in the Drives page

-- STEP 7: Check if plays are linked to defensive drives
-- ============================================================================
SELECT 'Step 7: Plays in defensive drives' as step;

SELECT
  d.drive_number,
  COUNT(pi.id) as plays_in_drive
FROM drives d
LEFT JOIN play_instances pi ON pi.drive_id = d.id
WHERE d.game_id = 'YOUR_GAME_ID'  -- Replace with actual game ID
  AND d.possession_type = 'defensive'
GROUP BY d.id, d.drive_number
ORDER BY d.drive_number;

-- This shows: How many plays are in each defensive drive
-- If all are 0, plays aren't linked to drives!

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================

-- SCENARIO 1: Step 1 shows old types only (no dl_run_defense, etc.)
-- → Migration 033 didn't run. Go back and run it.

-- SCENARIO 2: Step 2 shows 0 total participations
-- → Nothing is saving at all. Check browser console for errors.

-- SCENARIO 3: Step 3 shows participations_count = 0 for all plays
-- → Participations exist but not for Bears game plays.
--   Either wrong game, or saves failing for new plays.

-- SCENARIO 4: Step 4 shows only old types (assist_tackle, primary_tackle)
-- → New UI sections aren't being saved. Check if sections appeared when tagging.

-- SCENARIO 5: Step 5 shows 0 rows for Strong Safety
-- → That specific player wasn't saved. Was the SS in the tacklers list?

-- SCENARIO 6: Step 6 shows 0 defensive drives
-- → NO DEFENSIVE DRIVES EXIST! You must create them in Drives page first.
--   Defensive drive analytics need drives to exist!

-- SCENARIO 7: Step 7 shows 0 plays in drives
-- → Drives exist but plays aren't linked. When tagging, select the drive!

-- ============================================================================
-- NEXT STEPS BASED ON RESULTS
-- ============================================================================

-- If SCENARIO 6 or 7:
-- 1. Go to game page → Drives tab
-- 2. Create defensive drives
-- 3. Re-tag plays and assign them to drives
-- 4. Analytics will populate

-- If SCENARIO 1-5:
-- → Share the results with me and I'll help debug!
