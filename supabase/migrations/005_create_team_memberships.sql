-- Migration 005: Team Memberships (Multi-Coach Support)
-- Enables multiple coaches to collaborate on a single team
-- Backward compatible: teams.user_id remains as primary owner

CREATE TABLE team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Role-based access control
  role TEXT NOT NULL CHECK (role IN ('owner', 'coach', 'analyst', 'viewer')),

  -- Invitation tracking
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one user can only have one role per team
  UNIQUE(team_id, user_id)
);

-- Indexes for common queries
CREATE INDEX idx_team_memberships_user ON team_memberships(user_id);
CREATE INDEX idx_team_memberships_team ON team_memberships(team_id);
CREATE INDEX idx_team_memberships_active ON team_memberships(team_id, is_active);

-- Trigger for updated_at
CREATE TRIGGER update_team_memberships_updated_at
  BEFORE UPDATE ON team_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;

-- Users can view memberships for teams they belong to
CREATE POLICY "Users can view team memberships for their teams"
  ON team_memberships FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_memberships.team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships tm
      WHERE tm.team_id = team_memberships.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'coach')
    )
  );

-- Only owners can add members
CREATE POLICY "Team owners can add members"
  ON team_memberships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_id = team_memberships.team_id
      AND user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- Only owners can update roles
CREATE POLICY "Team owners can update memberships"
  ON team_memberships FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships tm
      WHERE tm.team_id = team_memberships.team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'owner'
    )
  );

-- Only owners can remove members
CREATE POLICY "Team owners can remove members"
  ON team_memberships FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships tm
      WHERE tm.team_id = team_memberships.team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'owner'
    )
  );

-- Populate existing team owners as members
-- This ensures backward compatibility
INSERT INTO team_memberships (team_id, user_id, role, invited_by)
SELECT id, user_id, 'owner', user_id
FROM teams
WHERE user_id IS NOT NULL
ON CONFLICT (team_id, user_id) DO NOTHING;
