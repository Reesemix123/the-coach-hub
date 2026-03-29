-- Migration 155: Create athlete_seasons table
-- Bridges athlete_profiles to team rosters per season/sport

CREATE TABLE IF NOT EXISTS athlete_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_profile_id UUID NOT NULL REFERENCES athlete_profiles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  roster_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sport TEXT NOT NULL DEFAULT 'football',
  season_year INTEGER NOT NULL,
  position TEXT,
  jersey_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_athlete_seasons_profile ON athlete_seasons(athlete_profile_id);
CREATE INDEX idx_athlete_seasons_team ON athlete_seasons(team_id);
CREATE INDEX idx_athlete_seasons_roster ON athlete_seasons(roster_id);
CREATE INDEX idx_athlete_seasons_sport ON athlete_seasons(sport);
CREATE UNIQUE INDEX idx_athlete_seasons_unique ON athlete_seasons(athlete_profile_id, team_id, season_year, sport);

-- RLS
ALTER TABLE athlete_seasons ENABLE ROW LEVEL SECURITY;

-- Parents can read seasons for their athletes
CREATE POLICY "Parents can read own athlete seasons"
  ON athlete_seasons FOR SELECT
  USING (
    athlete_profile_id IN (
      SELECT id FROM athlete_profiles
      WHERE created_by_parent_id = (
        SELECT id FROM parent_profiles WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

-- Parents can insert seasons for their athletes
CREATE POLICY "Parents can create athlete seasons"
  ON athlete_seasons FOR INSERT
  WITH CHECK (
    athlete_profile_id IN (
      SELECT id FROM athlete_profiles
      WHERE created_by_parent_id = (
        SELECT id FROM parent_profiles WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

-- Coaches can read seasons for players on their teams
CREATE POLICY "Coaches can read athlete seasons for their teams"
  ON athlete_seasons FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Coaches can insert seasons for players on their teams
CREATE POLICY "Coaches can create athlete seasons for their teams"
  ON athlete_seasons FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Now add the coach read policy on athlete_profiles that requires athlete_seasons
CREATE POLICY "Coaches can read athlete profiles for their team players"
  ON athlete_profiles FOR SELECT
  USING (
    id IN (
      SELECT athlete_profile_id FROM athlete_seasons
      WHERE team_id IN (
        SELECT team_id FROM team_memberships
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- Also add parent read policy for linked athletes (via player_parent_links → players → athlete_seasons)
CREATE POLICY "Parents can read linked athlete profiles"
  ON athlete_profiles FOR SELECT
  USING (
    id IN (
      SELECT as2.athlete_profile_id
      FROM athlete_seasons as2
      JOIN players p ON p.id = as2.roster_id
      JOIN player_parent_links ppl ON ppl.player_id = p.id
      JOIN parent_profiles pp ON pp.id = ppl.parent_id
      WHERE pp.user_id = auth.uid()
    )
  );

COMMENT ON TABLE athlete_seasons IS 'Links athlete profiles to team rosters per season. Bridges parent-owned profiles to coach-owned roster entries.';
COMMENT ON COLUMN athlete_seasons.roster_id IS 'FK to players table (the coach roster entry for this athlete on this team).';
COMMENT ON COLUMN athlete_seasons.sport IS 'Sport for this season entry. Multi-sport athletes have multiple rows.';
