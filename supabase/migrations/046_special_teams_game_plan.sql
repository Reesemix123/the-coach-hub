-- Migration: Add special teams support to game plan
-- Expands side, situation, and play_type_category constraints to include special teams

-- Update side constraint to include special_teams
ALTER TABLE game_plan_plays DROP CONSTRAINT IF EXISTS game_plan_plays_side_check;
ALTER TABLE game_plan_plays ADD CONSTRAINT game_plan_plays_side_check
  CHECK (side IN ('offense', 'defense', 'special_teams'));

-- Update situation constraint to include special teams situations
ALTER TABLE game_plan_plays DROP CONSTRAINT IF EXISTS game_plan_plays_situation_check;
ALTER TABLE game_plan_plays ADD CONSTRAINT game_plan_plays_situation_check
  CHECK (situation IN (
    -- Offensive situations
    '1st_down', '2nd_short', '2nd_medium', '2nd_long',
    '3rd_short', '3rd_medium', '3rd_long', '4th_short',
    'red_zone', 'goal_line', '2_minute', 'backed_up', 'first_15',
    -- Defensive situations
    'def_1st_down', 'def_2nd_short', 'def_2nd_medium', 'def_2nd_long',
    'def_3rd_short', 'def_3rd_medium', 'def_3rd_long', 'def_4th_short',
    'def_red_zone', 'def_goal_line', 'def_2_minute', 'def_backed_up',
    -- Special Teams situations
    'st_kickoff', 'st_kickoff_after_safety',
    'st_kick_return', 'st_kick_return_onside',
    'st_punt', 'st_punt_backed_up',
    'st_punt_return', 'st_punt_block',
    'st_field_goal', 'st_fg_long', 'st_fg_block',
    'st_pat', 'st_2pt_conversion'
  ));

-- Update play_type_category constraint to include special teams categories
ALTER TABLE game_plan_plays DROP CONSTRAINT IF EXISTS game_plan_plays_play_type_category_check;
ALTER TABLE game_plan_plays ADD CONSTRAINT game_plan_plays_play_type_category_check
  CHECK (play_type_category IN (
    -- Offensive play types
    'run', 'short_pass', 'medium_pass', 'long_pass',
    'screen', 'play_action', 'rpo', 'draw',
    -- Defensive play types
    'base_defense', 'nickel', 'dime', 'goal_line_d',
    'zone_coverage', 'man_coverage', 'blitz', 'prevent',
    -- Special Teams play types
    'kickoff_deep', 'kickoff_onside', 'kickoff_squib',
    'kick_return_middle', 'kick_return_wall', 'kick_return_wedge',
    'punt_standard', 'punt_directional', 'punt_fake',
    'punt_return', 'punt_block', 'punt_safe',
    'field_goal', 'fg_fake', 'fg_block',
    'pat_kick', 'pat_fake', 'two_point'
  ));

-- Add comment for the special teams support
COMMENT ON COLUMN game_plan_plays.side IS 'Which side of the ball: offense, defense, or special_teams';
