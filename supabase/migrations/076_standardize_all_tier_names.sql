-- Migration 076: Standardize All Tier Names
-- Updates subscriptions and team_analytics_config tables to use new tier naming:
-- little_league -> basic
-- hs_basic -> plus
-- hs_advanced -> premium
-- ai_powered stays the same

-- ============================================================================
-- Step 1: Update subscriptions table
-- ============================================================================

-- First, update existing data to new tier names
UPDATE subscriptions SET tier = 'basic' WHERE tier = 'little_league';
UPDATE subscriptions SET tier = 'plus' WHERE tier = 'hs_basic';
UPDATE subscriptions SET tier = 'premium' WHERE tier = 'hs_advanced';
-- ai_powered stays the same

-- Drop the old constraint
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

-- Add new constraint with standardized tier names only
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('basic', 'plus', 'premium', 'ai_powered'));

-- Update default value
ALTER TABLE subscriptions
  ALTER COLUMN tier SET DEFAULT 'plus';

-- ============================================================================
-- Step 2: Update team_analytics_config table
-- ============================================================================

-- First, update existing data to new tier names
UPDATE team_analytics_config SET tier = 'basic' WHERE tier = 'little_league';
UPDATE team_analytics_config SET tier = 'plus' WHERE tier = 'hs_basic';
UPDATE team_analytics_config SET tier = 'premium' WHERE tier = 'hs_advanced';
-- ai_powered stays the same

-- Drop the old constraint
ALTER TABLE team_analytics_config
  DROP CONSTRAINT IF EXISTS team_analytics_config_tier_check;

-- Add new constraint with standardized tier names only
ALTER TABLE team_analytics_config
  ADD CONSTRAINT team_analytics_config_tier_check
  CHECK (tier IN ('basic', 'plus', 'premium', 'ai_powered'));

-- Update default value
ALTER TABLE team_analytics_config
  ALTER COLUMN tier SET DEFAULT 'plus';

-- ============================================================================
-- Step 3: Update trial_requests to remove legacy tier names from constraint
-- ============================================================================

-- Drop the old constraint that allowed both old and new names
ALTER TABLE trial_requests
  DROP CONSTRAINT IF EXISTS trial_requests_requested_tier_check;

-- Add new constraint with only standardized tier names
ALTER TABLE trial_requests
  ADD CONSTRAINT trial_requests_requested_tier_check
  CHECK (requested_tier IN ('basic', 'plus', 'premium', 'ai_powered'));

-- ============================================================================
-- Step 4: Add comment for documentation
-- ============================================================================

COMMENT ON COLUMN subscriptions.tier IS 'Subscription tier: basic, plus, premium, ai_powered';
COMMENT ON COLUMN team_analytics_config.tier IS 'Analytics tier: basic, plus, premium, ai_powered';
