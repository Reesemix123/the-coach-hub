-- Migration 109: Add selected coaches to practice plans
-- Purpose: Store the coaches selected during AI practice generation for proper timeline display

-- Add selected_coaches column to store coach info including guest coaches
ALTER TABLE practice_plans
ADD COLUMN IF NOT EXISTS selected_coaches JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN practice_plans.selected_coaches IS 'Array of selected coaches: [{id: string, name: string, isGuest?: boolean}]';

-- Add coach_count for quick reference
ALTER TABLE practice_plans
ADD COLUMN IF NOT EXISTS coach_count INTEGER DEFAULT 1;

COMMENT ON COLUMN practice_plans.coach_count IS 'Number of coaches for this practice (for concurrent drill stations)';
