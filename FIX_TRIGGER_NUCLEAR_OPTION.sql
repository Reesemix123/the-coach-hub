-- ============================================================================
-- NUCLEAR OPTION: Completely remove and rebuild the trigger
-- ============================================================================
-- This completely drops everything related to auto_compute_play_metrics
-- and rebuilds it from scratch
-- ============================================================================

-- Step 1: Drop ALL triggers on play_instances (except system triggers)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tgname
              FROM pg_trigger
              WHERE tgrelid = 'play_instances'::regclass
                AND NOT tgisinternal) -- Don't drop system triggers
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON play_instances', r.tgname);
        RAISE NOTICE 'Dropped trigger: %', r.tgname;
    END LOOP;
END $$;

-- Step 2: Drop the function
DROP FUNCTION IF EXISTS auto_compute_play_metrics();

RAISE NOTICE '✅ All triggers and functions removed';

-- Step 3: Verify play_instances table is accessible
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO row_count FROM play_instances;
    RAISE NOTICE 'play_instances has % rows and is accessible', row_count;
END $$;

-- Step 4: Test a simple query
DO $$
DECLARE
    test_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO test_count
    FROM play_instances
    WHERE is_opponent_play = false;

    RAISE NOTICE 'Test query successful: % rows found', test_count;
END $$;

-- ============================================================================
-- If the above tests pass, you can safely re-create the trigger using:
-- supabase/migrations/031_fix_auto_compute_trigger.sql
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '========================================';
RAISE NOTICE 'TRIGGER REMOVAL COMPLETE';
RAISE NOTICE '========================================';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. If test queries above succeeded, the table is now working';
RAISE NOTICE '2. You can re-apply migration 031 if you need the trigger';
RAISE NOTICE '3. For now, the table should be queryable without errors';
RAISE NOTICE '========================================';
