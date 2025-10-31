-- Migration 006: Players Table (Roster Management)
-- Supports all analytics tiers (Little League through AI-Powered)
-- Enables player attribution, depth charts, and position-specific analytics

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Player identity
  jersey_number VARCHAR(3) NOT NULL, -- Support 2-3 digit numbers
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,

  -- Position information
  primary_position VARCHAR(20) NOT NULL, -- QB, RB, WR, TE, LT, LG, C, RG, RT, DE, DT, LB, CB, S, K, P
  secondary_position VARCHAR(20), -- Multi-position players
  position_group VARCHAR(20) NOT NULL CHECK (position_group IN ('offense', 'defense', 'special_teams')),

  -- Depth chart
  depth_order INTEGER DEFAULT 1, -- 1 = starter, 2 = backup, etc.
  is_active BOOLEAN DEFAULT true,

  -- Player details (optional, useful for little league parent communication)
  grade_level VARCHAR(20), -- '5th', '6th', 'Freshman', 'Sophomore', 'Junior', 'Senior'
  weight INTEGER, -- lbs
  height INTEGER, -- inches (e.g., 72 = 6'0")

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_players_jersey ON players(team_id, jersey_number);
CREATE INDEX idx_players_position ON players(position_group, primary_position);
CREATE INDEX idx_players_active ON players(team_id, is_active);
CREATE INDEX idx_players_depth ON players(team_id, depth_order) WHERE is_active = true;

-- Unique constraint: one active player per jersey number per team
CREATE UNIQUE INDEX idx_players_team_jersey_unique
  ON players(team_id, jersey_number)
  WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Multi-coach aware policies
CREATE POLICY "Users can view players for teams they have access to"
  ON players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = players.team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = players.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Owners and coaches can create players"
  ON players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = players.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach')
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Owners and coaches can update players"
  ON players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = players.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach')
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Only owners can delete players"
  ON players FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = players.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role = 'owner'
      AND team_memberships.is_active = true
    )
  );
