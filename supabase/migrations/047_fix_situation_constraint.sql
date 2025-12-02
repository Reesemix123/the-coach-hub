-- Migration: Fix situation constraint to match frontend categories
-- The frontend uses more granular situation IDs than the original constraint allowed

-- Drop existing situation constraint
ALTER TABLE game_plan_plays DROP CONSTRAINT IF EXISTS game_plan_plays_situation_check;

-- Add new constraint with all frontend situation IDs
ALTER TABLE game_plan_plays ADD CONSTRAINT game_plan_plays_situation_check
  CHECK (situation IS NULL OR situation IN (
    -- Offensive situations (granular by distance)
    '1st_short', '1st_medium', '1st_long',
    '2nd_short', '2nd_medium', '2nd_long',
    '3rd_short', '3rd_medium', '3rd_long',
    '4th_short', '4th_medium', '4th_long',
    'red_zone', 'goal_line', '2_minute', 'backed_up', 'first_15',
    -- Legacy offensive situations (for backward compatibility)
    '1st_down', 'opening_script',

    -- Defensive situations (granular by distance)
    'def_1st_short', 'def_1st_medium', 'def_1st_long',
    'def_2nd_short', 'def_2nd_medium', 'def_2nd_long',
    'def_3rd_short', 'def_3rd_medium', 'def_3rd_long',
    'def_4th_short', 'def_4th_medium', 'def_4th_long',
    'def_red_zone', 'def_goal_line', 'def_2_minute', 'def_backed_up',
    -- Legacy defensive situations (for backward compatibility)
    'def_1st_down',

    -- Special Teams: Kickoff
    'st_ko_start_game', 'st_ko_start_half', 'st_ko_late_game_ahead', 'st_ko_late_game_behind',
    -- Legacy kickoff
    'st_kickoff', 'st_kickoff_after_safety',

    -- Special Teams: Kick Return
    'st_kr_standard', 'st_kr_late_game_ahead', 'st_kr_late_game_behind',
    -- Legacy kick return
    'st_kick_return', 'st_kick_return_onside',

    -- Special Teams: Punt
    'st_punt_own_territory', 'st_punt_midfield', 'st_punt_plus_territory',
    'st_punt_backed_up', 'st_punt_late_game_ahead', 'st_punt_late_game_behind',
    -- Legacy punt
    'st_punt',

    -- Special Teams: Punt Return
    'st_pr_standard', 'st_pr_plus_territory', 'st_pr_own_territory',
    'st_pr_late_game_ahead', 'st_pr_late_game_behind',
    -- Legacy punt return/block
    'st_punt_return', 'st_punt_block',

    -- Special Teams: Field Goal
    'st_fg_short', 'st_fg_medium', 'st_fg_long', 'st_fg_max',
    -- Legacy field goal
    'st_field_goal',

    -- Special Teams: FG Block
    'st_fgb_short', 'st_fgb_medium', 'st_fgb_long', 'st_fgb_game_critical',
    -- Legacy FG block
    'st_fg_block',

    -- Special Teams: PAT / 2-Point
    'st_pat_standard', 'st_2pt_ahead', 'st_2pt_behind', 'st_2pt_tied',
    -- Legacy PAT
    'st_pat', 'st_2pt_conversion'
  ));

-- Comment on the update
COMMENT ON CONSTRAINT game_plan_plays_situation_check ON game_plan_plays
  IS 'Validates situation IDs match frontend gamePlanCategories.ts definitions';
