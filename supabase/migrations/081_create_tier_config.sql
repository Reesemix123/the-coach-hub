-- Migration: 081_create_tier_config.sql
-- Phase 1: Create tier configuration table - the single source of truth for all tier definitions
-- This is the foundation for the new subscription system

-- ============================================================================
-- TIER_CONFIG TABLE
-- Stores all tier attributes in one authoritative place
-- ============================================================================

CREATE TABLE IF NOT EXISTS tier_config (
  -- Primary key
  tier_key VARCHAR(50) PRIMARY KEY,

  -- Display information
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  tagline VARCHAR(255),

  -- Game & Storage Limits
  max_active_games INTEGER, -- NULL = unlimited (retention-based)
  max_team_games INTEGER,   -- For Basic: 1, NULL for others
  max_opponent_games INTEGER, -- For Basic: 1, NULL for others
  retention_days INTEGER NOT NULL DEFAULT 30,
  max_cameras_per_game INTEGER NOT NULL DEFAULT 1,

  -- Upload Token System
  monthly_upload_tokens INTEGER NOT NULL DEFAULT 2,
  token_rollover_cap INTEGER NOT NULL DEFAULT 2,

  -- Video Requirements (same for all tiers, but configurable)
  max_video_duration_seconds INTEGER NOT NULL DEFAULT 10800, -- 3 hours
  max_resolution VARCHAR(20) NOT NULL DEFAULT '1080p',
  max_fps INTEGER NOT NULL DEFAULT 60,

  -- AI Features
  ai_chat_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ai_film_tagging_enabled BOOLEAN NOT NULL DEFAULT FALSE, -- Disabled for MVP
  ai_film_credits_monthly INTEGER NOT NULL DEFAULT 0, -- Placeholder for future

  -- Stripe Integration (to be filled in after creating Stripe products)
  stripe_price_id_monthly VARCHAR(255),
  stripe_price_id_yearly VARCHAR(255),
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  price_yearly_cents INTEGER NOT NULL DEFAULT 0,

  -- UI/Display
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  features JSONB DEFAULT '[]'::jsonb, -- Array of feature strings for display

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: tier_key must be lowercase alphanumeric
ALTER TABLE tier_config ADD CONSTRAINT tier_key_format
  CHECK (tier_key ~ '^[a-z][a-z0-9_]*$');

-- Constraint: rollover cap must be >= monthly tokens
ALTER TABLE tier_config ADD CONSTRAINT valid_rollover_cap
  CHECK (token_rollover_cap >= monthly_upload_tokens);

-- Constraint: retention days must be positive
ALTER TABLE tier_config ADD CONSTRAINT valid_retention_days
  CHECK (retention_days > 0);

-- Constraint: cameras per game must be at least 1
ALTER TABLE tier_config ADD CONSTRAINT valid_cameras
  CHECK (max_cameras_per_game >= 1);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_tier_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tier_config_updated_at
  BEFORE UPDATE ON tier_config
  FOR EACH ROW
  EXECUTE FUNCTION update_tier_config_updated_at();

-- ============================================================================
-- SEED DATA: Three Tiers (Basic, Plus, Premium)
-- ============================================================================

INSERT INTO tier_config (
  tier_key,
  display_name,
  description,
  tagline,
  max_active_games,
  max_team_games,
  max_opponent_games,
  retention_days,
  max_cameras_per_game,
  monthly_upload_tokens,
  token_rollover_cap,
  max_video_duration_seconds,
  max_resolution,
  max_fps,
  ai_chat_enabled,
  ai_film_tagging_enabled,
  ai_film_credits_monthly,
  price_monthly_cents,
  price_yearly_cents,
  sort_order,
  is_active,
  features
) VALUES
-- BASIC TIER ($0/month)
(
  'basic',
  'Basic',
  'Essential game planning tools for new coaches and small programs.',
  'Essential Game Planning',
  2,        -- max_active_games: 2 total (1 team + 1 opponent)
  1,        -- max_team_games: 1
  1,        -- max_opponent_games: 1
  30,       -- retention_days: 30 days
  1,        -- max_cameras_per_game: 1 angle
  2,        -- monthly_upload_tokens: 2
  2,        -- token_rollover_cap: 2
  10800,    -- max_video_duration_seconds: 3 hours
  '1080p',  -- max_resolution
  60,       -- max_fps
  TRUE,     -- ai_chat_enabled
  FALSE,    -- ai_film_tagging_enabled (future)
  0,        -- ai_film_credits_monthly (placeholder)
  0,        -- price_monthly_cents: FREE
  0,        -- price_yearly_cents: FREE
  1,        -- sort_order
  TRUE,     -- is_active
  '["Digital Playbook", "1 Team Game + 1 Opponent Game", "30-Day Film Retention", "1 Camera Angle per Game", "2 Monthly Upload Tokens", "AI Chat Assistant"]'::jsonb
),
-- PLUS TIER ($29/month, $290/year)
(
  'plus',
  'Plus',
  'Full season workflow for active coaches who want to scout opponents and analyze games.',
  'Full Season Workflow',
  NULL,     -- max_active_games: unlimited (retention-based)
  NULL,     -- max_team_games: unlimited
  NULL,     -- max_opponent_games: unlimited
  180,      -- retention_days: 180 days (6 months)
  3,        -- max_cameras_per_game: 3 angles
  4,        -- monthly_upload_tokens: 4
  5,        -- token_rollover_cap: 5
  10800,    -- max_video_duration_seconds: 3 hours
  '1080p',  -- max_resolution
  60,       -- max_fps
  TRUE,     -- ai_chat_enabled
  FALSE,    -- ai_film_tagging_enabled (future)
  0,        -- ai_film_credits_monthly (placeholder)
  2900,     -- price_monthly_cents: $29
  29000,    -- price_yearly_cents: $290 (save ~17%)
  2,        -- sort_order
  TRUE,     -- is_active
  '["Digital Playbook", "Unlimited Games", "180-Day Film Retention", "3 Camera Angles per Game", "4 Monthly Upload Tokens (5 Max Rollover)", "Full Analytics Dashboard", "Drive-by-Drive Analysis", "AI Chat Assistant"]'::jsonb
),
-- PREMIUM TIER ($79/month, $790/year)
(
  'premium',
  'Premium',
  'Year-round performance tracking for clubs and advanced programs.',
  'Year-Round Performance',
  NULL,     -- max_active_games: unlimited (retention-based)
  NULL,     -- max_team_games: unlimited
  NULL,     -- max_opponent_games: unlimited
  365,      -- retention_days: 365 days (full year)
  5,        -- max_cameras_per_game: 5 angles
  8,        -- monthly_upload_tokens: 8
  10,       -- token_rollover_cap: 10
  10800,    -- max_video_duration_seconds: 3 hours
  '1080p',  -- max_resolution
  60,       -- max_fps
  TRUE,     -- ai_chat_enabled
  FALSE,    -- ai_film_tagging_enabled (future)
  0,        -- ai_film_credits_monthly (placeholder)
  7900,     -- price_monthly_cents: $79
  79000,    -- price_yearly_cents: $790 (save ~17%)
  3,        -- sort_order
  TRUE,     -- is_active
  '["Digital Playbook", "Unlimited Games", "365-Day Film Retention", "5 Camera Angles per Game", "8 Monthly Upload Tokens (10 Max Rollover)", "Advanced Analytics", "O-Line Grading", "Player Performance Tracking", "AI Chat Assistant"]'::jsonb
)
ON CONFLICT (tier_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  tagline = EXCLUDED.tagline,
  max_active_games = EXCLUDED.max_active_games,
  max_team_games = EXCLUDED.max_team_games,
  max_opponent_games = EXCLUDED.max_opponent_games,
  retention_days = EXCLUDED.retention_days,
  max_cameras_per_game = EXCLUDED.max_cameras_per_game,
  monthly_upload_tokens = EXCLUDED.monthly_upload_tokens,
  token_rollover_cap = EXCLUDED.token_rollover_cap,
  max_video_duration_seconds = EXCLUDED.max_video_duration_seconds,
  max_resolution = EXCLUDED.max_resolution,
  max_fps = EXCLUDED.max_fps,
  ai_chat_enabled = EXCLUDED.ai_chat_enabled,
  ai_film_tagging_enabled = EXCLUDED.ai_film_tagging_enabled,
  ai_film_credits_monthly = EXCLUDED.ai_film_credits_monthly,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_yearly_cents = EXCLUDED.price_yearly_cents,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  features = EXCLUDED.features,
  updated_at = NOW();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE tier_config ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can view tier definitions)
CREATE POLICY "tier_config_public_read" ON tier_config
  FOR SELECT
  USING (true);

-- Only platform admins can modify (via profiles.is_platform_admin)
CREATE POLICY "tier_config_admin_modify" ON tier_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tier_config IS 'Single source of truth for all subscription tier definitions';
COMMENT ON COLUMN tier_config.tier_key IS 'Unique identifier for the tier (basic, plus, premium)';
COMMENT ON COLUMN tier_config.max_active_games IS 'Max concurrent active games. NULL = unlimited (retention-based)';
COMMENT ON COLUMN tier_config.max_team_games IS 'Max team games for Basic tier. NULL = no limit';
COMMENT ON COLUMN tier_config.max_opponent_games IS 'Max opponent scouting games for Basic tier. NULL = no limit';
COMMENT ON COLUMN tier_config.retention_days IS 'Days before game film expires and is deleted';
COMMENT ON COLUMN tier_config.max_cameras_per_game IS 'Maximum camera angles allowed per game';
COMMENT ON COLUMN tier_config.monthly_upload_tokens IS 'Tokens granted each billing cycle';
COMMENT ON COLUMN tier_config.token_rollover_cap IS 'Maximum tokens that can roll over between periods';
COMMENT ON COLUMN tier_config.ai_film_tagging_enabled IS 'Whether AI film tagging is available (future feature)';
COMMENT ON COLUMN tier_config.features IS 'JSON array of feature strings for marketing/UI display';
