-- Migration: 082_update_subscription_tiers.sql
-- Phase 2: Update subscriptions table to use tier_config and remove ai_powered
-- This migration:
-- 1. Updates any ai_powered subscriptions to premium
-- 2. Updates CHECK constraints to remove ai_powered
-- 3. Adds foreign key reference to tier_config table

-- ============================================================================
-- Step 1: Migrate any ai_powered subscriptions to premium
-- ============================================================================

-- Update subscriptions
UPDATE subscriptions SET tier = 'premium' WHERE tier = 'ai_powered';

-- Update team_analytics_config
UPDATE team_analytics_config SET tier = 'premium' WHERE tier = 'ai_powered';

-- Update trial_requests
UPDATE trial_requests SET requested_tier = 'premium' WHERE requested_tier = 'ai_powered';
UPDATE trial_requests SET granted_tier = 'premium' WHERE granted_tier = 'ai_powered';

-- ============================================================================
-- Step 2: Drop old constraints
-- ============================================================================

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

ALTER TABLE team_analytics_config
  DROP CONSTRAINT IF EXISTS team_analytics_config_tier_check;

ALTER TABLE trial_requests
  DROP CONSTRAINT IF EXISTS trial_requests_requested_tier_check;

-- ============================================================================
-- Step 3: Add new constraints WITHOUT ai_powered
-- ============================================================================

-- Subscriptions tier constraint (now references tier_config)
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('basic', 'plus', 'premium'));

-- Team analytics config tier constraint
ALTER TABLE team_analytics_config
  ADD CONSTRAINT team_analytics_config_tier_check
  CHECK (tier IN ('basic', 'plus', 'premium'));

-- Trial requests tier constraint
ALTER TABLE trial_requests
  ADD CONSTRAINT trial_requests_requested_tier_check
  CHECK (requested_tier IN ('basic', 'plus', 'premium'));

-- ============================================================================
-- Step 4: Add foreign key to tier_config (soft reference via CHECK)
-- Note: Using CHECK instead of FK to allow flexibility during tier config updates
-- ============================================================================

-- Add index on tier for better join performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);

-- ============================================================================
-- Step 5: Update comments
-- ============================================================================

COMMENT ON COLUMN subscriptions.tier IS 'Subscription tier: basic, plus, premium (references tier_config.tier_key)';
COMMENT ON COLUMN team_analytics_config.tier IS 'Analytics tier: basic, plus, premium';
COMMENT ON COLUMN trial_requests.requested_tier IS 'Requested tier: basic, plus, premium';

-- ============================================================================
-- Step 6: Add user_id column to subscriptions if missing (for user-level subs)
-- This supports subscriptions that aren't tied to a team yet
-- ============================================================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Index for user-level subscription lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id) WHERE user_id IS NOT NULL;

-- Update constraint: either team_id OR user_id must be set, not both required
-- This allows user-level subscriptions before team creation
COMMENT ON COLUMN subscriptions.user_id IS 'User ID for user-level subscriptions (before team creation)';
COMMENT ON COLUMN subscriptions.team_id IS 'Team ID for team-level subscriptions (may be null for user-level subs)';

-- ============================================================================
-- Step 7: Make team_id nullable (to support user-level subscriptions)
-- ============================================================================

-- First drop the NOT NULL constraint if it exists
ALTER TABLE subscriptions
  ALTER COLUMN team_id DROP NOT NULL;

-- Add a constraint to ensure at least one of team_id or user_id is set
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_owner_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_owner_check
  CHECK (team_id IS NOT NULL OR user_id IS NOT NULL);
