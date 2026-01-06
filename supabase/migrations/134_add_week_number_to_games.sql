-- Migration 134: Add week_number and season_phase to games table
-- ============================================================================
-- PURPOSE:
--   Enable cumulative season filtering in analytics reports.
--   Coaches can view "Through Week X" stats instead of just single games.
-- ============================================================================

-- Add week_number column (nullable, coaches can set or we auto-calculate)
ALTER TABLE games ADD COLUMN IF NOT EXISTS week_number INTEGER;

-- Add season_phase to distinguish regular season from playoffs/scrimmages
-- Note: game_type column already exists for 'team' vs 'opponent' distinction
ALTER TABLE games ADD COLUMN IF NOT EXISTS season_phase TEXT DEFAULT 'regular'
  CHECK (season_phase IN ('scrimmage', 'regular', 'playoff', 'championship', 'bowl'));

-- Add index for efficient week-based queries
CREATE INDEX IF NOT EXISTS idx_games_week_number ON games(team_id, week_number);
CREATE INDEX IF NOT EXISTS idx_games_season_phase ON games(team_id, season_phase);

-- ============================================================================
-- Auto-populate week_number for existing games based on date ordering
-- ============================================================================
-- For each team, order games by date and assign week numbers 1, 2, 3...
-- This runs once for existing data; new games will be set by the app
-- Only applies to 'team' games, not opponent scouting games

WITH ranked_games AS (
  SELECT
    id,
    team_id,
    date,
    ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY date ASC) as calculated_week
  FROM games
  WHERE date IS NOT NULL
    AND (is_opponent_game IS NULL OR is_opponent_game = false)
    AND (game_type IS NULL OR game_type = 'team')
)
UPDATE games g
SET week_number = rg.calculated_week
FROM ranked_games rg
WHERE g.id = rg.id
  AND g.week_number IS NULL;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON COLUMN games.week_number IS 'Week number in the season (1-based). Auto-calculated from date order if not set by coach.';
COMMENT ON COLUMN games.season_phase IS 'Phase of season: scrimmage, regular, playoff, championship, bowl. Affects season aggregate calculations.';
