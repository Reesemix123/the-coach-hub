-- Migration 095: Fix tagging tier audit log column name
-- The log_tagging_tier_event function was using 'details' but the column is named 'metadata'

-- Drop existing triggers first
DROP TRIGGER IF EXISTS trigger_log_tagging_tier_event_insert ON games;
DROP TRIGGER IF EXISTS trigger_log_tagging_tier_event_update ON games;

-- Recreate the function with correct column name
CREATE OR REPLACE FUNCTION log_tagging_tier_event()
RETURNS TRIGGER AS $$
DECLARE
  event_action TEXT;
  event_details JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Initial tier selection on insert
    event_action := 'tagging_tier_selected';
    event_details := jsonb_build_object(
      'tier', NEW.tagging_tier,
      'game_id', NEW.id,
      'game_name', NEW.name
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.tagging_tier IS NULL AND NEW.tagging_tier IS NOT NULL THEN
      -- Initial tier selection
      event_action := 'tagging_tier_selected';
      event_details := jsonb_build_object(
        'tier', NEW.tagging_tier,
        'game_id', NEW.id,
        'game_name', NEW.name
      );
    ELSIF OLD.tagging_tier IS NOT NULL AND NEW.tagging_tier IS NOT NULL
          AND OLD.tagging_tier != NEW.tagging_tier THEN
      -- Tier upgrade
      event_action := 'tagging_tier_upgraded';
      event_details := jsonb_build_object(
        'from_tier', OLD.tagging_tier,
        'to_tier', NEW.tagging_tier,
        'game_id', NEW.id,
        'game_name', NEW.name
      );
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Log to audit_logs using correct column name 'metadata' instead of 'details'
  INSERT INTO audit_logs (
    actor_id,
    actor_email,
    action,
    target_type,
    target_id,
    target_name,
    metadata,
    timestamp
  ) VALUES (
    auth.uid(),
    (SELECT email FROM profiles WHERE id = auth.uid()),
    event_action,
    'game',
    NEW.id,
    NEW.name,
    event_details,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers
-- INSERT trigger: fires when a game is created with a tagging_tier set
CREATE TRIGGER trigger_log_tagging_tier_event_insert
  AFTER INSERT ON games
  FOR EACH ROW
  WHEN (NEW.tagging_tier IS NOT NULL)
  EXECUTE FUNCTION log_tagging_tier_event();

-- UPDATE trigger: fires when tagging_tier changes
CREATE TRIGGER trigger_log_tagging_tier_event_update
  AFTER UPDATE ON games
  FOR EACH ROW
  WHEN (NEW.tagging_tier IS NOT NULL AND
        (OLD.tagging_tier IS NULL OR OLD.tagging_tier IS DISTINCT FROM NEW.tagging_tier))
  EXECUTE FUNCTION log_tagging_tier_event();
