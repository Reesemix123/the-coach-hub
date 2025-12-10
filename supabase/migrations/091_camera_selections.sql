-- Migration: 091_camera_selections.sql
-- Adds camera_selections table for "Director's Cut" feature
-- Records which camera to use for each time segment during playback

-- ============================================================================
-- Step 1: Create camera_selections table
-- ============================================================================

CREATE TABLE IF NOT EXISTS camera_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  camera_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  start_seconds DECIMAL(10,3) NOT NULL, -- Start time in seconds (with millisecond precision)
  end_seconds DECIMAL(10,3), -- End time in seconds (NULL means "until next selection or end")
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Step 2: Create indexes for efficient querying
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_camera_selections_game ON camera_selections(game_id);
CREATE INDEX IF NOT EXISTS idx_camera_selections_game_time ON camera_selections(game_id, start_seconds);
CREATE INDEX IF NOT EXISTS idx_camera_selections_camera ON camera_selections(camera_id);

-- ============================================================================
-- Step 3: Add comments
-- ============================================================================

COMMENT ON TABLE camera_selections IS
  'Records camera angle selections over time for Director''s Cut playback. Each row represents a time segment where a specific camera should be used.';

COMMENT ON COLUMN camera_selections.start_seconds IS
  'Start time in seconds (absolute time, accounting for sync offsets) when this camera selection begins.';

COMMENT ON COLUMN camera_selections.end_seconds IS
  'End time in seconds. NULL means the selection extends until the next selection or end of video.';

-- ============================================================================
-- Step 4: Add RLS policies
-- ============================================================================

ALTER TABLE camera_selections ENABLE ROW LEVEL SECURITY;

-- Users can view camera selections for games they have access to
CREATE POLICY "Users can view camera selections for their games"
  ON camera_selections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM games g
      JOIN teams t ON g.team_id = t.id
      LEFT JOIN team_memberships tm ON tm.team_id = t.id AND tm.user_id = auth.uid() AND tm.is_active = true
      WHERE g.id = camera_selections.game_id
        AND (t.user_id = auth.uid() OR tm.user_id IS NOT NULL)
    )
  );

-- Users can insert camera selections for games they have access to
CREATE POLICY "Users can insert camera selections for their games"
  ON camera_selections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games g
      JOIN teams t ON g.team_id = t.id
      LEFT JOIN team_memberships tm ON tm.team_id = t.id AND tm.user_id = auth.uid() AND tm.is_active = true
      WHERE g.id = camera_selections.game_id
        AND (t.user_id = auth.uid() OR tm.user_id IS NOT NULL)
    )
  );

-- Users can update camera selections for games they have access to
CREATE POLICY "Users can update camera selections for their games"
  ON camera_selections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM games g
      JOIN teams t ON g.team_id = t.id
      LEFT JOIN team_memberships tm ON tm.team_id = t.id AND tm.user_id = auth.uid() AND tm.is_active = true
      WHERE g.id = camera_selections.game_id
        AND (t.user_id = auth.uid() OR tm.user_id IS NOT NULL)
    )
  );

-- Users can delete camera selections for games they have access to
CREATE POLICY "Users can delete camera selections for their games"
  ON camera_selections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM games g
      JOIN teams t ON g.team_id = t.id
      LEFT JOIN team_memberships tm ON tm.team_id = t.id AND tm.user_id = auth.uid() AND tm.is_active = true
      WHERE g.id = camera_selections.game_id
        AND (t.user_id = auth.uid() OR tm.user_id IS NOT NULL)
    )
  );

-- ============================================================================
-- Step 5: Add updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_camera_selections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS camera_selections_updated_at ON camera_selections;
CREATE TRIGGER camera_selections_updated_at
  BEFORE UPDATE ON camera_selections
  FOR EACH ROW
  EXECUTE FUNCTION update_camera_selections_updated_at();

-- ============================================================================
-- Step 6: Helper function to get camera at a specific time
-- ============================================================================

CREATE OR REPLACE FUNCTION get_camera_at_time(
  p_game_id UUID,
  p_time_seconds DECIMAL
)
RETURNS UUID AS $$
DECLARE
  v_camera_id UUID;
BEGIN
  -- Find the camera selection that covers this time
  SELECT camera_id INTO v_camera_id
  FROM camera_selections
  WHERE game_id = p_game_id
    AND start_seconds <= p_time_seconds
    AND (end_seconds IS NULL OR end_seconds > p_time_seconds)
  ORDER BY start_seconds DESC
  LIMIT 1;

  RETURN v_camera_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_camera_at_time IS
  'Returns the camera_id that should be used at a specific time in a game, based on recorded camera selections.';
