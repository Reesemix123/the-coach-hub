-- Migration: 100_camera_lane_timeline.sql
-- Adds swim lane timeline support for multi-clip camera management
-- Allows coaches to upload multiple video clips per camera lane and position them on a timeline

-- ============================================================================
-- Step 1: Add camera_lane to video_group_members for swim lane support
-- ============================================================================

ALTER TABLE video_group_members
ADD COLUMN IF NOT EXISTS camera_lane INTEGER DEFAULT 1;

-- Add constraint after column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'video_group_members_camera_lane_check'
  ) THEN
    ALTER TABLE video_group_members
    ADD CONSTRAINT video_group_members_camera_lane_check CHECK (camera_lane BETWEEN 1 AND 5);
  END IF;
END $$;

COMMENT ON COLUMN video_group_members.camera_lane IS
'Which camera lane (1-5) this clip belongs to in timeline mode';

-- ============================================================================
-- Step 2: Add lane_position_ms - absolute position on timeline
-- ============================================================================

ALTER TABLE video_group_members
ADD COLUMN IF NOT EXISTS lane_position_ms INTEGER DEFAULT 0;

COMMENT ON COLUMN video_group_members.lane_position_ms IS
'Absolute position in milliseconds where this clip starts on the timeline';

-- ============================================================================
-- Step 3: Add camera_label for lane naming
-- ============================================================================

ALTER TABLE video_group_members
ADD COLUMN IF NOT EXISTS camera_label TEXT;

COMMENT ON COLUMN video_group_members.camera_label IS
'Display label for the camera lane (e.g., Sideline, End Zone, Press Box)';

-- ============================================================================
-- Step 4: Add is_timeline_mode flag to video_groups
-- ============================================================================

ALTER TABLE video_groups
ADD COLUMN IF NOT EXISTS is_timeline_mode BOOLEAN DEFAULT false;

COMMENT ON COLUMN video_groups.is_timeline_mode IS
'When true, this group uses swim lane timeline mode instead of simple sequence';

-- ============================================================================
-- Step 5: Add total_duration_ms cache to video_groups
-- ============================================================================

ALTER TABLE video_groups
ADD COLUMN IF NOT EXISTS total_duration_ms INTEGER;

COMMENT ON COLUMN video_groups.total_duration_ms IS
'Cached total duration of the timeline in milliseconds';

-- ============================================================================
-- Step 6: Create index for efficient lane queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_video_group_members_lane
ON video_group_members(video_group_id, camera_lane, lane_position_ms);

-- ============================================================================
-- Step 7: Add game_id to video_groups for direct game association
-- ============================================================================

ALTER TABLE video_groups
ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES games(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_video_groups_game
ON video_groups(game_id) WHERE game_id IS NOT NULL;

COMMENT ON COLUMN video_groups.game_id IS
'Direct link to the game this timeline belongs to';

-- ============================================================================
-- Step 8: Helper function to get clip at a given time for a lane
-- ============================================================================

CREATE OR REPLACE FUNCTION get_clip_at_time(
  p_video_group_id UUID,
  p_camera_lane INTEGER,
  p_time_ms INTEGER
)
RETURNS TABLE(
  member_id UUID,
  video_id UUID,
  lane_position_ms INTEGER,
  duration_ms INTEGER,
  clip_time_ms INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vgm.id as member_id,
    vgm.video_id,
    vgm.lane_position_ms,
    COALESCE(v.duration_seconds * 1000, 0)::INTEGER as duration_ms,
    (p_time_ms - vgm.lane_position_ms)::INTEGER as clip_time_ms
  FROM video_group_members vgm
  JOIN videos v ON v.id = vgm.video_id
  WHERE vgm.video_group_id = p_video_group_id
    AND vgm.camera_lane = p_camera_lane
    AND vgm.lane_position_ms <= p_time_ms
    AND vgm.lane_position_ms + COALESCE(v.duration_seconds * 1000, 0) > p_time_ms
  ORDER BY vgm.lane_position_ms DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_clip_at_time IS
'Returns the clip playing at a given time position for a specific camera lane';

-- ============================================================================
-- Step 9: Helper function to get all clips for a timeline
-- ============================================================================

CREATE OR REPLACE FUNCTION get_timeline_clips(p_video_group_id UUID)
RETURNS TABLE(
  member_id UUID,
  video_id UUID,
  video_name TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  camera_lane INTEGER,
  camera_label TEXT,
  lane_position_ms INTEGER,
  duration_ms INTEGER,
  start_offset_ms INTEGER,
  end_offset_ms INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vgm.id as member_id,
    vgm.video_id,
    v.name as video_name,
    v.url as video_url,
    v.thumbnail_url,
    vgm.camera_lane,
    vgm.camera_label,
    vgm.lane_position_ms,
    COALESCE(
      CASE
        WHEN vgm.end_offset_ms IS NOT NULL THEN vgm.end_offset_ms - COALESCE(vgm.start_offset_ms, 0)
        ELSE v.duration_seconds * 1000
      END,
      0
    )::INTEGER as duration_ms,
    COALESCE(vgm.start_offset_ms, 0)::INTEGER as start_offset_ms,
    vgm.end_offset_ms::INTEGER
  FROM video_group_members vgm
  JOIN videos v ON v.id = vgm.video_id
  WHERE vgm.video_group_id = p_video_group_id
  ORDER BY vgm.camera_lane, vgm.lane_position_ms;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_timeline_clips IS
'Returns all clips for a timeline with computed durations';

-- ============================================================================
-- Step 10: Function to check for clip overlaps (for validation)
-- ============================================================================

CREATE OR REPLACE FUNCTION check_clip_overlap(
  p_video_group_id UUID,
  p_camera_lane INTEGER,
  p_position_ms INTEGER,
  p_duration_ms INTEGER,
  p_exclude_member_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_new_end INTEGER := p_position_ms + p_duration_ms;
  v_overlap_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_overlap_count
  FROM video_group_members vgm
  JOIN videos v ON v.id = vgm.video_id
  WHERE vgm.video_group_id = p_video_group_id
    AND vgm.camera_lane = p_camera_lane
    AND (p_exclude_member_id IS NULL OR vgm.id != p_exclude_member_id)
    AND (
      -- New clip starts during existing clip
      (p_position_ms >= vgm.lane_position_ms
       AND p_position_ms < vgm.lane_position_ms + COALESCE(v.duration_seconds * 1000, 0))
      OR
      -- New clip ends during existing clip
      (v_new_end > vgm.lane_position_ms
       AND v_new_end <= vgm.lane_position_ms + COALESCE(v.duration_seconds * 1000, 0))
      OR
      -- New clip completely contains existing clip
      (p_position_ms <= vgm.lane_position_ms
       AND v_new_end >= vgm.lane_position_ms + COALESCE(v.duration_seconds * 1000, 0))
    );

  RETURN v_overlap_count > 0;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_clip_overlap IS
'Returns true if placing a clip at the given position would overlap with existing clips';
