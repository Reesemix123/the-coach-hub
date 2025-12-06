-- Migration 075: Update Tier Names and Add Granted Tier
-- Updates trial_requests to use standardized tier names (basic, plus, premium, ai_powered)
-- and adds granted_tier column for admin tier selection

-- ============================================================================
-- Step 1: Add granted_tier column
-- ============================================================================

ALTER TABLE trial_requests
  ADD COLUMN IF NOT EXISTS granted_tier TEXT;

COMMENT ON COLUMN trial_requests.granted_tier IS 'The tier actually granted by admin (may differ from requested_tier)';

-- ============================================================================
-- Step 2: Update the requested_tier constraint to allow new tier names
-- ============================================================================

-- Drop the old constraint
ALTER TABLE trial_requests
  DROP CONSTRAINT IF EXISTS trial_requests_requested_tier_check;

-- Add new constraint that allows both old and new tier names
-- (for backward compatibility with existing data)
ALTER TABLE trial_requests
  ADD CONSTRAINT trial_requests_requested_tier_check
  CHECK (requested_tier IN (
    -- New standardized tier names
    'basic', 'plus', 'premium', 'ai_powered',
    -- Legacy tier names (for existing records)
    'little_league', 'hs_basic', 'hs_advanced'
  ));

-- ============================================================================
-- Step 3: Add constraint for granted_tier column
-- ============================================================================

ALTER TABLE trial_requests
  ADD CONSTRAINT trial_requests_granted_tier_check
  CHECK (granted_tier IS NULL OR granted_tier IN (
    'basic', 'plus', 'premium', 'ai_powered'
  ));

-- ============================================================================
-- Step 4: Migrate existing data to new tier names (optional)
-- ============================================================================

-- Update existing records to use new tier names
-- little_league -> basic
-- hs_basic -> plus
-- hs_advanced -> premium
-- ai_powered stays the same

UPDATE trial_requests SET requested_tier = 'basic' WHERE requested_tier = 'little_league';
UPDATE trial_requests SET requested_tier = 'plus' WHERE requested_tier = 'hs_basic';
UPDATE trial_requests SET requested_tier = 'premium' WHERE requested_tier = 'hs_advanced';

-- Also update granted_tier if it has legacy values (shouldn't have any, but just in case)
UPDATE trial_requests SET granted_tier = 'basic' WHERE granted_tier = 'little_league';
UPDATE trial_requests SET granted_tier = 'plus' WHERE granted_tier = 'hs_basic';
UPDATE trial_requests SET granted_tier = 'premium' WHERE granted_tier = 'hs_advanced';
