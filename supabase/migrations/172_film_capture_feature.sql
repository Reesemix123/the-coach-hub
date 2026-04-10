-- Migration 172: Film Capture Feature
-- Sports reference table, film capture access flags, and film captures table.
-- Storage bucket 'film_captures' must be created manually in Supabase dashboard.

-- ============================================================================
-- Step 1: Sports reference table
-- ============================================================================
-- TODO: MULTI-SPORT — This table is the foundation for multi-sport support.
-- When adding new sport hubs, update status from 'internal' to 'active'.

CREATE TABLE sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  status TEXT NOT NULL DEFAULT 'internal' CHECK (status IN ('active', 'internal', 'disabled')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed sports: Football is active, others are internal (visible in film capture only)
INSERT INTO sports (name, slug, icon, status, display_order) VALUES
  ('Football', 'football', '🏈', 'active', 1),
  ('Basketball', 'basketball', '🏀', 'internal', 2),
  ('Baseball', 'baseball', '⚾', 'internal', 3),
  ('Softball', 'softball', '🥎', 'internal', 4),
  ('Soccer', 'soccer', '⚽', 'internal', 5),
  ('Volleyball', 'volleyball', '🏐', 'internal', 6),
  ('Lacrosse', 'lacrosse', '🥍', 'internal', 7),
  ('Wrestling', 'wrestling', '🤼', 'internal', 8),
  ('Track & Field', 'track-and-field', '🏃', 'internal', 9),
  ('Swimming', 'swimming', '🏊', 'internal', 10);

-- RLS: everyone can read sports, only admins can modify
ALTER TABLE sports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_sports" ON sports
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_sports" ON sports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

COMMENT ON TABLE sports IS 'Reference table of supported sports. status=active means full sport hub, internal means available in film capture only.';

-- ============================================================================
-- Step 2: Film capture access flags on profiles
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS film_capture_access BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_profiles_film_capture ON profiles(film_capture_access) WHERE film_capture_access = true;

ALTER TABLE parent_profiles ADD COLUMN IF NOT EXISTS film_capture_access BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_parent_profiles_film_capture ON parent_profiles(film_capture_access) WHERE film_capture_access = true;

COMMENT ON COLUMN profiles.film_capture_access IS 'Whether this coach/user can access the film capture feature';
COMMENT ON COLUMN parent_profiles.film_capture_access IS 'Whether this parent can access the film capture feature';

-- ============================================================================
-- Step 3: Film captures table
-- ============================================================================

CREATE TABLE film_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id UUID NOT NULL REFERENCES sports(id),
  game_date DATE NOT NULL,
  opponent TEXT,
  age_group TEXT,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  uploader_id UUID NOT NULL REFERENCES auth.users(id),
  uploader_role TEXT NOT NULL CHECK (uploader_role IN ('coach', 'parent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_film_captures_uploader ON film_captures(uploader_id);
CREATE INDEX idx_film_captures_sport ON film_captures(sport_id);
CREATE INDEX idx_film_captures_game_date ON film_captures(game_date DESC);

ALTER TABLE film_captures ENABLE ROW LEVEL SECURITY;

-- Uploaders can view and manage their own captures
CREATE POLICY "users_own_captures" ON film_captures
  FOR ALL USING (uploader_id = auth.uid())
  WITH CHECK (uploader_id = auth.uid());

-- Platform admins can view all captures
CREATE POLICY "admin_all_captures" ON film_captures
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

COMMENT ON TABLE film_captures IS 'Film uploads from coaches and parents across all sports via the film capture feature';
COMMENT ON COLUMN film_captures.sport_id IS 'TODO: MULTI-SPORT — References sports table for cross-sport film capture';
COMMENT ON COLUMN film_captures.uploader_role IS 'coach or parent — determines which profile table granted access';
