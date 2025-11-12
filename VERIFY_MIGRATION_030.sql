-- ============================================================================
-- VERIFY: Check if migration 030 was fully applied
-- ============================================================================

-- 1. Check if optimized calculate_block_win_rate exists
SELECT
  'calculate_block_win_rate' as function_name,
  CASE
    WHEN prosrc LIKE '%COUNT(*) FILTER%' THEN 'OPTIMIZED ✅'
    ELSE 'OLD VERSION ❌'
  END as version_status
FROM pg_proc
WHERE proname = 'calculate_block_win_rate';

-- 2. Check if optimized calculate_tackle_participation exists
SELECT
  'calculate_tackle_participation' as function_name,
  CASE
    WHEN prosrc LIKE '%COUNT(*) FILTER%' THEN 'OPTIMIZED ✅'
    ELSE 'OLD VERSION ❌'
  END as version_status
FROM pg_proc
WHERE proname = 'calculate_tackle_participation';

-- 3. Check if optimized calculate_pressure_rate exists
SELECT
  'calculate_pressure_rate' as function_name,
  CASE
    WHEN prosrc LIKE '%COUNT(*) FILTER%' THEN 'OPTIMIZED ✅'
    ELSE 'OLD VERSION ❌'
  END as version_status
FROM pg_proc
WHERE proname = 'calculate_pressure_rate';

-- 4. Check if optimized calculate_coverage_success exists
SELECT
  'calculate_coverage_success' as function_name,
  CASE
    WHEN prosrc LIKE '%COUNT(*) FILTER%' THEN 'OPTIMIZED ✅'
    ELSE 'OLD VERSION ❌'
  END as version_status
FROM pg_proc
WHERE proname = 'calculate_coverage_success';

-- 5. Check statement timeout
SHOW statement_timeout;

-- 6. Check if composite OL index exists
SELECT
  'idx_play_instances_ol_positions_combined' as index_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE indexname = 'idx_play_instances_ol_positions_combined'
    ) THEN 'EXISTS ✅'
    ELSE 'MISSING ❌'
  END as status;

-- 7. Check if GIN indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename = 'play_instances'
  AND indexname LIKE '%gin%';

-- ============================================================================
-- INTERPRETATION:
-- ✅ All functions show "OPTIMIZED" = Migration 030 fully applied
-- ❌ Any "OLD VERSION" or "MISSING" = Need to re-run parts of migration
-- ============================================================================
