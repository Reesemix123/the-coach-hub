-- RESET TAGGING DATA SQL
-- Use this in Supabase SQL Editor for quick resets
--
-- CAUTION: This deletes all tagging data while preserving structure
-- Teams, players, games, and videos are NOT affected

-- ========================================
-- OPTION 1: Reset ALL tagging data
-- ========================================

-- DELETE FROM player_participation WHERE team_id = 'YOUR_TEAM_ID_HERE';
-- DELETE FROM play_instances WHERE team_id = 'YOUR_TEAM_ID_HERE';
-- DELETE FROM drives WHERE team_id = 'YOUR_TEAM_ID_HERE';


-- ========================================
-- OPTION 2: Reset data for specific game
-- ========================================

-- Step 1: Delete player_participation for this game's plays
-- DELETE FROM player_participation
-- WHERE play_instance_id IN (
--   SELECT id FROM play_instances WHERE game_id = 'YOUR_GAME_ID_HERE'
-- );

-- Step 2: Delete play instances for this game
-- DELETE FROM play_instances WHERE game_id = 'YOUR_GAME_ID_HERE';

-- Step 3: Delete drives for this game
-- DELETE FROM drives WHERE game_id = 'YOUR_GAME_ID_HERE';


-- ========================================
-- OPTION 3: Check counts before deleting
-- ========================================

-- Check current data for a team
SELECT
  'play_instances' as table_name,
  COUNT(*) as count
FROM play_instances
WHERE team_id = 'YOUR_TEAM_ID_HERE'

UNION ALL

SELECT
  'player_participation' as table_name,
  COUNT(*) as count
FROM player_participation
WHERE team_id = 'YOUR_TEAM_ID_HERE'

UNION ALL

SELECT
  'drives' as table_name,
  COUNT(*) as count
FROM drives
WHERE team_id = 'YOUR_TEAM_ID_HERE';


-- ========================================
-- OPTION 4: Nuclear option (delete EVERYTHING)
-- ========================================
-- USE WITH EXTREME CAUTION - This deletes ALL data including teams!

-- DELETE FROM player_participation;
-- DELETE FROM play_instances;
-- DELETE FROM drives;
-- DELETE FROM videos;
-- DELETE FROM games;
-- DELETE FROM players;
-- DELETE FROM team_memberships;
-- DELETE FROM playbook_plays;
-- DELETE FROM teams;


-- ========================================
-- OPTION 5: Create a test game copy
-- ========================================
-- This creates a duplicate game for testing without affecting original

-- INSERT INTO games (id, name, date, opponent, team_id, user_id, team_score, opponent_score, game_result)
-- SELECT
--   gen_random_uuid(),
--   name || ' (TEST)',
--   date,
--   opponent,
--   team_id,
--   user_id,
--   0,
--   0,
--   'tie'
-- FROM games
-- WHERE id = 'YOUR_ORIGINAL_GAME_ID_HERE';
