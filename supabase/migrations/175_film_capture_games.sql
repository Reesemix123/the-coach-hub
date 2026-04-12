-- Migration 175: Film Capture Game Grouping
-- Groups film capture clips into games/sessions for organization.
-- A game holds shared metadata (sport, date, opponent, age group).
-- Clips reference a game via game_id.

-- ============================================================================
-- Step 1: Film capture games table
-- ============================================================================

CREATE TABLE film_capture_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id UUID NOT NULL REFERENCES sports(id),
  game_date DATE NOT NULL,
  opponent TEXT,
  age_group TEXT,
  title TEXT,  -- Optional display title, e.g. "Spring Scrimmage"
  uploader_id UUID NOT NULL REFERENCES auth.users(id),
  uploader_role TEXT NOT NULL CHECK (uploader_role IN ('coach', 'parent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_film_capture_games_uploader ON film_capture_games(uploader_id);
CREATE INDEX idx_film_capture_games_sport ON film_capture_games(sport_id);
CREATE INDEX idx_film_capture_games_date ON film_capture_games(game_date DESC);

ALTER TABLE film_capture_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_games" ON film_capture_games
  FOR ALL USING (uploader_id = auth.uid())
  WITH CHECK (uploader_id = auth.uid());

CREATE POLICY "admin_all_games" ON film_capture_games
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

-- Users can view games shared with them (via film_capture_shares on any clip in the game)
CREATE POLICY "shared_users_view_games" ON film_capture_games
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM film_capture_shares fcs
      JOIN film_captures fc ON fc.id = fcs.capture_id
      WHERE fc.game_id = film_capture_games.id
        AND fcs.shared_with_user_id = auth.uid()
    )
  );

COMMENT ON TABLE film_capture_games IS 'Groups film capture clips into logical games/sessions';

-- ============================================================================
-- Step 2: Add game_id, clip_label, clip_order to film_captures
-- ============================================================================

ALTER TABLE film_captures
  ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES film_capture_games(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clip_label TEXT,
  ADD COLUMN IF NOT EXISTS clip_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_film_captures_game ON film_captures(game_id);

COMMENT ON COLUMN film_captures.game_id IS 'Groups this clip with other clips from the same game. Null for standalone uploads.';
COMMENT ON COLUMN film_captures.clip_label IS 'User-defined label like Q1, Sideline, End Zone';
COMMENT ON COLUMN film_captures.clip_order IS 'Display order within the game';

-- ============================================================================
-- Step 3: Backfill — create a game for each unique (sport_id, game_date, opponent, uploader_id)
-- and link existing clips to it
-- ============================================================================

-- Create games from existing distinct combinations
INSERT INTO film_capture_games (sport_id, game_date, opponent, age_group, uploader_id, uploader_role)
SELECT DISTINCT
  fc.sport_id,
  fc.game_date,
  fc.opponent,
  fc.age_group,
  fc.uploader_id,
  fc.uploader_role
FROM film_captures fc
WHERE fc.game_id IS NULL;

-- Link clips to their games
UPDATE film_captures fc
SET game_id = fcg.id
FROM film_capture_games fcg
WHERE fc.game_id IS NULL
  AND fc.sport_id = fcg.sport_id
  AND fc.game_date = fcg.game_date
  AND fc.uploader_id = fcg.uploader_id
  AND COALESCE(fc.opponent, '') = COALESCE(fcg.opponent, '')
  AND COALESCE(fc.age_group, '') = COALESCE(fcg.age_group, '');
