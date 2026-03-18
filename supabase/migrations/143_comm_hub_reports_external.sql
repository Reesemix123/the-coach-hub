-- Migration 143: Communication Hub - Reports & External Sharing
-- Phase 4-5: Shared reports, game summaries, Vimeo integration

-- ====================
-- SHARED REPORTS
-- ====================

CREATE TABLE IF NOT EXISTS shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('player_summary', 'game_recap', 'season_progress', 'individual')),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  game_id UUID,
  coach_id UUID REFERENCES auth.users(id) NOT NULL,
  coach_notes TEXT,
  report_data JSONB NOT NULL,
  visibility TEXT DEFAULT 'parents' CHECK (visibility IN ('parents', 'specific_parent')),
  target_parent_id UUID REFERENCES parent_profiles(id),
  notification_channel TEXT DEFAULT 'email' CHECK (notification_channel IN ('sms', 'email', 'both')),
  shared_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_shared_reports_team_id ON shared_reports(team_id);
CREATE INDEX idx_shared_reports_player_id ON shared_reports(player_id);
CREATE INDEX idx_shared_reports_type ON shared_reports(report_type);

COMMENT ON TABLE shared_reports IS 'Curated reports shared with parents (positive framing)';
COMMENT ON COLUMN shared_reports.report_type IS 'Type: player_summary, game_recap, season_progress, individual';
COMMENT ON COLUMN shared_reports.report_data IS 'Positively-framed data snapshot as JSON';
COMMENT ON COLUMN shared_reports.visibility IS 'Who can see: all parents or specific_parent';

-- ====================
-- REPORT VIEWS
-- ====================

CREATE TABLE IF NOT EXISTS report_views (
  report_id UUID REFERENCES shared_reports(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (report_id, parent_id)
);

CREATE INDEX idx_report_views_parent_id ON report_views(parent_id);

COMMENT ON TABLE report_views IS 'Tracks which parents have viewed each report';

-- ====================
-- GAME SUMMARIES
-- ====================

CREATE TABLE IF NOT EXISTS game_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  game_id UUID,
  coach_id UUID REFERENCES auth.users(id) NOT NULL,
  coach_raw_notes TEXT,
  ai_draft TEXT,
  published_text TEXT,
  opponent TEXT,
  score_us INTEGER,
  score_them INTEGER,
  game_date DATE,
  player_highlights JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  notification_channel TEXT DEFAULT 'email' CHECK (notification_channel IN ('sms', 'email', 'both')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_game_summaries_team_id ON game_summaries(team_id);
CREATE INDEX idx_game_summaries_game_id ON game_summaries(game_id);
CREATE INDEX idx_game_summaries_status ON game_summaries(status);

CREATE TRIGGER update_game_summaries_updated_at
  BEFORE UPDATE ON game_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE game_summaries IS 'Game summaries with AI co-pilot assistance';
COMMENT ON COLUMN game_summaries.coach_raw_notes IS 'Coach''s raw notes/bullet points';
COMMENT ON COLUMN game_summaries.ai_draft IS 'AI-generated draft from coach notes';
COMMENT ON COLUMN game_summaries.published_text IS 'Final coach-approved text for parents';
COMMENT ON COLUMN game_summaries.player_highlights IS 'Array of player highlight objects [{player_id, highlight_text}]';

-- ====================
-- COACH EXTERNAL ACCOUNTS (Vimeo)
-- ====================

CREATE TABLE IF NOT EXISTS coach_external_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'vimeo' CHECK (platform = 'vimeo'),
  platform_account_id TEXT,
  platform_account_name TEXT,
  access_token_vault_id TEXT NOT NULL,
  refresh_token_vault_id TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'expired')),
  UNIQUE(coach_id, platform)
);

CREATE INDEX idx_coach_external_accounts_coach_id ON coach_external_accounts(coach_id);

