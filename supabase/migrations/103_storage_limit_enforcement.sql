-- Migration 103: Storage Limit Enforcement
-- Purpose:
--   1. Update tier quota names in platform_config to match current tiers (basic/plus/premium)
--   2. Add per-game storage/duration limits to tier_config
--   3. Add per-camera total duration validation
-- Date: 2024-12-15

-- ============================================================================
-- PART 1: Update tier quota names in platform_config
-- ============================================================================

UPDATE platform_config
SET value = jsonb_set(
  value,
  '{tier_quotas}',
  '{
    "basic": 10737418240,
    "plus": 53687091200,
    "premium": 214748364800
  }'::jsonb
),
description = 'Video storage limits. Tier quotas in bytes: basic=10GB, plus=50GB, premium=200GB. Max file=5GB.'
WHERE key = 'storage_limits';

-- ============================================================================
-- PART 2: Add per-game storage/duration limits to tier_config
-- ============================================================================

-- Add columns for per-game limits
ALTER TABLE tier_config
ADD COLUMN IF NOT EXISTS max_storage_per_game_bytes BIGINT,
ADD COLUMN IF NOT EXISTS max_duration_per_game_seconds INTEGER,
ADD COLUMN IF NOT EXISTS max_duration_per_camera_seconds INTEGER;

-- Set per-game limits for each tier
-- Basic: 5GB per game, 3 hours per game total (1 camera × 3 hours), 3 hours per camera
-- Plus: 15GB per game, 9 hours per game total (3 cameras × 3 hours), 3 hours per camera
-- Premium: 25GB per game, 15 hours per game total (5 cameras × 3 hours), 3 hours per camera

UPDATE tier_config SET
  max_storage_per_game_bytes = 5368709120,    -- 5GB
  max_duration_per_game_seconds = 10800,       -- 3 hours (3600 * 3)
  max_duration_per_camera_seconds = 10800      -- 3 hours per camera
WHERE tier_key = 'basic';

UPDATE tier_config SET
  max_storage_per_game_bytes = 16106127360,   -- 15GB
  max_duration_per_game_seconds = 32400,       -- 9 hours (3600 * 9)
  max_duration_per_camera_seconds = 10800      -- 3 hours per camera
WHERE tier_key = 'plus';

UPDATE tier_config SET
  max_storage_per_game_bytes = 26843545600,   -- 25GB
  max_duration_per_game_seconds = 54000,       -- 15 hours (3600 * 15)
  max_duration_per_camera_seconds = 10800      -- 3 hours per camera
WHERE tier_key = 'premium';

-- Add constraints
ALTER TABLE tier_config ADD CONSTRAINT valid_game_storage
  CHECK (max_storage_per_game_bytes IS NULL OR max_storage_per_game_bytes > 0);

ALTER TABLE tier_config ADD CONSTRAINT valid_game_duration
  CHECK (max_duration_per_game_seconds IS NULL OR max_duration_per_game_seconds > 0);

ALTER TABLE tier_config ADD CONSTRAINT valid_camera_duration
  CHECK (max_duration_per_camera_seconds IS NULL OR max_duration_per_camera_seconds > 0);

-- ============================================================================
-- PART 3: Add game-level storage tracking columns
-- ============================================================================

-- Add storage tracking to games table
ALTER TABLE games
ADD COLUMN IF NOT EXISTS total_storage_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_duration_seconds INTEGER DEFAULT 0;

-- Add duration tracking to videos table (if not exists)
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- ============================================================================
-- PART 4: Function to get game storage/duration usage
-- ============================================================================

