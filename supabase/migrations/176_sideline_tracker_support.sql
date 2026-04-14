-- ============================================================================
-- Migration 176: Sideline Tracker Support
-- ============================================================================
-- PURPOSE:
--   Enable live play-by-play entry from the sideline without requiring video.
--   This migration:
--   1. Makes video_id nullable on play_instances (the only hard blocker)
--   2. Adds source/sync columns so film-tagged and live-entered plays coexist
--   3. Creates sport_positions lookup table (seeded with football)
--   4. Creates play_personnel junction table (replaces hardcoded position FKs)
--   5. Creates play_penalties table (supports multiple penalties per play)
--   6. Creates game_scouting_packages table (opponent tendency tracking)
--
-- BACKWARDS COMPATIBILITY:
--   - Existing plays retain video_id; source defaults to 'film'
--   - All new tables are additive — no existing tables are dropped or altered destructively
--   - Existing penalty columns on play_instances are NOT removed (deprecate later)
-- ============================================================================

-- ============================================================================
-- Step 1: Make video_id nullable on play_instances
-- ============================================================================
-- Currently: video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE
-- Sideline tracker entries won't have a video at creation time.
-- They may later be synced to film (via sync_status/synced_at).

ALTER TABLE play_instances
  ALTER COLUMN video_id DROP NOT NULL;

COMMENT ON COLUMN play_instances.video_id IS 'NULL for sideline-entered plays that have not yet been synced to video';

-- ============================================================================
-- Step 2: Add source/sync columns to play_instances
-- ============================================================================

-- Source: how this play was created
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'film'
    CHECK (source IN ('film', 'sideline', 'manual', 'import'));

-- Local ID: client-generated UUID for offline-first sideline entries
-- Used to deduplicate when syncing from a device that was offline
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS local_id UUID;

-- Sync status: tracks whether a sideline entry has been matched to film
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'unsynced'
    CHECK (sync_status IN ('unsynced', 'synced', 'conflict', 'manual'));

-- When the sideline entry was matched/synced to a video timestamp
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

-- Indexes for source/sync queries
CREATE INDEX IF NOT EXISTS idx_play_instances_source
  ON play_instances(source);

CREATE INDEX IF NOT EXISTS idx_play_instances_local_id
  ON play_instances(local_id) WHERE local_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_play_instances_sync_status
  ON play_instances(sync_status) WHERE source = 'sideline';

COMMENT ON COLUMN play_instances.source IS 'How this play was created: film (tagged from video), sideline (live entry), manual (post-game), import (CSV/external)';
COMMENT ON COLUMN play_instances.local_id IS 'Client-generated UUID for offline-first deduplication during sync';
COMMENT ON COLUMN play_instances.sync_status IS 'For sideline entries: unsynced (no video match), synced (matched to video), conflict (ambiguous match), manual (user-resolved)';

-- ============================================================================
-- Step 3: Create sport_positions lookup table
-- ============================================================================
-- Normalized position reference table. Currently seeded with football positions.
-- Multi-sport ready via sport_id FK to existing sports table.

CREATE TABLE sport_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id UUID NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  abbreviation TEXT NOT NULL,        -- 'QB', 'RB', 'WR', etc.
  name TEXT NOT NULL,                -- 'Quarterback', 'Running Back', etc.
  position_group TEXT NOT NULL,      -- 'offense', 'defense', 'special_teams'
  side_of_ball TEXT NOT NULL         -- 'offense', 'defense', 'special_teams'
    CHECK (side_of_ball IN ('offense', 'defense', 'special_teams')),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique: one abbreviation per sport
CREATE UNIQUE INDEX idx_sport_positions_sport_abbr
  ON sport_positions(sport_id, abbreviation);

CREATE INDEX idx_sport_positions_sport
  ON sport_positions(sport_id);

CREATE INDEX idx_sport_positions_group
  ON sport_positions(sport_id, position_group);

-- RLS
ALTER TABLE sport_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_sport_positions" ON sport_positions
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_sport_positions" ON sport_positions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

