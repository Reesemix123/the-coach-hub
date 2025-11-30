-- Migration: Add situational categorization to game plan plays
-- Purpose: Organize plays by game situations (1st down, 3rd short, red zone, etc.) and play type

-- Add situational columns to game_plan_plays
ALTER TABLE game_plan_plays
  ADD COLUMN IF NOT EXISTS situation TEXT,           -- '1st_down', '3rd_short', 'red_zone', etc.
  ADD COLUMN IF NOT EXISTS play_type_category TEXT;  -- 'run', 'short_pass', 'long_pass', 'screen'

-- Add check constraint for valid situations
ALTER TABLE game_plan_plays
  ADD CONSTRAINT game_plan_plays_situation_check
  CHECK (situation IS NULL OR situation IN (
    '1st_down',
    '2nd_short',
    '2nd_medium',
    '2nd_long',
    '3rd_short',
    '3rd_medium',
    '3rd_long',
    '4th_short',
    'red_zone',
    'goal_line',
    '2_minute',
    'backed_up',
    'opening_script'
  ));

-- Add check constraint for valid play type categories
ALTER TABLE game_plan_plays
  ADD CONSTRAINT game_plan_plays_play_type_category_check
  CHECK (play_type_category IS NULL OR play_type_category IN (
    'run',
    'short_pass',
    'medium_pass',
    'long_pass',
    'screen',
    'play_action',
    'rpo',
    'draw'
  ));

-- Create index for situational queries
CREATE INDEX IF NOT EXISTS idx_game_plan_plays_situation ON game_plan_plays(game_plan_id, situation);
CREATE INDEX IF NOT EXISTS idx_game_plan_plays_type_category ON game_plan_plays(game_plan_id, play_type_category);

-- Comment explaining the schema
COMMENT ON COLUMN game_plan_plays.situation IS 'Game situation category: 1st_down, 3rd_short, red_zone, etc.';
COMMENT ON COLUMN game_plan_plays.play_type_category IS 'Play type subcategory: run, short_pass, long_pass, etc.';