CREATE OR REPLACE FUNCTION get_game_storage_usage(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_bytes BIGINT;
  v_total_duration INTEGER;
  v_camera_count INTEGER;
  v_team_id UUID;
  v_tier_key TEXT;
  v_limits RECORD;
BEGIN
  -- Get game's team
  SELECT team_id INTO v_team_id
  FROM games
  WHERE id = p_game_id;

  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Game not found');
  END IF;

  -- Get team's tier
  SELECT COALESCE(s.tier, 'basic') INTO v_tier_key
  FROM subscriptions s
  WHERE s.team_id = v_team_id
    AND s.status IN ('active', 'trialing', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Get tier limits
  SELECT
    max_storage_per_game_bytes,
    max_duration_per_game_seconds,
    max_duration_per_camera_seconds,
    max_cameras_per_game
  INTO v_limits
  FROM tier_config
  WHERE tier_key = COALESCE(v_tier_key, 'basic');

  -- Calculate totals from videos
  SELECT
    COALESCE(SUM(file_size_bytes), 0),
    COALESCE(SUM(duration_seconds), 0),
    COUNT(*)
  INTO v_total_bytes, v_total_duration, v_camera_count
  FROM videos
  WHERE game_id = p_game_id;

  RETURN jsonb_build_object(
    'game_id', p_game_id,
    'team_id', v_team_id,
    'tier', COALESCE(v_tier_key, 'basic'),
    'total_storage_bytes', v_total_bytes,
    'total_duration_seconds', v_total_duration,
    'camera_count', v_camera_count,
    'limits', jsonb_build_object(
      'max_storage_bytes', v_limits.max_storage_per_game_bytes,
      'max_duration_seconds', v_limits.max_duration_per_game_seconds,
      'max_duration_per_camera_seconds', v_limits.max_duration_per_camera_seconds,
      'max_cameras', v_limits.max_cameras_per_game
    ),
    'is_storage_exceeded', v_total_bytes > COALESCE(v_limits.max_storage_per_game_bytes, 999999999999),
    'is_duration_exceeded', v_total_duration > COALESCE(v_limits.max_duration_per_game_seconds, 999999)
  );
END;
$$;

-- ============================================================================
-- PART 5: Function to check if upload is allowed for a game
-- ============================================================================

CREATE OR REPLACE FUNCTION check_game_upload_allowed(
  p_game_id UUID,
  p_file_size_bytes BIGINT,
  p_duration_seconds INTEGER DEFAULT NULL,
  p_camera_lane INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usage JSONB;
  v_current_storage BIGINT;
  v_current_duration INTEGER;
  v_camera_duration INTEGER;
  v_max_storage BIGINT;
  v_max_duration INTEGER;
  v_max_camera_duration INTEGER;
  v_max_cameras INTEGER;
  v_camera_count INTEGER;
BEGIN
  -- Get current usage
  v_usage := get_game_storage_usage(p_game_id);

  IF v_usage->>'error' IS NOT NULL THEN
    RETURN v_usage;
  END IF;

  v_current_storage := (v_usage->>'total_storage_bytes')::BIGINT;
  v_current_duration := (v_usage->>'total_duration_seconds')::INTEGER;
  v_camera_count := (v_usage->>'camera_count')::INTEGER;
  v_max_storage := (v_usage->'limits'->>'max_storage_bytes')::BIGINT;
  v_max_duration := (v_usage->'limits'->>'max_duration_seconds')::INTEGER;
  v_max_camera_duration := (v_usage->'limits'->>'max_duration_per_camera_seconds')::INTEGER;
  v_max_cameras := (v_usage->'limits'->>'max_cameras')::INTEGER;

  -- Check storage limit
  IF v_max_storage IS NOT NULL AND (v_current_storage + p_file_size_bytes) > v_max_storage THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'game_storage_exceeded',
      'message', format('This upload would exceed the per-game storage limit of %s. Current usage: %s, this file: %s.',
        pg_size_pretty(v_max_storage),
        pg_size_pretty(v_current_storage),
        pg_size_pretty(p_file_size_bytes)
      ),
      'current_bytes', v_current_storage,
      'file_bytes', p_file_size_bytes,
      'max_bytes', v_max_storage
    );
  END IF;

  -- Check total duration limit (if duration provided)
  IF p_duration_seconds IS NOT NULL AND v_max_duration IS NOT NULL THEN
    IF (v_current_duration + p_duration_seconds) > v_max_duration THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'game_duration_exceeded',
        'message', format('This upload would exceed the per-game duration limit of %s hours. Current: %s, this video: %s.',
          ROUND(v_max_duration / 3600.0, 1),
          format('%s:%02s', v_current_duration / 3600, (v_current_duration % 3600) / 60),
          format('%s:%02s', p_duration_seconds / 3600, (p_duration_seconds % 3600) / 60)
        ),
        'current_seconds', v_current_duration,
        'file_seconds', p_duration_seconds,
        'max_seconds', v_max_duration
      );
    END IF;
  END IF;

  -- Check per-camera duration limit (if camera lane and duration provided)
  IF p_camera_lane IS NOT NULL AND p_duration_seconds IS NOT NULL AND v_max_camera_duration IS NOT NULL THEN
    -- Get current duration for this camera lane
    SELECT COALESCE(SUM(v.duration_seconds), 0) INTO v_camera_duration
    FROM videos v
    LEFT JOIN video_group_members vgm ON v.id = vgm.video_id
    WHERE v.game_id = p_game_id
      AND (
        v.camera_order = p_camera_lane
        OR vgm.camera_lane = p_camera_lane
      );

    IF (v_camera_duration + p_duration_seconds) > v_max_camera_duration THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'camera_duration_exceeded',
        'message', format('This upload would exceed the per-camera duration limit of %s hours for Camera %s. Current: %s, this video: %s.',
          ROUND(v_max_camera_duration / 3600.0, 1),
          p_camera_lane,
          format('%s:%02s', v_camera_duration / 3600, (v_camera_duration % 3600) / 60),
          format('%s:%02s', p_duration_seconds / 3600, (p_duration_seconds % 3600) / 60)
        ),
        'camera_lane', p_camera_lane,
        'current_camera_seconds', v_camera_duration,
        'file_seconds', p_duration_seconds,
        'max_camera_seconds', v_max_camera_duration
      );
    END IF;
  END IF;

  -- All checks passed
  RETURN jsonb_build_object(
    'allowed', true,
    'current_storage_bytes', v_current_storage,
    'current_duration_seconds', v_current_duration,
    'remaining_storage_bytes', GREATEST(COALESCE(v_max_storage, 999999999999) - v_current_storage - p_file_size_bytes, 0),
    'remaining_duration_seconds', GREATEST(COALESCE(v_max_duration, 999999) - v_current_duration - COALESCE(p_duration_seconds, 0), 0)
  );
