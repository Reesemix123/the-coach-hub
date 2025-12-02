-- Migration 059: Users Browser Support
-- Adds user status tracking, deactivation support, role column, and password reset tokens

-- ============================================================================
-- 1. Add role column to profiles (for role display)
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'coach';

-- Update existing platform admins to have 'platform_admin' role
UPDATE profiles SET role = 'platform_admin' WHERE is_platform_admin = true;

-- ============================================================================
-- 2. Add is_deactivated column to profiles (for deactivation support)
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_deactivated BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- Index for querying active/deactivated users
CREATE INDEX IF NOT EXISTS idx_profiles_is_deactivated ON profiles(is_deactivated);

-- ============================================================================
-- 3. Create user_status table (for tracking login activity)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_login_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  last_login_ip TEXT,
  last_login_user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for looking up user status
CREATE INDEX IF NOT EXISTS idx_user_status_user_id ON user_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_last_login ON user_status(last_login_at DESC);

-- Enable RLS
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all user status records
CREATE POLICY "Platform admins can view all user status" ON user_status
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Users can view their own status
CREATE POLICY "Users can view own status" ON user_status
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 4. Create trigger to auto-populate user_status on profile creation
-- ============================================================================

CREATE OR REPLACE FUNCTION create_user_status_on_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_status (user_id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_create_user_status ON profiles;

-- Create trigger
CREATE TRIGGER trigger_create_user_status
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_status_on_profile();

-- ============================================================================
-- 5. Backfill user_status for existing profiles
-- ============================================================================

INSERT INTO user_status (user_id, created_at, updated_at)
SELECT p.id, NOW(), NOW()
FROM profiles p
WHERE p.id NOT IN (SELECT user_id FROM user_status)
ON CONFLICT (user_id) DO NOTHING;

-- Update user_status with last_active_at from profiles where available
UPDATE user_status us
SET last_login_at = p.last_active_at
FROM profiles p
WHERE us.user_id = p.id
AND p.last_active_at IS NOT NULL
AND us.last_login_at IS NULL;

-- ============================================================================
-- 6. Create password_reset_tokens table for OTP-based password reset
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL, -- SHA256 hash of the token (we store hash, not plain token)
  temporary_password TEXT, -- Encrypted/hashed temporary password
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id), -- Admin who initiated the reset
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- Enable RLS
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Only platform admins can view/create password reset tokens
CREATE POLICY "Platform admins can manage password reset tokens" ON password_reset_tokens
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- ============================================================================
-- 7. Add updated_at trigger for user_status
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_status_updated_at ON user_status;

CREATE TRIGGER trigger_update_user_status_updated_at
  BEFORE UPDATE ON user_status
  FOR EACH ROW
  EXECUTE FUNCTION update_user_status_updated_at();

-- ============================================================================
-- 8. Function to update user status on login (callable from auth hook)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_login_status(
  p_user_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_status (user_id, first_login_at, last_login_at, login_count, last_login_ip, last_login_user_agent)
  VALUES (p_user_id, NOW(), NOW(), 1, p_ip_address, p_user_agent)
  ON CONFLICT (user_id) DO UPDATE SET
    first_login_at = COALESCE(user_status.first_login_at, NOW()),
    last_login_at = NOW(),
    login_count = COALESCE(user_status.login_count, 0) + 1,
    last_login_ip = COALESCE(p_ip_address, user_status.last_login_ip),
    last_login_user_agent = COALESCE(p_user_agent, user_status.last_login_user_agent),
    updated_at = NOW();

  -- Also update last_active_at in profiles
  UPDATE profiles
  SET last_active_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION update_user_login_status TO authenticated;

-- ============================================================================
-- 9. Add audit action types for user management
-- ============================================================================

-- These are just documented here for reference - actual logging happens in the application
-- New audit actions:
-- - user.password_reset_initiated
-- - user.password_reset_completed
-- - user.deactivated
-- - user.reactivated
-- - user.role_updated
