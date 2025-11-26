-- ============================================================================
-- Fix Existing Turnovers
-- ============================================================================
-- Updates existing plays that have is_forced_fumble or is_interception
-- but weren't marked as is_turnover = true
-- ============================================================================

-- Check how many plays need to be fixed
SELECT
  COUNT(*) AS plays_to_fix,
  COUNT(*) FILTER (WHERE is_forced_fumble = true) AS forced_fumbles,
  COUNT(*) FILTER (WHERE is_interception = true) AS interceptions
FROM play_instances
WHERE (is_forced_fumble = true OR is_interception = true)
  AND is_turnover = false;

-- Update the plays
UPDATE play_instances
SET
  is_turnover = true,
  turnover_type = CASE
    WHEN is_interception = true THEN 'interception'
    WHEN is_forced_fumble = true THEN 'fumble'
    ELSE turnover_type
  END
WHERE (is_forced_fumble = true OR is_interception = true)
  AND is_turnover = false;

-- Verify the fix
SELECT
  id,
  play_code,
  is_forced_fumble,
  is_interception,
  is_turnover,
  turnover_type
FROM play_instances
WHERE is_forced_fumble = true OR is_interception = true
ORDER BY created_at DESC
LIMIT 20;
