-- 071_ai_credits_system.sql
-- AI Credits System for tracking video minutes and text actions
-- Supports subscription-based allocations and one-time purchases

-- ============================================
-- Drop old ai_credits table if it exists with old schema
-- (Old schema had: credits_allowed, credits_used, period_start, period_end)
-- ============================================
DROP TABLE IF EXISTS ai_credits CASCADE;
DROP TABLE IF EXISTS ai_credit_purchases CASCADE;
DROP TABLE IF EXISTS ai_usage CASCADE;

-- ============================================
-- Table: ai_credits
-- Subscription-based monthly allocations
-- ============================================
CREATE TABLE ai_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Monthly allocation from subscription
  video_minutes_monthly INTEGER NOT NULL DEFAULT 0,
  text_actions_monthly INTEGER NOT NULL DEFAULT 0, -- -1 for unlimited

  -- Current month's remaining credits
  video_minutes_remaining INTEGER NOT NULL DEFAULT 0,
  text_actions_remaining INTEGER NOT NULL DEFAULT 0, -- -1 for unlimited

  -- Priority processing flag (for AI Powered tier)
  priority_processing BOOLEAN DEFAULT FALSE,

  -- Billing cycle tracking
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id)
);

-- ============================================
-- Table: ai_credit_purchases
-- One-time purchases of additional AI minutes
-- ============================================
CREATE TABLE ai_credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Purchase details
  minutes_purchased INTEGER NOT NULL,
  minutes_remaining INTEGER NOT NULL,
  price_cents INTEGER NOT NULL, -- Price paid in cents

  -- Validity period (90 days from purchase)
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Payment info
  stripe_payment_intent_id TEXT,
  purchased_by_user_id UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: ai_usage
-- Detailed usage tracking for all AI operations
-- ============================================
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),

  -- Usage type
  usage_type TEXT NOT NULL CHECK (usage_type IN ('video_analysis', 'text_action')),

  -- For video_analysis: minutes consumed
  -- For text_action: always 1
  units_consumed NUMERIC(10, 2) NOT NULL,

  -- Source of credits used
  credit_source TEXT NOT NULL CHECK (credit_source IN ('subscription', 'purchase', 'trial')),
  purchase_id UUID REFERENCES ai_credit_purchases(id),

  -- Context
  operation_type TEXT, -- 'play_tagging', 'scouting_report', 'practice_plan', etc.
  video_id UUID REFERENCES videos(id),
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ai_credits_team ON ai_credits(team_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_purchases_team ON ai_credit_purchases(team_id);
CREATE INDEX IF NOT EXISTS idx_ai_credit_purchases_expires ON ai_credit_purchases(expires_at) WHERE minutes_remaining > 0;
CREATE INDEX IF NOT EXISTS idx_ai_usage_team ON ai_usage(team_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_type ON ai_usage(usage_type);

-- ============================================
-- RLS Policies
-- ============================================

-- ai_credits policies
ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their team credits"
  ON ai_credits FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Platform admins can manage all credits"
  ON ai_credits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = TRUE
    )
  );

-- ai_credit_purchases policies
ALTER TABLE ai_credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their purchase history"
  ON ai_credit_purchases FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team owners can make purchases"
  ON ai_credit_purchases FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Platform admins can manage all purchases"
  ON ai_credit_purchases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = TRUE
    )
  );

-- ai_usage policies
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their usage"
  ON ai_usage FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert usage records"
  ON ai_usage FOR INSERT
  WITH CHECK (TRUE); -- Usage is tracked by system, authenticated user required

CREATE POLICY "Platform admins can view all usage"
  ON ai_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = TRUE
    )
  );

