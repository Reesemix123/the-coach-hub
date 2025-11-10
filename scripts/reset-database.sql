-- ================================================
-- RESET DATABASE - DELETE ALL DATA
-- ================================================
-- WARNING: This will delete ALL data from your database!
-- Run this in Supabase SQL Editor when you want to start fresh.
-- ================================================

-- Delete in order (respecting foreign key constraints)

-- 1. Delete all play instances (references playbook_plays and videos)
DELETE FROM play_instances;

-- 2. Delete all game plan plays (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'game_plan_plays') THEN
        DELETE FROM game_plan_plays;
    END IF;
END $$;

-- 3. Delete all game plans (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'game_plans') THEN
        DELETE FROM game_plans;
    END IF;
END $$;

-- 4. Delete all practice plan plays (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'practice_plan_plays') THEN
        DELETE FROM practice_plan_plays;
    END IF;
END $$;

-- 5. Delete all practice plans (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'practice_plans') THEN
        DELETE FROM practice_plans;
    END IF;
END $$;

-- 6. Delete all videos
DELETE FROM videos;

-- 7. Delete all drives (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'drives') THEN
        DELETE FROM drives;
    END IF;
END $$;

-- 8. Delete all games
DELETE FROM games;

-- 9. Delete all playbook plays
DELETE FROM playbook_plays;

-- 10. Delete all players (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'players') THEN
        DELETE FROM players;
    END IF;
END $$;

-- 11. Delete all teams (this will cascade delete any remaining data)
DELETE FROM teams;

-- ================================================
-- VERIFICATION
-- ================================================
-- Check that core tables are empty (should return 0 for each)

SELECT 'teams' as table_name, COUNT(*) as count FROM teams
UNION ALL
SELECT 'games', COUNT(*) FROM games
UNION ALL
SELECT 'videos', COUNT(*) FROM videos
UNION ALL
SELECT 'playbook_plays', COUNT(*) FROM playbook_plays
UNION ALL
SELECT 'play_instances', COUNT(*) FROM play_instances
ORDER BY table_name;

-- ================================================
-- SUCCESS!
-- All data has been deleted. Database is now empty.
-- Your auth users are preserved (login still works).
-- ================================================
