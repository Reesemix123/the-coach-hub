-- Migration 117: Token Auto-Refresh and Auto-Initialization
--
-- This migration adds:
-- 1. Add default_tier column to teams for tier selection during creation
-- 2. Trigger to auto-create subscription and tokens when a team is created
-- 3. Function to lazy-refresh tokens when period has expired
-- 4. Fix rollover caps (basic = no rollover)

-- ============================================
-- STEP 0: Add default_tier column to teams table
-- ============================================

ALTER TABLE teams
ADD COLUMN IF NOT EXISTS default_tier TEXT DEFAULT 'basic' CHECK (default_tier IN ('basic', 'plus', 'premium'));

-- ============================================
-- STEP 1: Fix rollover caps for basic tier
-- ============================================

UPDATE tier_config SET
  team_token_rollover_cap = CASE tier_key
    WHEN 'basic' THEN 1      -- Same as monthly = no rollover
    WHEN 'plus' THEN 4       -- 2x monthly (2 * 2)
    WHEN 'premium' THEN 8    -- 2x monthly (2 * 4)
    ELSE 1
  END,
  opponent_token_rollover_cap = CASE tier_key
    WHEN 'basic' THEN 1      -- Same as monthly = no rollover
    WHEN 'plus' THEN 4       -- 2x monthly
    WHEN 'premium' THEN 8    -- 2x monthly
    ELSE 1
  END;

-- ============================================
-- STEP 2: Auto-initialize subscription and tokens for new teams
-- ============================================

CREATE OR REPLACE FUNCTION auto_initialize_team_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_tier_config RECORD;
  v_status TEXT;
  v_billing_waived BOOLEAN;
BEGIN
  -- Use the selected tier from the team record, default to 'basic'
  v_tier := COALESCE(NEW.default_tier, 'basic');

  -- Get tier config for the selected tier
  SELECT * INTO v_tier_config FROM tier_config WHERE tier_key = v_tier;

  -- If tier config not found, fall back to basic
  IF NOT FOUND THEN
    v_tier := 'basic';
    SELECT * INTO v_tier_config FROM tier_config WHERE tier_key = 'basic';
  END IF;

  -- Set subscription status based on tier
  -- Basic: waived billing, active immediately
  -- Plus/Premium: waived initially (Stripe webhook will update when payment confirmed)
  IF v_tier = 'basic' THEN
    v_status := 'waived';
    v_billing_waived := true;
  ELSE
    -- For paid tiers, start as waived until Stripe confirms payment
    v_status := 'waived';
    v_billing_waived := true;
  END IF;

  -- Create subscription with selected tier
  INSERT INTO subscriptions (team_id, tier, status, billing_waived, current_period_start, current_period_end)
  VALUES (
    NEW.id,
    v_tier,
    v_status,
    v_billing_waived,
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (team_id) DO NOTHING;

  -- Initialize tokens using the selected tier's config
  INSERT INTO token_balance (
    team_id,
    subscription_tokens_available,
    subscription_tokens_used_this_period,
    purchased_tokens_available,
    team_subscription_tokens_available,
    team_subscription_tokens_used_this_period,
    team_purchased_tokens_available,
    opponent_subscription_tokens_available,
    opponent_subscription_tokens_used_this_period,
    opponent_purchased_tokens_available,
    period_start,
    period_end
  ) VALUES (
    NEW.id,
    COALESCE(v_tier_config.monthly_team_tokens, 1) + COALESCE(v_tier_config.monthly_opponent_tokens, 1),
    0, 0,
    COALESCE(v_tier_config.monthly_team_tokens, 1), 0, 0,
    COALESCE(v_tier_config.monthly_opponent_tokens, 1), 0, 0,
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (team_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_init_team_subscription ON teams;
CREATE TRIGGER trigger_auto_init_team_subscription
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION auto_initialize_team_subscription();

-- ============================================
-- STEP 3: Lazy refresh function
-- ============================================

CREATE OR REPLACE FUNCTION check_and_refresh_tokens(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance RECORD;
  v_subscription RECORD;
BEGIN
  -- Get current balance
  SELECT * INTO v_balance FROM token_balance WHERE team_id = p_team_id;

  -- If no balance exists, return false (trigger should have created it)
  IF v_balance IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if period has expired
  IF v_balance.period_end IS NOT NULL AND v_balance.period_end < NOW() THEN
    -- Get subscription tier
    SELECT tier INTO v_subscription FROM subscriptions WHERE team_id = p_team_id;

    IF v_subscription.tier IS NOT NULL THEN
      -- Refresh tokens using existing function
      PERFORM refresh_subscription_tokens(
        p_team_id,
        v_subscription.tier,
        NOW(),
        NOW() + INTERVAL '30 days'
      );
      RETURN TRUE;  -- Tokens were refreshed
    END IF;
  END IF;

  RETURN FALSE;  -- No refresh needed
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_refresh_tokens TO authenticated;

-- ============================================
-- STEP 4: Enhanced get_designated_token_balance with auto-refresh
-- ============================================

CREATE OR REPLACE FUNCTION get_designated_token_balance(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance RECORD;
  v_refreshed BOOLEAN;
BEGIN
  -- Check and refresh if needed
  v_refreshed := check_and_refresh_tokens(p_team_id);

  -- Get current balance
  SELECT * INTO v_balance
  FROM token_balance
  WHERE team_id = p_team_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'team_available', 0,
      'team_used', 0,
      'opponent_available', 0,
      'opponent_used', 0,
      'total_available', 0,
      'period_start', NULL,
      'period_end', NULL,
      'was_refreshed', FALSE
    );
  END IF;

  RETURN jsonb_build_object(
    'team_subscription_available', v_balance.team_subscription_tokens_available,
    'team_purchased_available', v_balance.team_purchased_tokens_available,
    'team_total_available', v_balance.team_subscription_tokens_available + v_balance.team_purchased_tokens_available,
    'team_used_this_period', v_balance.team_subscription_tokens_used_this_period,
    'opponent_subscription_available', v_balance.opponent_subscription_tokens_available,
    'opponent_purchased_available', v_balance.opponent_purchased_tokens_available,
    'opponent_total_available', v_balance.opponent_subscription_tokens_available + v_balance.opponent_purchased_tokens_available,
    'opponent_used_this_period', v_balance.opponent_subscription_tokens_used_this_period,
    'total_available',
      v_balance.team_subscription_tokens_available + v_balance.team_purchased_tokens_available +
      v_balance.opponent_subscription_tokens_available + v_balance.opponent_purchased_tokens_available,
    'period_start', v_balance.period_start,
    'period_end', v_balance.period_end,
    'was_refreshed', v_refreshed
  );
END;
$$;