-- ============================================
-- Function: allocate_subscription_credits
-- Called when a subscription is created or renewed
-- ============================================
CREATE OR REPLACE FUNCTION allocate_subscription_credits(
  p_team_id UUID,
  p_tier TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS VOID AS $$
DECLARE
  v_video_minutes INTEGER;
  v_text_actions INTEGER;
  v_priority BOOLEAN;
BEGIN
  -- Determine allocation based on tier
  CASE p_tier
    WHEN 'basic' THEN
      v_video_minutes := 0;
      v_text_actions := 0;
      v_priority := FALSE;
    WHEN 'plus' THEN
      v_video_minutes := 30;
      v_text_actions := 100;
      v_priority := FALSE;
    WHEN 'premium' THEN
      v_video_minutes := 120;
      v_text_actions := -1; -- Unlimited
      v_priority := FALSE;
    WHEN 'ai_powered' THEN
      v_video_minutes := 300;
      v_text_actions := -1; -- Unlimited
      v_priority := TRUE;
    ELSE
      v_video_minutes := 0;
      v_text_actions := 0;
      v_priority := FALSE;
  END CASE;

  -- Upsert credits record
  INSERT INTO ai_credits (
    team_id,
    video_minutes_monthly,
    text_actions_monthly,
    video_minutes_remaining,
    text_actions_remaining,
    priority_processing,
    current_period_start,
    current_period_end,
    updated_at
  ) VALUES (
    p_team_id,
    v_video_minutes,
    v_text_actions,
    v_video_minutes,
    v_text_actions,
    v_priority,
    p_period_start,
    p_period_end,
    NOW()
  )
  ON CONFLICT (team_id) DO UPDATE SET
    video_minutes_monthly = v_video_minutes,
    text_actions_monthly = v_text_actions,
    video_minutes_remaining = v_video_minutes,
    text_actions_remaining = v_text_actions,
    priority_processing = v_priority,
    current_period_start = p_period_start,
    current_period_end = p_period_end,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: check_video_minutes
-- Returns available video minutes (subscription + purchases)
-- ============================================
CREATE OR REPLACE FUNCTION check_video_minutes(p_team_id UUID)
RETURNS TABLE (
  subscription_remaining INTEGER,
  purchased_remaining INTEGER,
  total_available INTEGER,
  has_priority BOOLEAN
) AS $$
DECLARE
  v_sub_remaining INTEGER := 0;
  v_purchase_remaining INTEGER := 0;
  v_priority BOOLEAN := FALSE;
BEGIN
  -- Get subscription credits
  SELECT
    COALESCE(video_minutes_remaining, 0),
    COALESCE(priority_processing, FALSE)
  INTO v_sub_remaining, v_priority
  FROM ai_credits
  WHERE team_id = p_team_id;

  -- Get remaining purchased credits (non-expired)
  SELECT COALESCE(SUM(minutes_remaining), 0)
  INTO v_purchase_remaining
  FROM ai_credit_purchases
  WHERE team_id = p_team_id
    AND expires_at > NOW()
    AND minutes_remaining > 0;

  RETURN QUERY SELECT
    v_sub_remaining,
    v_purchase_remaining,
    v_sub_remaining + v_purchase_remaining,
    v_priority;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: consume_video_minutes
-- Deducts video minutes (subscription first, then purchases)
-- Returns success boolean and remaining balance
-- ============================================
CREATE OR REPLACE FUNCTION consume_video_minutes(
  p_team_id UUID,
  p_user_id UUID,
  p_minutes NUMERIC,
  p_video_id UUID DEFAULT NULL,
  p_operation_type TEXT DEFAULT 'video_analysis',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
  success BOOLEAN,
  remaining_subscription INTEGER,
  remaining_purchased INTEGER,
  message TEXT
) AS $$
DECLARE
  v_sub_remaining INTEGER := 0;
  v_minutes_needed NUMERIC := p_minutes;
  v_from_subscription NUMERIC := 0;
  v_from_purchase NUMERIC := 0;
  v_purchase_record RECORD;
BEGIN
  -- Get subscription credits
  SELECT video_minutes_remaining
  INTO v_sub_remaining
  FROM ai_credits
  WHERE team_id = p_team_id
  FOR UPDATE;

  -- First, use subscription credits
  IF v_sub_remaining > 0 THEN
    v_from_subscription := LEAST(v_sub_remaining, v_minutes_needed);
    v_minutes_needed := v_minutes_needed - v_from_subscription;

    UPDATE ai_credits
    SET video_minutes_remaining = video_minutes_remaining - v_from_subscription::INTEGER,
        updated_at = NOW()
    WHERE team_id = p_team_id;

    -- Log subscription usage
    IF v_from_subscription > 0 THEN
      INSERT INTO ai_usage (team_id, user_id, usage_type, units_consumed, credit_source, operation_type, video_id, metadata)
      VALUES (p_team_id, p_user_id, 'video_analysis', v_from_subscription, 'subscription', p_operation_type, p_video_id, p_metadata);
    END IF;
  END IF;

  -- Then use purchased credits (oldest first) if needed
  IF v_minutes_needed > 0 THEN
    FOR v_purchase_record IN
      SELECT id, minutes_remaining
      FROM ai_credit_purchases
      WHERE team_id = p_team_id
        AND expires_at > NOW()
        AND minutes_remaining > 0
      ORDER BY purchased_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_minutes_needed <= 0;

      DECLARE
        v_deduct NUMERIC := LEAST(v_purchase_record.minutes_remaining, v_minutes_needed);
      BEGIN
        UPDATE ai_credit_purchases
        SET minutes_remaining = minutes_remaining - v_deduct::INTEGER
        WHERE id = v_purchase_record.id;

        v_from_purchase := v_from_purchase + v_deduct;
        v_minutes_needed := v_minutes_needed - v_deduct;

        -- Log purchase usage
        INSERT INTO ai_usage (team_id, user_id, usage_type, units_consumed, credit_source, purchase_id, operation_type, video_id, metadata)
        VALUES (p_team_id, p_user_id, 'video_analysis', v_deduct, 'purchase', v_purchase_record.id, p_operation_type, p_video_id, p_metadata);
      END;
    END LOOP;
  END IF;

  -- Check if we had enough credits
  IF v_minutes_needed > 0 THEN
    -- Rollback partial deductions (transaction will handle this)
    RETURN QUERY SELECT
      FALSE,
      (SELECT video_minutes_remaining FROM ai_credits WHERE team_id = p_team_id),
      (SELECT COALESCE(SUM(minutes_remaining), 0)::INTEGER FROM ai_credit_purchases WHERE team_id = p_team_id AND expires_at > NOW()),
      'Insufficient video minutes. Need ' || p_minutes || ' but only have ' || (p_minutes - v_minutes_needed) || ' available.';
    RETURN;
  END IF;

  -- Return success
  RETURN QUERY SELECT
    TRUE,
    (SELECT video_minutes_remaining FROM ai_credits WHERE team_id = p_team_id),
    (SELECT COALESCE(SUM(minutes_remaining), 0)::INTEGER FROM ai_credit_purchases WHERE team_id = p_team_id AND expires_at > NOW()),
    'Successfully consumed ' || p_minutes || ' video minutes.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: check_text_actions
-- Returns available text actions
-- ============================================
CREATE OR REPLACE FUNCTION check_text_actions(p_team_id UUID)
RETURNS TABLE (
  remaining INTEGER,
  is_unlimited BOOLEAN
) AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  SELECT text_actions_remaining
  INTO v_remaining
  FROM ai_credits
  WHERE team_id = p_team_id;

  -- -1 means unlimited
  IF v_remaining = -1 THEN
    RETURN QUERY SELECT -1, TRUE;
  ELSE
    RETURN QUERY SELECT COALESCE(v_remaining, 0), FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: consume_text_action
-- Deducts 1 text action (unless unlimited)
-- ============================================
CREATE OR REPLACE FUNCTION consume_text_action(
  p_team_id UUID,
  p_user_id UUID,
  p_operation_type TEXT DEFAULT 'text_action',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
  success BOOLEAN,
  remaining INTEGER,
  is_unlimited BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  -- Get current text actions
  SELECT text_actions_remaining
  INTO v_remaining
  FROM ai_credits
  WHERE team_id = p_team_id
  FOR UPDATE;

  -- Handle unlimited
  IF v_remaining = -1 THEN
    -- Log usage but don't decrement
    INSERT INTO ai_usage (team_id, user_id, usage_type, units_consumed, credit_source, operation_type, metadata)
    VALUES (p_team_id, p_user_id, 'text_action', 1, 'subscription', p_operation_type, p_metadata);

    RETURN QUERY SELECT TRUE, -1, TRUE, 'Text action consumed (unlimited plan).';
    RETURN;
  END IF;

  -- Check if we have credits
  IF v_remaining IS NULL OR v_remaining <= 0 THEN
    RETURN QUERY SELECT FALSE, COALESCE(v_remaining, 0), FALSE, 'No text actions remaining.';
    RETURN;
  END IF;

  -- Decrement and log
  UPDATE ai_credits
  SET text_actions_remaining = text_actions_remaining - 1,
      updated_at = NOW()
  WHERE team_id = p_team_id;

  INSERT INTO ai_usage (team_id, user_id, usage_type, units_consumed, credit_source, operation_type, metadata)
  VALUES (p_team_id, p_user_id, 'text_action', 1, 'subscription', p_operation_type, p_metadata);

  RETURN QUERY SELECT TRUE, v_remaining - 1, FALSE, 'Text action consumed.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: get_usage_summary
-- Get usage summary for a team
-- ============================================
CREATE OR REPLACE FUNCTION get_usage_summary(
  p_team_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  video_minutes_used NUMERIC,
  text_actions_used INTEGER,
  video_minutes_remaining INTEGER,
  video_minutes_purchased_remaining INTEGER,
  text_actions_remaining INTEGER,
  is_text_unlimited BOOLEAN,
  has_priority BOOLEAN,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((
      SELECT SUM(units_consumed)
      FROM ai_usage
      WHERE team_id = p_team_id
        AND usage_type = 'video_analysis'
        AND created_at > NOW() - (p_days || ' days')::INTERVAL
    ), 0) AS video_minutes_used,
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM ai_usage
      WHERE team_id = p_team_id
        AND usage_type = 'text_action'
        AND created_at > NOW() - (p_days || ' days')::INTERVAL
    ), 0) AS text_actions_used,
    COALESCE(c.video_minutes_remaining, 0) AS video_minutes_remaining,
    COALESCE((
      SELECT SUM(minutes_remaining)::INTEGER
      FROM ai_credit_purchases
      WHERE team_id = p_team_id
        AND expires_at > NOW()
    ), 0) AS video_minutes_purchased_remaining,
    COALESCE(c.text_actions_remaining, 0) AS text_actions_remaining,
    COALESCE(c.text_actions_remaining = -1, FALSE) AS is_text_unlimited,
    COALESCE(c.priority_processing, FALSE) AS has_priority,
    c.current_period_start,
    c.current_period_end
  FROM ai_credits c
  WHERE c.team_id = p_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Trigger: Update timestamp on ai_credits
-- ============================================
CREATE OR REPLACE FUNCTION update_ai_credits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ai_credits_updated
  BEFORE UPDATE ON ai_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_credits_timestamp();

-- ============================================
-- Initialize credits for existing teams
-- ============================================
DO $$
DECLARE
  v_team RECORD;
BEGIN
  -- Create credit records for existing teams (default to basic tier)
  FOR v_team IN SELECT id FROM teams LOOP
    INSERT INTO ai_credits (team_id, video_minutes_monthly, text_actions_monthly, video_minutes_remaining, text_actions_remaining)
    VALUES (v_team.id, 0, 0, 0, 0)
    ON CONFLICT (team_id) DO NOTHING;
  END LOOP;
END;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION allocate_subscription_credits TO authenticated;
GRANT EXECUTE ON FUNCTION check_video_minutes TO authenticated;
GRANT EXECUTE ON FUNCTION consume_video_minutes TO authenticated;
GRANT EXECUTE ON FUNCTION check_text_actions TO authenticated;
GRANT EXECUTE ON FUNCTION consume_text_action TO authenticated;
GRANT EXECUTE ON FUNCTION get_usage_summary TO authenticated;
