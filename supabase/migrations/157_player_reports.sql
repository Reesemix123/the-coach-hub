-- Migration 157: Create player_reports table
-- AI-generated performance reports with dual coach/parent narratives

CREATE TABLE IF NOT EXISTS player_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_profile_id UUID NOT NULL REFERENCES athlete_profiles(id) ON DELETE CASCADE,
  athlete_season_id UUID NOT NULL REFERENCES athlete_seasons(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  sport TEXT NOT NULL DEFAULT 'football',
  report_type TEXT NOT NULL CHECK (report_type IN ('game', 'season', 'highlight')),
  stats_snapshot JSONB,
  ai_narrative_coach TEXT,
  ai_narrative_parent TEXT,
  gemini_model_used TEXT,
  is_published_to_parent BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  coach_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_player_reports_athlete ON player_reports(athlete_profile_id);
CREATE INDEX idx_player_reports_season ON player_reports(athlete_season_id);
CREATE INDEX idx_player_reports_game ON player_reports(game_id);
CREATE INDEX idx_player_reports_published ON player_reports(is_published_to_parent);
CREATE INDEX idx_player_reports_sport ON player_reports(sport);
CREATE INDEX idx_player_reports_type ON player_reports(report_type);

-- RLS
ALTER TABLE player_reports ENABLE ROW LEVEL SECURITY;

-- Parent read policy (deferred until parent_can_access_athlete_content function is created in migration 158)

-- Coaches can read all reports for players on their teams
CREATE POLICY "Coaches can read reports for their team players"
  ON player_reports FOR SELECT
  USING (
    athlete_season_id IN (
      SELECT id FROM athlete_seasons
      WHERE team_id IN (
        SELECT team_id FROM team_memberships
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- Coaches can insert reports
CREATE POLICY "Coaches can create reports for their team players"
  ON player_reports FOR INSERT
  WITH CHECK (
    athlete_season_id IN (
      SELECT id FROM athlete_seasons
      WHERE team_id IN (
        SELECT team_id FROM team_memberships
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- Coaches can update reports (edit narrative, publish/unpublish)
CREATE POLICY "Coaches can update reports for their team players"
  ON player_reports FOR UPDATE
  USING (
    athlete_season_id IN (
      SELECT id FROM athlete_seasons
      WHERE team_id IN (
        SELECT team_id FROM team_memberships
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_player_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_player_reports_updated_at
  BEFORE UPDATE ON player_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_player_reports_updated_at();

COMMENT ON TABLE player_reports IS 'AI-generated performance reports with dual coach/parent narratives.';
COMMENT ON COLUMN player_reports.stats_snapshot IS 'JSONB stats — football fields today, extensible for other sports.';
COMMENT ON COLUMN player_reports.report_type IS 'game = per-game report, season = end-of-season summary, highlight = curated highlights.';
