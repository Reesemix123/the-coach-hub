-- ============================================================================
-- Migration 031: Fix Auto Compute Play Metrics Trigger
-- ============================================================================
-- Purpose: Fix the broken trigger that was causing SELECT query timeouts
--
-- PROBLEM:
--   The auto_compute_play_metrics_trigger was causing statement timeouts
--   on SELECT queries, making the entire play_instances table inaccessible.
--
-- ROOT CAUSE:
--   Unknown - possibly trigger firing on SELECT, or expensive computation
--   in the trigger function itself.
--
-- SOLUTION:
--   1. Drop the old broken trigger and function
--   2. Create a simpler, more efficient version
--   3. Only fire on INSERT and UPDATE (never on SELECT)
--   4. Make computation lightweight (no complex queries)
-- ============================================================================

-- Drop the old broken trigger
DROP TRIGGER IF EXISTS auto_compute_play_metrics_trigger ON play_instances;

-- Drop the old function
DROP FUNCTION IF EXISTS auto_compute_play_metrics();

-- Create a new, optimized trigger function
CREATE OR REPLACE FUNCTION auto_compute_play_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Compute 'success' based on standard football success criteria
  -- Only if we have the required fields
  IF NEW.down IS NOT NULL AND NEW.distance IS NOT NULL AND NEW.yards_gained IS NOT NULL THEN
    -- If explicitly marked as first down, it's successful
    IF NEW.resulted_in_first_down = true THEN
      NEW.success := true;
    ELSE
      -- Standard success criteria:
      -- 1st down: gain 40% of yards needed
      -- 2nd down: gain 60% of yards needed
      -- 3rd/4th down: gain 100% of yards needed (first down)
      CASE NEW.down
        WHEN 1 THEN
          NEW.success := (NEW.yards_gained >= NEW.distance * 0.4);
        WHEN 2 THEN
          NEW.success := (NEW.yards_gained >= NEW.distance * 0.6);
        WHEN 3, 4 THEN
          NEW.success := (NEW.yards_gained >= NEW.distance);
        ELSE
          NEW.success := false;
      END CASE;
    END IF;
  ELSE
    -- Can't determine success without required fields
    NEW.success := NULL;
  END IF;

  -- Compute 'explosive' based on play type and yards gained
  -- Explosive = 10+ yard run or 15+ yard pass
  IF NEW.yards_gained IS NOT NULL THEN
    IF NEW.play_type = 'run' AND NEW.yards_gained >= 10 THEN
      NEW.explosive := true;
    ELSIF NEW.play_type = 'pass' AND NEW.yards_gained >= 15 THEN
      NEW.explosive := true;
    ELSE
      NEW.explosive := false;
    END IF;
  ELSE
    NEW.explosive := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger (only fires on INSERT and UPDATE, never on SELECT)
CREATE TRIGGER auto_compute_play_metrics_trigger
  BEFORE INSERT OR UPDATE ON play_instances
  FOR EACH ROW
  EXECUTE FUNCTION auto_compute_play_metrics();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- The trigger should now:
--   1. Only fire on INSERT/UPDATE (not SELECT)
--   2. Complete in <1ms per row (lightweight computation)
--   3. Not cause any timeouts
--
-- Test by inserting a sample row:
--   INSERT INTO play_instances (team_id, video_id, play_code, down, distance, yards_gained, play_type)
--   VALUES ('test-team-id', 'test-video-id', 'P-001', 1, 10, 5, 'run');
--
-- Should auto-compute:
--   - success = true (5 yards on 1st & 10 is 50%, which is > 40%)
--   - explosive = false (5 yards is not >= 10 for a run)
-- ============================================================================
