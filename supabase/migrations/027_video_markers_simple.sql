-- Migration 027: Extend video_timeline_markers for simple single-video markers
-- This enables coaches to add markers directly to individual videos without video groups

-- Step 1: Make video_group_id nullable and add video_id
ALTER TABLE video_timeline_markers
  ALTER COLUMN video_group_id DROP NOT NULL;

ALTER TABLE video_timeline_markers
  ADD COLUMN video_id UUID REFERENCES videos(id) ON DELETE CASCADE;

-- Step 2: Add XOR constraint (must have video_id OR video_group_id, not both)
ALTER TABLE video_timeline_markers
  ADD CONSTRAINT video_timeline_markers_video_xor_group
  CHECK (
    (video_id IS NOT NULL AND video_group_id IS NULL) OR
    (video_id IS NULL AND video_group_id IS NOT NULL)
  );

-- Step 3: Add new marker types for game boundaries
ALTER TABLE video_timeline_markers
  DROP CONSTRAINT IF EXISTS video_timeline_markers_marker_type_check;

ALTER TABLE video_timeline_markers
  ADD CONSTRAINT video_timeline_markers_marker_type_check
  CHECK (marker_type IN (
    'play',           -- Existing: play marker
    'quarter_start',  -- New: quarter boundary start
    'quarter_end',    -- New: quarter boundary end
    'halftime',       -- New: halftime break
    'overtime',       -- New: overtime period
    'big_play',       -- New: significant play
    'turnover',       -- New: turnover marker
    'timeout',        -- Existing: timeout marker
    'custom'          -- Existing: custom marker
  ));

-- Step 4: Add metadata columns
ALTER TABLE video_timeline_markers
  ADD COLUMN quarter INTEGER CHECK (quarter BETWEEN 1 AND 5), -- 5 = OT
  ADD COLUMN color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for visual styling
  ADD COLUMN created_by UUID REFERENCES auth.users(id),
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- Step 5: Add indexes for single-video queries
CREATE INDEX IF NOT EXISTS idx_video_timeline_markers_video
  ON video_timeline_markers(video_id);

CREATE INDEX IF NOT EXISTS idx_video_timeline_markers_type
  ON video_timeline_markers(marker_type);

CREATE INDEX IF NOT EXISTS idx_video_timeline_markers_video_timestamp
  ON video_timeline_markers(video_id, virtual_timestamp_start_ms);

-- Step 6: Update RLS policies to support both video and video_group access
DROP POLICY IF EXISTS "Users can view markers for their video groups" ON video_timeline_markers;
DROP POLICY IF EXISTS "Users can manage markers for their video groups" ON video_timeline_markers;

-- View policy: can see markers for own videos OR video groups
CREATE POLICY "Users can view markers for their content"
  ON video_timeline_markers FOR SELECT
  USING (
    -- Check video access
    video_id IN (
      SELECT v.id FROM videos v
      JOIN games g ON v.game_id = g.id
      WHERE g.user_id = auth.uid()
    )
    OR
    -- Check video group access
    video_group_id IN (
      SELECT vg.id FROM video_groups vg
      JOIN games g ON vg.game_id = g.id
      WHERE g.user_id = auth.uid()
    )
  );

-- Insert policy
CREATE POLICY "Users can insert markers for their content"
  ON video_timeline_markers FOR INSERT
  WITH CHECK (
    video_id IN (
      SELECT v.id FROM videos v
      JOIN games g ON v.game_id = g.id
      WHERE g.user_id = auth.uid()
    )
    OR
    video_group_id IN (
      SELECT vg.id FROM video_groups vg
      JOIN games g ON vg.game_id = g.id
      WHERE g.user_id = auth.uid()
    )
  );

-- Update policy
CREATE POLICY "Users can update markers for their content"
  ON video_timeline_markers FOR UPDATE
  USING (
    video_id IN (
      SELECT v.id FROM videos v
      JOIN games g ON v.game_id = g.id
      WHERE g.user_id = auth.uid()
    )
    OR
    video_group_id IN (
      SELECT vg.id FROM video_groups vg
      JOIN games g ON vg.game_id = g.id
      WHERE g.user_id = auth.uid()
    )
  );

-- Delete policy
CREATE POLICY "Users can delete markers for their content"
  ON video_timeline_markers FOR DELETE
  USING (
    video_id IN (
      SELECT v.id FROM videos v
      JOIN games g ON v.game_id = g.id
      WHERE g.user_id = auth.uid()
    )
    OR
    video_group_id IN (
      SELECT vg.id FROM video_groups vg
      JOIN games g ON vg.game_id = g.id
      WHERE g.user_id = auth.uid()
    )
  );

-- Step 7: Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_timeline_markers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER video_timeline_markers_updated_at
  BEFORE UPDATE ON video_timeline_markers
  FOR EACH ROW
  EXECUTE FUNCTION update_video_timeline_markers_updated_at();

-- Step 8: Add helpful comments
COMMENT ON COLUMN video_timeline_markers.video_id IS
  'For simple single-video markers. Mutually exclusive with video_group_id.';

COMMENT ON COLUMN video_timeline_markers.video_group_id IS
  'For virtual timeline markers across multiple videos. Mutually exclusive with video_id.';

COMMENT ON COLUMN video_timeline_markers.virtual_timestamp_start_ms IS
  'Timestamp in milliseconds. For single videos, this is just the video timestamp. For groups, this is the virtual timeline position.';

COMMENT ON COLUMN video_timeline_markers.quarter IS
  'Game quarter (1-4) or overtime (5). Used for quarter_start/quarter_end markers.';

COMMENT ON COLUMN video_timeline_markers.color IS
  'Hex color code for visual styling (e.g., #3B82F6). Defaults to blue.';
