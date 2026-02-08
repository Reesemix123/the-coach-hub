-- Migration 139: Communication Hub - Parent System Tables
-- Phase 1: Parent profiles, player links, access control, invitations, consent

-- ====================
-- PARENT PROFILES
-- ====================

CREATE TABLE IF NOT EXISTS parent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  notification_preference TEXT DEFAULT 'both' CHECK (notification_preference IN ('sms', 'email', 'both')),
  avatar_url TEXT,
  is_champion BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parent_profiles_user_id ON parent_profiles(user_id);
CREATE INDEX idx_parent_profiles_email ON parent_profiles(email);

CREATE TRIGGER update_parent_profiles_updated_at
  BEFORE UPDATE ON parent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE parent_profiles IS 'Parent user profiles linked to Supabase Auth';
COMMENT ON COLUMN parent_profiles.notification_preference IS 'Default notification channel: sms, email, or both';
COMMENT ON COLUMN parent_profiles.is_champion IS 'Parent Champion status - can resend invites and view onboarding status';

-- ====================
-- PLAYER-PARENT LINKS
-- ====================

CREATE TABLE IF NOT EXISTS player_parent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('mother', 'father', 'guardian', 'stepmother', 'stepfather', 'other')),
  is_primary_contact BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id, parent_id)
);

CREATE INDEX idx_player_parent_links_player_id ON player_parent_links(player_id);
CREATE INDEX idx_player_parent_links_parent_id ON player_parent_links(parent_id);

COMMENT ON TABLE player_parent_links IS 'Links parents to their children (players)';
COMMENT ON COLUMN player_parent_links.relationship IS 'Relationship type: mother, father, guardian, etc.';
COMMENT ON COLUMN player_parent_links.is_primary_contact IS 'Primary contact receives urgent notifications first';

-- ====================
-- TEAM PARENT ACCESS
-- ====================

CREATE TABLE IF NOT EXISTS team_parent_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE NOT NULL,
  access_level TEXT DEFAULT 'full' CHECK (access_level IN ('full', 'view_only')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'removed')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, parent_id)
);

CREATE INDEX idx_team_parent_access_team_id ON team_parent_access(team_id);
CREATE INDEX idx_team_parent_access_parent_id ON team_parent_access(parent_id);

COMMENT ON TABLE team_parent_access IS 'Controls parent access to specific teams';
COMMENT ON COLUMN team_parent_access.access_level IS 'Access level: full or view_only';
COMMENT ON COLUMN team_parent_access.status IS 'Access status: active, invited, or removed';

-- ====================
-- PARENT INVITATIONS
-- ====================

CREATE TABLE IF NOT EXISTS parent_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  parent_email TEXT NOT NULL,
  parent_name TEXT,
  relationship TEXT,
  invitation_token UUID DEFAULT gen_random_uuid(),
  token_expires_at TIMESTAMPTZ DEFAULT (now() + interval '72 hours'),
  auto_resend_at TIMESTAMPTZ DEFAULT (now() + interval '72 hours'),
  auto_resend_sent BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, parent_email)
);

CREATE INDEX idx_parent_invitations_team_id ON parent_invitations(team_id);
CREATE INDEX idx_parent_invitations_token ON parent_invitations(invitation_token);
CREATE INDEX idx_parent_invitations_status ON parent_invitations(status);
CREATE INDEX idx_parent_invitations_auto_resend ON parent_invitations(auto_resend_at) WHERE status = 'pending' AND auto_resend_sent = false;

COMMENT ON TABLE parent_invitations IS 'Magic link invitation system for parents';
COMMENT ON COLUMN parent_invitations.invitation_token IS 'Unique token for magic link URL';
COMMENT ON COLUMN parent_invitations.token_expires_at IS 'Token expires 72 hours after creation';
COMMENT ON COLUMN parent_invitations.auto_resend_at IS 'Automatically resend if not accepted by this time';
COMMENT ON COLUMN parent_invitations.auto_resend_sent IS 'Whether auto-resend has been triggered';

-- ====================
-- COPPA CONSENT LOG
-- ====================

CREATE TABLE IF NOT EXISTS parent_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('account_creation', 'video_sharing', 'data_usage')),
  consented BOOLEAN NOT NULL,
  consent_text TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  consented_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parent_consent_log_parent_id ON parent_consent_log(parent_id);

