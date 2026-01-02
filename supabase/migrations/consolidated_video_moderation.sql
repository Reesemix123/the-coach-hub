-- Consolidated Migration: Video Virtual Videos + Content Moderation
-- Combines migrations 017 and 066 for easy deployment
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS patterns)

-- ============================================================================
-- PART 1: VIRTUAL VIDEOS (from migration 017)
-- ============================================================================

-- Add columns to videos table for virtual/combined videos
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_video_ids UUID[],
  ADD COLUMN IF NOT EXISTS virtual_name TEXT,
  ADD COLUMN IF NOT EXISTS video_count INTEGER DEFAULT 1;

-- Note: video_group_id column requires video_groups table to exist
-- Only add if video_groups table exists (from migration 016)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_groups') THEN
    ALTER TABLE videos ADD COLUMN IF NOT EXISTS video_group_id UUID REFERENCES video_groups(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add indexes for virtual videos queries
CREATE INDEX IF NOT EXISTS idx_videos_is_virtual ON videos(is_virtual);
CREATE INDEX IF NOT EXISTS idx_videos_game_id_is_virtual ON videos(game_id, is_virtual);

-- Update existing videos to have video_count = 1
UPDATE videos SET video_count = 1 WHERE video_count IS NULL;

-- Add comments
COMMENT ON COLUMN videos.is_virtual IS 'True if this is a virtual/combined video made from multiple source videos';
COMMENT ON COLUMN videos.source_video_ids IS 'Array of video IDs that make up this virtual video (only populated if is_virtual=true)';
COMMENT ON COLUMN videos.virtual_name IS 'Display name for virtual videos (e.g., "Full Game", "First Half")';
COMMENT ON COLUMN videos.video_count IS 'Number of source videos (1 for regular videos, N for virtual videos)';

-- ============================================================================
-- PART 2: CONTENT MODERATION (from migration 066)
-- ============================================================================

-- Create enum for moderation status (safe creation)
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

-- Add comments for moderation columns
COMMENT ON COLUMN videos.moderation_status IS 'Content moderation status: pending (new uploads), approved (safe), flagged (needs review), removed (blocked)';
COMMENT ON COLUMN videos.upload_ip IS 'IP address of uploader for accountability and abuse prevention';
COMMENT ON COLUMN videos.upload_metadata IS 'Additional metadata for future AI moderation: frame hashes, transcription, etc.';

-- Indexes for efficient moderation queries
CREATE INDEX IF NOT EXISTS idx_videos_moderation_status ON videos(moderation_status);
CREATE INDEX IF NOT EXISTS idx_videos_uploaded_by ON videos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_file_size ON videos(file_size_bytes DESC);

-- ============================================================================
-- PART 3: TOS TRACKING (only if profiles table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS tos_version TEXT,
      ADD COLUMN IF NOT EXISTS tos_accepted_ip INET;

    CREATE INDEX IF NOT EXISTS idx_profiles_tos_accepted ON profiles(tos_accepted_at);
  END IF;
END $$;

-- ============================================================================
-- PART 4: MODERATION AUDIT LOG
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

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_moderation_log_video ON video_moderation_log(video_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_action ON video_moderation_log(action);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created ON video_moderation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_log_actor ON video_moderation_log(actor_id);

-- Enable RLS on moderation log
ALTER TABLE video_moderation_log ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view moderation logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'video_moderation_log' AND policyname = 'Platform admins can view moderation logs'
  ) THEN
    CREATE POLICY "Platform admins can view moderation logs"
      ON video_moderation_log FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_platform_admin = true
        )
      );
  END IF;
END $$;

-- System/admins can insert logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'video_moderation_log' AND policyname = 'System can insert moderation logs'
  ) THEN
    CREATE POLICY "System can insert moderation logs"
      ON video_moderation_log FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- PART 5: AUTO-APPROVE FUNCTION
-- ============================================================================

-- Function to auto-approve videos (temporary until manual review is implemented)
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
-- PART 6: HELPER FUNCTIONS
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION moderate_video TO authenticated;

-- Function to check TOS compliance
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
-- PART 7: VIEW FOR ADMIN MODERATION QUEUE
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
-- PART 8: MARK EXISTING VIDEOS AS APPROVED
-- ============================================================================

-- Mark all existing videos as approved (they were uploaded before moderation)
UPDATE videos
SET moderation_status = 'approved'
WHERE moderation_status IS NULL OR moderation_status = 'pending';

-- ============================================================================
-- PART 9: PLATFORM CONFIG FOR MODERATION (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_config') THEN
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
  END IF;
END $$;

-- ============================================================================
-- DONE!
-- ============================================================================
-- This migration adds:
-- 1. Virtual video support (is_virtual, source_video_ids, virtual_name, video_count)
-- 2. Content moderation (moderation_status, uploaded_by, upload_ip, etc.)
-- 3. TOS tracking on profiles
-- 4. Moderation audit log table
-- 5. Auto-approve trigger for new uploads
-- 6. Helper functions for moderation
-- 7. Admin moderation queue view
-- 8. Platform config for moderation settings
