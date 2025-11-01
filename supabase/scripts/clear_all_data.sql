-- =====================================================
-- CLEAR ALL DATA - Keep Structure
-- =====================================================
-- This script removes all data from tables while preserving:
-- - Table schemas
-- - RLS policies
-- - Indexes
-- - Constraints
-- - Functions and triggers
--
-- WARNING: This will DELETE ALL DATA. Run only in development.
-- =====================================================

-- Disable triggers temporarily for faster deletion
SET session_replication_role = 'replica';

-- Clear all tables in reverse dependency order
-- Using TRUNCATE CASCADE handles foreign key constraints automatically

-- Video-related tables
TRUNCATE TABLE IF EXISTS play_instances CASCADE;
TRUNCATE TABLE IF EXISTS video_group_videos CASCADE;
TRUNCATE TABLE IF EXISTS video_groups CASCADE;
TRUNCATE TABLE IF EXISTS videos CASCADE;

-- Drive and game tables
TRUNCATE TABLE IF EXISTS drives CASCADE;
TRUNCATE TABLE IF EXISTS games CASCADE;

-- Playbook tables
TRUNCATE TABLE IF EXISTS playbook_plays CASCADE;

-- Game planning tables (from migration 015)
TRUNCATE TABLE IF EXISTS wristbands CASCADE;
TRUNCATE TABLE IF EXISTS game_plans CASCADE;

-- Player tables
TRUNCATE TABLE IF EXISTS players CASCADE;

-- Team tables
TRUNCATE TABLE IF EXISTS team_memberships CASCADE;
TRUNCATE TABLE IF EXISTS team_analytics_config CASCADE;
TRUNCATE TABLE IF EXISTS teams CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Optional: Reset sequences (auto-increment IDs)
-- Note: Most tables use UUIDs, but if you have any sequences:
-- ALTER SEQUENCE IF EXISTS some_sequence_name RESTART WITH 1;

-- Show confirmation
SELECT
  'All data cleared successfully!' as message,
  'Database structure preserved' as status,
  'You can now start fresh with clean data' as note;
