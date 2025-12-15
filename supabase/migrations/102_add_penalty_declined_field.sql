-- Migration 102: Add penalty_declined field for tagging efficiency
-- When true, penalty was recorded but declined by the team, so it should not
-- affect calculations for the next play's down, distance, or yard line.

-- ============================================================================
-- 1. Add penalty_declined column to play_instances
-- ============================================================================
ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS penalty_declined BOOLEAN DEFAULT false;

COMMENT ON COLUMN play_instances.penalty_declined IS
'When true, penalty was declined and should not affect next play calculations (down, distance, yard line)';

-- ============================================================================
-- 2. Create index for efficient penalty queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_play_instances_penalty_declined
ON play_instances(video_id, penalty_on_play, penalty_declined)
WHERE penalty_on_play = true;
