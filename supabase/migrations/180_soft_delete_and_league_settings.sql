-- ============================================================================
-- Migration 180
-- 1. Soft delete support for play_instances (deleted_at)
-- 2. League field settings on teams (field_length, touchback_yard_line)
-- ============================================================================

-- Step 1: Soft delete for play_instances
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN play_instances.deleted_at IS 'Soft delete timestamp. NULL = active, non-NULL = deleted. Used by sideline tracker drive cleanup.';

CREATE INDEX IF NOT EXISTS idx_play_instances_deleted_at
  ON play_instances(deleted_at) WHERE deleted_at IS NOT NULL;

-- Step 2: League field settings on teams
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS field_length INTEGER NOT NULL DEFAULT 100;

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS touchback_yard_line INTEGER NOT NULL DEFAULT 20;

COMMENT ON COLUMN teams.field_length IS 'Playing field length in yards. 100 for 11-man, 80 for 8-man. Used by calculateBallPlacement.';
COMMENT ON COLUMN teams.touchback_yard_line IS 'Touchback placement yard line. 20 for most leagues, 25 for NFL kickoffs. Used by calculateBallPlacement.';
