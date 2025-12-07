-- Migration 079: Allow all authenticated users to read public config values
-- This fixes the "Billing is not enabled" error for regular users

-- Add policy for reading public config keys (stripe_enabled, ai_enabled, maintenance_mode)
CREATE POLICY "All users can read public config"
  ON platform_config
  FOR SELECT
  TO authenticated
  USING (key IN ('stripe_enabled', 'ai_enabled', 'maintenance_mode', 'trial_config'));

COMMENT ON POLICY "All users can read public config" ON platform_config IS
  'Allows authenticated users to read public platform settings like stripe_enabled';
