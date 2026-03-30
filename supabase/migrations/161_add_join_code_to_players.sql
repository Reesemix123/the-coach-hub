-- Migration 161: Add join_code column to players table
-- Used by parents to link their athlete profile to a roster player

-- Add the column (nullable initially so we can backfill)
ALTER TABLE players ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- Generate 6-character uppercase codes for all existing players
UPDATE players SET join_code = UPPER(SUBSTRING(MD5(id::text), 1, 6))
WHERE join_code IS NULL;

-- Make it NOT NULL with a default for new players
ALTER TABLE players ALTER COLUMN join_code SET NOT NULL;
ALTER TABLE players ALTER COLUMN join_code SET DEFAULT UPPER(SUBSTRING(MD5(gen_random_uuid()::text), 1, 6));

-- Index for fast lookup by join code
CREATE INDEX IF NOT EXISTS idx_players_join_code ON players(join_code);
