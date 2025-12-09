-- Migration: 080_disable_trials.sql
-- Disable trial functionality via platform config
-- This is Phase 0 of the subscription tier update

-- Delete any remaining trial subscriptions
DELETE FROM subscriptions WHERE status = 'trialing';

-- Set trial_enabled to false in platform_config
INSERT INTO platform_config (key, value, description, updated_at)
VALUES (
  'trial_enabled',
  'false',
  'Whether trial requests are currently accepted. Set to false to disable trial system.',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = 'false',
  description = 'Whether trial requests are currently accepted. Set to false to disable trial system.',
  updated_at = NOW();

-- Also update trial_config if it exists to mark as disabled
UPDATE platform_config
SET value = jsonb_set(
  CASE
    WHEN value::jsonb IS NOT NULL THEN value::jsonb
    ELSE '{}'::jsonb
  END,
  '{trial_enabled}',
  'false'::jsonb
),
updated_at = NOW()
WHERE key = 'trial_config';
