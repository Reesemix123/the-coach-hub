-- ============================================================================
-- Migration 037: Remove Duplicate OL Columns from play_instances
-- ============================================================================
-- PURPOSE:
--   Clean up duplicate OL data storage after migrating to player_participation
--   junction table (Migration 032).
--
-- CONTEXT:
--   Migration 010 added OL tracking columns directly to play_instances:
--     - lt_id, lt_block_result
--     - lg_id, lg_block_result
--     - c_id, c_block_result
--     - rg_id, rg_block_result
--     - rt_id, rt_block_result
--
--   Migration 032 created player_participation junction table and migrated
--   all existing OL data to the new normalized structure.
--
--   These old columns are now redundant and should be removed.
--
-- VERIFICATION BEFORE RUNNING:
--   Run this query to confirm old columns are empty:
--   SELECT COUNT(lt_id), COUNT(lg_id), COUNT(c_id), COUNT(rg_id), COUNT(rt_id)
--   FROM play_instances;
--   -- Should return all zeros
--
-- BACKWARDS COMPATIBILITY:
--   None needed - OL data now lives exclusively in player_participation table.
--   All analytics queries have been updated to use the junction table.
-- ============================================================================

-- ============================================================================
-- Step 1: Drop Indexes on Old OL Columns
-- ============================================================================

DROP INDEX IF EXISTS idx_play_instances_lt;
DROP INDEX IF EXISTS idx_play_instances_lg;
DROP INDEX IF EXISTS idx_play_instances_c;
DROP INDEX IF EXISTS idx_play_instances_rg;
DROP INDEX IF EXISTS idx_play_instances_rt;
DROP INDEX IF EXISTS idx_play_instances_ol_assignments;

-- ============================================================================
-- Step 2: Drop Old Helper Functions That Use These Columns
-- ============================================================================

-- Function from migration 010 that calculated OL stats from old columns
DROP FUNCTION IF EXISTS get_ol_block_stats(UUID);

-- ============================================================================
-- Step 3: Remove Old OL Columns from play_instances Table
-- ============================================================================

ALTER TABLE play_instances
  DROP COLUMN IF EXISTS lt_id,
  DROP COLUMN IF EXISTS lt_block_result,
  DROP COLUMN IF EXISTS lg_id,
  DROP COLUMN IF EXISTS lg_block_result,
  DROP COLUMN IF EXISTS c_id,
  DROP COLUMN IF EXISTS c_block_result,
  DROP COLUMN IF EXISTS rg_id,
  DROP COLUMN IF EXISTS rg_block_result,
  DROP COLUMN IF EXISTS rt_id,
  DROP COLUMN IF EXISTS rt_block_result;

-- ============================================================================
-- Step 4: Verify Cleanup
-- ============================================================================

DO $$
DECLARE
  ol_columns TEXT[];
  col TEXT;
BEGIN
  -- Check if any OL columns still exist
  SELECT ARRAY_AGG(column_name)
  INTO ol_columns
  FROM information_schema.columns
  WHERE table_name = 'play_instances'
    AND column_name IN ('lt_id', 'lg_id', 'c_id', 'rg_id', 'rt_id',
                        'lt_block_result', 'lg_block_result', 'c_block_result',
                        'rg_block_result', 'rt_block_result');

  IF ol_columns IS NULL OR array_length(ol_columns, 1) IS NULL THEN
    RAISE NOTICE 'SUCCESS: All old OL columns have been removed from play_instances';
  ELSE
    RAISE WARNING 'WARNING: Some OL columns still exist: %', array_to_string(ol_columns, ', ');
  END IF;
END $$;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- After this migration:
-- 1. OL data is stored exclusively in player_participation table
-- 2. OL Performance section queries player_participation directly
-- 3. Film tagging UI writes OL data to player_participation only
-- 4. All OL analytics use the normalized junction table architecture
-- ============================================================================
