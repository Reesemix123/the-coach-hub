-- Migration 115: Add Designated Tokens (Team vs Opponent)
--
-- Problem: Current token system uses a single pool for all game types.
-- Coaches can use all tokens on opponent scouting and have none left for team games.
--
-- Solution: Separate token pools for team games and opponent scouting games.
-- Each tier provides a specific allocation of each token type.

-- ============================================
-- STEP 1: Add designated token columns to token_balance
-- ============================================

-- Add team token columns
ALTER TABLE token_balance
ADD COLUMN IF NOT EXISTS team_subscription_tokens_available INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS team_subscription_tokens_used_this_period INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS team_purchased_tokens_available INTEGER NOT NULL DEFAULT 0;

-- Add opponent token columns
ALTER TABLE token_balance
ADD COLUMN IF NOT EXISTS opponent_subscription_tokens_available INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS opponent_subscription_tokens_used_this_period INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS opponent_purchased_tokens_available INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- STEP 2: Add designated allocations to tier_config
-- ============================================

ALTER TABLE tier_config
ADD COLUMN IF NOT EXISTS monthly_team_tokens INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS monthly_opponent_tokens INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS team_token_rollover_cap INTEGER NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS opponent_token_rollover_cap INTEGER NOT NULL DEFAULT 2;

-- Set tier allocations based on spec:
-- Basic: 1 team + 1 opponent = 2 total
-- Plus: 2 team + 2 opponent = 4 total
-- Premium: 4 team + 4 opponent = 8 total
UPDATE tier_config SET
  monthly_team_tokens = CASE tier_key
    WHEN 'basic' THEN 1
    WHEN 'plus' THEN 2
    WHEN 'premium' THEN 4
    ELSE 1
  END,
  monthly_opponent_tokens = CASE tier_key
    WHEN 'basic' THEN 1
    WHEN 'plus' THEN 2
    WHEN 'premium' THEN 4
    ELSE 1
  END,
  team_token_rollover_cap = CASE tier_key
    WHEN 'basic' THEN 2
    WHEN 'plus' THEN 4
    WHEN 'premium' THEN 8
    ELSE 2
  END,
  opponent_token_rollover_cap = CASE tier_key
    WHEN 'basic' THEN 2
    WHEN 'plus' THEN 4
    WHEN 'premium' THEN 8
    ELSE 2
  END;

-- ============================================
-- STEP 3: Migrate existing token balances
-- ============================================

-- Split existing tokens evenly between team and opponent
-- Subscription tokens: split available tokens
UPDATE token_balance SET
  team_subscription_tokens_available = CEIL(subscription_tokens_available / 2.0),
  opponent_subscription_tokens_available = FLOOR(subscription_tokens_available / 2.0),
  team_subscription_tokens_used_this_period = CEIL(subscription_tokens_used_this_period / 2.0),
  opponent_subscription_tokens_used_this_period = FLOOR(subscription_tokens_used_this_period / 2.0),
  -- Purchased tokens: split evenly
  team_purchased_tokens_available = CEIL(purchased_tokens_available / 2.0),
  opponent_purchased_tokens_available = FLOOR(purchased_tokens_available / 2.0);

-- ============================================
-- STEP 4: Add game_type to token_transactions
-- ============================================

ALTER TABLE token_transactions
ADD COLUMN IF NOT EXISTS game_type TEXT CHECK (game_type IN ('team', 'opponent'));

-- ============================================
-- STEP 5: Create consume_designated_token function
-- ============================================

