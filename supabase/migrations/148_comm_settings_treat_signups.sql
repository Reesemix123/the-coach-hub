-- Migration 148: Team Communication Settings + Treat Sign-ups
-- ============================================================

-- 1. Team communication settings (shared config for messaging + treats features)
CREATE TABLE IF NOT EXISTS team_communication_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL UNIQUE,
  allow_parent_to_parent_messaging BOOLEAN DEFAULT true,
  treats_enabled BOOLEAN DEFAULT false,
  max_treat_slots_per_event INTEGER DEFAULT 2,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE team_communication_settings ENABLE ROW LEVEL SECURITY;

-- Coaches/owners can manage settings
CREATE POLICY "Coaches can manage communication settings"
  ON team_communication_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = team_communication_settings.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

-- Parents can read settings for their team
CREATE POLICY "Parents can read communication settings"
  ON team_communication_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_parent_access tpa
      JOIN parent_profiles pp ON pp.id = tpa.parent_id
      WHERE tpa.team_id = team_communication_settings.team_id
      AND pp.user_id = auth.uid()
      AND tpa.status = 'active'
    )
  );

-- 2. Treat sign-ups
CREATE TABLE IF NOT EXISTS treat_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  event_id UUID REFERENCES team_events(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE NOT NULL,
  description TEXT,
  signed_up_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(game_id, parent_id),
  UNIQUE(event_id, parent_id),
  CHECK (game_id IS NOT NULL OR event_id IS NOT NULL)
);

CREATE INDEX idx_treat_signups_team_id ON treat_signups(team_id);
CREATE INDEX idx_treat_signups_game_id ON treat_signups(game_id) WHERE game_id IS NOT NULL;
CREATE INDEX idx_treat_signups_event_id ON treat_signups(event_id) WHERE event_id IS NOT NULL;

ALTER TABLE treat_signups ENABLE ROW LEVEL SECURITY;

-- Coaches can view all treat signups for their team
CREATE POLICY "Coaches can manage treat signups"
  ON treat_signups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = treat_signups.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

-- Parents can view treat signups for their team
CREATE POLICY "Parents can view treat signups"
  ON treat_signups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_parent_access tpa
      JOIN parent_profiles pp ON pp.id = tpa.parent_id
      WHERE tpa.team_id = treat_signups.team_id
      AND pp.user_id = auth.uid()
      AND tpa.status = 'active'
    )
  );

-- Parents can insert their own treat signups
CREATE POLICY "Parents can sign up for treats"
  ON treat_signups FOR INSERT
  WITH CHECK (
    parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );

-- Parents can delete their own treat signups
CREATE POLICY "Parents can cancel own treat signups"
  ON treat_signups FOR DELETE
  USING (
    parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );

COMMENT ON TABLE team_communication_settings IS 'Per-team configuration for communication hub features';
COMMENT ON TABLE treat_signups IS 'Parent sign-ups to bring treats/snacks to games and events';
COMMENT ON COLUMN treat_signups.description IS 'What the parent plans to bring (e.g., "Oranges and water bottles")';
COMMENT ON COLUMN team_communication_settings.max_treat_slots_per_event IS 'Maximum number of families that can sign up per game/event';
