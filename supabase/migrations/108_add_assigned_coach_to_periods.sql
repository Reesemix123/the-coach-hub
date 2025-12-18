-- Migration: Add assigned_coach_id to practice_periods
-- This allows tracking which coach is responsible for each concurrent period

-- Add assigned_coach_id column to practice_periods
ALTER TABLE practice_periods
ADD COLUMN IF NOT EXISTS assigned_coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add index for faster lookups by coach
CREATE INDEX IF NOT EXISTS idx_practice_periods_coach ON practice_periods(assigned_coach_id);

-- Comment explaining the column
COMMENT ON COLUMN practice_periods.assigned_coach_id IS 'The coach responsible for running this period (mainly used for concurrent periods with multiple coaches)';
