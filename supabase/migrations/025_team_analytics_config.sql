-- Migration 025: Team Analytics Configuration
-- Stores analytics tier setting per team

CREATE TABLE IF NOT EXISTS team_analytics_config (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('little_league', 'hs_basic', 'hs_advanced', 'ai_powered')) DEFAULT 'hs_basic',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE team_analytics_config ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view analytics config for their teams
CREATE POLICY "Users can view team analytics config"
  ON team_analytics_config
  FOR SELECT
  USING (
    team_id IN (
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update analytics config for their teams
CREATE POLICY "Users can update team analytics config"
  ON team_analytics_config
  FOR UPDATE
  USING (
    team_id IN (
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert analytics config for their teams
CREATE POLICY "Users can insert team analytics config"
  ON team_analytics_config
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- Create default configs for existing teams (default to hs_basic)
INSERT INTO team_analytics_config (team_id, tier)
SELECT id, 'hs_basic' FROM teams
ON CONFLICT (team_id) DO NOTHING;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_analytics_config_team_id ON team_analytics_config(team_id);