-- Seed football positions
INSERT INTO sport_positions (sport_id, abbreviation, name, position_group, side_of_ball, display_order) VALUES
  -- Offensive Line
  ((SELECT id FROM sports WHERE slug = 'football'), 'C',   'Center',             'offense', 'offense', 1),
  ((SELECT id FROM sports WHERE slug = 'football'), 'LG',  'Left Guard',         'offense', 'offense', 2),
  ((SELECT id FROM sports WHERE slug = 'football'), 'RG',  'Right Guard',        'offense', 'offense', 3),
  ((SELECT id FROM sports WHERE slug = 'football'), 'LT',  'Left Tackle',        'offense', 'offense', 4),
  ((SELECT id FROM sports WHERE slug = 'football'), 'RT',  'Right Tackle',       'offense', 'offense', 5),
  -- Skill positions
  ((SELECT id FROM sports WHERE slug = 'football'), 'QB',  'Quarterback',        'offense', 'offense', 6),
  ((SELECT id FROM sports WHERE slug = 'football'), 'RB',  'Running Back',       'offense', 'offense', 7),
  ((SELECT id FROM sports WHERE slug = 'football'), 'FB',  'Fullback',           'offense', 'offense', 8),
  ((SELECT id FROM sports WHERE slug = 'football'), 'WR',  'Wide Receiver',      'offense', 'offense', 9),
  ((SELECT id FROM sports WHERE slug = 'football'), 'TE',  'Tight End',          'offense', 'offense', 10),
  ((SELECT id FROM sports WHERE slug = 'football'), 'X',   'Split End',          'offense', 'offense', 11),
  ((SELECT id FROM sports WHERE slug = 'football'), 'Y',   'Flanker',            'offense', 'offense', 12),
  ((SELECT id FROM sports WHERE slug = 'football'), 'Z',   'Z Receiver',         'offense', 'offense', 13),
  ((SELECT id FROM sports WHERE slug = 'football'), 'SL',  'Slot Left',          'offense', 'offense', 14),
  ((SELECT id FROM sports WHERE slug = 'football'), 'SR',  'Slot Right',         'offense', 'offense', 15),
  ((SELECT id FROM sports WHERE slug = 'football'), 'TB',  'Tailback',           'offense', 'offense', 16),
  ((SELECT id FROM sports WHERE slug = 'football'), 'SB',  'Slotback',           'offense', 'offense', 17),
  ((SELECT id FROM sports WHERE slug = 'football'), 'SE',  'Split End',          'offense', 'offense', 18),
  ((SELECT id FROM sports WHERE slug = 'football'), 'FL',  'Flanker',            'offense', 'offense', 19),
  ((SELECT id FROM sports WHERE slug = 'football'), 'WB',  'Wingback',           'offense', 'offense', 20),
  -- Defensive Line
  ((SELECT id FROM sports WHERE slug = 'football'), 'DE',  'Defensive End',      'defense', 'defense', 21),
  ((SELECT id FROM sports WHERE slug = 'football'), 'DT',  'Defensive Tackle',   'defense', 'defense', 22),
  ((SELECT id FROM sports WHERE slug = 'football'), 'NT',  'Nose Tackle',        'defense', 'defense', 23),
  -- Linebackers
  ((SELECT id FROM sports WHERE slug = 'football'), 'MLB', 'Middle Linebacker',  'defense', 'defense', 24),
  ((SELECT id FROM sports WHERE slug = 'football'), 'OLB', 'Outside Linebacker', 'defense', 'defense', 25),
  ((SELECT id FROM sports WHERE slug = 'football'), 'ILB', 'Inside Linebacker',  'defense', 'defense', 26),
  ((SELECT id FROM sports WHERE slug = 'football'), 'WLB', 'Weak Linebacker',    'defense', 'defense', 27),
  ((SELECT id FROM sports WHERE slug = 'football'), 'SLB', 'Strong Linebacker',  'defense', 'defense', 28),
  ((SELECT id FROM sports WHERE slug = 'football'), 'LB',  'Linebacker',         'defense', 'defense', 29),
  -- Defensive Backs
  ((SELECT id FROM sports WHERE slug = 'football'), 'CB',  'Cornerback',         'defense', 'defense', 30),
  ((SELECT id FROM sports WHERE slug = 'football'), 'SS',  'Strong Safety',      'defense', 'defense', 31),
  ((SELECT id FROM sports WHERE slug = 'football'), 'FS',  'Free Safety',        'defense', 'defense', 32),
  ((SELECT id FROM sports WHERE slug = 'football'), 'S',   'Safety',             'defense', 'defense', 33),
  ((SELECT id FROM sports WHERE slug = 'football'), 'NB',  'Nickelback',         'defense', 'defense', 34),
  ((SELECT id FROM sports WHERE slug = 'football'), 'DB',  'Defensive Back',     'defense', 'defense', 35),
  -- Special Teams
  ((SELECT id FROM sports WHERE slug = 'football'), 'K',   'Kicker',             'special_teams', 'special_teams', 36),
  ((SELECT id FROM sports WHERE slug = 'football'), 'P',   'Punter',             'special_teams', 'special_teams', 37),
  ((SELECT id FROM sports WHERE slug = 'football'), 'LS',  'Long Snapper',       'special_teams', 'special_teams', 38),
  ((SELECT id FROM sports WHERE slug = 'football'), 'KR',  'Kick Returner',      'special_teams', 'special_teams', 39),
  ((SELECT id FROM sports WHERE slug = 'football'), 'PR',  'Punt Returner',      'special_teams', 'special_teams', 40),
  ((SELECT id FROM sports WHERE slug = 'football'), 'H',   'Holder',             'special_teams', 'special_teams', 41);

