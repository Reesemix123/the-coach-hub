-- Migration: Add FG Block special teams unit and additional block result types
-- This allows tracking blocked field goals from the blocking team's perspective

-- Drop existing constraint on special_teams_unit and add fg_block
ALTER TABLE play_instances
  DROP CONSTRAINT IF EXISTS play_instances_special_teams_unit_check;

ALTER TABLE play_instances
  ADD CONSTRAINT play_instances_special_teams_unit_check CHECK (special_teams_unit IN (
    'kickoff', 'kick_return', 'punt', 'punt_return', 'field_goal', 'fg_block', 'pat'
  ));

-- Drop existing constraint on kick_result and add new block result types
ALTER TABLE play_instances
  DROP CONSTRAINT IF EXISTS play_instances_kick_result_check;

ALTER TABLE play_instances
  ADD CONSTRAINT play_instances_kick_result_check CHECK (kick_result IN (
    'made', 'missed', 'blocked', 'blocked_recovered', 'blocked_returned', 'blocked_td', 'blocked_lost',
    'touchback', 'fair_catch', 'returned', 'out_of_bounds',
    'onside_recovered', 'onside_lost', 'fake_success', 'fake_fail', 'muffed', 'downed'
  ));

-- Add column for tracking who blocked the kick (for FG Block unit)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS blocker_id UUID REFERENCES players(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN play_instances.blocker_id IS 'Player who blocked the kick (for FG Block plays)';
