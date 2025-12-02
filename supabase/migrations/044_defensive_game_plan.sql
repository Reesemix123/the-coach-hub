-- Migration: Add defensive game plan support
-- Adds side column to game_plan_plays and defensive situational categories

-- Add side column to game_plan_plays
ALTER TABLE game_plan_plays ADD COLUMN IF NOT EXISTS side TEXT DEFAULT 'offense';

-- Add check constraint for side
ALTER TABLE game_plan_plays DROP CONSTRAINT IF EXISTS game_plan_plays_side_check;
ALTER TABLE game_plan_plays ADD CONSTRAINT game_plan_plays_side_check
  CHECK (side IN ('offense', 'defense'));

-- Drop existing situation constraint and add new one with defensive situations
ALTER TABLE game_plan_plays DROP CONSTRAINT IF EXISTS game_plan_plays_situation_check;
ALTER TABLE game_plan_plays ADD CONSTRAINT game_plan_plays_situation_check
  CHECK (situation IN (
    -- Offensive situations
    '1st_down', '2nd_short', '2nd_medium', '2nd_long',
    '3rd_short', '3rd_medium', '3rd_long', '4th_short',
    'red_zone', 'goal_line', '2_minute', 'backed_up', 'first_15',
    -- Defensive situations (mirrored)
    'def_1st_down', 'def_2nd_short', 'def_2nd_medium', 'def_2nd_long',
    'def_3rd_short', 'def_3rd_medium', 'def_3rd_long', 'def_4th_short',
    'def_red_zone', 'def_goal_line', 'def_2_minute', 'def_backed_up'
  ));

-- Drop existing play_type_category constraint and add new one with defensive categories
ALTER TABLE game_plan_plays DROP CONSTRAINT IF EXISTS game_plan_plays_play_type_category_check;
ALTER TABLE game_plan_plays ADD CONSTRAINT game_plan_plays_play_type_category_check
  CHECK (play_type_category IN (
    -- Offensive play types
    'run', 'short_pass', 'medium_pass', 'long_pass',
    'screen', 'play_action', 'rpo', 'draw',
    -- Defensive play types
    'base_defense', 'nickel', 'dime', 'goal_line_d',
    'zone_coverage', 'man_coverage', 'blitz', 'prevent'
  ));

-- Create index for side column for faster queries
CREATE INDEX IF NOT EXISTS idx_game_plan_plays_side ON game_plan_plays(side);

-- Create composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_game_plan_plays_side_situation
  ON game_plan_plays(game_plan_id, side, situation);
