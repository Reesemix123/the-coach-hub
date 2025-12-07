-- Migration 078: Signup Flow Updates
-- Supports new signup flow where users pay before creating a team

-- 1. Add stripe_customer_id to profiles table
-- This stores the Stripe customer ID for the user (for signup flow)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- 2. Add user_id to subscriptions table
-- This links subscription to user when team doesn't exist yet
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON subscriptions(user_id)
  WHERE user_id IS NOT NULL;

-- 3. Make team_id nullable
-- This allows subscriptions to exist before team is created
ALTER TABLE subscriptions
  ALTER COLUMN team_id DROP NOT NULL;

-- 4. Add check constraint to ensure either team_id OR user_id is set
-- (subscription must be linked to something)
ALTER TABLE subscriptions
  ADD CONSTRAINT chk_subscription_owner
  CHECK (team_id IS NOT NULL OR user_id IS NOT NULL);

-- 5. Add has_seen_tour to profiles for tour timing
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS has_seen_tour BOOLEAN DEFAULT FALSE;

-- 6. Add first_login_at to profiles to track first sign-in
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID for direct user billing (signup flow)';
COMMENT ON COLUMN profiles.has_seen_tour IS 'Whether the user has completed the onboarding tour';
COMMENT ON COLUMN profiles.first_login_at IS 'Timestamp of user first successful login';
COMMENT ON COLUMN subscriptions.user_id IS 'User who owns this subscription (for signup flow before team creation)';
