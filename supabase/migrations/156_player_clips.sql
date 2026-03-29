-- Migration 156: Create player_clips table
-- Auto-generated Mux clips for player profile system

CREATE TABLE IF NOT EXISTS player_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_profile_id UUID NOT NULL REFERENCES athlete_profiles(id) ON DELETE CASCADE,
  athlete_season_id UUID NOT NULL REFERENCES athlete_seasons(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  play_instance_id UUID NOT NULL REFERENCES play_instances(id) ON DELETE CASCADE,
  sport TEXT NOT NULL DEFAULT 'football',
  mux_asset_id TEXT,
  mux_playback_id TEXT,
  clip_start_seconds NUMERIC NOT NULL,
  clip_end_seconds NUMERIC NOT NULL,
  play_type TEXT,
  play_result TEXT,
  tags TEXT[],
  coach_note TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  coach_approved BOOLEAN NOT NULL DEFAULT false,
  coach_suppressed BOOLEAN NOT NULL DEFAULT false,
  ai_confidence_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_player_clips_athlete ON player_clips(athlete_profile_id);
CREATE INDEX idx_player_clips_season ON player_clips(athlete_season_id);
CREATE INDEX idx_player_clips_game ON player_clips(game_id);
CREATE INDEX idx_player_clips_play_instance ON player_clips(play_instance_id);
CREATE INDEX idx_player_clips_approval ON player_clips(coach_approved, coach_suppressed);
CREATE INDEX idx_player_clips_sport ON player_clips(sport);

-- RLS
ALTER TABLE player_clips ENABLE ROW LEVEL SECURITY;

-- Parent read policy (deferred until parent_can_access_athlete_content function is created in migration 158)

-- Coaches can read all clips for players on their teams
CREATE POLICY "Coaches can read clips for their team players"
  ON player_clips FOR SELECT
  USING (
    athlete_season_id IN (
      SELECT id FROM athlete_seasons
      WHERE team_id IN (
        SELECT team_id FROM team_memberships
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- Coaches can insert clips for their team players
CREATE POLICY "Coaches can create clips for their team players"
  ON player_clips FOR INSERT
  WITH CHECK (
    athlete_season_id IN (
      SELECT id FROM athlete_seasons
      WHERE team_id IN (
        SELECT team_id FROM team_memberships
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- Coaches can update clips for their team players (approve/suppress/note)
CREATE POLICY "Coaches can update clips for their team players"
  ON player_clips FOR UPDATE
  USING (
    athlete_season_id IN (
      SELECT id FROM athlete_seasons
      WHERE team_id IN (
        SELECT team_id FROM team_memberships
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

COMMENT ON TABLE player_clips IS 'Auto-generated Mux clips for player profiles. Coach must approve before parent visibility.';
COMMENT ON COLUMN player_clips.play_instance_id IS 'FK to play_instances — the tagged play this clip was generated from.';
COMMENT ON COLUMN player_clips.mux_playback_id IS 'Signed playback ID — never expose publicly.';
