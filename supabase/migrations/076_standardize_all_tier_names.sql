-- Migration 076: Standardize All Tier Names
-- Updates subscriptions and team_analytics_config tables to use new tier naming:
-- little_league -> basic
-- hs_basic -> plus
-- hs_advanced -> premium
-- ai_powered stays the same

-- ============================================================================
-- Step 1: Drop ALL constraints FIRST (before any data changes)
-- ============================================================================

-- Drop subscriptions constraint
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

-- Drop team_analytics_config constraint
ALTER TABLE team_analytics_config
  DROP CONSTRAINT IF EXISTS team_analytics_config_tier_check;

-- Drop trial_requests constraint
ALTER TABLE trial_requests
  DROP CONSTRAINT IF EXISTS trial_requests_requested_tier_check;

-- ============================================================================
-- Step 2: Update all data to new tier names
-- ============================================================================

-- Update subscriptions table
UPDATE subscriptions SET tier = 'basic' WHERE tier = 'little_league';
UPDATE subscriptions SET tier = 'plus' WHERE tier = 'hs_basic';
UPDATE subscriptions SET tier = 'premium' WHERE tier = 'hs_advanced';

-- Update team_analytics_config table
UPDATE team_analytics_config SET tier = 'basic' WHERE tier = 'little_league';
UPDATE team_analytics_config SET tier = 'plus' WHERE tier = 'hs_basic';
UPDATE team_analytics_config SET tier = 'premium' WHERE tier = 'hs_advanced';

-- Update trial_requests table (should already be done by migration 075, but just in case)
UPDATE trial_requests SET requested_tier = 'basic' WHERE requested_tier = 'little_league';
UPDATE trial_requests SET requested_tier = 'plus' WHERE requested_tier = 'hs_basic';
UPDATE trial_requests SET requested_tier = 'premium' WHERE requested_tier = 'hs_advanced';

-- ============================================================================
-- Step 3: Add new constraints with standardized tier names
-- ============================================================================

-- Add subscriptions constraint
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('basic', 'plus', 'premium', 'ai_powered'));

-- Update subscriptions default value
ALTER TABLE subscriptions
  ALTER COLUMN tier SET DEFAULT 'plus';

-- Add team_analytics_config constraint
ALTER TABLE team_analytics_config
  ADD CONSTRAINT team_analytics_config_tier_check
  CHECK (tier IN ('basic', 'plus', 'premium', 'ai_powered'));

-- Update team_analytics_config default value
ALTER TABLE team_analytics_config
  ALTER COLUMN tier SET DEFAULT 'plus';

-- Add trial_requests constraint
ALTER TABLE trial_requests
  ADD CONSTRAINT trial_requests_requested_tier_check
  CHECK (requested_tier IN ('basic', 'plus', 'premium', 'ai_powered'));

-- ============================================================================
-- Step 4: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN subscriptions.tier IS 'Subscription tier: basic, plus, premium, ai_powered';
COMMENT ON COLUMN team_analytics_config.tier IS 'Analytics tier: basic, plus, premium, ai_powered';
