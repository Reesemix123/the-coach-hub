-- Migration 060: Error and Auth Logs Tables
-- Adds error_logs and auth_logs tables for Block 16: Logs & Audit
--
-- This enables:
-- 1. Error tracking for debugging and monitoring
-- 2. Authentication event logging for security audits
-- 3. Searchable, filterable logs for platform admins

-- ============================================================================
-- 1. ERROR_LOGS TABLE
-- Tracks application errors for debugging and monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Severity level
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('error', 'warning', 'info')),

  -- Error details
  message TEXT NOT NULL,
  stack_trace TEXT,

  -- Additional context
  metadata JSONB,

  -- Request tracking
  request_id VARCHAR(100),

  -- Source info
  source VARCHAR(100), -- e.g., 'api', 'webhook', 'cron', 'client'
  endpoint VARCHAR(255) -- e.g., '/api/admin/billing/retry-payment'
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source) WHERE source IS NOT NULL;

COMMENT ON TABLE error_logs IS 'Application error tracking for debugging and monitoring';

-- ============================================================================
-- 2. AUTH_LOGS TABLE
-- Tracks authentication events for security auditing
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- User info (nullable for failed attempts where user is unknown)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),

  -- Event details
  action VARCHAR(50) NOT NULL CHECK (action IN (
    'login', 'logout', 'signup', 'password_reset',
    'password_change', 'email_change', 'mfa_enable',
    'mfa_disable', 'token_refresh', 'session_end'
  )),

  -- Result
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure')),
  failure_reason VARCHAR(255), -- Only for failed attempts

  -- Request info
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Additional context
  metadata JSONB
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_auth_logs_timestamp ON auth_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_user ON auth_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_email ON auth_logs(user_email) WHERE user_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_logs_action ON auth_logs(action);
CREATE INDEX IF NOT EXISTS idx_auth_logs_status ON auth_logs(status);

COMMENT ON TABLE auth_logs IS 'Authentication event tracking for security auditing';

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

-- Error Logs RLS (admin only)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view error_logs"
  ON error_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

CREATE POLICY "Service role can insert error_logs"
  ON error_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert error_logs"
  ON error_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Auth Logs RLS (admin only for viewing)
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view auth_logs"
  ON auth_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

CREATE POLICY "Service role can insert auth_logs"
  ON auth_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert own auth_logs"
  ON auth_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function to log errors
CREATE OR REPLACE FUNCTION log_error(
  p_severity VARCHAR(20),
  p_message TEXT,
  p_stack_trace TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_source VARCHAR(100) DEFAULT NULL,
  p_endpoint VARCHAR(255) DEFAULT NULL,
  p_request_id VARCHAR(100) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO error_logs (severity, message, stack_trace, metadata, source, endpoint, request_id)
  VALUES (p_severity, p_message, p_stack_trace, p_metadata, p_source, p_endpoint, p_request_id)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Function to log auth events
CREATE OR REPLACE FUNCTION log_auth_event(
  p_user_id UUID,
  p_user_email VARCHAR(255),
  p_action VARCHAR(50),
  p_status VARCHAR(20),
  p_ip_address VARCHAR(45) DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_failure_reason VARCHAR(255) DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO auth_logs (user_id, user_email, action, status, ip_address, user_agent, failure_reason, metadata)
  VALUES (p_user_id, p_user_email, p_action, p_status, p_ip_address, p_user_agent, p_failure_reason, p_metadata)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION log_error IS 'Helper to consistently log application errors';
COMMENT ON FUNCTION log_auth_event IS 'Helper to log authentication events';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION log_error TO authenticated;
GRANT EXECUTE ON FUNCTION log_auth_event TO authenticated;
