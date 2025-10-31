-- Migration 007: Team Analytics Configuration (Tier Selection)
-- Enables per-team analytics tier selection
-- Tier 1: Little League | Tier 2: HS Basic | Tier 3: HS Advanced | Tier 4: AI-Powered (future)

CREATE TABLE team_analytics_config (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,

  -- Analytics tier selection
  tier TEXT NOT NULL DEFAULT 'hs_basic' CHECK (tier IN ('little_league', 'hs_basic', 'hs_advanced', 'ai_powered')),

  -- Feature flags (granular control within tiers)
  enable_drive_analytics BOOLEAN DEFAULT true,
  enable_player_attribution BOOLEAN DEFAULT true,
  enable_ol_tracking BOOLEAN DEFAULT false, -- Tier 3+
  enable_defensive_tracking BOOLEAN DEFAULT false, -- Tier 3+
  enable_situational_splits BOOLEAN DEFAULT false, -- Tier 3+

  -- UI preferences
  default_tagging_mode TEXT DEFAULT 'standard' CHECK (default_tagging_mode IN ('quick', 'standard', 'advanced')),

  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Trigger for updated_at
CREATE TRIGGER update_team_analytics_config_updated_at
  BEFORE UPDATE ON team_analytics_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE team_analytics_config ENABLE ROW LEVEL SECURITY;

-- Multi-coach aware policies
CREATE POLICY "Users can view analytics config for their teams"
  ON team_analytics_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_analytics_config.team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = team_analytics_config.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
  );

-- Only owners can change analytics config
CREATE POLICY "Team owners can update analytics config"
  ON team_analytics_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = team_analytics_config.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role = 'owner'
      AND team_memberships.is_active = true
    )
  );

-- Create default configs for existing teams
INSERT INTO team_analytics_config (team_id, tier)
SELECT id, 'hs_basic'
FROM teams
ON CONFLICT (team_id) DO NOTHING;

-- Helper function to get tier capabilities
CREATE OR REPLACE FUNCTION get_tier_capabilities(p_tier TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN CASE p_tier
    WHEN 'little_league' THEN jsonb_build_object(
      'max_fields', 6,
      'drive_analytics', false,
      'ol_tracking', false,
      'defensive_tracking', false,
      'situational_splits', false,
      'player_stats', 'basic'
    )
    WHEN 'hs_basic' THEN jsonb_build_object(
      'max_fields', 12,
      'drive_analytics', true,
      'ol_tracking', false,
      'defensive_tracking', false,
      'situational_splits', false,
      'player_stats', 'standard'
    )
    WHEN 'hs_advanced' THEN jsonb_build_object(
      'max_fields', 40,
      'drive_analytics', true,
      'ol_tracking', true,
      'defensive_tracking', true,
      'situational_splits', true,
      'player_stats', 'advanced'
    )
    WHEN 'ai_powered' THEN jsonb_build_object(
      'max_fields', 50,
      'drive_analytics', true,
      'ol_tracking', true,
      'defensive_tracking', true,
      'situational_splits', true,
      'player_stats', 'advanced',
      'ai_tagging', true
    )
    ELSE jsonb_build_object('error', 'invalid_tier')
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
