-- Migration: 084_games_cameras_architecture.sql
-- Phase 4: Restructure Games/Cameras Architecture
-- Games become containers for multiple camera angles (videos)
-- Adds expiration, locking, and camera metadata

-- ============================================================================
-- Step 1: Add game_type enum to replace is_opponent_game boolean
-- ============================================================================

-- Create the enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_type_enum') THEN
    CREATE TYPE game_type_enum AS ENUM ('team', 'opponent');
  END IF;
END$$;

-- Add game_type column if it doesn't exist
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS game_type game_type_enum;

-- Migrate existing data from is_opponent_game to game_type
UPDATE games
SET game_type = CASE
  WHEN is_opponent_game = true THEN 'opponent'::game_type_enum
  ELSE 'team'::game_type_enum
END
WHERE game_type IS NULL;

-- Set default for new games
ALTER TABLE games
  ALTER COLUMN game_type SET DEFAULT 'team'::game_type_enum;

-- Make game_type NOT NULL after migration
ALTER TABLE games
  ALTER COLUMN game_type SET NOT NULL;

-- ============================================================================
-- Step 2: Add expiration and locking columns to games
-- ============================================================================

-- Expiration timestamp (calculated: created_at + tier.retention_days)
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Lock status for downgrade handling
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS locked_reason TEXT;

-- Index for finding expired games
CREATE INDEX IF NOT EXISTS idx_games_expires_at ON games(expires_at) WHERE expires_at IS NOT NULL;

-- Index for finding locked games
CREATE INDEX IF NOT EXISTS idx_games_locked ON games(is_locked) WHERE is_locked = true;

-- ============================================================================
-- Step 3: Add camera metadata to videos table
-- Videos are now "cameras" - multiple angles of the same game
-- ============================================================================

-- Camera identification
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS camera_label VARCHAR(100);

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS camera_order INTEGER DEFAULT 1;

-- Video file metadata
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);

-- Video technical metadata (populated after upload/processing)
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS resolution_width INTEGER;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS resolution_height INTEGER;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS fps INTEGER;

-- Processing status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_status_enum') THEN
    CREATE TYPE upload_status_enum AS ENUM ('pending', 'processing', 'ready', 'failed');
  END IF;
END$$;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS upload_status upload_status_enum DEFAULT 'pending';

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS upload_error TEXT;

-- Thumbnail for UI display
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Timestamps
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- Step 4: Create trigger to update videos.updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS videos_updated_at ON videos;
CREATE TRIGGER videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_videos_updated_at();

-- ============================================================================
-- Step 5: Function to calculate expiration date for a game
-- Based on team's subscription tier retention_days
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_game_expiration(
  p_team_id UUID,
  p_created_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_retention_days INTEGER;
BEGIN
  -- Get retention days from subscription's tier
  SELECT tc.retention_days INTO v_retention_days
  FROM subscriptions s
  JOIN tier_config tc ON tc.tier_key = s.tier
  WHERE s.team_id = p_team_id
    AND s.status IN ('active', 'trialing', 'past_due');

  -- Default to 30 days if no subscription found
  IF v_retention_days IS NULL THEN
    v_retention_days := 30;
  END IF;

  RETURN p_created_at + (v_retention_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 6: Function to set expiration when game is created
-- ============================================================================

CREATE OR REPLACE FUNCTION set_game_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set expiration for new games if not already set
  IF NEW.expires_at IS NULL AND NEW.team_id IS NOT NULL THEN
    NEW.expires_at := calculate_game_expiration(NEW.team_id, COALESCE(NEW.created_at, NOW()));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS game_set_expiration ON games;
CREATE TRIGGER game_set_expiration
  BEFORE INSERT ON games
  FOR EACH ROW
  EXECUTE FUNCTION set_game_expiration();

-- ============================================================================
-- Step 7: Calculate expiration for existing games without expiration
-- ============================================================================

-- Update existing games to have expiration dates
UPDATE games g
SET expires_at = calculate_game_expiration(g.team_id, g.created_at)
WHERE g.expires_at IS NULL
  AND g.team_id IS NOT NULL;

-- ============================================================================
-- Step 8: Add default camera labels for existing videos
-- ============================================================================

UPDATE videos
SET
  camera_label = 'Main Camera',
  camera_order = 1,
  upload_status = 'ready'
WHERE camera_label IS NULL;

-- ============================================================================
-- Step 9: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN games.game_type IS 'Type of game: team (your games) or opponent (scouting film)';
COMMENT ON COLUMN games.expires_at IS 'When game expires based on tier retention period';
COMMENT ON COLUMN games.is_locked IS 'Whether game is locked due to tier limits (downgrade)';
COMMENT ON COLUMN games.locked_reason IS 'Reason for locking (downgrade_excess, camera_limit, etc.)';

COMMENT ON COLUMN videos.camera_label IS 'Display name for camera angle (End Zone, Sideline, Press Box, etc.)';
COMMENT ON COLUMN videos.camera_order IS 'Order for display (1 = primary camera)';
COMMENT ON COLUMN videos.duration_seconds IS 'Video duration in seconds';
COMMENT ON COLUMN videos.resolution_width IS 'Video width in pixels';
COMMENT ON COLUMN videos.resolution_height IS 'Video height in pixels';
COMMENT ON COLUMN videos.fps IS 'Video frame rate';
COMMENT ON COLUMN videos.upload_status IS 'Processing status: pending, processing, ready, failed';
COMMENT ON COLUMN videos.thumbnail_url IS 'URL to video thumbnail for UI';

COMMENT ON FUNCTION calculate_game_expiration IS 'Calculate expiration date based on team tier retention days';
COMMENT ON FUNCTION set_game_expiration IS 'Trigger function to set expiration on new games';

-- ============================================================================
-- Step 10: View for active (non-expired, non-locked) games
-- ============================================================================

CREATE OR REPLACE VIEW active_games AS
SELECT g.*
FROM games g
WHERE g.is_locked = false
  AND (g.expires_at IS NULL OR g.expires_at > NOW());

COMMENT ON VIEW active_games IS 'Games that are accessible (not locked or expired)';
