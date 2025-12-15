-- Migration 101: Update kick_result check constraint to include new values
-- Adds: returned_td, muffed_lost

-- Drop the old constraint
ALTER TABLE play_instances
DROP CONSTRAINT IF EXISTS play_instances_kick_result_check;

-- Add updated constraint with new values
ALTER TABLE play_instances
ADD CONSTRAINT play_instances_kick_result_check
CHECK (kick_result IS NULL OR kick_result IN (
  'made',
  'missed',
  'blocked',
  'blocked_recovered',
  'blocked_returned',
  'blocked_td',
  'blocked_lost',
  'touchback',
  'fair_catch',
  'returned',
  'returned_td',        -- NEW: Returned for touchdown
  'out_of_bounds',
  'onside_recovered',
  'onside_lost',
  'fake_success',
  'fake_fail',
  'muffed',
  'muffed_lost',        -- NEW: Muffed and lost possession
  'downed'
));
