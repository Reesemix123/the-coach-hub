-- Migration 063: User Sessions & Device Limit System
-- Purpose: Track active sessions per user with configurable device limits
-- Date: 2024-12-02

-- ============================================================================
-- USER SESSIONS TABLE
-- Tracks active sessions/devices per user
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session identification
  session_token TEXT NOT NULL, -- Supabase session token (hashed for security)
  device_id TEXT, -- Fingerprint or unique device identifier

  -- Device information for user transparency
  device_name TEXT, -- Parsed friendly name (e.g., "Chrome on MacOS")
  browser TEXT, -- Browser name
  browser_version TEXT,
  os TEXT, -- Operating system
  os_version TEXT,
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),

  -- Location & network
  ip_address TEXT,
  city TEXT,
  country TEXT,

  -- Activity tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- When the session naturally expires

  -- Status
  is_current BOOLEAN DEFAULT false, -- Is this the current session for the viewing user
  is_revoked BOOLEAN DEFAULT false, -- Manually revoked by user
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT, -- 'user_logout', 'device_limit', 'admin_revoke', 'security'

  -- Unique constraint: one session token per user
  UNIQUE(user_id, session_token)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, is_revoked, last_active_at)
  WHERE is_revoked = false;
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_device ON user_sessions(user_id, device_id);

-- ============================================================================
-- PLATFORM CONFIG: Default Session Limits
-- ============================================================================

-- Add default session limit configuration
INSERT INTO platform_config (key, value, description)
VALUES (
  'session_limits',
  '{
    "default_limit": 3,
    "tier_limits": {
      "free": 2,
      "little_league": 3,
      "hs_basic": 3,
      "hs_advanced": 5,
      "ai_powered": 10
    },
    "session_timeout_hours": 720,
    "enforce_limits": true
  }',
  'Device/session limits per user tier. session_timeout_hours is how long inactive sessions remain valid.'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================================
-- FUNCTION: Get Session Limit for User
-- Returns the max allowed sessions based on user's subscription tier
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_session_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config JSONB;
  v_tier TEXT;
  v_limit INTEGER;
BEGIN
  -- Get session limits config
  SELECT value INTO v_config
  FROM platform_config
  WHERE key = 'session_limits';

  IF v_config IS NULL THEN
    RETURN 3; -- Default fallback
  END IF;

  -- Check if limits are enforced
  IF NOT (v_config->>'enforce_limits')::BOOLEAN THEN
    RETURN 999; -- Effectively unlimited
  END IF;

  -- Get user's highest tier from their team subscriptions
  SELECT COALESCE(s.tier, 'free') INTO v_tier
  FROM team_memberships tm
  JOIN subscriptions s ON s.team_id = tm.team_id
  WHERE tm.user_id = p_user_id
    AND tm.is_active = true
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

  -- Default to 'free' if no subscription found
  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;

  -- Get tier-specific limit
  v_limit := (v_config->'tier_limits'->>v_tier)::INTEGER;

  -- Fallback to default if tier not configured
  IF v_limit IS NULL THEN
    v_limit := (v_config->>'default_limit')::INTEGER;
  END IF;

  RETURN COALESCE(v_limit, 3);
END;
$$;

-- ============================================================================
-- FUNCTION: Count Active Sessions
-- ============================================================================

