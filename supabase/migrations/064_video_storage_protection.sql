-- Migration 064: Video Storage Protection System
-- Purpose: Implement storage quotas, tracking, and rate limiting for video uploads
-- Date: 2024-12-02

-- ============================================================================
-- STORAGE USAGE TABLE
-- Tracks storage consumption per team
-- ============================================================================

CREATE TABLE IF NOT EXISTS storage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Storage metrics
  total_bytes_used BIGINT DEFAULT 0,
  file_count INTEGER DEFAULT 0,

  -- Quota tracking
  quota_bytes BIGINT, -- NULL means use tier default
  quota_exceeded_at TIMESTAMPTZ, -- When quota was first exceeded

  -- Rate limiting
  uploads_this_hour INTEGER DEFAULT 0,
  hour_window_start TIMESTAMPTZ DEFAULT NOW(),

  -- Audit
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id)
);

-- ============================================================================
-- UPLOAD LOGS TABLE
-- Tracks individual uploads for rate limiting and auditing
-- ============================================================================

CREATE TABLE IF NOT EXISTS upload_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- File info
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT,
  storage_path TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'rejected')),
  rejection_reason TEXT, -- 'quota_exceeded', 'rate_limited', 'invalid_type', 'file_too_large'

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_storage_usage_team ON storage_usage(team_id);
CREATE INDEX idx_upload_logs_team ON upload_logs(team_id);
CREATE INDEX idx_upload_logs_user ON upload_logs(user_id);
CREATE INDEX idx_upload_logs_status ON upload_logs(team_id, status, created_at);
CREATE INDEX idx_upload_logs_recent ON upload_logs(team_id, created_at DESC);

-- ============================================================================
-- PLATFORM CONFIG: Storage Limits
-- ============================================================================

INSERT INTO platform_config (key, value, description)
VALUES (
  'storage_limits',
  '{
    "max_file_size_bytes": 2147483648,
    "max_uploads_per_hour": 20,
    "allowed_mime_types": ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo", "video/avi", "video/x-m4v", "video/mpeg"],
    "allowed_extensions": [".mp4", ".mov", ".webm", ".avi", ".m4v", ".mpeg", ".mpg"],
    "tier_quotas": {
      "free": 10737418240,
      "little_league": 10737418240,
      "hs_basic": 53687091200,
      "hs_advanced": 214748364800,
      "ai_powered": 536870912000
    },
    "default_quota_bytes": 10737418240,
    "enforce_quotas": true,
    "enforce_rate_limits": true
  }',
  'Video storage limits. Tier quotas in bytes: free/little_league=10GB, hs_basic=50GB, hs_advanced=200GB, ai_powered=500GB. Max file=2GB.'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================================
-- FUNCTION: Get Storage Quota for Team
-- Returns the storage quota in bytes based on subscription tier
-- ============================================================================

