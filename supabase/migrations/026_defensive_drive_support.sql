-- Migration 026: Defensive Drive Support (Opponent Possessions)
-- Enables tracking opponent possessions as "defensive drives"
-- Allows quarter filtering for defensive plays

-- Add possession_type column to distinguish offensive vs defensive drives
ALTER TABLE drives
  ADD COLUMN possession_type TEXT NOT NULL DEFAULT 'offense'
    CHECK (possession_type IN ('offense', 'defense'));

-- Add comment for clarity
COMMENT ON COLUMN drives.possession_type IS
  'offense = your team has the ball, defense = opponent has the ball (defensive drive)';

-- Update the unique constraint to allow separate drive numbering per possession type
-- Drop old constraint if it exists
DROP INDEX IF EXISTS idx_drives_game_team_number;

-- Create new constraint: separate sequences for offense and defense
CREATE UNIQUE INDEX idx_drives_game_team_number_possession
  ON drives(game_id, team_id, possession_type, drive_number);

-- Add index for querying by possession type
CREATE INDEX idx_drives_possession_type ON drives(possession_type);

-- Backfill existing drives as 'offense'
-- (All existing drives are offensive possessions)
UPDATE drives SET possession_type = 'offense' WHERE possession_type IS NULL OR possession_type = 'offense';

-- Verification query (run separately to check)
-- SELECT possession_type, COUNT(*) FROM drives GROUP BY possession_type;
