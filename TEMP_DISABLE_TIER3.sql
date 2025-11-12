-- ============================================================================
-- TEMPORARY: Downgrade to Tier 2 to avoid defensive stats timeouts
-- ============================================================================
-- This will let you use the app while we fix the RPC functions
-- You can upgrade back to Tier 3 after migration 030 is fully applied
-- ============================================================================

UPDATE team_analytics_config
SET
  tier = 'hs_basic',
  enable_ol_tracking = false,
  enable_defensive_tracking = false
WHERE team_id = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

-- Verify
SELECT * FROM team_analytics_config
WHERE team_id = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

-- ============================================================================
-- After this, refresh your app
-- You should see analytics load WITHOUT defensive stats timeouts
-- ============================================================================