CREATE OR REPLACE FUNCTION get_team_storage_quota(p_team_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config JSONB;
  v_tier TEXT;
  v_custom_quota BIGINT;
  v_quota BIGINT;
BEGIN
  -- Check for custom quota override
  SELECT quota_bytes INTO v_custom_quota
  FROM storage_usage
  WHERE team_id = p_team_id;

  IF v_custom_quota IS NOT NULL THEN
    RETURN v_custom_quota;
  END IF;

  -- Get storage config
  SELECT value INTO v_config
  FROM platform_config
  WHERE key = 'storage_limits';

  IF v_config IS NULL THEN
    RETURN 10737418240; -- 10GB default fallback
  END IF;

  -- Get team's subscription tier
  SELECT COALESCE(s.tier, 'free') INTO v_tier
  FROM subscriptions s
  WHERE s.team_id = p_team_id
    AND s.status IN ('active', 'trialing')
  ORDER BY
    CASE s.tier
      WHEN 'ai_powered' THEN 5
      WHEN 'hs_advanced' THEN 4
      WHEN 'hs_basic' THEN 3
      WHEN 'little_league' THEN 2
      ELSE 1
    END DESC
  LIMIT 1;

  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;

  -- Get tier-specific quota
  v_quota := (v_config->'tier_quotas'->>v_tier)::BIGINT;

  -- Fallback to default
  IF v_quota IS NULL THEN
    v_quota := (v_config->>'default_quota_bytes')::BIGINT;
  END IF;

  RETURN COALESCE(v_quota, 10737418240);
END;
$$;

-- ============================================================================
-- FUNCTION: Get Storage Usage for Team
-- Returns current storage usage and quota info
-- ============================================================================

CREATE OR REPLACE FUNCTION get_team_storage_usage(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usage RECORD;
  v_quota BIGINT;
  v_config JSONB;
BEGIN
  -- Get storage config
  SELECT value INTO v_config
  FROM platform_config
  WHERE key = 'storage_limits';

  -- Get or create usage record
  INSERT INTO storage_usage (team_id, total_bytes_used, file_count)
  VALUES (p_team_id, 0, 0)
  ON CONFLICT (team_id) DO NOTHING;

  SELECT * INTO v_usage
  FROM storage_usage
  WHERE team_id = p_team_id;

  v_quota := get_team_storage_quota(p_team_id);

  RETURN jsonb_build_object(
    'team_id', p_team_id,
    'total_bytes_used', v_usage.total_bytes_used,
    'file_count', v_usage.file_count,
    'quota_bytes', v_quota,
    'quota_used_percent', ROUND((v_usage.total_bytes_used::NUMERIC / NULLIF(v_quota, 0)) * 100, 2),
    'bytes_remaining', GREATEST(v_quota - v_usage.total_bytes_used, 0),
    'is_quota_exceeded', v_usage.total_bytes_used >= v_quota,
    'quota_exceeded_at', v_usage.quota_exceeded_at,
    'uploads_this_hour', v_usage.uploads_this_hour,
    'max_uploads_per_hour', COALESCE((v_config->>'max_uploads_per_hour')::INTEGER, 20),
    'max_file_size_bytes', COALESCE((v_config->>'max_file_size_bytes')::BIGINT, 2147483648),
    'last_updated', v_usage.last_updated
  );
END;
$$;

-- ============================================================================
-- FUNCTION: Check Upload Allowed
-- Validates if an upload can proceed (quota, rate limit, file type, size)
-- ============================================================================

CREATE OR REPLACE FUNCTION check_upload_allowed(
  p_team_id UUID,
  p_file_size_bytes BIGINT,
  p_mime_type TEXT DEFAULT NULL,
  p_file_extension TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config JSONB;
  v_usage RECORD;
  v_quota BIGINT;
  v_max_file_size BIGINT;
  v_max_uploads_per_hour INTEGER;
  v_allowed_mime_types JSONB;
  v_allowed_extensions JSONB;
  v_enforce_quotas BOOLEAN;
  v_enforce_rate_limits BOOLEAN;
BEGIN
  -- Get storage config
  SELECT value INTO v_config
  FROM platform_config
  WHERE key = 'storage_limits';

  IF v_config IS NULL THEN
    -- No config, allow with defaults
    RETURN jsonb_build_object('allowed', true);
  END IF;

  v_enforce_quotas := COALESCE((v_config->>'enforce_quotas')::BOOLEAN, true);
  v_enforce_rate_limits := COALESCE((v_config->>'enforce_rate_limits')::BOOLEAN, true);
  v_max_file_size := COALESCE((v_config->>'max_file_size_bytes')::BIGINT, 2147483648);
  v_max_uploads_per_hour := COALESCE((v_config->>'max_uploads_per_hour')::INTEGER, 20);
  v_allowed_mime_types := v_config->'allowed_mime_types';
  v_allowed_extensions := v_config->'allowed_extensions';

  -- Get or create usage record
  INSERT INTO storage_usage (team_id, total_bytes_used, file_count)
  VALUES (p_team_id, 0, 0)
  ON CONFLICT (team_id) DO NOTHING;

  SELECT * INTO v_usage
  FROM storage_usage
  WHERE team_id = p_team_id;

  -- Reset hourly counter if window expired
  IF v_usage.hour_window_start < NOW() - INTERVAL '1 hour' THEN
    UPDATE storage_usage
    SET uploads_this_hour = 0, hour_window_start = NOW()
    WHERE team_id = p_team_id;
    v_usage.uploads_this_hour := 0;
  END IF;

  v_quota := get_team_storage_quota(p_team_id);

  -- CHECK 1: File size limit
  IF p_file_size_bytes > v_max_file_size THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'file_too_large',
      'message', 'File exceeds maximum size of ' || (v_max_file_size / 1073741824) || 'GB',
      'max_size_bytes', v_max_file_size,
      'file_size_bytes', p_file_size_bytes
    );
  END IF;

  -- CHECK 2: MIME type validation
  IF p_mime_type IS NOT NULL AND v_allowed_mime_types IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_allowed_mime_types) AS t
      WHERE LOWER(t) = LOWER(p_mime_type)
    ) THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'invalid_type',
        'message', 'File type not allowed. Allowed types: mp4, mov, webm, avi',
        'mime_type', p_mime_type,
        'allowed_types', v_allowed_mime_types
      );
    END IF;
  END IF;

  -- CHECK 3: File extension validation
  IF p_file_extension IS NOT NULL AND v_allowed_extensions IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(v_allowed_extensions) AS t
      WHERE LOWER(t) = LOWER(p_file_extension)
    ) THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'invalid_extension',
        'message', 'File extension not allowed. Allowed: mp4, mov, webm, avi',
        'extension', p_file_extension,
        'allowed_extensions', v_allowed_extensions
      );
    END IF;
  END IF;

  -- CHECK 4: Storage quota
  IF v_enforce_quotas AND (v_usage.total_bytes_used + p_file_size_bytes) > v_quota THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'quota_exceeded',
      'message', 'Storage quota would be exceeded. Please delete some videos or upgrade your plan.',
      'quota_bytes', v_quota,
      'used_bytes', v_usage.total_bytes_used,
      'file_size_bytes', p_file_size_bytes,
      'would_use_bytes', v_usage.total_bytes_used + p_file_size_bytes
    );
  END IF;

  -- CHECK 5: Rate limiting
  IF v_enforce_rate_limits AND v_usage.uploads_this_hour >= v_max_uploads_per_hour THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'message', 'Upload limit reached. Please wait before uploading more videos.',
      'uploads_this_hour', v_usage.uploads_this_hour,
      'max_uploads_per_hour', v_max_uploads_per_hour,
      'window_resets_at', v_usage.hour_window_start + INTERVAL '1 hour'
    );
  END IF;

  -- All checks passed
  RETURN jsonb_build_object(
    'allowed', true,
    'quota_bytes', v_quota,
    'used_bytes', v_usage.total_bytes_used,
    'remaining_bytes', v_quota - v_usage.total_bytes_used,
    'uploads_this_hour', v_usage.uploads_this_hour,
    'max_uploads_per_hour', v_max_uploads_per_hour
  );
