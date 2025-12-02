-- Migration: Allow same play in multiple situations with same call number
-- A play can appear in multiple situations but should keep the same call number

-- Drop the existing unique constraint on play_code (which prevented same play in multiple situations)
ALTER TABLE game_plan_plays DROP CONSTRAINT IF EXISTS game_plan_plays_game_plan_id_play_code_key;

-- Add a new unique constraint that allows same play_code in multiple situations
-- Each (game_plan_id, play_code, situation) combination must be unique
ALTER TABLE game_plan_plays ADD CONSTRAINT game_plan_plays_unique_per_situation
  UNIQUE(game_plan_id, play_code, situation);

-- The call_number constraint remains - each call_number unique per game plan
-- (game_plan_id, call_number) is still unique

-- Comment explaining the change
COMMENT ON CONSTRAINT game_plan_plays_unique_per_situation ON game_plan_plays
  IS 'Allows same play to appear in multiple situations, but only once per situation';
