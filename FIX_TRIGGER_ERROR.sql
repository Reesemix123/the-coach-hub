-- ============================================================================
-- FIX: Disable only user-defined triggers (not system FK triggers)
-- ============================================================================

-- First, let's see what triggers exist
SELECT tgname, tgtype, tgenabled
FROM pg_trigger
WHERE tgrelid = 'play_instances'::regclass
AND tgname NOT LIKE 'RI_%'; -- Exclude system constraint triggers

-- Disable only the auto_compute_play_metrics trigger
ALTER TABLE play_instances DISABLE TRIGGER auto_compute_play_metrics_trigger;

-- Now test if we can query the table
SELECT COUNT(*) as total_rows FROM play_instances;

-- If that works, check for your team specifically
SELECT COUNT(*) as team_rows
FROM play_instances
WHERE team_id = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

-- Check videos table
SELECT COUNT(*) as total_videos FROM videos;

-- Check playbook
SELECT COUNT(*) as total_playbook_plays FROM playbook_plays;

-- ============================================================================
-- If you see rows now, the trigger was causing the timeout!
-- If you still see 0 rows, we need to investigate data loss
-- ============================================================================
