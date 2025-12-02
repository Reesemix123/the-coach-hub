-- Migration 051: Admin Console Data Model Foundation
-- Block 1: Multi-tenant architecture with organizations, subscriptions, AI credits
--
-- This migration is ADDITIVE - no existing tables/columns are modified or removed
-- All FKs reference auth.users (Supabase Auth) not a 'users' table

-- ============================================================================
-- 1. ORGANIZATIONS TABLE
-- Groups teams under one billing account (school/athletic department)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Status: active, suspended, churned
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'churned')),

  -- Stripe integration (null until billing is set up)
  stripe_customer_id VARCHAR(255),

  -- Contact info for billing/notifications
  billing_email VARCHAR(255),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Updated_at trigger
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE organizations IS 'Groups teams under one billing account (school/athletic department)';

-- ============================================================================
-- 2. SUBSCRIPTIONS TABLE
-- Links team to billing tier (per-team billing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Tier matches team_analytics_config tiers
  -- Source of truth for what customer is PAYING for
  -- team_analytics_config.tier is what features are ENABLED (may differ during trials, etc.)
  tier VARCHAR(50) NOT NULL DEFAULT 'hs_basic'
    CHECK (tier IN ('little_league', 'hs_basic', 'hs_advanced', 'ai_powered')),

  -- Status: trialing, active, past_due, canceled, waived
  -- 'waived' = billing not required for this team (grandfathered, special deal, etc.)
  status VARCHAR(50) NOT NULL DEFAULT 'none'
    CHECK (status IN ('none', 'trialing', 'active', 'past_due', 'canceled', 'waived')),

  -- Billing can be waived at team level (separate from status for clarity)
  billing_waived BOOLEAN DEFAULT false,
  billing_waived_reason TEXT,
  billing_waived_by UUID REFERENCES auth.users(id),
  billing_waived_at TIMESTAMPTZ,

  -- Stripe integration
  stripe_subscription_id VARCHAR(255),
  stripe_price_id VARCHAR(255),

  -- Billing period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  -- Trial
  trial_ends_at TIMESTAMPTZ,

  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one subscription per team
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_team ON subscriptions(team_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Updated_at trigger
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE subscriptions IS 'Per-team billing subscription linked to Stripe';

-- ============================================================================
-- 3. AI_CREDITS TABLE
-- Tracks AI usage per team per billing period
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Credit allocation for this period
  credits_allowed INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,

  -- Period tracking (allows historical records)
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite unique: one record per team per period
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_credits_team_period ON ai_credits(team_id, period_start);
CREATE INDEX IF NOT EXISTS idx_ai_credits_period_end ON ai_credits(period_end);
CREATE INDEX IF NOT EXISTS idx_ai_credits_team ON ai_credits(team_id);

-- Updated_at trigger
CREATE TRIGGER update_ai_credits_updated_at
  BEFORE UPDATE ON ai_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE ai_credits IS 'AI credit allocation and usage per team per billing period';

-- ============================================================================
-- 4. PLATFORM_CONFIG TABLE
-- Key-value store for platform-wide settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Updated_at trigger
CREATE TRIGGER update_platform_config_updated_at
  BEFORE UPDATE ON platform_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed initial configuration
INSERT INTO platform_config (key, value, description) VALUES
  ('trial_enabled', 'false', 'Whether free trials are available (requires manual approval)'),
  ('trial_duration_days', '14', 'Length of trial period in days'),
  ('trial_allowed_tiers', '["little_league", "hs_basic"]', 'Which tiers can be trialed'),
  ('trial_ai_credits_limit', '25', 'AI credits allowed during trial'),
  ('tier_config', '{
    "little_league": {
      "name": "Little League",
      "description": "Perfect for youth football programs",
      "ai_credits": 0,
      "price_monthly": 0,
      "features": ["basic_tagging", "simple_stats", "participation_tracking"]
    },
    "hs_basic": {
      "name": "High School Basic",
      "description": "Essential tools for high school programs",
      "ai_credits": 100,
      "price_monthly": 29,
      "features": ["drive_analytics", "player_stats", "game_planning"]
    },
    "hs_advanced": {
      "name": "High School Pro",
      "description": "Advanced analytics and AI features",
      "ai_credits": 500,
      "price_monthly": 79,
      "features": ["ol_tracking", "defensive_tracking", "situational_splits", "ai_tagging"]
    },
    "ai_powered": {
      "name": "AI Powered",
      "description": "Full AI automation and insights",
      "ai_credits": 2000,
      "price_monthly": 149,
      "features": ["auto_film_parsing", "strategy_assistant", "predictive_analytics"]
    }
  }', 'Tier definitions with features, pricing, and AI credits')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE platform_config IS 'Platform-wide configuration settings (managed by platform admin)';

-- ============================================================================
-- 5. AUDIT_LOGS TABLE
-- Records admin actions and important events
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Who performed the action (null for system actions)
  actor_id UUID REFERENCES auth.users(id),
  actor_email VARCHAR(255), -- Denormalized for easier searching

  -- What action was performed
  action VARCHAR(100) NOT NULL,

  -- What was affected
  target_type VARCHAR(50), -- organization, team, user, subscription, config
  target_id UUID,
  target_name VARCHAR(255), -- Denormalized for easier reading

  -- Additional context
  metadata JSONB,

  -- Request info
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

COMMENT ON TABLE audit_logs IS 'Audit trail for admin actions and important system events';

-- ============================================================================
-- 6. INVOICES TABLE (Optional - supplements Stripe data)
-- Caches invoice data for quick access without Stripe API calls
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Stripe reference
  stripe_invoice_id VARCHAR(255) UNIQUE,

  -- Invoice details
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',

  -- Status: draft, open, paid, void, uncollectible
  status VARCHAR(50) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),

  -- Dates
  invoice_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- PDF link
  invoice_pdf_url TEXT,

  -- Line items (denormalized for display)
  line_items JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

COMMENT ON TABLE invoices IS 'Cached invoice data from Stripe (organization-level billing)';

-- ============================================================================
-- 7. ADD COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add organization_id and is_platform_admin to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_organization ON profiles(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_platform_admin ON profiles(is_platform_admin) WHERE is_platform_admin = true;

-- Add organization_id to teams table
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_teams_organization ON teams(organization_id) WHERE organization_id IS NOT NULL;

-- ============================================================================
-- 8. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Organizations RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Platform admins can see all organizations
CREATE POLICY "Platform admins can view all organizations"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Organization owners can view their own organization
CREATE POLICY "Organization owners can view own organization"
  ON organizations FOR SELECT
  USING (owner_user_id = auth.uid());

-- Members can view their organization
CREATE POLICY "Members can view their organization"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Platform admins can manage all organizations
CREATE POLICY "Platform admins can manage organizations"
  ON organizations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Organization owners can update their own organization
CREATE POLICY "Organization owners can update own organization"
  ON organizations FOR UPDATE
  USING (owner_user_id = auth.uid());

-- Subscriptions RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Platform admins can see all subscriptions
CREATE POLICY "Platform admins can view all subscriptions"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Team members can view their team's subscription
CREATE POLICY "Team members can view team subscription"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = subscriptions.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = subscriptions.team_id
      AND teams.user_id = auth.uid()
    )
  );

