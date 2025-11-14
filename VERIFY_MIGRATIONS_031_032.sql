-- ============================================================================
-- VERIFICATION: Check if Migrations 031 & 032 Applied Successfully
-- ============================================================================

-- ============================================================================
-- 1. Verify Migration 031 - Fixed Trigger
-- ============================================================================

-- Check if trigger exists and is enabled
SELECT
  tgname as trigger_name,
  CASE tgenabled
    WHEN 'O' THEN '✅ ENABLED'
    WHEN 'D' THEN '❌ DISABLED'
    ELSE 'UNKNOWN'
  END as status
FROM pg_trigger
WHERE tgname = 'auto_compute_play_metrics_trigger'
  AND tgrelid = 'play_instances'::regclass;

-- Check if function has the new optimized version
SELECT
  'auto_compute_play_metrics' as function_name,
  CASE
    WHEN prosrc LIKE '%resulted_in_first_down%' THEN '✅ NEW VERSION (Migration 031)'
    ELSE '❌ OLD VERSION'
  END as version_status
FROM pg_proc
WHERE proname = 'auto_compute_play_metrics';

-- ============================================================================
-- 2. Verify Migration 032 - Junction Table Created
-- ============================================================================

-- Check if player_participation table exists
SELECT
  'player_participation' as table_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'player_participation')
    THEN '✅ TABLE EXISTS'
    ELSE '❌ TABLE MISSING'
  END as status;

-- Check column structure
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'player_participation'
ORDER BY ordinal_position;

-- Count total records migrated
SELECT
  COUNT(*) as total_participations,
  COUNT(DISTINCT play_instance_id) as unique_plays,
  COUNT(DISTINCT player_id) as unique_players
FROM player_participation;

-- Breakdown by participation type
SELECT
  participation_type,
  COUNT(*) as count,
  COUNT(DISTINCT player_id) as unique_players
FROM player_participation
GROUP BY participation_type
ORDER BY count DESC;

-- Breakdown by result
SELECT
  result,
  COUNT(*) as count
FROM player_participation
WHERE result IS NOT NULL
GROUP BY result
ORDER BY count DESC;

-- Check indexes were created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'player_participation'
ORDER BY indexname;

-- Check RLS is enabled
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'player_participation';

-- Check RLS policies exist
SELECT
  policyname,
  cmd as command_type
FROM pg_policies
WHERE tablename = 'player_participation'
ORDER BY policyname;

-- ============================================================================
-- 3. Check Helper Functions Created
-- ============================================================================

SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as parameters,
  CASE
    WHEN proname = 'get_player_tackle_stats' THEN '✅ EXISTS'
    WHEN proname = 'get_player_pressure_stats' THEN '✅ EXISTS'
    WHEN proname = 'get_player_ol_block_stats' THEN '✅ EXISTS'
    ELSE '✅ EXISTS'
  END as status
FROM pg_proc
WHERE proname IN (
  'get_player_tackle_stats',
  'get_player_pressure_stats',
  'get_player_ol_block_stats'
)
ORDER BY proname;

-- ============================================================================
-- 4. Data Integrity Checks
-- ============================================================================

-- Check for orphaned records (should be 0 due to foreign keys)
SELECT
  'Orphaned player_id' as check_type,
  COUNT(*) as count
FROM player_participation pp
WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pp.player_id);

SELECT
  'Orphaned play_instance_id' as check_type,
  COUNT(*) as count
FROM player_participation pp
WHERE NOT EXISTS (SELECT 1 FROM play_instances pi WHERE pi.id = pp.play_instance_id);

SELECT
  'Orphaned team_id' as check_type,
  COUNT(*) as count
FROM player_participation pp
WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = pp.team_id);

-- Check team_id consistency (should match play_instances)
SELECT
  'team_id mismatch' as check_type,
  COUNT(*) as count
FROM player_participation pp
JOIN play_instances pi ON pi.id = pp.play_instance_id
WHERE pp.team_id != pi.team_id;

-- ============================================================================
-- 5. Test Helper Functions
-- ============================================================================

-- Get a sample player_id to test with
DO $$
DECLARE
  sample_player_id UUID;
  sample_team_id UUID;
BEGIN
  -- Get first player with participations
  SELECT player_id, team_id INTO sample_player_id, sample_team_id
  FROM player_participation
  LIMIT 1;

  IF sample_player_id IS NOT NULL THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Testing RPC Functions with player_id: %', sample_player_id;
    RAISE NOTICE '========================================';

    -- Test tackle stats function
    RAISE NOTICE 'Testing get_player_tackle_stats()...';
    PERFORM * FROM get_player_tackle_stats(sample_player_id, sample_team_id);

    -- Test pressure stats function
    RAISE NOTICE 'Testing get_player_pressure_stats()...';
    PERFORM * FROM get_player_pressure_stats(sample_player_id, sample_team_id);

    -- Test OL block stats function
    RAISE NOTICE 'Testing get_player_ol_block_stats()...';
    PERFORM * FROM get_player_ol_block_stats(sample_player_id, sample_team_id);

    RAISE NOTICE '✅ All RPC functions executed successfully';
  ELSE
    RAISE NOTICE '⚠️ No player_participation records found to test with';
  END IF;
END $$;

-- ============================================================================
-- 6. Performance Check
-- ============================================================================

-- Compare query performance (you should see fast execution)
EXPLAIN ANALYZE
SELECT pp.player_id, COUNT(*) as tackles
FROM player_participation pp
WHERE pp.participation_type = 'primary_tackle'
GROUP BY pp.player_id;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
DECLARE
  trigger_exists BOOLEAN;
  table_exists BOOLEAN;
  participation_count INTEGER;
BEGIN
  -- Check trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'auto_compute_play_metrics_trigger'
  ) INTO trigger_exists;

  -- Check table
  SELECT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'player_participation'
  ) INTO table_exists;

  -- Count participations
  SELECT COUNT(*) INTO participation_count FROM player_participation;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION VERIFICATION SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Migration 031 (Trigger Fix):';
  RAISE NOTICE '  Trigger exists: %', CASE WHEN trigger_exists THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '';
  RAISE NOTICE 'Migration 032 (Junction Table):';
  RAISE NOTICE '  Table exists: %', CASE WHEN table_exists THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '  Participations migrated: %', participation_count;
  RAISE NOTICE '';

  IF trigger_exists AND table_exists AND participation_count > 0 THEN
    RAISE NOTICE '✅ ALL MIGRATIONS APPLIED SUCCESSFULLY!';
  ELSIF trigger_exists AND table_exists AND participation_count = 0 THEN
    RAISE NOTICE '⚠️ Migrations applied but no data migrated (may be expected if no plays exist)';
  ELSE
    RAISE NOTICE '❌ MIGRATION INCOMPLETE - Check errors above';
  END IF;

  RAISE NOTICE '========================================';
END $$;
