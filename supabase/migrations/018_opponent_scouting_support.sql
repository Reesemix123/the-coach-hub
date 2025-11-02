-- Migration 018: Opponent Scouting Support
-- Purpose: Add fields to track opponent scouting games for film analysis

-- Add opponent scouting fields to games table
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS is_opponent_game BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS opponent_team_name VARCHAR(200);

-- Add index for filtering opponent games
CREATE INDEX IF NOT EXISTS idx_games_is_opponent ON games(is_opponent_game);

-- Add comment
COMMENT ON COLUMN games.is_opponent_game IS 'True if this game is for opponent scouting (not own team game)';
COMMENT ON COLUMN games.opponent_team_name IS 'Name of opponent team being scouted (if is_opponent_game = true)';
