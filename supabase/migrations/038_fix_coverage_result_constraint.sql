-- Migration 038: Fix coverage_result Constraint
-- Fixes mismatch between database constraint and UI values for coverage tracking
--
-- Issue: Migration 011 defined coverage_result with CHECK constraint ('win', 'loss', 'neutral')
-- but the film tagging UI sends detailed values ('target_allowed', 'completion_allowed', etc.)
-- This mismatch prevents saving coverage tracking data.
--
-- Solution: Update constraint to accept the more detailed UI values which provide
-- better analytics granularity. Win/loss can be derived from these specific values.

-- Drop the old constraint
ALTER TABLE play_instances
DROP CONSTRAINT IF EXISTS play_instances_coverage_result_check;

-- Add new constraint with detailed coverage result values
ALTER TABLE play_instances
ADD CONSTRAINT play_instances_coverage_result_check
CHECK (coverage_result IN (
  'target_allowed',      -- Ball thrown at receiver (neutral)
  'completion_allowed',  -- Receiver caught it (loss)
  'incompletion',        -- Pass defended/dropped (win)
  'interception',        -- INT by coverage player (win)
  'pass_breakup'         -- PBU by coverage player (win)
));

-- Update calculate_coverage_success function to use new detailed values
-- Success = incompletion, interception, or pass_breakup
CREATE OR REPLACE FUNCTION calculate_coverage_success(p_player_id UUID, p_team_id UUID)
RETURNS TABLE (
  targets BIGINT,
  successes BIGINT, -- Incompletion, INT, or PBU
  success_rate NUMERIC
) AS $$
DECLARE
  v_targets BIGINT;
  v_successes BIGINT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE coverage_result IN ('incompletion', 'interception', 'pass_breakup'))
  INTO v_targets, v_successes
  FROM play_instances
  WHERE coverage_player_id = p_player_id
    AND team_id = p_team_id;

  RETURN QUERY SELECT
    v_targets,
    v_successes,
    CASE
      WHEN v_targets > 0 THEN ROUND((v_successes::NUMERIC / v_targets) * 100, 1)
      ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment explaining the mapping
COMMENT ON COLUMN play_instances.coverage_result IS
'Detailed coverage result: target_allowed (neutral), completion_allowed (loss), incompletion/interception/pass_breakup (win).
Provides granular analytics for defensive back performance tracking.';
