-- Migration 120: Team Invites (Pending Invitations for New Users)
-- Allows inviting coaches who don't have an account yet
-- They can sign up and automatically join the team

CREATE TABLE team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Invitation details
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'coach' CHECK (role IN ('owner', 'coach', 'analyst', 'viewer')),

  -- Secure token for accepting invite
  token UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Invitation tracking
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate pending invites for same email/team (partial unique index)
CREATE UNIQUE INDEX idx_team_invites_unique_pending
  ON team_invites(team_id, email)
  WHERE (status = 'pending');

-- Indexes for common queries
CREATE INDEX idx_team_invites_team ON team_invites(team_id);
CREATE INDEX idx_team_invites_email ON team_invites(email);
CREATE INDEX idx_team_invites_token ON team_invites(token);
CREATE INDEX idx_team_invites_pending ON team_invites(status) WHERE (status = 'pending');

-- Trigger for updated_at
CREATE TRIGGER update_team_invites_updated_at
  BEFORE UPDATE ON team_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Team owners and coaches can view invites for their teams
CREATE POLICY "Team members can view invites"
  ON team_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_invites.team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships tm
      WHERE tm.team_id = team_invites.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'coach')
      AND tm.is_active = true
    )
  );

-- Anyone can view their own invite by token (for accepting)
CREATE POLICY "Users can view invites by token"
  ON team_invites FOR SELECT
  USING (true);

-- Only owners can create invites
CREATE POLICY "Team owners can create invites"
  ON team_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships tm
      WHERE tm.team_id = team_invites.team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'owner'
      AND tm.is_active = true
    )
  );

-- Only owners can update/cancel invites
CREATE POLICY "Team owners can update invites"
  ON team_invites FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships tm
      WHERE tm.team_id = team_invites.team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'owner'
      AND tm.is_active = true
    )
  );

-- Only owners can delete invites
CREATE POLICY "Team owners can delete invites"
  ON team_invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships tm
      WHERE tm.team_id = team_invites.team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'owner'
      AND tm.is_active = true
    )
  );