-- ============================================================================
-- Step 4: Create play_personnel junction table
-- ============================================================================
-- Tracks which players were on the field for each play and what position they
-- lined up at. Separate from player_participation which tracks what they DID.
-- This answers "who was on the field?" vs participation's "who did what?"
-- Also supports opponent personnel (is_opponent=true) for scouting.

CREATE TABLE play_personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  play_instance_id UUID NOT NULL REFERENCES play_instances(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,  -- nullable for opponent players
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  position_id UUID REFERENCES sport_positions(id),  -- normalized position
  position_label TEXT,                                -- raw label from sideline entry (e.g., 'RB')
  side_of_ball TEXT NOT NULL CHECK (side_of_ball IN ('offense', 'defense', 'special_teams')),
  is_starter BOOLEAN DEFAULT true,
  is_opponent BOOLEAN NOT NULL DEFAULT false,         -- true for opponent personnel entries
  opponent_number INTEGER,                            -- jersey number for opponent players
  opponent_label TEXT,                                -- label/name for opponent players (e.g., '#12 QB')
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate entries: one player per play (only for roster players)
CREATE UNIQUE INDEX idx_play_personnel_unique
  ON play_personnel(play_instance_id, player_id) WHERE player_id IS NOT NULL;

CREATE INDEX idx_play_personnel_play
  ON play_personnel(play_instance_id);

CREATE INDEX idx_play_personnel_player
  ON play_personnel(player_id, team_id) WHERE player_id IS NOT NULL;

CREATE INDEX idx_play_personnel_team
  ON play_personnel(team_id);

CREATE INDEX idx_play_personnel_position
  ON play_personnel(position_id) WHERE position_id IS NOT NULL;

CREATE INDEX idx_play_personnel_opponent
  ON play_personnel(play_instance_id, is_opponent) WHERE is_opponent = true;

-- RLS
ALTER TABLE play_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their team's play personnel"
  ON play_personnel FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = play_personnel.team_id
        AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create play personnel for their teams"
  ON play_personnel FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = play_personnel.team_id
        AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their team's play personnel"
  ON play_personnel FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = play_personnel.team_id
        AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their team's play personnel"
  ON play_personnel FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = play_personnel.team_id
        AND teams.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Step 5: Create play_penalties table
-- ============================================================================
-- Supports multiple penalties per play (existing columns only allow one).
-- Existing penalty_type/penalty_yards/penalty_on_us columns on play_instances
-- are NOT removed — they will be deprecated after migration to this table.

CREATE TABLE play_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  play_instance_id UUID NOT NULL REFERENCES play_instances(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  penalty_type TEXT NOT NULL,           -- 'holding', 'false_start', 'pass_interference', etc.
  yards INTEGER NOT NULL DEFAULT 0,
  on_us BOOLEAN NOT NULL DEFAULT false, -- true = penalty on our team
  enforced BOOLEAN NOT NULL DEFAULT true, -- false = declined or offset
  player_id UUID REFERENCES players(id) ON DELETE SET NULL, -- who committed it
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_play_penalties_play
  ON play_penalties(play_instance_id);

CREATE INDEX idx_play_penalties_team
  ON play_penalties(team_id);

CREATE INDEX idx_play_penalties_type
  ON play_penalties(penalty_type);

CREATE INDEX idx_play_penalties_player
  ON play_penalties(player_id) WHERE player_id IS NOT NULL;

-- RLS
ALTER TABLE play_penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their team's play penalties"
  ON play_penalties FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = play_penalties.team_id
        AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create play penalties for their teams"
  ON play_penalties FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = play_penalties.team_id
        AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their team's play penalties"
  ON play_penalties FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = play_penalties.team_id
        AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their team's play penalties"
  ON play_penalties FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = play_penalties.team_id
        AND teams.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Step 6: Create game_scouting_packages table
-- ============================================================================
-- Stores opponent tendency packages observed during scouting.
-- Links to a game (opponent) and captures formation/personnel tendencies
-- grouped by situation (down/distance, field zone, etc.).

CREATE TABLE game_scouting_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- 'Red Zone Package', 'Passing Downs', etc.
  situation JSONB NOT NULL DEFAULT '{}', -- {"down": [2,3], "distance": "long", "field_zone": "red_zone"}
  tendencies JSONB NOT NULL DEFAULT '{}', -- {"formations": [...], "play_types": {...}, "personnel": {...}}
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scouting_packages_game
  ON game_scouting_packages(game_id);

CREATE INDEX idx_scouting_packages_team
  ON game_scouting_packages(team_id);

CREATE INDEX idx_scouting_packages_situation
  ON game_scouting_packages USING GIN (situation);

CREATE INDEX idx_scouting_packages_tendencies
  ON game_scouting_packages USING GIN (tendencies);

-- RLS
ALTER TABLE game_scouting_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their team's scouting packages"
  ON game_scouting_packages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = game_scouting_packages.team_id
        AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create scouting packages for their teams"
  ON game_scouting_packages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = game_scouting_packages.team_id
        AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their team's scouting packages"
  ON game_scouting_packages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = game_scouting_packages.team_id
        AND teams.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their team's scouting packages"
  ON game_scouting_packages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = game_scouting_packages.team_id
        AND teams.user_id = auth.uid()
    )
  );

-- Updated at trigger
CREATE TRIGGER update_game_scouting_packages_updated_at
  BEFORE UPDATE ON game_scouting_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Step 7: Verification
-- ============================================================================

DO $$
DECLARE
  pos_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO pos_count FROM sport_positions;
  RAISE NOTICE 'Sport positions seeded: %', pos_count;
END $$;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- DEPRECATION PLAN (future migration):
--   - play_instances.penalty_type → use play_penalties table
--   - play_instances.penalty_yards → use play_penalties table
--   - play_instances.penalty_on_us → use play_penalties table
--   - play_instances.penalty_declined → use play_penalties.enforced
--   - play_instances.ball_carrier_id, qb_id, target_id → use play_personnel
--   - play_instances.lt_id..rt_id + block results → already in player_participation
--
-- FRONTEND DEPENDENCIES:
--   - Film tagging page: needs fallback for video_id nullable
--   - Analytics service: needs to handle source='sideline' plays
--   - Drive triggers: should still fire for sideline plays (no video_id dependency)
-- ============================================================================
