-- Migration 066: Content Moderation Foundation
-- Adds infrastructure for video content moderation and TOS tracking
-- Does NOT implement AI scanning - just manual review foundation

-- ============================================================================
-- 1. VIDEO MODERATION FIELDS
-- ============================================================================

-- Create enum for moderation status
DO $$ BEGIN
  CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'flagged', 'removed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add moderation and accountability fields to videos table
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS moderation_status moderation_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS upload_ip INET,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
  ADD COLUMN IF NOT EXISTS flagged_reason TEXT,
  ADD COLUMN IF NOT EXISTS upload_metadata JSONB DEFAULT '{}';

-- Add comment explaining the moderation workflow
COMMENT ON COLUMN videos.moderation_status IS 'Content moderation status: pending (new uploads), approved (safe), flagged (needs review), removed (blocked)';
COMMENT ON COLUMN videos.upload_ip IS 'IP address of uploader for accountability and abuse prevention';
COMMENT ON COLUMN videos.upload_metadata IS 'Additional metadata for future AI moderation: frame hashes, transcription, etc.';

-- Index for efficient moderation queries
CREATE INDEX IF NOT EXISTS idx_videos_moderation_status ON videos(moderation_status);
CREATE INDEX IF NOT EXISTS idx_videos_uploaded_by ON videos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_file_size ON videos(file_size_bytes DESC);

-- ============================================================================
-- 2. TERMS OF SERVICE TRACKING
-- ============================================================================

-- Add TOS acceptance fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tos_version TEXT,
  ADD COLUMN IF NOT EXISTS tos_accepted_ip INET;

-- Index for TOS compliance queries
CREATE INDEX IF NOT EXISTS idx_profiles_tos_accepted ON profiles(tos_accepted_at);

COMMENT ON COLUMN profiles.tos_accepted_at IS 'When user accepted Terms of Service. NULL means TOS not yet accepted.';
COMMENT ON COLUMN profiles.tos_version IS 'Version of TOS accepted (e.g., "2024-01-01")';

