-- Migration 154: Create athlete_profiles table
-- Parent-owned persistent athlete identity that accumulates across seasons/sports

CREATE TABLE IF NOT EXISTS athlete_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_first_name TEXT NOT NULL,
  athlete_last_name TEXT NOT NULL,
  graduation_year INTEGER,
  profile_photo_url TEXT,
  created_by_parent_id UUID NOT NULL REFERENCES parent_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_athlete_profiles_created_by ON athlete_profiles(created_by_parent_id);
CREATE INDEX idx_athlete_profiles_name ON athlete_profiles(athlete_last_name, athlete_first_name);

-- RLS
ALTER TABLE athlete_profiles ENABLE ROW LEVEL SECURITY;

-- Parents can read profiles they created
CREATE POLICY "Parents can read own athlete profiles"
  ON athlete_profiles FOR SELECT
  USING (
    created_by_parent_id = (
      SELECT id FROM parent_profiles WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Parents can also read profiles linked via player_parent_links → players → athlete_seasons
-- (This policy will be updated in migration 155 after athlete_seasons exists)

-- Parents can update profiles they created
CREATE POLICY "Parents can update own athlete profiles"
  ON athlete_profiles FOR UPDATE
  USING (
    created_by_parent_id = (
      SELECT id FROM parent_profiles WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Parents can insert profiles (they own them)
CREATE POLICY "Parents can create athlete profiles"
  ON athlete_profiles FOR INSERT
  WITH CHECK (
    created_by_parent_id = (
      SELECT id FROM parent_profiles WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Coaches can read profiles for players on their teams
-- (This policy will be added in migration 155 after athlete_seasons exists)

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_athlete_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_athlete_profiles_updated_at
  BEFORE UPDATE ON athlete_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_athlete_profiles_updated_at();

COMMENT ON TABLE athlete_profiles IS 'Parent-owned persistent athlete identity. Accumulates data across seasons, sports, and coaches.';
COMMENT ON COLUMN athlete_profiles.created_by_parent_id IS 'The parent who owns this profile. FK to parent_profiles.';