COMMENT ON TABLE parent_consent_log IS 'COPPA compliance consent tracking - immutable audit log';
COMMENT ON COLUMN parent_consent_log.consent_text IS 'Exact text shown to parent at time of consent';
COMMENT ON COLUMN parent_consent_log.ip_address IS 'IP address at time of consent for audit purposes';

-- ====================
-- PARENT EMAIL CHANGES
-- ====================

CREATE TABLE IF NOT EXISTS parent_email_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE NOT NULL,
  old_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  requested_by UUID REFERENCES auth.users(id) NOT NULL,
  confirmation_token UUID DEFAULT gen_random_uuid(),
  confirmed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parent_email_changes_parent_id ON parent_email_changes(parent_id);
CREATE INDEX idx_parent_email_changes_token ON parent_email_changes(confirmation_token);

COMMENT ON TABLE parent_email_changes IS 'Audit trail for parent email changes - parents cannot change their own email';
COMMENT ON COLUMN parent_email_changes.requested_by IS 'Coach or team admin who initiated the change';

-- ====================
-- ROW LEVEL SECURITY
-- ====================

ALTER TABLE parent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_parent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_parent_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_email_changes ENABLE ROW LEVEL SECURITY;

-- Parent profiles: parents can view/update their own profile
CREATE POLICY "Parents can view own profile"
  ON parent_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Parents can update own profile"
  ON parent_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND email = (SELECT email FROM parent_profiles WHERE user_id = auth.uid()));
  -- Note: email cannot be changed by parent (enforced by checking email hasn't changed)

CREATE POLICY "Parents can insert own profile"
  ON parent_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Coaches can view parent profiles for their teams
CREATE POLICY "Coaches can view team parent profiles"
  ON parent_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_parent_access tpa
      JOIN teams t ON t.id = tpa.team_id
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE tpa.parent_id = parent_profiles.id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

-- Coaches can update is_champion for parents on their teams (head coach only)
CREATE POLICY "Head coach can update parent champion status"
  ON parent_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_parent_access tpa
      JOIN teams t ON t.id = tpa.team_id
      WHERE tpa.parent_id = parent_profiles.id
      AND t.user_id = auth.uid()
    )
  );

-- Player-parent links: viewable by parent and team coaches
CREATE POLICY "Parents can view own child links"
  ON player_parent_links FOR SELECT
  USING (
    parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Coaches can view player parent links"
  ON player_parent_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players p
      JOIN teams t ON t.id = p.team_id
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE p.id = player_parent_links.player_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

CREATE POLICY "Coaches can manage player parent links"
  ON player_parent_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM players p
      JOIN teams t ON t.id = p.team_id
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE p.id = player_parent_links.player_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

-- Team parent access: viewable by parent and team staff
CREATE POLICY "Parents can view own team access"
  ON team_parent_access FOR SELECT
  USING (
    parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Coaches can view team parent access"
  ON team_parent_access FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = team_parent_access.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

CREATE POLICY "Coaches can manage team parent access"
  ON team_parent_access FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = team_parent_access.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

-- Parent invitations: managed by team staff, viewable by recipient
CREATE POLICY "Coaches can manage invitations"
  ON parent_invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = parent_invitations.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

-- Parent Champions can view and resend invitations (but not create/delete)
CREATE POLICY "Parent Champions can view invitations"
  ON parent_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_profiles pp
      JOIN team_parent_access tpa ON tpa.parent_id = pp.id
      WHERE pp.user_id = auth.uid()
      AND pp.is_champion = true
      AND tpa.team_id = parent_invitations.team_id
      AND tpa.status = 'active'
    )
  );

-- Public access to accept invitations (token-based, handled in API)
CREATE POLICY "Anyone can view invitation by token"
  ON parent_invitations FOR SELECT
  USING (true);  -- Token validation happens in API layer

-- Consent log: insert only, viewable by parent and coaches
CREATE POLICY "Parents can view own consent log"
  ON parent_consent_log FOR SELECT
  USING (
    parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Parents can insert consent"
  ON parent_consent_log FOR INSERT
  WITH CHECK (
    parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Coaches can view team consent logs"
  ON parent_consent_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = parent_consent_log.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

-- Email changes: managed by coaches, viewable by affected parent
CREATE POLICY "Coaches can manage email changes"
  ON parent_email_changes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM parent_profiles pp
      JOIN team_parent_access tpa ON tpa.parent_id = pp.id
      JOIN teams t ON t.id = tpa.team_id
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE pp.id = parent_email_changes.parent_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

CREATE POLICY "Parents can view own email changes"
  ON parent_email_changes FOR SELECT
  USING (
    parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );
