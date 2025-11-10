-- ============================================
-- DIAGNOSTIC QUERIES FOR GAME/VIDEO ID MISMATCH (FIXED)
-- ============================================

-- 1. Check all games for your user
SELECT
  g.id as game_id,
  g.name as game_name,
  g.opponent,
  g.date,
  g.team_id,
  t.name as team_name,
  (SELECT COUNT(*) FROM videos v WHERE v.game_id = g.id) as video_count
FROM games g
JOIN teams t ON g.team_id = t.id
WHERE t.user_id = '2c2cecd8-fd1c-495b-8c68-418ecb4d6302'
ORDER BY g.date DESC;

-- 2. Check all videos and their game associations
SELECT
  v.id as video_id,
  v.name as video_name,
  v.game_id,
  v.file_path,
  g.name as game_name,
  g.opponent,
  CASE
    WHEN g.id IS NULL THEN '❌ ORPHANED - Game does not exist'
    ELSE '✅ Valid'
  END as status
FROM videos v
LEFT JOIN games g ON v.game_id = g.id
WHERE v.game_id IN (
  SELECT id FROM games WHERE team_id IN (
    SELECT id FROM teams WHERE user_id = '2c2cecd8-fd1c-495b-8c68-418ecb4d6302'
  )
)
OR g.id IS NULL;

-- 3. Find videos with game_id that doesn't exist in games table
SELECT
  v.id as video_id,
  v.name as video_name,
  v.game_id as broken_game_id,
  v.file_path,
  v.created_at
FROM videos v
WHERE v.game_id NOT IN (SELECT id FROM games)
AND v.game_id IS NOT NULL;

-- 4. Check if game_id in file_path matches game_id column (FIXED with type cast)
SELECT
  v.id,
  v.name,
  v.game_id as db_game_id,
  SPLIT_PART(v.file_path, '/', 1)::uuid as filepath_game_id,
  CASE
    WHEN v.game_id = SPLIT_PART(v.file_path, '/', 1)::uuid THEN '✅ Match'
    ELSE '❌ MISMATCH'
  END as status,
  v.file_path
FROM videos v
WHERE v.file_path IS NOT NULL;

-- 5. Summary: Data integrity check
SELECT
  'Total Games' as metric,
  COUNT(*) as count
FROM games g
JOIN teams t ON g.team_id = t.id
WHERE t.user_id = '2c2cecd8-fd1c-495b-8c68-418ecb4d6302'

UNION ALL

SELECT
  'Games with Videos' as metric,
  COUNT(DISTINCT v.game_id) as count
FROM videos v
JOIN games g ON v.game_id = g.id
JOIN teams t ON g.team_id = t.id
WHERE t.user_id = '2c2cecd8-fd1c-495b-8c68-418ecb4d6302'

UNION ALL

SELECT
  'Total Videos' as metric,
  COUNT(*) as count
FROM videos v
WHERE v.game_id IN (
  SELECT g.id FROM games g
  JOIN teams t ON g.team_id = t.id
  WHERE t.user_id = '2c2cecd8-fd1c-495b-8c68-418ecb4d6302'
)

UNION ALL

SELECT
  'Orphaned Videos (broken game_id)' as metric,
  COUNT(*) as count
FROM videos v
WHERE v.game_id NOT IN (SELECT id FROM games)
AND v.game_id IS NOT NULL;

-- ============================================
-- FIX QUERY: Update videos to match file_path game_id
-- ============================================
-- Run this AFTER reviewing the results above

-- UPDATE videos
-- SET game_id = SPLIT_PART(file_path, '/', 1)::uuid
-- WHERE game_id != SPLIT_PART(file_path, '/', 1)::uuid
-- AND file_path IS NOT NULL;
