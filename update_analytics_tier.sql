-- Update analytics tier to hs_advanced for your team
-- Run this in Supabase SQL Editor

UPDATE team_analytics_config
SET tier = 'hs_advanced', updated_at = now()
WHERE team_id IN (
  SELECT id FROM teams WHERE user_id = '2c2cecd8-fd1c-495b-8c68-418ecb4d6302'
);

-- Verify the update
SELECT
  t.name as team_name,
  tac.tier,
  tac.updated_at
FROM teams t
JOIN team_analytics_config tac ON t.id = tac.team_id
WHERE t.user_id = '2c2cecd8-fd1c-495b-8c68-418ecb4d6302';