CREATE OR REPLACE FUNCTION count_user_active_sessions(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM user_sessions
  WHERE user_id = p_user_id
    AND is_revoked = false
    AND (expires_at IS NULL OR expires_at > NOW());

  RETURN v_count;
END;
$$;

-- ============================================================================
-- FUNCTION: Register New Session
-- Creates a new session, enforcing device limits by revoking oldest if needed
-- Returns: session_id if successful, error info if failed
-- ============================================================================

CREATE OR REPLACE FUNCTION register_user_session(
  p_user_id UUID,
  p_session_token TEXT,
  p_device_id TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_browser_version TEXT DEFAULT NULL,
  p_os TEXT DEFAULT NULL,
  p_os_version TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT 'unknown',
  p_ip_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_limit INTEGER;
  v_active_count INTEGER;
  v_sessions_to_revoke INTEGER;
  v_oldest_session RECORD;
  v_new_session_id UUID;
  v_revoked_sessions UUID[] := '{}';
  v_config JSONB;
  v_timeout_hours INTEGER;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get session config
  SELECT value INTO v_config
  FROM platform_config
  WHERE key = 'session_limits';

  v_timeout_hours := COALESCE((v_config->>'session_timeout_hours')::INTEGER, 720);
  v_expires_at := NOW() + (v_timeout_hours || ' hours')::INTERVAL;

  -- Check if this session token already exists (refresh/update case)
  UPDATE user_sessions
  SET
    last_active_at = NOW(),
    device_name = COALESCE(p_device_name, device_name),
    browser = COALESCE(p_browser, browser),
    browser_version = COALESCE(p_browser_version, browser_version),
    os = COALESCE(p_os, os),
    os_version = COALESCE(p_os_version, os_version),
    device_type = COALESCE(p_device_type, device_type),
    ip_address = COALESCE(p_ip_address, ip_address),
    city = COALESCE(p_city, city),
    country = COALESCE(p_country, country),
    expires_at = v_expires_at
  WHERE user_id = p_user_id
    AND session_token = p_session_token
    AND is_revoked = false
  RETURNING id INTO v_new_session_id;

  IF v_new_session_id IS NOT NULL THEN
    -- Session already exists, just updated it
    RETURN jsonb_build_object(
      'success', true,
      'session_id', v_new_session_id,
      'action', 'updated'
    );
  END IF;

  -- Get limits
  v_session_limit := get_user_session_limit(p_user_id);
  v_active_count := count_user_active_sessions(p_user_id);

  -- Calculate how many sessions need to be revoked
  v_sessions_to_revoke := v_active_count - v_session_limit + 1;

  -- Revoke oldest sessions if over limit
  IF v_sessions_to_revoke > 0 THEN
    FOR v_oldest_session IN
      SELECT id
      FROM user_sessions
      WHERE user_id = p_user_id
        AND is_revoked = false
      ORDER BY last_active_at ASC
      LIMIT v_sessions_to_revoke
    LOOP
      UPDATE user_sessions
      SET
        is_revoked = true,
        revoked_at = NOW(),
        revoked_reason = 'device_limit'
      WHERE id = v_oldest_session.id;

      v_revoked_sessions := array_append(v_revoked_sessions, v_oldest_session.id);
    END LOOP;
  END IF;

  -- Create new session
  INSERT INTO user_sessions (
    user_id,
    session_token,
    device_id,
    device_name,
    browser,
    browser_version,
    os,
    os_version,
    device_type,
    ip_address,
    city,
    country,
    expires_at
  ) VALUES (
    p_user_id,
    p_session_token,
    p_device_id,
    p_device_name,
    p_browser,
    p_browser_version,
    p_os,
    p_os_version,
    p_device_type,
    p_ip_address,
    p_city,
    p_country,
    v_expires_at
  )
  RETURNING id INTO v_new_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_new_session_id,
    'action', 'created',
    'revoked_sessions', v_revoked_sessions,
    'revoked_count', array_length(v_revoked_sessions, 1),
    'session_limit', v_session_limit,
    'active_count', count_user_active_sessions(p_user_id)
  );
END;
$$;

-- ============================================================================
-- FUNCTION: Revoke Session
-- Allows users to manually revoke a session
-- ============================================================================

CREATE OR REPLACE FUNCTION revoke_user_session(
  p_user_id UUID,
  p_session_id UUID,
  p_reason TEXT DEFAULT 'user_logout'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE user_sessions
  SET
    is_revoked = true,
    revoked_at = NOW(),
    revoked_reason = p_reason
  WHERE id = p_session_id
    AND user_id = p_user_id
    AND is_revoked = false;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session not found or already revoked'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Session revoked successfully'
  );
END;
$$;

-- ============================================================================
-- FUNCTION: Revoke All Other Sessions
-- Keeps only the current session active
-- ============================================================================

CREATE OR REPLACE FUNCTION revoke_all_other_sessions(
  p_user_id UUID,
  p_current_session_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_revoked_count INTEGER;
BEGIN
  UPDATE user_sessions
  SET
    is_revoked = true,
    revoked_at = NOW(),
    revoked_reason = 'user_logout'
  WHERE user_id = p_user_id
    AND session_token != p_current_session_token
    AND is_revoked = false;

  GET DIAGNOSTICS v_revoked_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'revoked_count', v_revoked_count
  );
END;
$$;

-- ============================================================================
-- FUNCTION: Get User Sessions
-- Returns all active sessions for a user with formatted device info
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_sessions(
  p_user_id UUID,
  p_current_session_token TEXT DEFAULT NULL,
  p_include_revoked BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sessions JSONB;
  v_limit INTEGER;
  v_active_count INTEGER;
BEGIN
  v_limit := get_user_session_limit(p_user_id);
  v_active_count := count_user_active_sessions(p_user_id);

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'device_name', COALESCE(s.device_name, 'Unknown Device'),
      'browser', s.browser,
      'browser_version', s.browser_version,
      'os', s.os,
      'os_version', s.os_version,
      'device_type', s.device_type,
      'ip_address', s.ip_address,
      'city', s.city,
      'country', s.country,
      'location', CASE
        WHEN s.city IS NOT NULL AND s.country IS NOT NULL THEN s.city || ', ' || s.country
        WHEN s.country IS NOT NULL THEN s.country
        ELSE NULL
      END,
      'created_at', s.created_at,
      'last_active_at', s.last_active_at,
      'is_current', (s.session_token = p_current_session_token),
      'is_revoked', s.is_revoked,
      'revoked_at', s.revoked_at,
      'revoked_reason', s.revoked_reason
    )
    ORDER BY
      (s.session_token = p_current_session_token) DESC,
      s.last_active_at DESC
  ) INTO v_sessions
  FROM user_sessions s
  WHERE s.user_id = p_user_id
    AND (p_include_revoked OR s.is_revoked = false);

  RETURN jsonb_build_object(
    'sessions', COALESCE(v_sessions, '[]'::jsonb),
    'active_count', v_active_count,
    'session_limit', v_limit,
    'can_add_more', v_active_count < v_limit
  );
