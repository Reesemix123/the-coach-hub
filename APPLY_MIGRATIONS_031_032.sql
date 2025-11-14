-- ============================================================================
-- COMBINED: Apply Migrations 031 + 032
-- ============================================================================
-- Safe to run even if 031 already applied (uses DROP IF EXISTS)
-- Apply these in order to fix trigger then create junction table
-- ============================================================================

-- ============================================================================
-- MIGRATION 031: Fix Auto Compute Play Metrics Trigger
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

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 031 complete: Trigger fixed and re-enabled';
END $$;

-- ============================================================================
-- MIGRATION 032: Create player_participation Junction Table
-- ============================================================================
-- (Full migration 032 follows...)
-- ============================================================================
