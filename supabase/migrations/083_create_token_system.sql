-- Migration: 083_create_token_system.sql
-- Phase 3: Upload Token System
-- Creates token_balance and token_transactions tables for tracking game upload tokens

-- ============================================================================
-- Step 1: Create token_balance table
-- Tracks current token balances per team (subscription + purchased pools)
-- ============================================================================

CREATE TABLE IF NOT EXISTS token_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Subscription Tokens (reset monthly on billing cycle)
  subscription_tokens_available INTEGER NOT NULL DEFAULT 0,
  subscription_tokens_used_this_period INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,

  -- Purchased Tokens (separate pool, don't expire with billing cycle)
  purchased_tokens_available INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  last_rollover_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One balance record per team
  CONSTRAINT token_balance_team_unique UNIQUE (team_id),

  -- Ensure non-negative values
  CONSTRAINT token_balance_subscription_positive CHECK (subscription_tokens_available >= 0),
  CONSTRAINT token_balance_used_positive CHECK (subscription_tokens_used_this_period >= 0),
  CONSTRAINT token_balance_purchased_positive CHECK (purchased_tokens_available >= 0)
);

-- Index for quick team lookups
CREATE INDEX IF NOT EXISTS idx_token_balance_team ON token_balance(team_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_token_balance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER token_balance_updated_at
  BEFORE UPDATE ON token_balance
  FOR EACH ROW
  EXECUTE FUNCTION update_token_balance_updated_at();

-- ============================================================================
-- Step 2: Create token_transactions table
-- Audit log for all token changes (allocations, consumption, purchases, etc.)
-- ============================================================================

CREATE TYPE token_transaction_type AS ENUM (
  'monthly_allocation',  -- Monthly refresh from subscription
  'rollover',           -- Unused tokens carried to next period
  'consumption',        -- Token used to create a game
  'purchase',           -- Token purchased via Stripe
  'refund',             -- Token refunded (game deletion, support action)
  'admin_adjustment'    -- Manual adjustment by platform admin
);

CREATE TYPE token_source AS ENUM (
  'subscription',       -- From monthly subscription allocation
  'purchased'           -- From purchased token pool
);

CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Transaction Details
  transaction_type token_transaction_type NOT NULL,
  amount INTEGER NOT NULL, -- Positive for credits, negative for debits
  balance_after INTEGER NOT NULL, -- Total balance after this transaction
  source token_source NOT NULL,

  -- References (context-dependent)
  reference_id TEXT, -- game_id for consumption, stripe_payment_id for purchase
  reference_type TEXT, -- 'game', 'stripe_payment', 'admin', etc.

  -- Audit Info
  notes TEXT,
  created_by UUID REFERENCES auth.users(id), -- Who initiated (null for system)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_token_transactions_team ON token_transactions(team_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created ON token_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_transactions_reference ON token_transactions(reference_id) WHERE reference_id IS NOT NULL;

-- ============================================================================
-- Step 3: Row Level Security
-- ============================================================================

ALTER TABLE token_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Token Balance Policies
-- Users can view their own team's token balance
CREATE POLICY "Users can view own team token balance"
  ON token_balance
  FOR SELECT
  USING (
    team_id IN (
      SELECT id FROM teams WHERE user_id = auth.uid()
      UNION
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only system/admin can modify token balances directly
-- (Updates happen via backend services, not direct user access)
CREATE POLICY "Service role can manage token balance"
  ON token_balance
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Token Transactions Policies
-- Users can view their own team's transaction history
CREATE POLICY "Users can view own team token transactions"
  ON token_transactions
  FOR SELECT
  USING (
    team_id IN (
      SELECT id FROM teams WHERE user_id = auth.uid()
      UNION
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only system/admin can create transactions
CREATE POLICY "Service role can manage token transactions"
  ON token_transactions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Step 4: Helper function to get total available tokens
-- ============================================================================

CREATE OR REPLACE FUNCTION get_total_tokens_available(p_team_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_subscription_tokens INTEGER;
  v_purchased_tokens INTEGER;
BEGIN
  SELECT
    COALESCE(subscription_tokens_available, 0),
    COALESCE(purchased_tokens_available, 0)
  INTO v_subscription_tokens, v_purchased_tokens
  FROM token_balance
  WHERE team_id = p_team_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  RETURN v_subscription_tokens + v_purchased_tokens;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 5: Function to consume a token (used when creating a game)
-- Returns TRUE if successful, FALSE if no tokens available
-- ============================================================================

CREATE OR REPLACE FUNCTION consume_upload_token(
  p_team_id UUID,
  p_game_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_balance token_balance%ROWTYPE;
  v_source token_source;
  v_total_after INTEGER;
BEGIN
  -- Lock the row for update
  SELECT * INTO v_balance
  FROM token_balance
  WHERE team_id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE; -- No token balance record
  END IF;

  -- Check total available
  IF v_balance.subscription_tokens_available + v_balance.purchased_tokens_available < 1 THEN
    RETURN FALSE; -- No tokens available
  END IF;

  -- Consume from subscription pool first, then purchased
  IF v_balance.subscription_tokens_available > 0 THEN
    v_source := 'subscription';
    UPDATE token_balance
    SET
      subscription_tokens_available = subscription_tokens_available - 1,
      subscription_tokens_used_this_period = subscription_tokens_used_this_period + 1
    WHERE team_id = p_team_id;

    v_total_after := v_balance.subscription_tokens_available - 1 + v_balance.purchased_tokens_available;
  ELSE
    v_source := 'purchased';
    UPDATE token_balance
    SET purchased_tokens_available = purchased_tokens_available - 1
    WHERE team_id = p_team_id;

    v_total_after := v_balance.subscription_tokens_available + v_balance.purchased_tokens_available - 1;
  END IF;

  -- Log the transaction
  INSERT INTO token_transactions (
    team_id,
    transaction_type,
    amount,
    balance_after,
    source,
    reference_id,
    reference_type,
    notes,
    created_by
  ) VALUES (
    p_team_id,
    'consumption',
    -1,
    v_total_after,
    v_source,
    p_game_id::TEXT,
    'game',
    'Token consumed for game creation',
    p_user_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 6: Function to add purchased tokens
-- ============================================================================

CREATE OR REPLACE FUNCTION add_purchased_tokens(
  p_team_id UUID,
  p_amount INTEGER,
  p_stripe_payment_id TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_balance token_balance%ROWTYPE;
  v_total_after INTEGER;
BEGIN
  -- Ensure token_balance record exists
  INSERT INTO token_balance (team_id)
  VALUES (p_team_id)
  ON CONFLICT (team_id) DO NOTHING;

  -- Lock the row for update
  SELECT * INTO v_balance
  FROM token_balance
  WHERE team_id = p_team_id
  FOR UPDATE;

  -- Add purchased tokens
  UPDATE token_balance
  SET purchased_tokens_available = purchased_tokens_available + p_amount
  WHERE team_id = p_team_id;

  v_total_after := v_balance.subscription_tokens_available + v_balance.purchased_tokens_available + p_amount;

  -- Log the transaction
  INSERT INTO token_transactions (
    team_id,
    transaction_type,
    amount,
    balance_after,
    source,
    reference_id,
    reference_type,
    notes,
    created_by
  ) VALUES (
    p_team_id,
    'purchase',
    p_amount,
    v_total_after,
    'purchased',
    p_stripe_payment_id,
    'stripe_payment',
    'Tokens purchased via Stripe',
    p_user_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 7: Function to refresh tokens on billing cycle
-- Called when subscription renews (via Stripe webhook)
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_subscription_tokens(
  p_team_id UUID,
  p_tier_key TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tier_config tier_config%ROWTYPE;
  v_balance token_balance%ROWTYPE;
  v_rollover INTEGER;
  v_new_allocation INTEGER;
  v_total_after INTEGER;
BEGIN
  -- Get tier configuration
  SELECT * INTO v_tier_config
  FROM tier_config
  WHERE tier_key = p_tier_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid tier_key: %', p_tier_key;
  END IF;

  -- Ensure token_balance record exists
  INSERT INTO token_balance (team_id, period_start, period_end)
  VALUES (p_team_id, p_period_start, p_period_end)
  ON CONFLICT (team_id) DO NOTHING;

  -- Lock the row for update
  SELECT * INTO v_balance
  FROM token_balance
  WHERE team_id = p_team_id
  FOR UPDATE;

  -- Calculate rollover (capped at tier's rollover limit)
  v_rollover := LEAST(v_balance.subscription_tokens_available, v_tier_config.token_rollover_cap);

  -- New allocation = rollover + monthly tokens
  v_new_allocation := v_rollover + v_tier_config.monthly_upload_tokens;

  -- Log rollover transaction if there was one
  IF v_rollover > 0 THEN
    INSERT INTO token_transactions (
      team_id,
      transaction_type,
      amount,
      balance_after,
      source,
      notes
    ) VALUES (
      p_team_id,
      'rollover',
      v_rollover,
      v_rollover,
      'subscription',
      format('Rolled over %s tokens from previous period (cap: %s)', v_rollover, v_tier_config.token_rollover_cap)
    );
  END IF;

  -- Update balance with new allocation
  UPDATE token_balance
  SET
    subscription_tokens_available = v_new_allocation,
    subscription_tokens_used_this_period = 0,
    period_start = p_period_start,
    period_end = p_period_end,
    last_rollover_at = NOW()
  WHERE team_id = p_team_id;

  v_total_after := v_new_allocation + v_balance.purchased_tokens_available;

  -- Log monthly allocation transaction
  INSERT INTO token_transactions (
    team_id,
    transaction_type,
    amount,
    balance_after,
    source,
    notes
  ) VALUES (
    p_team_id,
    'monthly_allocation',
    v_tier_config.monthly_upload_tokens,
    v_total_after,
    'subscription',
    format('Monthly allocation of %s tokens for %s tier', v_tier_config.monthly_upload_tokens, v_tier_config.display_name)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 8: Function to initialize tokens for new subscription
-- Called when a team first subscribes
-- ============================================================================

CREATE OR REPLACE FUNCTION initialize_subscription_tokens(
  p_team_id UUID,
  p_tier_key TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tier_config tier_config%ROWTYPE;
BEGIN
  -- Get tier configuration
  SELECT * INTO v_tier_config
  FROM tier_config
  WHERE tier_key = p_tier_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid tier_key: %', p_tier_key;
  END IF;

  -- Insert or update token balance
  INSERT INTO token_balance (
    team_id,
    subscription_tokens_available,
    subscription_tokens_used_this_period,
    period_start,
    period_end,
    purchased_tokens_available
  ) VALUES (
    p_team_id,
    v_tier_config.monthly_upload_tokens,
    0,
    p_period_start,
    p_period_end,
    0
  )
  ON CONFLICT (team_id) DO UPDATE SET
    subscription_tokens_available = v_tier_config.monthly_upload_tokens,
    subscription_tokens_used_this_period = 0,
    period_start = p_period_start,
    period_end = p_period_end;

  -- Log the initial allocation
  INSERT INTO token_transactions (
    team_id,
    transaction_type,
    amount,
    balance_after,
    source,
    notes
  ) VALUES (
    p_team_id,
    'monthly_allocation',
    v_tier_config.monthly_upload_tokens,
    v_tier_config.monthly_upload_tokens,
    'subscription',
    format('Initial token allocation for %s tier subscription', v_tier_config.display_name)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 9: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE token_balance IS 'Tracks upload token balances per team. Subscription tokens reset monthly, purchased tokens persist.';
COMMENT ON TABLE token_transactions IS 'Audit log of all token transactions (allocations, consumption, purchases, refunds).';

COMMENT ON COLUMN token_balance.subscription_tokens_available IS 'Current available tokens from subscription (resets monthly)';
COMMENT ON COLUMN token_balance.subscription_tokens_used_this_period IS 'Tokens used in current billing period';
COMMENT ON COLUMN token_balance.purchased_tokens_available IS 'Tokens purchased separately (do not expire)';
COMMENT ON COLUMN token_balance.period_start IS 'Start of current billing period';
COMMENT ON COLUMN token_balance.period_end IS 'End of current billing period';

COMMENT ON FUNCTION consume_upload_token IS 'Consumes one token when creating a game. Uses subscription tokens first, then purchased.';
COMMENT ON FUNCTION add_purchased_tokens IS 'Adds purchased tokens to team balance after Stripe payment.';
COMMENT ON FUNCTION refresh_subscription_tokens IS 'Refreshes monthly token allocation on billing cycle with rollover.';
COMMENT ON FUNCTION initialize_subscription_tokens IS 'Sets up initial token balance for new subscription.';