COMMENT ON TABLE coach_external_accounts IS 'Coach connected external accounts (Vimeo)';
COMMENT ON COLUMN coach_external_accounts.access_token_vault_id IS 'Reference to encrypted token in Supabase Vault';
COMMENT ON COLUMN coach_external_accounts.refresh_token_vault_id IS 'Reference to encrypted refresh token in Supabase Vault';

-- ====================
-- EXTERNAL VIDEO SHARES
-- ====================

CREATE TABLE IF NOT EXISTS external_video_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES auth.users(id) NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('shared_video', 'film_session', 'highlight_reel')),
  source_id UUID NOT NULL,
  platform TEXT NOT NULL DEFAULT 'vimeo' CHECK (platform = 'vimeo'),
  external_url TEXT,
  external_video_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  privacy_setting TEXT NOT NULL DEFAULT 'unlisted' CHECK (privacy_setting IN ('public', 'unlisted', 'private')),
  watermark_applied BOOLEAN NOT NULL DEFAULT true,
  upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploading', 'processing', 'complete', 'failed')),
  upload_progress INTEGER DEFAULT 0,
  upload_error TEXT,
  confirmation_text TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_external_video_shares_coach_id ON external_video_shares(coach_id);
CREATE INDEX idx_external_video_shares_team_id ON external_video_shares(team_id);
CREATE INDEX idx_external_video_shares_status ON external_video_shares(upload_status);

COMMENT ON TABLE external_video_shares IS 'Log of videos shared to external platforms (Vimeo)';
COMMENT ON COLUMN external_video_shares.watermark_applied IS 'Always true - watermark is required';
COMMENT ON COLUMN external_video_shares.confirmation_text IS 'Text coach agreed to when initiating share';

-- ====================
-- ROW LEVEL SECURITY
-- ====================

ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_external_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_video_shares ENABLE ROW LEVEL SECURITY;

-- Shared reports: coaches can manage, parents can view
CREATE POLICY "Coaches can manage shared reports"
  ON shared_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = shared_reports.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach') AND tm.is_active = true)
      )
    )
  );

CREATE POLICY "Parents can view reports shared with all parents"
  ON shared_reports FOR SELECT
  USING (
    visibility = 'parents'
    AND EXISTS (
      SELECT 1 FROM team_parent_access tpa
      JOIN parent_profiles pp ON pp.id = tpa.parent_id
      WHERE tpa.team_id = shared_reports.team_id
      AND pp.user_id = auth.uid()
      AND tpa.status = 'active'
    )
  );

CREATE POLICY "Parents can view reports shared specifically with them"
  ON shared_reports FOR SELECT
  USING (
    visibility = 'specific_parent'
    AND target_parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );

-- Report views: parents can manage their own
CREATE POLICY "Parents can manage own report views"
  ON report_views FOR ALL
  USING (
    parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Coaches can view report views"
  ON report_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_reports sr
      JOIN teams t ON t.id = sr.team_id
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE sr.id = report_views.report_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach') AND tm.is_active = true)
      )
    )
  );

-- Game summaries: coaches can manage, parents can view published
CREATE POLICY "Coaches can manage game summaries"
  ON game_summaries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = game_summaries.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach') AND tm.is_active = true)
      )
    )
  );

CREATE POLICY "Parents can view published game summaries"
  ON game_summaries FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM team_parent_access tpa
      JOIN parent_profiles pp ON pp.id = tpa.parent_id
      WHERE tpa.team_id = game_summaries.team_id
      AND pp.user_id = auth.uid()
      AND tpa.status = 'active'
    )
  );

-- Coach external accounts: coaches can manage their own
CREATE POLICY "Coaches can manage own external accounts"
  ON coach_external_accounts FOR ALL
  USING (coach_id = auth.uid());

-- External video shares: coaches can manage their own
CREATE POLICY "Coaches can manage own external shares"
  ON external_video_shares FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "Team staff can view external shares"
  ON external_video_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = external_video_shares.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach') AND tm.is_active = true)
      )
    )
  );
