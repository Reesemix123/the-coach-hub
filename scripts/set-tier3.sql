-- Script to enable Tier 3 analytics for all teams
-- This enables defensive tracking, OL tracking, and all advanced features

-- First, let's see what teams exist and their current config
SELECT
  t.id as team_id,
  t.name as team_name,
  tac.tier,
  tac.enable_defensive_tracking,
  tac.enable_ol_tracking
FROM teams t
LEFT JOIN team_analytics_config tac ON t.id = tac.team_id;

-- Insert or update analytics config to Tier 3 for all teams
INSERT INTO team_analytics_config (
  team_id,
  tier,
  enable_drive_analytics,
  enable_player_attribution,
  enable_ol_tracking,
  enable_defensive_tracking,
  enable_situational_splits,
  default_tagging_mode,
  updated_at
)
SELECT
  id as team_id,
  'hs_advanced' as tier,
  true as enable_drive_analytics,
  true as enable_player_attribution,
  true as enable_ol_tracking,
  true as enable_defensive_tracking,
  true as enable_situational_splits,
  'advanced' as default_tagging_mode,
  NOW() as updated_at
FROM teams
ON CONFLICT (team_id)
DO UPDATE SET
  tier = 'hs_advanced',
  enable_drive_analytics = true,
  enable_player_attribution = true,
  enable_ol_tracking = true,
  enable_defensive_tracking = true,
  enable_situational_splits = true,
  default_tagging_mode = 'advanced',
  updated_at = NOW();

-- Verify the update
SELECT
  t.id as team_id,
  t.name as team_name,
  tac.tier,
  tac.enable_defensive_tracking,
  tac.enable_ol_tracking
FROM teams t
LEFT JOIN team_analytics_config tac ON t.id = tac.team_id;
