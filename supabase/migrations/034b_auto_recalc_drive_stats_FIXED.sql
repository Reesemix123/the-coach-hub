-- ============================================================================
-- Migration 034b: Automatic Drive Stats Recalculation (FIXED)
-- ============================================================================
-- FIXES: Changed result_type → result (correct column name)
-- Creates database triggers that automatically update drive statistics
-- whenever play_instances are inserted, updated, or deleted.
-- This eliminates the need for manual SQL scripts or service calls.
-- ============================================================================

-- First, drop the broken triggers and functions from 034
DROP TRIGGER IF EXISTS trigger_recalc_drive_stats_insert ON play_instances;
DROP TRIGGER IF EXISTS trigger_recalc_drive_stats_update ON play_instances;
DROP TRIGGER IF EXISTS trigger_recalc_drive_stats_delete ON play_instances;
DROP FUNCTION IF EXISTS recalculate_drive_stats();
DROP FUNCTION IF EXISTS update_single_drive_stats(UUID);

-- ============================================================================
-- FUNCTION: Recalculate Drive Stats
-- ============================================================================
-- This function calculates ALL drive statistics from linked plays:
-- - plays_count, yards_gained, first_downs (basic counts)
-- - result, points, scoring_drive (scoring outcome)
-- - three_and_out (efficiency metric)
-- - reached_red_zone (field position)
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_drive_stats()
RETURNS TRIGGER AS $$
DECLARE
  target_drive_id UUID;
  old_drive_id UUID;
BEGIN
  -- Determine which drive(s) to recalculate
  IF (TG_OP = 'DELETE') THEN
    target_drive_id := OLD.drive_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    target_drive_id := NEW.drive_id;
    old_drive_id := OLD.drive_id;

    -- If drive_id changed, recalculate both old and new drives
    IF (old_drive_id IS NOT NULL AND old_drive_id != target_drive_id) THEN
      PERFORM update_single_drive_stats(old_drive_id);
    END IF;
  ELSE -- INSERT
    target_drive_id := NEW.drive_id;
  END IF;

  -- Only recalculate if drive_id is set
  IF target_drive_id IS NOT NULL THEN
    PERFORM update_single_drive_stats(target_drive_id);
  END IF;

  -- Return appropriate record based on operation
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Update Single Drive Stats
-- ============================================================================
-- Core calculation logic - updates all stats for one drive
-- FIXED: Uses "result" column (not "result_type")
-- ============================================================================

CREATE OR REPLACE FUNCTION update_single_drive_stats(p_drive_id UUID)
RETURNS VOID AS $$
DECLARE
  v_plays_count INTEGER;
  v_yards_gained INTEGER;
  v_first_downs INTEGER;
  v_reached_red_zone BOOLEAN;
  v_result TEXT;
  v_points INTEGER;
  v_three_and_out BOOLEAN;
  v_scoring_drive BOOLEAN;
  v_has_turnover BOOLEAN;
  v_has_touchdown BOOLEAN;
  v_has_pass_touchdown BOOLEAN;
  v_has_field_goal BOOLEAN;
  v_has_safety BOOLEAN;
  v_last_play_result TEXT;
BEGIN
  -- Get basic aggregates
  SELECT
    COUNT(*),
    COALESCE(SUM(yards_gained), 0),
    COUNT(*) FILTER (WHERE resulted_in_first_down = true),
    COALESCE(bool_or(yard_line >= 80), false)
  INTO
    v_plays_count,
    v_yards_gained,
    v_first_downs,
    v_reached_red_zone
  FROM play_instances
  WHERE drive_id = p_drive_id;

  -- Check for scoring and turnover plays
  -- FIXED: Using "result" column with various possible values
  SELECT
    bool_or(is_turnover = true),
    bool_or(result ILIKE '%touchdown%' AND result NOT ILIKE '%pass%'),
    bool_or(result ILIKE '%pass%touchdown%' OR result ILIKE '%passing%touchdown%'),
    bool_or(result ILIKE '%field%goal%' OR result ILIKE '%fg%'),
    bool_or(result ILIKE '%safety%')
  INTO
    v_has_turnover,
    v_has_touchdown,
    v_has_pass_touchdown,
    v_has_field_goal,
    v_has_safety
  FROM play_instances
  WHERE drive_id = p_drive_id;

  -- Get last play result
  SELECT result
  INTO v_last_play_result
  FROM play_instances
  WHERE drive_id = p_drive_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Determine drive result and points (priority order)
  IF v_has_turnover THEN
    v_result := 'turnover';
    v_points := 0;
  ELSIF v_has_touchdown OR v_has_pass_touchdown THEN
    v_result := 'touchdown';
    v_points := 6;  -- Base touchdown points (excludes PAT)
  ELSIF v_has_field_goal THEN
    v_result := 'field_goal';
    v_points := 3;
  ELSIF v_has_safety THEN
    v_result := 'safety';
    v_points := 2;
  ELSIF v_last_play_result ILIKE '%punt%' THEN
    v_result := 'punt';
    v_points := 0;
  ELSIF v_last_play_result ILIKE '%turnover%down%' OR v_last_play_result ILIKE '%downs%' THEN
    v_result := 'downs';
    v_points := 0;
  ELSE
    v_result := 'end_half';
    v_points := 0;
  END IF;

  -- Calculate derived metrics
  v_three_and_out := (v_plays_count = 3 AND v_first_downs = 0);
  v_scoring_drive := (v_points > 0);

  -- Update the drive record
  UPDATE drives
  SET
    plays_count = v_plays_count,
    yards_gained = v_yards_gained,
    first_downs = v_first_downs,
    reached_red_zone = v_reached_red_zone,
    result = v_result,
    points = v_points,
    three_and_out = v_three_and_out,
    scoring_drive = v_scoring_drive,
    updated_at = NOW()
  WHERE id = p_drive_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS: Auto-recalculate on play_instances changes
-- ============================================================================

CREATE TRIGGER trigger_recalc_drive_stats_insert
  AFTER INSERT ON play_instances
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_drive_stats();

CREATE TRIGGER trigger_recalc_drive_stats_update
  AFTER UPDATE ON play_instances
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_drive_stats();

CREATE TRIGGER trigger_recalc_drive_stats_delete
  AFTER DELETE ON play_instances
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_drive_stats();

-- ============================================================================
-- ONE-TIME: Recalculate all existing drives
-- ============================================================================
-- This ensures all existing drives have correct stats after trigger deployment
-- ============================================================================

DO $$
DECLARE
  drive_record RECORD;
BEGIN
  FOR drive_record IN SELECT id FROM drives LOOP
    PERFORM update_single_drive_stats(drive_record.id);
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION: Check that triggers are installed
-- ============================================================================

SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'play_instances'
  AND trigger_name LIKE 'trigger_recalc_drive_stats%'
ORDER BY trigger_name;
