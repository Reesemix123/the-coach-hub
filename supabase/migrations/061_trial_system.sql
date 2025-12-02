-- Migration 061: Trial System
-- Adds has_had_trial tracking and updates subscription status constraints

-- ============================================================================
-- 1. ADD has_had_trial TO TEAMS TABLE
-- ============================================================================

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS has_had_trial BOOLEAN DEFAULT false;

COMMENT ON COLUMN teams.has_had_trial IS 'Tracks whether team has used a trial (informational only, admins can override)';

-- ============================================================================
-- 2. UPDATE SUBSCRIPTION STATUS TO INCLUDE 'expired'
-- ============================================================================

-- First drop and recreate the constraint to add 'expired' status
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('none', 'trialing', 'active', 'past_due', 'canceled', 'waived', 'expired'));

-- ============================================================================
-- 3. FUNCTION TO CHECK AND EXPIRE TRIALS
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_ended_trials()
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  trial_ended_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH expired AS (
    UPDATE subscriptions s
    SET
      status = 'expired',
      updated_at = NOW()
    FROM teams t
    WHERE s.team_id = t.id
      AND s.status = 'trialing'
      AND s.trial_ends_at < NOW()
    RETURNING s.team_id, t.name, s.trial_ends_at
  )
  SELECT
    expired.team_id,
    expired.name::TEXT AS team_name,
    expired.trial_ends_at AS trial_ended_at
  FROM expired;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION expire_ended_trials IS 'Expires all trials past their end date. Returns list of expired teams.';

-- ============================================================================
-- 4. FUNCTION TO START A TRIAL FOR A TEAM (Admin use)
-- ============================================================================

