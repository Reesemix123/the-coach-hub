-- Fix video moderation trigger: Split BEFORE and AFTER triggers
--
-- Problem: The auto_approve_video() function tried to both:
-- 1. Modify NEW.moderation_status (requires BEFORE INSERT)
-- 2. Insert into video_moderation_log with NEW.id (requires AFTER INSERT - video must exist first)
--
-- Solution: Split into two separate triggers

-- ============================================================================
-- STEP 1: Drop the problematic trigger
-- ============================================================================

DROP TRIGGER IF EXISTS video_auto_moderate ON videos;

-- ============================================================================
-- STEP 2: Create new BEFORE INSERT function (only sets moderation_status)
-- ============================================================================

CREATE OR REPLACE FUNCTION set_video_moderation_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-approve all uploads for now
  -- Change this to 'pending' when ready for manual review
  NEW.moderation_status := 'approved';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Create new AFTER INSERT function (logs the upload)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_video_upload()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the upload to the moderation log
  INSERT INTO video_moderation_log (
    video_id, action, new_status, actor_id, actor_type, ip_address
  ) VALUES (
    NEW.id, 'uploaded', NEW.moderation_status, NEW.uploaded_by, 'system', NEW.upload_ip
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: Create the two triggers (drop first to be idempotent)
-- ============================================================================

DROP TRIGGER IF EXISTS video_set_moderation_status ON videos;
DROP TRIGGER IF EXISTS video_log_upload ON videos;

-- BEFORE INSERT: Set the moderation status
CREATE TRIGGER video_set_moderation_status
  BEFORE INSERT ON videos
  FOR EACH ROW
  EXECUTE FUNCTION set_video_moderation_status();

-- AFTER INSERT: Log the upload (video now exists, FK will work)
CREATE TRIGGER video_log_upload
  AFTER INSERT ON videos
  FOR EACH ROW
  EXECUTE FUNCTION log_video_upload();

-- ============================================================================
-- STEP 5: Keep the old function for backwards compatibility (but unused)
-- ============================================================================

-- Note: Keeping auto_approve_video() in case anything references it,
-- but it's no longer triggered. Can be removed in a future cleanup migration.
