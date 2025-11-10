-- Migration 020: Practice-Schedule Integration
-- Purpose: Link practice plans to schedule events and support concurrent periods

-- ====================
-- TEAM EVENTS - Add practice plan link
-- ====================
-- Add foreign key to link schedule events to practice plans
ALTER TABLE team_events
  ADD COLUMN IF NOT EXISTS practice_plan_id UUID REFERENCES practice_plans(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_events_practice_plan ON team_events(practice_plan_id);

-- ====================
-- PRACTICE PERIODS - Add concurrent support
-- ====================
-- Add start_time to support concurrent periods
ALTER TABLE practice_periods
  ADD COLUMN IF NOT EXISTS start_time INTEGER; -- Minutes from practice start (0 = beginning)

-- Add flag to indicate if period runs concurrently with others
ALTER TABLE practice_periods
  ADD COLUMN IF NOT EXISTS is_concurrent BOOLEAN DEFAULT FALSE;

-- ====================
-- COMMENTS
-- ====================
COMMENT ON COLUMN team_events.practice_plan_id IS 'Links schedule event to its practice plan';
COMMENT ON COLUMN practice_periods.start_time IS 'Start time in minutes from practice start (0 = beginning). NULL means sequential after previous period.';
COMMENT ON COLUMN practice_periods.is_concurrent IS 'TRUE if this period runs at the same time as other periods (different position groups)';
