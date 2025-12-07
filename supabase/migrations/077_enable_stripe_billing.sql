-- Migration 077: Enable Stripe Billing
-- Adds stripe_enabled configuration to platform_config

-- Insert stripe_enabled config (allows Stripe billing to work)
INSERT INTO platform_config (key, value, description)
VALUES (
  'stripe_enabled',
  '{"enabled": true}',
  'Enable/disable Stripe billing integration'
)
ON CONFLICT (key) DO UPDATE SET
  value = '{"enabled": true}',
  updated_at = NOW();

-- Also ensure AI is properly configured (set to disabled for now)
INSERT INTO platform_config (key, value, description)
VALUES (
  'ai_enabled',
  '{"enabled": false}',
  'Enable/disable AI features platform-wide'
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON COLUMN platform_config.value IS 'JSON value - for boolean configs use {"enabled": true/false}';
