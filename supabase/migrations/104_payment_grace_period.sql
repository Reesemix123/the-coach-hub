-- Migration: 104_payment_grace_period.sql
-- Add tracking for payment grace period and automatic suspension after 7 days

-- Add past_due_since column to track when subscription entered past_due status
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS past_due_since TIMESTAMPTZ;

-- Add payment_suspended status indicator
-- This is set when grace period expires (7 days after past_due_since)
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS payment_suspended BOOLEAN DEFAULT false;

-- Add payment_suspended_at timestamp
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS payment_suspended_at TIMESTAMPTZ;

-- Comment on columns
COMMENT ON COLUMN subscriptions.past_due_since IS
'Timestamp when subscription first entered past_due status. Used to calculate 7-day grace period.';

COMMENT ON COLUMN subscriptions.payment_suspended IS
'True when payment grace period (7 days) has expired and access should be blocked.';

COMMENT ON COLUMN subscriptions.payment_suspended_at IS
'Timestamp when payment_suspended was set to true.';

-- Create index for efficient queries on past_due subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_past_due_since
ON subscriptions(past_due_since)
WHERE past_due_since IS NOT NULL;

-- Create index for suspended subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_suspended
ON subscriptions(payment_suspended)
WHERE payment_suspended = true;

-- Function to check and update payment suspension status
-- Called when checking access or periodically via cron
CREATE OR REPLACE FUNCTION check_payment_grace_period(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_past_due_since TIMESTAMPTZ;
  v_status TEXT;
  v_payment_suspended BOOLEAN;
  v_grace_period_days INT := 7;
BEGIN
  -- Get subscription details
  SELECT past_due_since, status, payment_suspended
  INTO v_past_due_since, v_status, v_payment_suspended
  FROM subscriptions
  WHERE team_id = p_team_id;

  -- If not found or not past_due, return true (has access)
  IF NOT FOUND OR v_status != 'past_due' THEN
    RETURN true;
  END IF;

  -- If already suspended, return false
  IF v_payment_suspended = true THEN
    RETURN false;
  END IF;

  -- If no past_due_since set, something is wrong - allow access but log
  IF v_past_due_since IS NULL THEN
    RETURN true;
  END IF;

  -- Check if grace period has expired
  IF v_past_due_since + (v_grace_period_days || ' days')::INTERVAL < NOW() THEN
    -- Grace period expired - suspend access
    UPDATE subscriptions
    SET payment_suspended = true,
        payment_suspended_at = NOW(),
        updated_at = NOW()
    WHERE team_id = p_team_id;

    -- Log the suspension
    INSERT INTO audit_logs (action, target_type, target_id, metadata)
    VALUES (
      'subscription.payment_suspended',
      'team',
      p_team_id,
      jsonb_build_object(
        'past_due_since', v_past_due_since,
        'grace_period_days', v_grace_period_days,
        'reason', 'grace_period_expired'
      )
    );

    RETURN false;
  END IF;

  -- Still within grace period
  RETURN true;
END;
$$;

-- Function to get days remaining in grace period
CREATE OR REPLACE FUNCTION get_grace_period_remaining(p_team_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_past_due_since TIMESTAMPTZ;
  v_status TEXT;
  v_grace_period_days INT := 7;
  v_days_remaining INT;
BEGIN
  SELECT past_due_since, status
  INTO v_past_due_since, v_status
  FROM subscriptions
  WHERE team_id = p_team_id;

  IF NOT FOUND OR v_status != 'past_due' OR v_past_due_since IS NULL THEN
    RETURN NULL;
  END IF;

  v_days_remaining := v_grace_period_days - EXTRACT(DAY FROM (NOW() - v_past_due_since))::INT;

  RETURN GREATEST(0, v_days_remaining);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_payment_grace_period(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_grace_period_remaining(UUID) TO authenticated;
