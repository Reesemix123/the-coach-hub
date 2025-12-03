-- Migration 069: User Onboarding System
-- Purpose: Track onboarding tour and checklist state for coaches
-- Date: 2024-12-03

-- Create user_onboarding table
CREATE TABLE user_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  -- Tour state
  tour_completed_at TIMESTAMPTZ,
  tour_skipped_at TIMESTAMPTZ,

  -- Checklist state
  checklist_dismissed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, team_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_user_onboarding_user_id ON user_onboarding(user_id);
CREATE INDEX idx_user_onboarding_team_id ON user_onboarding(team_id);

-- Enable RLS
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own onboarding records
CREATE POLICY "Users can view their own onboarding records"
  ON user_onboarding
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding records"
  ON user_onboarding
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding records"
  ON user_onboarding
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_onboarding_updated_at
  BEFORE UPDATE ON user_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION update_user_onboarding_updated_at();