CREATE OR REPLACE FUNCTION consume_designated_token(
  p_team_id UUID,
  p_game_id UUID,
  p_game_type TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance RECORD;
  v_consumed BOOLEAN := FALSE;
  v_source TEXT;
  v_remaining_team INTEGER;
  v_remaining_opponent INTEGER;
BEGIN
  -- Validate game_type
  IF p_game_type NOT IN ('team', 'opponent') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid game_type. Must be "team" or "opponent".'
    );
  END IF;

  -- Get current balance with row lock
  SELECT * INTO v_balance
  FROM token_balance
  WHERE team_id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No token balance found for this team.'
    );
  END IF;

  -- Consume from appropriate pool based on game_type
  IF p_game_type = 'team' THEN
    -- Try subscription tokens first
    IF v_balance.team_subscription_tokens_available > 0 THEN
      UPDATE token_balance SET
        team_subscription_tokens_available = team_subscription_tokens_available - 1,
        team_subscription_tokens_used_this_period = team_subscription_tokens_used_this_period + 1,
        -- Also update legacy fields for backward compatibility
        subscription_tokens_available = subscription_tokens_available - 1,
        subscription_tokens_used_this_period = subscription_tokens_used_this_period + 1
      WHERE team_id = p_team_id;
      v_consumed := TRUE;
      v_source := 'team_subscription';
    -- Then try purchased tokens
    ELSIF v_balance.team_purchased_tokens_available > 0 THEN
      UPDATE token_balance SET
        team_purchased_tokens_available = team_purchased_tokens_available - 1,
        -- Also update legacy field
        purchased_tokens_available = purchased_tokens_available - 1
      WHERE team_id = p_team_id;
      v_consumed := TRUE;
      v_source := 'team_purchased';
    END IF;
  ELSE -- opponent
    -- Try subscription tokens first
    IF v_balance.opponent_subscription_tokens_available > 0 THEN
      UPDATE token_balance SET
        opponent_subscription_tokens_available = opponent_subscription_tokens_available - 1,
        opponent_subscription_tokens_used_this_period = opponent_subscription_tokens_used_this_period + 1,
        -- Also update legacy fields
        subscription_tokens_available = subscription_tokens_available - 1,
        subscription_tokens_used_this_period = subscription_tokens_used_this_period + 1
      WHERE team_id = p_team_id;
      v_consumed := TRUE;
      v_source := 'opponent_subscription';
    -- Then try purchased tokens
    ELSIF v_balance.opponent_purchased_tokens_available > 0 THEN
      UPDATE token_balance SET
        opponent_purchased_tokens_available = opponent_purchased_tokens_available - 1,
        -- Also update legacy field
        purchased_tokens_available = purchased_tokens_available - 1
      WHERE team_id = p_team_id;
      v_consumed := TRUE;
      v_source := 'opponent_purchased';
    END IF;
  END IF;

  IF NOT v_consumed THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', format('No %s tokens available.', p_game_type)
    );
  END IF;

  -- Get updated remaining counts
  SELECT
    team_subscription_tokens_available + team_purchased_tokens_available,
    opponent_subscription_tokens_available + opponent_purchased_tokens_available
  INTO v_remaining_team, v_remaining_opponent
  FROM token_balance
  WHERE team_id = p_team_id;

  -- Log the transaction
  INSERT INTO token_transactions (
    team_id,
    transaction_type,
    amount,
    source,
    game_id,
    game_type,
    performed_by_user_id,
    notes
  ) VALUES (
    p_team_id,
    'consume',
    -1,
    v_source,
    p_game_id,
    p_game_type,
    p_user_id,
    format('Consumed 1 %s token for game creation', p_game_type)
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'source', v_source,
    'remaining_team', v_remaining_team,
    'remaining_opponent', v_remaining_opponent
  );
END;
$$;

-- ============================================
-- STEP 6: Update initialize_subscription_tokens function
-- ============================================

