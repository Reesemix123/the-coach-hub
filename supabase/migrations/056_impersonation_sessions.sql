-- Migration 056: Impersonation Sessions for Admin Support
-- Block 12: Organizations Browser - Full impersonation system
--
-- This enables platform admins to "impersonate" organization owners
-- for support and troubleshooting purposes.

-- ============================================================================
-- 1. IMPERSONATION_SESSIONS TABLE
-- Stores active impersonation sessions with token-based authentication
-- ============================================================================

CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Token for session identification (secure random string)
  session_token VARCHAR(64) UNIQUE NOT NULL,

  -- Who is impersonating
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Who is being impersonated
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Organization context (for filtering/logging)
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Reason for impersonation (required for audit)
  reason TEXT NOT NULL,

  -- Session validity
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Session termination
  ended_at TIMESTAMPTZ,
  ended_reason VARCHAR(50) CHECK (ended_reason IN ('expired', 'manual_logout', 'admin_revoked'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_token ON impersonation_sessions(session_token) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin ON impersonation_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target ON impersonation_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_org ON impersonation_sessions(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active ON impersonation_sessions(expires_at) WHERE ended_at IS NULL;

COMMENT ON TABLE impersonation_sessions IS 'Tracks admin impersonation sessions for support and troubleshooting';

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all impersonation sessions
CREATE POLICY "Platform admins can view impersonation_sessions"
  ON impersonation_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Platform admins can create impersonation sessions
CREATE POLICY "Platform admins can create impersonation_sessions"
  ON impersonation_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
    AND admin_user_id = auth.uid()
  );

-- Platform admins can update their own sessions (to end them)
CREATE POLICY "Platform admins can end their impersonation_sessions"
  ON impersonation_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
    AND admin_user_id = auth.uid()
  );

-- ============================================================================
-- 3. HELPER FUNCTIONS
-- ============================================================================

-- Function to create an impersonation session
-- Returns the session token
CREATE OR REPLACE FUNCTION create_impersonation_session(
  p_admin_user_id UUID,
  p_target_user_id UUID,
  p_organization_id UUID,
  p_reason TEXT,
  p_duration_minutes INTEGER DEFAULT 60
)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
  v_is_admin BOOLEAN;
BEGIN
  -- Verify admin is platform admin
  SELECT is_platform_admin INTO v_is_admin
  FROM profiles
  WHERE id = p_admin_user_id;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'User is not a platform admin';
  END IF;

  -- Generate secure token (64 chars hex)
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Create session
  INSERT INTO impersonation_sessions (
    session_token,
    admin_user_id,
    target_user_id,
    organization_id,
    reason,
    expires_at
  ) VALUES (
    v_token,
    p_admin_user_id,
    p_target_user_id,
    p_organization_id,
    p_reason,
    NOW() + (p_duration_minutes || ' minutes')::INTERVAL
  );

  -- Log the impersonation start
  PERFORM log_audit_event(
    p_admin_user_id,
    'impersonation.started',
    'user',
    p_target_user_id,
    NULL,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'reason', p_reason,
      'duration_minutes', p_duration_minutes
    )
  );

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate and get impersonation session
-- Returns the session details if valid
CREATE OR REPLACE FUNCTION validate_impersonation_session(p_token TEXT)
RETURNS TABLE (
  admin_user_id UUID,
  target_user_id UUID,
  organization_id UUID,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.admin_user_id,
    s.target_user_id,
    s.organization_id,
    s.expires_at
  FROM impersonation_sessions s
  WHERE s.session_token = p_token
    AND s.ended_at IS NULL
    AND s.expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end an impersonation session
CREATE OR REPLACE FUNCTION end_impersonation_session(
  p_token TEXT,
  p_reason VARCHAR(50) DEFAULT 'manual_logout'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_session_id UUID;
  v_admin_id UUID;
  v_target_id UUID;
BEGIN
  -- Get session info before ending
  SELECT id, admin_user_id, target_user_id
  INTO v_session_id, v_admin_id, v_target_id
  FROM impersonation_sessions
  WHERE session_token = p_token
    AND ended_at IS NULL;

  IF v_session_id IS NULL THEN
    RETURN false;
  END IF;

  -- End the session
  UPDATE impersonation_sessions
  SET ended_at = NOW(),
      ended_reason = p_reason
  WHERE id = v_session_id;

  -- Log the impersonation end
  PERFORM log_audit_event(
    v_admin_id,
    'impersonation.ended',
    'user',
    v_target_id,
    NULL,
    jsonb_build_object('reason', p_reason)
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired sessions (can be called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_impersonation_sessions()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE impersonation_sessions
    SET ended_at = NOW(),
        ended_reason = 'expired'
    WHERE ended_at IS NULL
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_impersonation_session IS 'Creates a new impersonation session for admin support';
COMMENT ON FUNCTION validate_impersonation_session IS 'Validates an impersonation token and returns session details';
COMMENT ON FUNCTION end_impersonation_session IS 'Ends an active impersonation session';
COMMENT ON FUNCTION cleanup_expired_impersonation_sessions IS 'Marks expired sessions as ended (for scheduled cleanup)';
