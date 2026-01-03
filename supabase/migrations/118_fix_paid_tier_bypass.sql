-- Migration 118: Fix paid tier bypass vulnerability
--
-- Problem: When users select a paid tier during signup, the trigger creates
-- a subscription with billing_waived=true, granting full access without payment.
--
-- Fix: For paid tiers, create subscription as 'basic' tier until Stripe confirms payment.
-- The Stripe webhook will upgrade the tier after successful payment.

CREATE OR REPLACE FUNCTION auto_initialize_team_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_selected_tier TEXT;
  v_actual_tier TEXT;
  v_tier_config RECORD;
  v_status TEXT;
  v_billing_waived BOOLEAN;
BEGIN
  -- Get the tier user selected (stored in default_tier)
  v_selected_tier := COALESCE(NEW.default_tier, 'basic');

  -- SECURITY FIX: For paid tiers, start as basic until payment is confirmed
  -- The Stripe webhook will upgrade the tier after successful payment
  IF v_selected_tier IN ('plus', 'premium') THEN
    -- Paid tier selected - start as basic (no free access to paid features)
    v_actual_tier := 'basic';
    v_status := 'waived';  -- Basic is free, so billing is waived
    v_billing_waived := true;
  ELSE
    -- Basic tier - grant access immediately
    v_actual_tier := 'basic';
    v_status := 'waived';
    v_billing_waived := true;
  END IF;

  -- Get tier config for the ACTUAL tier (basic)
  SELECT * INTO v_tier_config FROM tier_config WHERE tier_key = v_actual_tier;

  -- If tier config not found, use defaults
  IF NOT FOUND THEN
    v_actual_tier := 'basic';
    SELECT * INTO v_tier_config FROM tier_config WHERE tier_key = 'basic';
  END IF;

  -- Create subscription with the ACTUAL tier (basic for unpaid, basic for basic)
  INSERT INTO subscriptions (team_id, tier, status, billing_waived, current_period_start, current_period_end)
  VALUES (
    NEW.id,
    v_actual_tier,
    v_status,
    v_billing_waived,
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (team_id) DO NOTHING;

  -- Initialize tokens using the ACTUAL tier's config (basic tier limits)
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

-- Note: The Stripe webhook (api/webhooks/stripe/route.ts) should already handle
-- upgrading the subscription tier when payment is confirmed. This migration
-- just ensures users can't bypass payment by navigating away from checkout.
