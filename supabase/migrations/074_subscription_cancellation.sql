-- Migration: 074_subscription_cancellation.sql
-- Description: Add subscription cancellation tracking and admin revoke capabilities
-- Date: 2024-12-05

-- ============================================================================
-- PART 1: Add new fields to subscriptions table for access revocation
-- ============================================================================

-- Add access revocation fields (for admin TOS violation actions)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS access_revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_revoked_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS access_revoked_reason TEXT,
  ADD COLUMN IF NOT EXISTS data_access_expires_at TIMESTAMPTZ;

-- Add comment explaining the fields
COMMENT ON COLUMN subscriptions.access_revoked_at IS 'When admin revoked access (TOS violation). NULL means not revoked.';
COMMENT ON COLUMN subscriptions.access_revoked_by IS 'Admin user who revoked access';
COMMENT ON COLUMN subscriptions.access_revoked_reason IS 'Reason for access revocation (TOS violation details)';
COMMENT ON COLUMN subscriptions.data_access_expires_at IS '30 days after subscription ends - when data becomes inaccessible';

-- ============================================================================
-- PART 2: Create subscription_cancellations table for tracking cancellation reasons
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  stripe_subscription_id VARCHAR(255),

  -- Cancellation details
  canceled_at TIMESTAMPTZ DEFAULT NOW(),
  subscription_ends_at TIMESTAMPTZ NOT NULL,

  -- Reason tracking
  reason TEXT CHECK (reason IN (
    'too_expensive',
    'not_using',
    'missing_features',
    'seasonal',
    'switching_provider',
    'team_disbanded',
    'other'
  )),
  reason_details TEXT,

  -- Resubscription tracking
  resubscribed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_subscription_cancellations_team
  ON subscription_cancellations(team_id);
CREATE INDEX IF NOT EXISTS idx_subscription_cancellations_date
  ON subscription_cancellations(canceled_at);
CREATE INDEX IF NOT EXISTS idx_subscription_cancellations_reason
  ON subscription_cancellations(reason);

-- Add comment
COMMENT ON TABLE subscription_cancellations IS 'Tracks subscription cancellation reasons and resubscription activity';

-- ============================================================================
-- PART 3: Enable RLS on subscription_cancellations
-- ============================================================================

ALTER TABLE subscription_cancellations ENABLE ROW LEVEL SECURITY;

-- Team owners can view their own cancellations
CREATE POLICY "Team owners can view cancellations"
  ON subscription_cancellations
  FOR SELECT
  USING (
    team_id IN (
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- Only allow inserts from authenticated users (via API)
CREATE POLICY "Authenticated users can insert cancellations"
  ON subscription_cancellations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Platform admins can view all cancellations
CREATE POLICY "Platform admins can view all cancellations"
  ON subscription_cancellations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_platform_admin = TRUE
    )
  );

-- Platform admins can update cancellations (for tracking resubscription)
CREATE POLICY "Platform admins can update cancellations"
  ON subscription_cancellations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_platform_admin = TRUE
    )
  );

-- ============================================================================
-- PART 4: Create updated_at trigger for subscription_cancellations
-- ============================================================================

CREATE OR REPLACE FUNCTION update_subscription_cancellations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscription_cancellations_updated_at ON subscription_cancellations;
CREATE TRIGGER subscription_cancellations_updated_at
  BEFORE UPDATE ON subscription_cancellations
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_cancellations_updated_at();

-- ============================================================================
-- PART 5: Add audit log action types for cancellation events
-- ============================================================================

-- These actions should be logged when cancellation events occur:
-- 'subscription.cancel_requested' - User initiated cancellation
-- 'subscription.reactivated' - User reactivated before period end
-- 'subscription.access_revoked' - Admin revoked access (TOS violation)
-- 'subscription.grace_period_expired' - 30-day grace period ended

-- No schema changes needed - audit_logs table already supports arbitrary action strings

-- ============================================================================
-- PART 6: Create helper function to check if user can access team data
-- ============================================================================

CREATE OR REPLACE FUNCTION can_access_team_data(p_team_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_subscription RECORD;
  v_days_since_end INTEGER;
BEGIN
  -- Get subscription for this team
  SELECT
    status,
    cancel_at_period_end,
    current_period_end,
    access_revoked_at
  INTO v_subscription
  FROM subscriptions
  WHERE team_id = p_team_id;

  -- No subscription found - no access
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Access revoked by admin - no access
  IF v_subscription.access_revoked_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  -- Active statuses have full access
  IF v_subscription.status IN ('active', 'trialing', 'past_due', 'waived') THEN
    RETURN TRUE;
  END IF;

  -- Canceled - check if within 30-day grace period
  IF v_subscription.status = 'canceled' THEN
    v_days_since_end := EXTRACT(DAY FROM (NOW() - v_subscription.current_period_end));
    RETURN v_days_since_end <= 30;
  END IF;

  -- Default: no access
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION can_access_team_data(UUID) TO authenticated;

COMMENT ON FUNCTION can_access_team_data IS 'Check if a team has data access based on subscription status and grace period';

-- ============================================================================
-- PART 7: Create view for subscription status with access info
-- ============================================================================

CREATE OR REPLACE VIEW subscription_access_status AS
SELECT
  s.id,
  s.team_id,
  s.tier,
  s.status,
  s.cancel_at_period_end,
  s.current_period_end,
  s.access_revoked_at,
  s.access_revoked_reason,
  s.data_access_expires_at,
  t.name as team_name,
  t.user_id as owner_id,
  -- Computed fields
  CASE
    WHEN s.access_revoked_at IS NOT NULL THEN 'revoked'
    WHEN s.status IN ('active', 'trialing', 'past_due', 'waived') THEN 'active'
    WHEN s.status = 'canceled' AND s.current_period_end + INTERVAL '30 days' > NOW() THEN 'grace_period'
    WHEN s.status = 'canceled' THEN 'expired'
    ELSE 'none'
  END as access_state,
  CASE
    WHEN s.status = 'canceled' AND s.current_period_end IS NOT NULL THEN
      GREATEST(0, 30 - EXTRACT(DAY FROM (NOW() - s.current_period_end)))::INTEGER
    ELSE NULL
  END as grace_days_remaining
FROM subscriptions s
JOIN teams t ON t.id = s.team_id;

COMMENT ON VIEW subscription_access_status IS 'View showing subscription status with computed access state and grace period info';
