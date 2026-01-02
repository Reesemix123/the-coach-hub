-- Migration: Cleanup orphaned videos
-- Description: Remove video records that are not part of any video_group_members (timeline)
-- These are videos that were uploaded but never added to a timeline, or were removed
-- from the timeline but the video record wasn't deleted.

-- First, let's see what we're deleting (for audit purposes)
-- This creates a temporary log of what will be deleted
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM videos v
  WHERE NOT EXISTS (
    SELECT 1 FROM video_group_members vgm WHERE vgm.video_id = v.id
  );

  RAISE NOTICE 'Found % orphaned video records to clean up', orphan_count;
END $$;

-- Delete play_instances that reference orphaned videos
-- (These would be plays tagged on videos that are no longer on the timeline)
DELETE FROM play_instances
WHERE video_id IN (
  SELECT v.id
  FROM videos v
  WHERE NOT EXISTS (
    SELECT 1 FROM video_group_members vgm WHERE vgm.video_id = v.id
  )
);

-- Delete video_timeline_markers that reference orphaned videos
DELETE FROM video_timeline_markers
WHERE video_id IN (
  SELECT v.id
  FROM videos v
  WHERE NOT EXISTS (
    SELECT 1 FROM video_group_members vgm WHERE vgm.video_id = v.id
  )
);

-- Delete gemini_file_cache entries for orphaned videos
DELETE FROM gemini_file_cache
WHERE video_id IN (
  SELECT v.id
  FROM videos v
  WHERE NOT EXISTS (
    SELECT 1 FROM video_group_members vgm WHERE vgm.video_id = v.id
  )
);

-- Finally, delete the orphaned video records themselves
-- Note: The actual storage files will need to be cleaned up separately
-- since we can't call storage APIs from SQL
DELETE FROM videos
WHERE id IN (
  SELECT v.id
  FROM videos v
  WHERE NOT EXISTS (
    SELECT 1 FROM video_group_members vgm WHERE vgm.video_id = v.id
  )
);

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Orphaned video cleanup complete';
END $$;

-- Add a comment explaining this migration
COMMENT ON TABLE videos IS 'Video records - should always have corresponding video_group_members entry. Run migration 113 to clean up orphans.';
