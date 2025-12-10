-- Migration: 090_multi_camera_sync.sql
-- Adds multi-camera sync support for play tagging
-- - videos.sync_offset_seconds: offset relative to primary camera (camera_order = 1)
-- - play_instances.camera_id: which camera angle was selected when tagging

-- ============================================================================
-- Step 1: Add sync_offset_seconds to videos table
-- ============================================================================

-- Sync offset in seconds relative to primary camera
-- Primary camera (camera_order = 1) should always have offset = 0
-- Other cameras: positive = starts after primary, negative = starts before
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS sync_offset_seconds INTEGER DEFAULT 0;

COMMENT ON COLUMN videos.sync_offset_seconds IS
  'Offset in seconds relative to primary camera (camera_order=1). Positive = starts after, negative = starts before.';

-- ============================================================================
-- Step 2: Add camera_id to play_instances table
-- ============================================================================

-- Track which camera angle was selected when the play was tagged
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS camera_id UUID REFERENCES videos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_play_instances_camera ON play_instances(camera_id);

COMMENT ON COLUMN play_instances.camera_id IS
  'The camera/video that was selected when this play was tagged.';

-- ============================================================================
-- Step 3: Backfill camera_id for existing play_instances
-- ============================================================================

-- For existing play instances, set camera_id = video_id
-- (since they were tagged before multi-camera, video_id IS the camera)
UPDATE play_instances
SET camera_id = video_id
WHERE camera_id IS NULL
  AND video_id IS NOT NULL;

-- ============================================================================
-- Step 4: Helper function to get synced timestamp across cameras
-- ============================================================================

-- Given a timestamp on one camera, get the equivalent timestamp on another camera
CREATE OR REPLACE FUNCTION get_synced_timestamp(
  p_source_camera_id UUID,
  p_source_timestamp INTEGER,
  p_target_camera_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_source_offset INTEGER;
  v_target_offset INTEGER;
BEGIN
  -- Get offsets for both cameras
  SELECT sync_offset_seconds INTO v_source_offset
  FROM videos WHERE id = p_source_camera_id;

  SELECT sync_offset_seconds INTO v_target_offset
  FROM videos WHERE id = p_target_camera_id;

  -- Handle null offsets (default to 0)
  v_source_offset := COALESCE(v_source_offset, 0);
  v_target_offset := COALESCE(v_target_offset, 0);

  -- Convert: source_timestamp -> absolute time -> target_timestamp
  -- absolute_time = source_timestamp + source_offset
  -- target_timestamp = absolute_time - target_offset
  RETURN p_source_timestamp + v_source_offset - v_target_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_synced_timestamp IS
  'Convert a timestamp from one camera to the equivalent timestamp on another camera, accounting for sync offsets.';

-- ============================================================================
-- Step 5: Add is_primary helper column to videos (computed from camera_order)
-- ============================================================================

-- Mark primary camera for easier querying
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS is_primary_camera BOOLEAN GENERATED ALWAYS AS (camera_order = 1) STORED;

CREATE INDEX IF NOT EXISTS idx_videos_is_primary ON videos(game_id, is_primary_camera) WHERE is_primary_camera = true;

COMMENT ON COLUMN videos.is_primary_camera IS
  'Computed column: true if this is the primary camera (camera_order = 1).';

-- ============================================================================
-- Step 6: Ensure primary camera always has offset 0
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_primary_camera_offset()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the primary camera, force offset to 0
  IF NEW.camera_order = 1 THEN
    NEW.sync_offset_seconds := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_primary_camera_offset_trigger ON videos;
CREATE TRIGGER enforce_primary_camera_offset_trigger
  BEFORE INSERT OR UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION enforce_primary_camera_offset();