-- Drop existing function first (signature may differ)
DROP FUNCTION IF EXISTS initialize_subscription_tokens(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION initialize_subscription_tokens(
  p_team_id UUID,
  p_tier TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
BEGIN
  -- Get tier configuration
  SELECT * INTO v_config
  FROM tier_config
  WHERE tier_key = p_tier;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown tier: %', p_tier;
  END IF;

  -- Upsert token balance with designated tokens
  INSERT INTO token_balance (
    team_id,
    -- Legacy fields (for backward compatibility)
    subscription_tokens_available,
    subscription_tokens_used_this_period,
    purchased_tokens_available,
    -- New designated token fields
    team_subscription_tokens_available,
    team_subscription_tokens_used_this_period,
    team_purchased_tokens_available,
    opponent_subscription_tokens_available,
    opponent_subscription_tokens_used_this_period,
    opponent_purchased_tokens_available,
    -- Period info
    period_start,
    period_end
  ) VALUES (
    p_team_id,
    -- Legacy: sum of both types
    v_config.monthly_team_tokens + v_config.monthly_opponent_tokens,
    0,
    0,
    -- Designated tokens
    v_config.monthly_team_tokens,
    0,
    0,
    v_config.monthly_opponent_tokens,
    0,
    0,
    -- Period
    p_period_start,
    p_period_end
  )
  ON CONFLICT (team_id) DO UPDATE SET
    -- Legacy fields
    subscription_tokens_available = v_config.monthly_team_tokens + v_config.monthly_opponent_tokens,
    subscription_tokens_used_this_period = 0,
    -- Designated tokens
    team_subscription_tokens_available = v_config.monthly_team_tokens,
    team_subscription_tokens_used_this_period = 0,
    opponent_subscription_tokens_available = v_config.monthly_opponent_tokens,
    opponent_subscription_tokens_used_this_period = 0,
    -- Period
    period_start = p_period_start,
    period_end = p_period_end;

  -- Log the initialization
  INSERT INTO token_transactions (
    team_id,
    transaction_type,
    amount,
    source,
    notes
  ) VALUES (
    p_team_id,
    'allocation',
    v_config.monthly_team_tokens + v_config.monthly_opponent_tokens,
    'subscription_init',
    format('Initialized %s tier: %s team + %s opponent tokens',
           p_tier, v_config.monthly_team_tokens, v_config.monthly_opponent_tokens)
  );
END;
$$;

-- ============================================
-- STEP 7: Update refresh_subscription_tokens function
-- ============================================

-- Drop existing function first (signature may differ)
DROP FUNCTION IF EXISTS refresh_subscription_tokens(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION refresh_subscription_tokens(
  p_team_id UUID,
  p_tier TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_current RECORD;
  v_new_team_tokens INTEGER;
  v_new_opponent_tokens INTEGER;
BEGIN
  -- Get tier configuration
  SELECT * INTO v_config
  FROM tier_config
  WHERE tier_key = p_tier;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown tier: %', p_tier;
  END IF;

  -- Get current balance
  SELECT * INTO v_current
  FROM token_balance
  WHERE team_id = p_team_id;

  -- Calculate new token amounts with rollover (capped)
  IF v_current IS NOT NULL THEN
    -- Team tokens: current unused + new allocation, capped at rollover limit
    v_new_team_tokens := LEAST(
      v_current.team_subscription_tokens_available + v_config.monthly_team_tokens,
      v_config.team_token_rollover_cap
    );
    -- Opponent tokens: same logic
    v_new_opponent_tokens := LEAST(
      v_current.opponent_subscription_tokens_available + v_config.monthly_opponent_tokens,
      v_config.opponent_token_rollover_cap
    );
  ELSE
    v_new_team_tokens := v_config.monthly_team_tokens;
    v_new_opponent_tokens := v_config.monthly_opponent_tokens;
  END IF;

  -- Upsert with new values
  INSERT INTO token_balance (
    team_id,
    subscription_tokens_available,
    subscription_tokens_used_this_period,
    team_subscription_tokens_available,
    team_subscription_tokens_used_this_period,
    opponent_subscription_tokens_available,
    opponent_subscription_tokens_used_this_period,
    period_start,
    period_end
  ) VALUES (
    p_team_id,
    v_new_team_tokens + v_new_opponent_tokens,
    0,
    v_new_team_tokens,
    0,
    v_new_opponent_tokens,
    0,
    p_period_start,
    p_period_end
  )
  ON CONFLICT (team_id) DO UPDATE SET
    subscription_tokens_available = v_new_team_tokens + v_new_opponent_tokens,
    subscription_tokens_used_this_period = 0,
    team_subscription_tokens_available = v_new_team_tokens,
    team_subscription_tokens_used_this_period = 0,
    opponent_subscription_tokens_available = v_new_opponent_tokens,
    opponent_subscription_tokens_used_this_period = 0,
    period_start = p_period_start,
    period_end = p_period_end;

  -- Log the refresh
  INSERT INTO token_transactions (
    team_id,
    transaction_type,
    amount,
    source,
    notes
  ) VALUES (
    p_team_id,
    'allocation',
    v_new_team_tokens + v_new_opponent_tokens,
    'subscription_renewal',
    format('Renewed %s tier: %s team + %s opponent tokens (with rollover)',
           p_tier, v_new_team_tokens, v_new_opponent_tokens)
  );
END;
$$;

-- ============================================
-- STEP 8: Create helper function to get designated token balance
-- ============================================

CREATE OR REPLACE FUNCTION get_designated_token_balance(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance RECORD;
BEGIN
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
      'period_end', NULL
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
    'period_end', v_balance.period_end
  );
END;
$$;

-- ============================================
-- STEP 9: Grant permissions
-- ============================================

GRANT EXECUTE ON FUNCTION consume_designated_token TO authenticated;
GRANT EXECUTE ON FUNCTION get_designated_token_balance TO authenticated;
