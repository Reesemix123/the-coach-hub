-- Migration 021: Add Injury Tracking to Players
-- Purpose: Track player injuries for Personnel station in Game Week Command Center

-- Add injury tracking columns to players table
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS injury_status VARCHAR(20) CHECK (injury_status IN ('healthy', 'questionable', 'doubtful', 'out', 'ir')),
  ADD COLUMN IF NOT EXISTS injury_notes TEXT,
  ADD COLUMN IF NOT EXISTS injury_updated_at TIMESTAMPTZ;

-- Index for filtering by injury status
CREATE INDEX IF NOT EXISTS idx_players_injury_status
  ON players(team_id, injury_status)
  WHERE injury_status IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN players.injury_status IS 'Player injury status: healthy, questionable, doubtful, out, ir';
COMMENT ON COLUMN players.injury_notes IS 'Details about the injury (e.g., "ankle sprain - day-to-day")';
COMMENT ON COLUMN players.injury_updated_at IS 'Last time injury status was updated';
