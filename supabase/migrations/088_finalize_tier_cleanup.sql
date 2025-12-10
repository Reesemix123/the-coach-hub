-- Migration: 088_finalize_tier_cleanup.sql
-- Finalizes the subscription model cleanup:
-- 1. Removes any remaining ai_powered tier references
-- 2. Drops ai_credit_purchases table (minute packs removed)
-- 3. Updates tier_config with Stripe price IDs
-- 4. Cleans up legacy AI usage tracking

-- ============================================================================
-- STEP 1: Ensure no ai_powered subscriptions remain
-- ============================================================================

-- Convert any remaining ai_powered subscriptions to premium
UPDATE subscriptions
SET tier = 'premium', updated_at = NOW()
WHERE tier = 'ai_powered';

-- Update any remaining ai_powered analytics configs
UPDATE team_analytics_config
SET tier = 'premium', updated_at = NOW()
WHERE tier = 'ai_powered';

-- ============================================================================
-- STEP 2: Drop minute pack related tables and columns
-- ============================================================================

-- Drop the ai_credit_purchases table (minute packs no longer offered)
DROP TABLE IF EXISTS ai_credit_purchases CASCADE;

-- Drop functions related to minute purchases if they exist
DROP FUNCTION IF EXISTS consume_video_minutes(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS check_video_minutes(UUID) CASCADE;

-- ============================================================================
-- STEP 3: Update tier_config with Stripe price IDs
-- (These will be populated via admin UI or direct update with actual Stripe IDs)
-- ============================================================================

-- Add stripe_price_id columns if they don't exist (they should from 081)
-- Just ensure the prices are correct
UPDATE tier_config SET
  price_monthly_cents = 0,
  price_yearly_cents = 0
WHERE tier_key = 'basic';

UPDATE tier_config SET
  price_monthly_cents = 2900,  -- $29/month
  price_yearly_cents = 29000   -- $290/year
WHERE tier_key = 'plus';

UPDATE tier_config SET
  price_monthly_cents = 7900,  -- $79/month
  price_yearly_cents = 79000   -- $790/year
WHERE tier_key = 'premium';

-- ============================================================================
-- STEP 4: Clean up old AI usage related views and functions
-- ============================================================================

-- Drop legacy AI usage functions that referenced ai_powered tier
DROP FUNCTION IF EXISTS allocate_subscription_credits(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS check_text_actions(UUID) CASCADE;
DROP FUNCTION IF EXISTS consume_text_action(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_usage_summary(UUID) CASCADE;

-- ============================================================================
-- STEP 5: Ensure subscription tier check constraint is updated
-- ============================================================================

-- Drop old constraint if exists
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS valid_tier;

-- Add new constraint with only valid tiers
ALTER TABLE subscriptions ADD CONSTRAINT valid_tier
  CHECK (tier IN ('basic', 'plus', 'premium'));

-- Same for team_analytics_config
ALTER TABLE team_analytics_config DROP CONSTRAINT IF EXISTS team_analytics_config_tier_check;
ALTER TABLE team_analytics_config DROP CONSTRAINT IF EXISTS valid_analytics_tier;

ALTER TABLE team_analytics_config ADD CONSTRAINT valid_analytics_tier
  CHECK (tier IN ('basic', 'plus', 'premium'));

-- ============================================================================
-- STEP 6: Clean up platform_config entries for removed tiers
-- ============================================================================

-- Remove any ai_powered tier configuration
DELETE FROM platform_config WHERE key = 'tier_config_ai_powered';

-- Remove minute pack pricing configuration if exists
DELETE FROM platform_config WHERE key LIKE 'ai_minutes%';
DELETE FROM platform_config WHERE key LIKE 'minute_pack%';

-- ============================================================================
-- STEP 7: Add comment documenting the subscription model
-- ============================================================================

COMMENT ON TABLE tier_config IS 'Single source of truth for subscription tiers: basic (free), plus ($29/mo), premium ($79/mo). ai_powered tier was removed.';

COMMENT ON TABLE subscriptions IS 'Team subscriptions. Valid tiers: basic, plus, premium. Status: active, canceled, past_due, trialing';
