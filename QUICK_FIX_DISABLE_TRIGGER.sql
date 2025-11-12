-- ============================================================================
-- QUICK FIX: Disable broken trigger temporarily
-- ============================================================================
-- This will disable the auto_compute_play_metrics trigger that might be
-- causing 500 errors on SELECT queries
-- ============================================================================

-- Disable all triggers on play_instances
ALTER TABLE play_instances DISABLE TRIGGER ALL;

-- Verify the table is accessible
SELECT COUNT(*) as total_rows FROM play_instances;

-- Check if we can query with team filter
SELECT COUNT(*) as team_rows
FROM play_instances
WHERE team_id = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

-- ============================================================================
-- After running this, try loading the analytics page again
-- ============================================================================
-- If it works, we know the trigger was the problem
-- Then we can fix the trigger function properly
-- ============================================================================
