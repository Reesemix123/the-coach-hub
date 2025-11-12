-- ============================================================================
-- DEBUG: 500 Error on play_instances SELECT query
-- ============================================================================
-- Purpose: Diagnose why basic SELECT queries are failing
--
-- SYMPTOMS:
--   GET /rest/v1/play_instances?select=*&team_id=eq.XXX&is_opponent_play=eq.false
--   Returns: 500 (Internal Server Error)
--
-- POSSIBLE CAUSES:
--   1. Trigger function error (auto_compute_play_metrics)
--   2. RLS policy calling broken function
--   3. Missing columns referenced in triggers/policies
--   4. View/computed column error
-- ============================================================================

-- Step 1: Check if play_instances table is accessible at all
-- Run this first to see if we can query the table directly
SELECT COUNT(*) FROM play_instances;

-- Step 2: Check if specific team query works
-- Replace XXX with your team_id
SELECT COUNT(*)
FROM play_instances
WHERE team_id = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

-- Step 3: Check what triggers exist on play_instances
SELECT
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'play_instances';

-- Step 4: Check if auto_compute_play_metrics function exists and is valid
SELECT
  proname,
  prosrc
FROM pg_proc
WHERE proname = 'auto_compute_play_metrics';

-- Step 5: Check RLS policies on play_instances
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'play_instances';

-- Step 6: Try to select a single row
SELECT * FROM play_instances LIMIT 1;

-- Step 7: Check for missing columns that might be referenced
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'play_instances'
ORDER BY ordinal_position;

-- ============================================================================
-- COMMON FIXES:
-- ============================================================================

-- FIX 1: If auto_compute_play_metrics trigger is broken, disable it:
-- ALTER TABLE play_instances DISABLE TRIGGER auto_compute_play_metrics_trigger;

-- FIX 2: If it's an RLS policy issue, check the policies:
-- SELECT * FROM pg_policies WHERE tablename = 'play_instances';

-- FIX 3: If a column is missing, you might need to add it:
-- (Check migration 009-012 to see what columns should exist)

-- FIX 4: Check Supabase logs for the actual error message
-- Go to: Dashboard > Logs > select "Postgres Logs"
-- Look for the error around the time of the 500 response
-- ============================================================================
