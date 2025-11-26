-- ============================================================================
-- Diagnostic: Why aren't defensive drive analytics showing?
-- ============================================================================

-- STEP 1: Check if drives exist
SELECT 'Step 1: All defensive drives for Bears game' as step;

SELECT
  d.id,
  d.drive_number,
  d.quarter,
  d.possession_type,
  d.plays_count,
  d.yards_gained,
  d.result,
  d.points
FROM drives d
JOIN games g ON g.id = d.game_id
WHERE g.opponent ILIKE '%Bears%'
  AND d.possession_type = 'defensive'
ORDER BY d.drive_number;

-- Expected: Should see Drive #2, #4, #5, #6, #7
-- If this returns 0 rows, drives don't exist!

-- STEP 2: Check if plays are linked to drives
SELECT 'Step 2: Plays linked to defensive drives' as step;

SELECT
  d.drive_number,
  d.quarter,
  COUNT(pi.id) as plays_count,
  STRING_AGG(pi.play_code, ', ') as play_codes
FROM drives d
JOIN games g ON g.id = d.game_id
LEFT JOIN play_instances pi ON pi.drive_id = d.id
WHERE g.opponent ILIKE '%Bears%'
  AND d.possession_type = 'defensive'
GROUP BY d.id, d.drive_number, d.quarter
ORDER BY d.drive_number;

-- This shows: How many plays are in each drive
-- If all show 0, plays aren't linked to drives!

-- STEP 3: Check for orphaned plays (no drive_id)
SELECT 'Step 3: Defensive plays WITHOUT drive assignment' as step;

SELECT
  pi.id,
  pi.play_code,
  pi.down,
  pi.distance,
  pi.yards_gained,
  pi.quarter,
  pi.drive_id,
  pi.created_at
FROM play_instances pi
JOIN videos v ON v.id = pi.video_id
JOIN games g ON g.id = v.game_id
WHERE g.opponent ILIKE '%Bears%'
  AND pi.is_opponent_play = true
  AND pi.drive_id IS NULL
ORDER BY pi.created_at DESC;

-- If plays show here, they were saved but NOT linked to a drive!

-- STEP 4: Check ALL plays (with or without drive)
SELECT 'Step 4: ALL defensive plays for Bears game' as step;

SELECT
  pi.id,
  pi.play_code,
  pi.down,
  pi.distance,
  pi.yards_gained,
  pi.quarter,
  pi.drive_id,
  d.drive_number,
  pi.created_at
FROM play_instances pi
JOIN videos v ON v.id = pi.video_id
JOIN games g ON g.id = v.game_id
LEFT JOIN drives d ON d.id = pi.drive_id
WHERE g.opponent ILIKE '%Bears%'
  AND pi.is_opponent_play = true
ORDER BY pi.created_at DESC
LIMIT 20;

-- This shows: ALL defensive plays, whether linked to drives or not

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================

-- SCENARIO A: Step 1 returns 0 rows
-- → No defensive drives exist at all
-- → Solution: Create defensive drives in the Drives tab

-- SCENARIO B: Step 1 shows drives, but Step 2 shows 0 plays for all drives
-- → Drives exist, but plays aren't linked to them
-- → Solution: Re-tag plays and select a drive from the dropdown

-- SCENARIO C: Step 3 shows plays
-- → Plays were saved but drive_id is NULL
-- → You forgot to select a drive when tagging
-- → Solution: Edit those plays and assign them to drives

-- SCENARIO D: Step 4 shows plays with drive_id, but analytics still shows 0
-- → There's a bug in the analytics query
-- → I'll need to fix the analytics service code

-- ============================================================================