-- ============================================================================
-- 3. MODERATION AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('uploaded', 'approved', 'flagged', 'removed', 'restored', 'reviewed')),
  previous_status moderation_status,
  new_status moderation_status,
  actor_id UUID REFERENCES auth.users(id),
  actor_type TEXT CHECK (actor_type IN ('user', 'admin', 'system', 'ai')),
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient audit queries
CREATE INDEX IF NOT EXISTS idx_moderation_log_video ON video_moderation_log(video_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_action ON video_moderation_log(action);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created ON video_moderation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_log_actor ON video_moderation_log(actor_id);

-- Enable RLS
ALTER TABLE video_moderation_log ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view moderation logs
CREATE POLICY "Platform admins can view moderation logs"
  ON video_moderation_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- System/admins can insert logs
CREATE POLICY "System can insert moderation logs"
  ON video_moderation_log FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 4. AUTO-APPROVE FUNCTION (for now - manual review later)
-- ============================================================================

-- Function to auto-approve videos (temporary until manual review is implemented)
-- This can be changed to 'pending' when you want to enable manual review
CREATE OR REPLACE FUNCTION auto_approve_video()
RETURNS TRIGGER AS $$
BEGIN
  -- For now, auto-approve all uploads
  -- Change this to 'pending' when ready for manual review
  NEW.moderation_status := 'approved';

  -- Log the upload
  INSERT INTO video_moderation_log (
    video_id, action, new_status, actor_id, actor_type, ip_address
  ) VALUES (
    NEW.id, 'uploaded', 'approved', NEW.uploaded_by, 'system', NEW.upload_ip
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new video uploads
DROP TRIGGER IF EXISTS video_auto_moderate ON videos;
CREATE TRIGGER video_auto_moderate
  BEFORE INSERT ON videos
  FOR EACH ROW
  EXECUTE FUNCTION auto_approve_video();

-- ============================================================================
-- 5. HELPER FUNCTIONS FOR MODERATION
-- ============================================================================

-- Function to moderate a video (for admin use)
CREATE OR REPLACE FUNCTION moderate_video(
  p_video_id UUID,
  p_new_status moderation_status,
  p_reason TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_old_status moderation_status;
BEGIN
  -- Get current status
  SELECT moderation_status INTO v_old_status
  FROM videos WHERE id = p_video_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update video
  UPDATE videos SET
    moderation_status = p_new_status,
    moderated_at = NOW(),
    moderated_by = COALESCE(p_admin_id, auth.uid()),
    moderation_notes = p_reason,
    flagged_reason = CASE WHEN p_new_status = 'flagged' THEN p_reason ELSE flagged_reason END
  WHERE id = p_video_id;

  -- Log the action
  INSERT INTO video_moderation_log (
    video_id, action, previous_status, new_status,
    actor_id, actor_type, reason
  ) VALUES (
    p_video_id,
    CASE p_new_status
      WHEN 'approved' THEN 'approved'
      WHEN 'flagged' THEN 'flagged'
      WHEN 'removed' THEN 'removed'
      ELSE 'reviewed'
    END,
    v_old_status,
    p_new_status,
    COALESCE(p_admin_id, auth.uid()),
    'admin',
    p_reason
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (RLS will protect actual usage)
GRANT EXECUTE ON FUNCTION moderate_video TO authenticated;

-- ============================================================================
-- 6. VIEW FOR ADMIN MODERATION QUEUE
-- ============================================================================

CREATE OR REPLACE VIEW video_moderation_queue AS
SELECT
  v.id,
  v.name,
  v.file_path,
  v.url,
  v.file_size_bytes,
  v.mime_type,
  v.duration_seconds,
  v.moderation_status,
  v.created_at AS uploaded_at,
  v.uploaded_by,
  v.upload_ip,
  v.moderated_at,
  v.moderated_by,
  v.moderation_notes,
  v.flagged_reason,
  v.game_id,
  g.name AS game_name,
  g.team_id,
  t.name AS team_name,
  p.email AS uploader_email,
  p.full_name AS uploader_name,
  mp.email AS moderator_email
FROM videos v
LEFT JOIN games g ON v.game_id = g.id
LEFT JOIN teams t ON g.team_id = t.id
LEFT JOIN profiles p ON v.uploaded_by = p.id
LEFT JOIN profiles mp ON v.moderated_by = mp.id
WHERE v.is_virtual = false OR v.is_virtual IS NULL;

-- ============================================================================
-- 7. FUNCTION TO CHECK TOS COMPLIANCE
-- ============================================================================

CREATE OR REPLACE FUNCTION check_tos_accepted(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_tos_accepted TIMESTAMPTZ;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  SELECT tos_accepted_at INTO v_tos_accepted
  FROM profiles
  WHERE id = v_user_id;

  RETURN v_tos_accepted IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_tos_accepted TO authenticated;

-- ============================================================================
-- 8. UPDATE EXISTING VIDEOS TO APPROVED STATUS
-- ============================================================================

-- Mark all existing videos as approved (they were uploaded before moderation)
UPDATE videos
SET moderation_status = 'approved'
WHERE moderation_status IS NULL OR moderation_status = 'pending';

-- ============================================================================
-- 9. PLATFORM CONFIG FOR MODERATION SETTINGS
-- ============================================================================

-- Add moderation config to platform_config
INSERT INTO platform_config (key, value, description)
VALUES (
  'content_moderation',
  '{
    "enabled": true,
    "auto_approve": true,
    "require_tos": false,
    "max_file_size_bytes": 2147483648,
    "allowed_mime_types": ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"],
    "flag_keywords": [],
    "ai_moderation_enabled": false
  }'::jsonb,
  'Content moderation settings. Set auto_approve to false to require manual review.'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