END;
$$;

-- ============================================================================
-- FUNCTION: Record Upload Start
-- Called when upload begins, increments rate limit counter
-- ============================================================================

CREATE OR REPLACE FUNCTION record_upload_start(
  p_team_id UUID,
  p_user_id UUID,
  p_file_name TEXT,
  p_file_size_bytes BIGINT,
  p_mime_type TEXT DEFAULT NULL,
  p_storage_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Reset hourly counter if needed
  UPDATE storage_usage
  SET
    uploads_this_hour = CASE
      WHEN hour_window_start < NOW() - INTERVAL '1 hour' THEN 1
      ELSE uploads_this_hour + 1
    END,
    hour_window_start = CASE
      WHEN hour_window_start < NOW() - INTERVAL '1 hour' THEN NOW()
      ELSE hour_window_start
    END,
    last_updated = NOW()
  WHERE team_id = p_team_id;

  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO storage_usage (team_id, uploads_this_hour, hour_window_start)
    VALUES (p_team_id, 1, NOW());
  END IF;

  -- Create upload log
  INSERT INTO upload_logs (team_id, user_id, file_name, file_size_bytes, mime_type, storage_path, status)
  VALUES (p_team_id, p_user_id, p_file_name, p_file_size_bytes, p_mime_type, p_storage_path, 'pending')
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============================================================================
-- FUNCTION: Record Upload Complete
-- Called when upload finishes, updates storage usage
-- ============================================================================

CREATE OR REPLACE FUNCTION record_upload_complete(
  p_log_id UUID,
  p_storage_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log RECORD;
  v_quota BIGINT;
BEGIN
  -- Get the upload log
  SELECT * INTO v_log
  FROM upload_logs
  WHERE id = p_log_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Upload log not found');
  END IF;

  -- Update the log
  UPDATE upload_logs
  SET
    status = 'completed',
    storage_path = COALESCE(p_storage_path, storage_path),
    completed_at = NOW()
  WHERE id = p_log_id;

  -- Update storage usage
  UPDATE storage_usage
  SET
    total_bytes_used = total_bytes_used + v_log.file_size_bytes,
    file_count = file_count + 1,
    last_updated = NOW()
  WHERE team_id = v_log.team_id;

  -- Check if quota is now exceeded
  v_quota := get_team_storage_quota(v_log.team_id);

  UPDATE storage_usage
  SET quota_exceeded_at = CASE
    WHEN total_bytes_used >= v_quota AND quota_exceeded_at IS NULL THEN NOW()
    WHEN total_bytes_used < v_quota THEN NULL
    ELSE quota_exceeded_at
  END
  WHERE team_id = v_log.team_id;

  RETURN jsonb_build_object(
    'success', true,
    'bytes_added', v_log.file_size_bytes
  );
END;
$$;

-- ============================================================================
-- FUNCTION: Record Upload Failed/Rejected
-- Called when upload fails or is rejected
-- ============================================================================

CREATE OR REPLACE FUNCTION record_upload_failed(
  p_log_id UUID,
  p_reason TEXT DEFAULT 'failed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE upload_logs
  SET
    status = CASE WHEN p_reason IN ('quota_exceeded', 'rate_limited', 'invalid_type', 'file_too_large') THEN 'rejected' ELSE 'failed' END,
    rejection_reason = p_reason,
    completed_at = NOW()
  WHERE id = p_log_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Upload log not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- FUNCTION: Record File Deletion
-- Called when a video is deleted, updates storage usage
-- ============================================================================

CREATE OR REPLACE FUNCTION record_file_deletion(
  p_team_id UUID,
  p_file_size_bytes BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quota BIGINT;
BEGIN
  UPDATE storage_usage
  SET
    total_bytes_used = GREATEST(total_bytes_used - p_file_size_bytes, 0),
    file_count = GREATEST(file_count - 1, 0),
    last_updated = NOW()
  WHERE team_id = p_team_id;

  -- Clear quota exceeded flag if now under quota
  v_quota := get_team_storage_quota(p_team_id);

  UPDATE storage_usage
  SET quota_exceeded_at = NULL
  WHERE team_id = p_team_id
    AND total_bytes_used < v_quota;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- FUNCTION: Recalculate Team Storage
-- Recalculates storage from actual video files (for sync/repair)
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_team_storage(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_bytes BIGINT;
  v_file_count INTEGER;
  v_quota BIGINT;
BEGIN
  -- This would ideally query the actual storage bucket
  -- For now, we'll count completed uploads
  SELECT
    COALESCE(SUM(file_size_bytes), 0),
    COUNT(*)
  INTO v_total_bytes, v_file_count
  FROM upload_logs
  WHERE team_id = p_team_id
    AND status = 'completed';

  -- Update storage usage
  INSERT INTO storage_usage (team_id, total_bytes_used, file_count, last_updated)
  VALUES (p_team_id, v_total_bytes, v_file_count, NOW())
  ON CONFLICT (team_id) DO UPDATE SET
    total_bytes_used = v_total_bytes,
    file_count = v_file_count,
    last_updated = NOW();

  v_quota := get_team_storage_quota(p_team_id);

  RETURN jsonb_build_object(
    'success', true,
    'total_bytes', v_total_bytes,
    'file_count', v_file_count,
    'quota_bytes', v_quota,
    'is_over_quota', v_total_bytes > v_quota
  );
END;
$$;

-- ============================================================================
-- FUNCTION: Get Upload Statistics
-- Returns upload stats for admin dashboard
-- ============================================================================

CREATE OR REPLACE FUNCTION get_upload_statistics(
  p_team_id UUID DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_uploads', COUNT(*),
    'completed_uploads', COUNT(*) FILTER (WHERE status = 'completed'),
    'failed_uploads', COUNT(*) FILTER (WHERE status = 'failed'),
    'rejected_uploads', COUNT(*) FILTER (WHERE status = 'rejected'),
    'total_bytes_uploaded', COALESCE(SUM(file_size_bytes) FILTER (WHERE status = 'completed'), 0),
    'rejections_by_reason', jsonb_build_object(
      'quota_exceeded', COUNT(*) FILTER (WHERE rejection_reason = 'quota_exceeded'),
      'rate_limited', COUNT(*) FILTER (WHERE rejection_reason = 'rate_limited'),
      'invalid_type', COUNT(*) FILTER (WHERE rejection_reason = 'invalid_type'),
      'file_too_large', COUNT(*) FILTER (WHERE rejection_reason = 'file_too_large')
    )
  ) INTO v_stats
  FROM upload_logs
  WHERE created_at > NOW() - (p_days || ' days')::INTERVAL
    AND (p_team_id IS NULL OR team_id = p_team_id);

  RETURN v_stats;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_logs ENABLE ROW LEVEL SECURITY;

-- Storage usage: Users can view their team's usage
CREATE POLICY "Users can view own team storage usage"
  ON storage_usage FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = storage_usage.team_id AND teams.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = storage_usage.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
  );

-- Upload logs: Users can view their team's logs
CREATE POLICY "Users can view own team upload logs"
  ON upload_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = upload_logs.team_id AND teams.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = upload_logs.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
  );

-- Upload logs: Users can insert for their teams
CREATE POLICY "Users can create upload logs for their teams"
  ON upload_logs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
      OR
      EXISTS (
        SELECT 1 FROM team_memberships
        WHERE team_memberships.team_id = upload_logs.team_id
        AND team_memberships.user_id = auth.uid()
        AND team_memberships.is_active = true
      )
    )
  );

-- ============================================================================
-- TRIGGER: Auto-track video deletions
-- Updates storage when videos are deleted
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_video_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_id UUID;
  v_file_size BIGINT;
BEGIN
  -- Get team_id from the game
  SELECT g.team_id INTO v_team_id
  FROM games g
  WHERE g.id = OLD.game_id;

  IF v_team_id IS NOT NULL THEN
    -- Try to get file size from upload logs
    SELECT file_size_bytes INTO v_file_size
    FROM upload_logs
    WHERE storage_path = OLD.file_path
      AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1;

    -- If found, update storage usage
    IF v_file_size IS NOT NULL THEN
      PERFORM record_file_deletion(v_team_id, v_file_size);
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

-- Only create trigger if videos table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'videos') THEN
    DROP TRIGGER IF EXISTS on_video_delete ON videos;
    CREATE TRIGGER on_video_delete
      BEFORE DELETE ON videos
      FOR EACH ROW
      EXECUTE FUNCTION handle_video_deletion();
  END IF;
END $$;

-- ============================================================================
-- INITIALIZE: Create storage_usage records for existing teams
-- ============================================================================

INSERT INTO storage_usage (team_id, total_bytes_used, file_count)
SELECT id, 0, 0
FROM teams
WHERE id NOT IN (SELECT team_id FROM storage_usage)
ON CONFLICT (team_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE storage_usage IS 'Tracks video storage consumption per team with quota enforcement';
COMMENT ON TABLE upload_logs IS 'Audit log of all upload attempts for rate limiting and debugging';
COMMENT ON FUNCTION check_upload_allowed IS 'Validates upload against quota, rate limits, and file type restrictions';
COMMENT ON FUNCTION get_team_storage_usage IS 'Returns current storage usage and quota info for a team';
COMMENT ON FUNCTION get_team_storage_quota IS 'Returns storage quota in bytes based on team subscription tier';
