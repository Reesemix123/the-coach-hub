-- Migration 094: Add tagging_tier to games table
-- Implements the tiered tagging system for film analysis
-- Tiers: quick, standard, comprehensive
-- Distinct from subscription tiers (basic/plus/premium)

-- ============================================================================
-- 1. Add tagging_tier column to games table
-- ============================================================================

-- Create enum type for tagging tier
DO $$ BEGIN
  CREATE TYPE tagging_tier_enum AS ENUM ('quick', 'standard', 'comprehensive');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add tagging_tier column to games table (nullable initially)
ALTER TABLE games
ADD COLUMN IF NOT EXISTS tagging_tier tagging_tier_enum;

-- Add index for querying games by tier
CREATE INDEX IF NOT EXISTS idx_games_tagging_tier ON games(tagging_tier);

-- ============================================================================
-- 2. Add optional AI assist metadata columns for future integration
-- ============================================================================

-- These columns support future AI assist functionality
-- tag_source: tracks how fields were populated (manual, ai, ai_corrected)
-- ai_confidence: stores confidence score from AI suggestions

-- Add to play_instances table
ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS tag_source VARCHAR(15) DEFAULT 'manual';

ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2);

-- Add comment for documentation
COMMENT ON COLUMN games.tagging_tier IS 'Tagging depth tier: quick (essentials), standard (play analysis), comprehensive (player evaluation)';
COMMENT ON COLUMN play_instances.tag_source IS 'How this play was tagged: manual, ai, or ai_corrected';
COMMENT ON COLUMN play_instances.ai_confidence IS 'AI confidence score (0.00-1.00) when tag_source is ai or ai_corrected';

-- ============================================================================
-- 3. Create function to check tier upgrade validity
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_tagging_tier_upgrade()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate if tagging_tier is being changed
  IF OLD.tagging_tier IS NOT NULL AND NEW.tagging_tier IS NOT NULL THEN
    -- Enforce one-way upgrade: quick -> standard -> comprehensive
    IF (OLD.tagging_tier = 'standard' AND NEW.tagging_tier = 'quick') OR
       (OLD.tagging_tier = 'comprehensive' AND NEW.tagging_tier IN ('quick', 'standard')) THEN
      RAISE EXCEPTION 'Tagging tier can only be upgraded, not downgraded. Current: %, Attempted: %',
        OLD.tagging_tier, NEW.tagging_tier;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tier upgrade validation
DROP TRIGGER IF EXISTS trigger_validate_tagging_tier_upgrade ON games;
CREATE TRIGGER trigger_validate_tagging_tier_upgrade
  BEFORE UPDATE ON games
  FOR EACH ROW
  WHEN (OLD.tagging_tier IS DISTINCT FROM NEW.tagging_tier)
  EXECUTE FUNCTION validate_tagging_tier_upgrade();

-- ============================================================================
-- 4. Create analytics event logging for tier selection
-- ============================================================================

-- Add tier selection events to audit_logs
-- Events: tagging_tier_selected, tagging_tier_upgraded

-- Insert function for tracking tier events
CREATE OR REPLACE FUNCTION log_tagging_tier_event()
RETURNS TRIGGER AS $$
DECLARE
  event_action TEXT;
  event_details JSONB;
BEGIN
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

  -- Log to audit_logs
  INSERT INTO audit_logs (
    actor_id,
    actor_email,
    action,
    target_type,
    target_id,
    target_name,
    details,
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

-- Create separate triggers for INSERT and UPDATE (INSERT can't reference OLD)
DROP TRIGGER IF EXISTS trigger_log_tagging_tier_event ON games;
DROP TRIGGER IF EXISTS trigger_log_tagging_tier_event_insert ON games;
DROP TRIGGER IF EXISTS trigger_log_tagging_tier_event_update ON games;

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

-- ============================================================================
-- 5. Add helper function to get tier capabilities
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tagging_tier_capabilities(p_tier tagging_tier_enum)
RETURNS JSONB AS $$
BEGIN
  CASE p_tier
    WHEN 'quick' THEN
      RETURN jsonb_build_object(
        'tier', 'quick',
        'name', 'Quick',
        'time_per_play', '15-20 sec',
        'show_player_attribution', false,
        'show_ol_tracking', false,
        'show_defensive_tracking', false,
        'show_performance_sections', false,
        'offense_fields', ARRAY['drive_context', 'down', 'distance', 'yard_line', 'hash_mark',
                                'play_code', 'formation', 'play_type', 'result_type', 'yards_gained',
                                'resulted_in_first_down', 'notes', 'fumbled'],
        'defense_fields', ARRAY['drive_context', 'down', 'distance', 'yard_line', 'hash_mark',
                                'opponent_play_type', 'result_type', 'yards_gained', 'resulted_in_first_down',
                                'notes', 'is_tfl', 'is_sack', 'is_forced_fumble', 'is_pbu'],
        'special_teams_fields', ARRAY['special_teams_unit', 'kick_result', 'kick_distance', 'return_yards',
                                      'is_fair_catch', 'is_touchback', 'is_muffed', 'penalty_on_play']
      );
    WHEN 'standard' THEN
      RETURN jsonb_build_object(
        'tier', 'standard',
        'name', 'Standard',
        'time_per_play', '30-45 sec',
        'show_player_attribution', true,
        'show_ol_tracking', false,
        'show_defensive_tracking', false,
        'show_performance_sections', false,
        'offense_fields', ARRAY['drive_context', 'down', 'distance', 'yard_line', 'hash_mark',
                                'play_code', 'formation', 'play_type', 'result_type', 'yards_gained',
                                'resulted_in_first_down', 'notes', 'fumbled',
                                'direction', 'qb_id', 'ball_carrier_id', 'target_id', 'drop', 'contested_catch'],
        'defense_fields', ARRAY['drive_context', 'down', 'distance', 'yard_line', 'hash_mark',
                                'opponent_play_type', 'result_type', 'yards_gained', 'resulted_in_first_down',
                                'notes', 'is_tfl', 'is_sack', 'is_forced_fumble', 'is_pbu',
                                'formation', 'opponent_player_number', 'pressure_player_ids',
                                'coverage_player_id', 'opponent_qb_evaluation', 'tackler_ids'],
        'special_teams_fields', ARRAY['special_teams_unit', 'kick_result', 'kick_distance', 'return_yards',
                                      'is_fair_catch', 'is_touchback', 'is_muffed', 'penalty_on_play',
                                      'kicker_id', 'punter_id', 'returner_id', 'kickoff_type', 'punt_type', 'blocked_by']
      );
    WHEN 'comprehensive' THEN
      RETURN jsonb_build_object(
        'tier', 'comprehensive',
        'name', 'Comprehensive',
        'time_per_play', '2-3 min',
        'show_player_attribution', true,
        'show_ol_tracking', true,
        'show_defensive_tracking', true,
        'show_performance_sections', true,
        'offense_fields', ARRAY['all'],
        'defense_fields', ARRAY['all'],
        'special_teams_fields', ARRAY['all']
      );
    ELSE
      RETURN NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_tagging_tier_capabilities TO authenticated;