END;
$$;

-- ============================================================================
-- PART 6: Function to validate video group / timeline clip addition
-- ============================================================================

CREATE OR REPLACE FUNCTION check_timeline_clip_allowed(
  p_game_id UUID,
  p_camera_lane INTEGER,
  p_video_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_video_duration INTEGER;
  v_video_size BIGINT;
  v_team_id UUID;
  v_tier_key TEXT;
  v_max_camera_duration INTEGER;
  v_current_lane_duration INTEGER;
BEGIN
  -- Get video info
  SELECT duration_seconds, file_size_bytes INTO v_video_duration, v_video_size
  FROM videos
  WHERE id = p_video_id;

  IF v_video_duration IS NULL THEN
    -- If duration not known, allow but warn
    RETURN jsonb_build_object(
      'allowed', true,
      'warning', 'Video duration unknown, cannot validate camera limit'
    );
  END IF;

  -- Get game's team
  SELECT team_id INTO v_team_id
  FROM games
  WHERE id = p_game_id;

  -- Get team's tier
  SELECT COALESCE(s.tier, 'basic') INTO v_tier_key
  FROM subscriptions s
  WHERE s.team_id = v_team_id
    AND s.status IN ('active', 'trialing', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Get max duration per camera
  SELECT max_duration_per_camera_seconds INTO v_max_camera_duration
  FROM tier_config
  WHERE tier_key = COALESCE(v_tier_key, 'basic');

  IF v_max_camera_duration IS NULL THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  -- Get current duration for this camera lane (from video_group_members)
  SELECT COALESCE(SUM(v.duration_seconds), 0) INTO v_current_lane_duration
  FROM video_group_members vgm
  JOIN videos v ON v.id = vgm.video_id
  JOIN video_groups vg ON vg.id = vgm.video_group_id
  WHERE vg.game_id = p_game_id
    AND vgm.camera_lane = p_camera_lane
    AND vgm.video_id != p_video_id;  -- Exclude the video being added (in case of re-add)

  -- Check if adding this video would exceed limit
  IF (v_current_lane_duration + v_video_duration) > v_max_camera_duration THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'camera_duration_exceeded',
      'message', format('Adding this clip would exceed the %s-hour limit for Camera %s. Current: %s, this clip: %s.',
        ROUND(v_max_camera_duration / 3600.0, 1),
        p_camera_lane,
        format('%s:%02s', v_current_lane_duration / 3600, (v_current_lane_duration % 3600) / 60),
        format('%s:%02s', v_video_duration / 3600, (v_video_duration % 3600) / 60)
      ),
      'camera_lane', p_camera_lane,
      'current_lane_seconds', v_current_lane_duration,
      'clip_seconds', v_video_duration,
      'max_camera_seconds', v_max_camera_duration
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'camera_lane', p_camera_lane,
    'current_lane_seconds', v_current_lane_duration,
    'clip_seconds', v_video_duration,
    'remaining_seconds', v_max_camera_duration - v_current_lane_duration - v_video_duration
  );
END;
$$;

-- ============================================================================
-- PART 7: Trigger to update game storage totals when videos change
-- ============================================================================

CREATE OR REPLACE FUNCTION update_game_storage_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_game_id UUID;
BEGIN
  -- Determine which game_id to update
  IF TG_OP = 'DELETE' THEN
    v_game_id := OLD.game_id;
  ELSE
    v_game_id := NEW.game_id;
  END IF;

  -- Update game totals
  UPDATE games
  SET
    total_storage_bytes = (
      SELECT COALESCE(SUM(file_size_bytes), 0)
      FROM videos
      WHERE game_id = v_game_id
    ),
    total_duration_seconds = (
      SELECT COALESCE(SUM(duration_seconds), 0)
      FROM videos
      WHERE game_id = v_game_id
    )
  WHERE id = v_game_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS update_game_storage_on_video_change ON videos;
CREATE TRIGGER update_game_storage_on_video_change
  AFTER INSERT OR UPDATE OR DELETE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_game_storage_totals();

-- ============================================================================
-- PART 8: Initialize game storage totals for existing games
-- ============================================================================

UPDATE games g
SET
  total_storage_bytes = (
    SELECT COALESCE(SUM(file_size_bytes), 0)
    FROM videos v
    WHERE v.game_id = g.id
  ),
  total_duration_seconds = (
    SELECT COALESCE(SUM(duration_seconds), 0)
    FROM videos v
    WHERE v.game_id = g.id
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN tier_config.max_storage_per_game_bytes IS 'Maximum total storage allowed per game in bytes';
COMMENT ON COLUMN tier_config.max_duration_per_game_seconds IS 'Maximum total video duration per game in seconds';
COMMENT ON COLUMN tier_config.max_duration_per_camera_seconds IS 'Maximum video duration per camera/lane in seconds';
COMMENT ON COLUMN games.total_storage_bytes IS 'Cached total storage used by videos in this game';
COMMENT ON COLUMN games.total_duration_seconds IS 'Cached total duration of videos in this game';
COMMENT ON FUNCTION get_game_storage_usage IS 'Returns storage and duration usage for a game with tier limits';
COMMENT ON FUNCTION check_game_upload_allowed IS 'Validates if a video upload is allowed based on per-game limits';
COMMENT ON FUNCTION check_timeline_clip_allowed IS 'Validates if adding a clip to a timeline lane is allowed based on per-camera limits';