-- Platform admins can manage all subscriptions
CREATE POLICY "Platform admins can manage subscriptions"
  ON subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- AI Credits RLS
ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;

-- Platform admins can see all AI credits
CREATE POLICY "Platform admins can view all ai_credits"
  ON ai_credits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Team members can view their team's AI credits
CREATE POLICY "Team members can view team ai_credits"
  ON ai_credits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = ai_credits.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = ai_credits.team_id
      AND teams.user_id = auth.uid()
    )
  );

-- Platform admins can manage all AI credits
CREATE POLICY "Platform admins can manage ai_credits"
  ON ai_credits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Platform Config RLS (admin only)
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Platform admins can read config
CREATE POLICY "Platform admins can view platform_config"
  ON platform_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Platform admins can manage config
CREATE POLICY "Platform admins can manage platform_config"
  ON platform_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Audit Logs RLS (admin read-only, system insert)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Platform admins can view audit logs
CREATE POLICY "Platform admins can view audit_logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Service role can insert audit logs (for system/API use)
CREATE POLICY "Service role can insert audit_logs"
  ON audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Authenticated users can insert their own audit logs
CREATE POLICY "Users can insert own audit_logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- Invoices RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Platform admins can see all invoices
CREATE POLICY "Platform admins can view all invoices"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Organization owners can view their invoices
CREATE POLICY "Organization owners can view own invoices"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = invoices.organization_id
      AND organizations.owner_user_id = auth.uid()
    )
  );

-- Platform admins can manage all invoices
CREATE POLICY "Platform admins can manage invoices"
  ON invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- Function to get current AI credits for a team
CREATE OR REPLACE FUNCTION get_team_ai_credits(p_team_id UUID)
RETURNS TABLE (
  credits_allowed INTEGER,
  credits_used INTEGER,
  credits_remaining INTEGER,
  period_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.credits_allowed,
    ac.credits_used,
    ac.credits_allowed - ac.credits_used AS credits_remaining,
    ac.period_end
  FROM ai_credits ac
  WHERE ac.team_id = p_team_id
    AND ac.period_start <= NOW()
    AND ac.period_end > NOW()
  ORDER BY ac.period_start DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to use AI credits (returns true if successful, false if insufficient)
CREATE OR REPLACE FUNCTION use_ai_credits(p_team_id UUID, p_amount INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
  v_credits_remaining INTEGER;
BEGIN
  -- Get current credits
  SELECT credits_allowed - credits_used INTO v_credits_remaining
  FROM ai_credits
  WHERE team_id = p_team_id
    AND period_start <= NOW()
    AND period_end > NOW()
  FOR UPDATE;

  -- Check if sufficient credits
  IF v_credits_remaining IS NULL OR v_credits_remaining < p_amount THEN
    RETURN false;
  END IF;

  -- Deduct credits
  UPDATE ai_credits
  SET credits_used = credits_used + p_amount,
      updated_at = NOW()
  WHERE team_id = p_team_id
    AND period_start <= NOW()
    AND period_end > NOW();

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log audit event
CREATE OR REPLACE FUNCTION log_audit_event(
  p_actor_id UUID,
  p_action VARCHAR(100),
  p_target_type VARCHAR(50) DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_target_name VARCHAR(255) DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_actor_email VARCHAR(255);
  v_log_id UUID;
BEGIN
  -- Get actor email for denormalization
  SELECT email INTO v_actor_email
  FROM profiles
  WHERE id = p_actor_id;

  -- Insert audit log
  INSERT INTO audit_logs (
    actor_id, actor_email, action, target_type, target_id, target_name, metadata
  ) VALUES (
    p_actor_id, v_actor_email, p_action, p_target_type, p_target_id, p_target_name, p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_team_ai_credits IS 'Get current AI credit balance for a team';
COMMENT ON FUNCTION use_ai_credits IS 'Deduct AI credits from team balance (returns false if insufficient)';
COMMENT ON FUNCTION log_audit_event IS 'Log an audit event with actor and target info';