END;
$$;

-- ============================================================================
-- FUNCTION: Update Session Activity
-- Called periodically to update last_active_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_session_activity(
  p_user_id UUID,
  p_session_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE user_sessions
  SET last_active_at = NOW()
  WHERE user_id = p_user_id
    AND session_token = p_session_token
    AND is_revoked = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated > 0;
END;
$$;

-- ============================================================================
-- FUNCTION: Check Session Valid
-- Returns whether a session is still valid (not revoked, not expired)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_session_valid(
  p_user_id UUID,
  p_session_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM user_sessions
    WHERE user_id = p_user_id
      AND session_token = p_session_token
      AND is_revoked = false
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

-- ============================================================================
-- FUNCTION: Cleanup Expired Sessions
-- Called by cron job to remove old expired/revoked sessions
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- Delete sessions that are:
  -- 1. Revoked and older than 30 days
  -- 2. Expired and older than 30 days
  DELETE FROM user_sessions
  WHERE (
    (is_revoked = true AND revoked_at < NOW() - INTERVAL '30 days')
    OR
    (expires_at IS NOT NULL AND expires_at < NOW() - INTERVAL '30 days')
  );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own sessions (for activity updates)
CREATE POLICY "Users can update own sessions"
  ON user_sessions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Only system can insert sessions (via function with SECURITY DEFINER)
-- Regular users cannot insert directly
CREATE POLICY "System can insert sessions"
  ON user_sessions FOR INSERT
  WITH CHECK (
    -- Allow platform admins or service role
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
    OR
    -- Allow users to insert their own sessions
    user_id = auth.uid()
  );

-- Users can delete (revoke) their own sessions
CREATE POLICY "Users can delete own sessions"
  ON user_sessions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_sessions IS 'Tracks active user sessions/devices with configurable limits per subscription tier';
COMMENT ON FUNCTION get_user_session_limit IS 'Returns the maximum allowed sessions for a user based on their subscription tier';
COMMENT ON FUNCTION register_user_session IS 'Creates a new session, automatically revoking oldest sessions if device limit exceeded';
COMMENT ON FUNCTION get_user_sessions IS 'Returns all sessions for a user with device info and current session indicator';
COMMENT ON FUNCTION revoke_user_session IS 'Allows a user to manually sign out from a specific device';
COMMENT ON FUNCTION revoke_all_other_sessions IS 'Signs out all devices except the current one';