CREATE OR REPLACE FUNCTION start_team_trial(
  p_team_id UUID,
  p_tier VARCHAR(50),
  p_duration_days INTEGER,
  p_ai_credits_limit INTEGER,
  p_admin_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_trial_ends_at TIMESTAMPTZ;
  v_team_name TEXT;
  v_result JSONB;
BEGIN
  -- Calculate trial end date
  v_trial_ends_at := NOW() + (p_duration_days || ' days')::INTERVAL;

  -- Get team name for audit
  SELECT name INTO v_team_name FROM teams WHERE id = p_team_id;

  IF v_team_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- Upsert subscription
  INSERT INTO subscriptions (team_id, tier, status, trial_ends_at)
  VALUES (p_team_id, p_tier, 'trialing', v_trial_ends_at)
  ON CONFLICT (team_id) DO UPDATE SET
    tier = p_tier,
    status = 'trialing',
    trial_ends_at = v_trial_ends_at,
    updated_at = NOW();

  -- Upsert AI credits for trial period
  INSERT INTO ai_credits (team_id, credits_allowed, credits_used, period_start, period_end)
  VALUES (p_team_id, p_ai_credits_limit, 0, NOW(), v_trial_ends_at)
  ON CONFLICT (team_id, period_start) DO UPDATE SET
    credits_allowed = p_ai_credits_limit,
    credits_used = 0,
    period_end = v_trial_ends_at,
    updated_at = NOW();

  -- Mark team as having had a trial
  UPDATE teams SET has_had_trial = true WHERE id = p_team_id;

  -- Log audit event
  PERFORM log_audit_event(
    p_admin_id,
    'trial.started',
    'team',
    p_team_id,
    v_team_name,
    jsonb_build_object(
      'tier', p_tier,
      'duration_days', p_duration_days,
      'ai_credits_limit', p_ai_credits_limit,
      'trial_ends_at', v_trial_ends_at
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'trial_ends_at', v_trial_ends_at,
    'tier', p_tier,
    'ai_credits_limit', p_ai_credits_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION start_team_trial IS 'Starts or restarts a trial for a team (admin only)';

-- ============================================================================
-- 5. FUNCTION TO EXTEND A TRIAL
-- ============================================================================

CREATE OR REPLACE FUNCTION extend_team_trial(
  p_team_id UUID,
  p_additional_days INTEGER,
  p_admin_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_current_end TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
  v_team_name TEXT;
BEGIN
  -- Get current trial end and team name
  SELECT s.trial_ends_at, t.name
  INTO v_current_end, v_team_name
  FROM subscriptions s
  JOIN teams t ON s.team_id = t.id
  WHERE s.team_id = p_team_id AND s.status = 'trialing';

  IF v_current_end IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team is not currently in a trial');
  END IF;

  -- Calculate new end date (extend from current end or from now if already expired)
  IF v_current_end < NOW() THEN
    v_new_end := NOW() + (p_additional_days || ' days')::INTERVAL;
  ELSE
    v_new_end := v_current_end + (p_additional_days || ' days')::INTERVAL;
  END IF;

  -- Update subscription
  UPDATE subscriptions
  SET trial_ends_at = v_new_end, updated_at = NOW()
  WHERE team_id = p_team_id;

  -- Extend AI credits period
  UPDATE ai_credits
  SET period_end = v_new_end, updated_at = NOW()
  WHERE team_id = p_team_id
    AND period_end = v_current_end;

  -- Log audit event
  PERFORM log_audit_event(
    p_admin_id,
    'trial.extended',
    'team',
    p_team_id,
    v_team_name,
    jsonb_build_object(
      'additional_days', p_additional_days,
      'previous_end', v_current_end,
      'new_end', v_new_end
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'previous_end', v_current_end,
    'new_end', v_new_end
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION extend_team_trial IS 'Extends an active trial by additional days (admin only)';

-- ============================================================================
-- 6. FUNCTION TO END A TRIAL EARLY
-- ============================================================================

CREATE OR REPLACE FUNCTION end_team_trial(
  p_team_id UUID,
  p_new_status VARCHAR(50),
  p_admin_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_team_name TEXT;
  v_old_status TEXT;
BEGIN
  -- Validate new status
  IF p_new_status NOT IN ('expired', 'canceled', 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status. Must be expired, canceled, or active');
  END IF;

  -- Get team info
  SELECT t.name, s.status
  INTO v_team_name, v_old_status
  FROM teams t
  LEFT JOIN subscriptions s ON s.team_id = t.id
  WHERE t.id = p_team_id;

  IF v_team_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- Update subscription
  UPDATE subscriptions
  SET
    status = p_new_status,
    trial_ends_at = CASE WHEN p_new_status IN ('expired', 'canceled') THEN NOW() ELSE trial_ends_at END,
    updated_at = NOW()
  WHERE team_id = p_team_id;

  -- If ending/canceling, zero out AI credits
  IF p_new_status IN ('expired', 'canceled') THEN
    UPDATE ai_credits
    SET credits_allowed = 0, period_end = NOW(), updated_at = NOW()
    WHERE team_id = p_team_id
      AND period_end > NOW();
  END IF;

  -- Log audit event
  PERFORM log_audit_event(
    p_admin_id,
    'trial.ended',
    'team',
    p_team_id,
    v_team_name,
    jsonb_build_object(
      'old_status', v_old_status,
      'new_status', p_new_status
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_status', v_old_status,
    'new_status', p_new_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION end_team_trial IS 'Ends a trial early with specified new status (admin only)';

-- ============================================================================
-- 7. FUNCTION TO GET TRIAL STATUS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_team_trial_status(p_team_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_subscription RECORD;
  v_ai_credits RECORD;
  v_days_remaining INTEGER;
BEGIN
  -- Get subscription info
  SELECT tier, status, trial_ends_at
  INTO v_subscription
  FROM subscriptions
  WHERE team_id = p_team_id;

  -- If no subscription or not trialing
  IF v_subscription IS NULL OR v_subscription.status != 'trialing' THEN
    RETURN jsonb_build_object(
      'is_trialing', false,
      'status', COALESCE(v_subscription.status, 'none')
    );
  END IF;

  -- Calculate days remaining
  v_days_remaining := GREATEST(0, EXTRACT(DAY FROM v_subscription.trial_ends_at - NOW())::INTEGER);

  -- Get AI credits
  SELECT credits_used, credits_allowed
  INTO v_ai_credits
  FROM ai_credits
  WHERE team_id = p_team_id
    AND period_start <= NOW()
    AND period_end > NOW()
  ORDER BY period_start DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'is_trialing', true,
    'trial_ends_at', v_subscription.trial_ends_at,
    'days_remaining', v_days_remaining,
    'tier', v_subscription.tier,
    'ai_credits_used', COALESCE(v_ai_credits.credits_used, 0),
    'ai_credits_limit', COALESCE(v_ai_credits.credits_allowed, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_team_trial_status IS 'Get current trial status for a team';
