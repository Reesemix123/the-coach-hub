-- Migration: 085_downgrade_expiration_enforcement.sql
-- Phase 8: Downgrade and Expiration Enforcement
-- Handles game locking when users downgrade and game expiration

-- ============================================================================
-- Step 1: Function to count active games for a team
-- ============================================================================

CREATE OR REPLACE FUNCTION count_active_games(p_team_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM games
    WHERE team_id = p_team_id
      AND is_locked = false
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION count_active_games IS 'Count non-locked, non-expired games for a team';

-- ============================================================================
-- Step 2: Function to count cameras for a game
-- ============================================================================

CREATE OR REPLACE FUNCTION count_game_cameras(p_game_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM videos
    WHERE game_id = p_game_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION count_game_cameras IS 'Count video/camera angles for a game';

-- ============================================================================
-- Step 3: Function to get team tier limits
-- ============================================================================

CREATE OR REPLACE FUNCTION get_team_tier_limits(p_team_id UUID)
RETURNS TABLE (
  tier_key TEXT,
  max_active_games INTEGER,
  cameras_per_game INTEGER,
  retention_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.tier_key,
    tc.max_active_games,
    tc.cameras_per_game,
    tc.retention_days
  FROM subscriptions s
  JOIN tier_config tc ON tc.tier_key = s.tier
  WHERE s.team_id = p_team_id
    AND s.status IN ('active', 'trialing', 'past_due');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_team_tier_limits IS 'Get tier limits for a team based on their subscription';

-- ============================================================================
-- Step 4: Function to lock excess games on downgrade
-- When a team downgrades, lock oldest games exceeding the new tier limit
-- ============================================================================

CREATE OR REPLACE FUNCTION lock_excess_games(
  p_team_id UUID,
  p_max_games INTEGER,
  p_reason TEXT DEFAULT 'downgrade_excess'
)
RETURNS INTEGER AS $$
DECLARE
  v_locked_count INTEGER := 0;
  v_excess_count INTEGER;
BEGIN
  -- Count how many games exceed the limit
  v_excess_count := count_active_games(p_team_id) - p_max_games;

  IF v_excess_count <= 0 THEN
    RETURN 0; -- Nothing to lock
  END IF;

  -- Lock the oldest games first (keep the newest ones active)
  WITH games_to_lock AS (
    SELECT id
    FROM games
    WHERE team_id = p_team_id
      AND is_locked = false
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at ASC
    LIMIT v_excess_count
  )
  UPDATE games
  SET
    is_locked = true,
    locked_reason = p_reason
  FROM games_to_lock
  WHERE games.id = games_to_lock.id;

  GET DIAGNOSTICS v_locked_count = ROW_COUNT;

  RETURN v_locked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION lock_excess_games IS 'Lock oldest games exceeding tier limit (used on downgrade)';

-- ============================================================================
-- Step 5: Function to unlock games (when upgrading or adding capacity)
-- ============================================================================

CREATE OR REPLACE FUNCTION unlock_games(
  p_team_id UUID,
  p_count INTEGER DEFAULT NULL -- NULL = unlock all
)
RETURNS INTEGER AS $$
DECLARE
  v_unlocked_count INTEGER := 0;
BEGIN
  -- Unlock locked games (oldest first if count specified)
  WITH games_to_unlock AS (
    SELECT id
    FROM games
    WHERE team_id = p_team_id
      AND is_locked = true
      AND locked_reason IN ('downgrade_excess', 'camera_limit')
    ORDER BY created_at ASC
    LIMIT COALESCE(p_count, 1000000)
  )
  UPDATE games
  SET
    is_locked = false,
    locked_reason = NULL
  FROM games_to_unlock
  WHERE games.id = games_to_unlock.id;

  GET DIAGNOSTICS v_unlocked_count = ROW_COUNT;

  RETURN v_unlocked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION unlock_games IS 'Unlock games that were locked due to tier limits';

-- ============================================================================
-- Step 6: Function to expire old games
-- Marks games as expired based on their expires_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_old_games()
RETURNS TABLE (
  team_id UUID,
  game_id UUID,
  game_name TEXT,
  expired_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  UPDATE games
  SET
    is_locked = true,
    locked_reason = 'expired'
  WHERE expires_at IS NOT NULL
    AND expires_at <= NOW()
    AND is_locked = false
  RETURNING games.team_id, games.id, games.name, games.expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION expire_old_games IS 'Lock games that have passed their expiration date';

-- ============================================================================
-- Step 7: Function to handle tier change (downgrade/upgrade)
-- Main entry point for enforcing tier limits
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_tier_limits(p_team_id UUID)
RETURNS TABLE (
  games_locked INTEGER,
  games_unlocked INTEGER,
  current_active_games INTEGER,
  max_allowed_games INTEGER
) AS $$
DECLARE
  v_tier_key TEXT;
  v_max_games INTEGER;
  v_current_games INTEGER;
  v_locked INTEGER := 0;
  v_unlocked INTEGER := 0;
BEGIN
  -- Get current tier limits
  SELECT tl.tier_key, tl.max_active_games
  INTO v_tier_key, v_max_games
  FROM get_team_tier_limits(p_team_id) tl;

  IF v_tier_key IS NULL THEN
    -- No active subscription, use basic defaults
    v_max_games := 3;
  END IF;

  -- Count current active games
  v_current_games := count_active_games(p_team_id);

  -- If over limit, lock excess games
  IF v_current_games > v_max_games THEN
    v_locked := lock_excess_games(p_team_id, v_max_games, 'downgrade_excess');
  -- If under limit, try to unlock previously locked games
  ELSIF v_current_games < v_max_games THEN
    v_unlocked := unlock_games(p_team_id, v_max_games - v_current_games);
  END IF;

  -- Return results
  RETURN QUERY SELECT
    v_locked,
    v_unlocked,
    count_active_games(p_team_id),
    v_max_games;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION enforce_tier_limits IS 'Enforce game limits based on team tier (locks/unlocks games as needed)';

-- ============================================================================
-- Step 8: Function to update game expiration dates based on new tier
-- Called when tier changes to recalculate all expiration dates
-- ============================================================================

CREATE OR REPLACE FUNCTION update_game_expirations(p_team_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_retention_days INTEGER;
  v_updated_count INTEGER := 0;
BEGIN
  -- Get retention days from current tier
  SELECT tc.retention_days INTO v_retention_days
  FROM subscriptions s
  JOIN tier_config tc ON tc.tier_key = s.tier
  WHERE s.team_id = p_team_id
    AND s.status IN ('active', 'trialing', 'past_due');

  IF v_retention_days IS NULL THEN
    v_retention_days := 30; -- Default
  END IF;

  -- Update expiration dates for non-locked games
  UPDATE games
  SET expires_at = created_at + (v_retention_days || ' days')::INTERVAL
  WHERE team_id = p_team_id
    AND is_locked = false
    AND locked_reason IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_game_expirations IS 'Update game expiration dates based on current tier retention period';

-- ============================================================================
-- Step 9: Function to get games at risk of expiring soon
-- For displaying warnings to users
-- ============================================================================

CREATE OR REPLACE FUNCTION get_expiring_games(
  p_team_id UUID,
  p_days_ahead INTEGER DEFAULT 7
)
RETURNS TABLE (
  game_id UUID,
  game_name TEXT,
  expires_at TIMESTAMPTZ,
  days_until_expiration INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.expires_at,
    EXTRACT(DAY FROM g.expires_at - NOW())::INTEGER as days_left
  FROM games g
  WHERE g.team_id = p_team_id
    AND g.is_locked = false
    AND g.expires_at IS NOT NULL
    AND g.expires_at <= NOW() + (p_days_ahead || ' days')::INTERVAL
    AND g.expires_at > NOW()
  ORDER BY g.expires_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_expiring_games IS 'Get games expiring within N days for warning display';

-- ============================================================================
-- Step 10: Trigger to enforce limits when subscription tier changes
-- ============================================================================

CREATE OR REPLACE FUNCTION on_subscription_tier_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act if tier actually changed
  IF OLD.tier IS DISTINCT FROM NEW.tier AND NEW.team_id IS NOT NULL THEN
    -- Enforce new tier limits
    PERFORM enforce_tier_limits(NEW.team_id);

    -- Update expiration dates for new retention period
    PERFORM update_game_expirations(NEW.team_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS subscription_tier_change ON subscriptions;
CREATE TRIGGER subscription_tier_change
  AFTER UPDATE OF tier ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION on_subscription_tier_change();

COMMENT ON TRIGGER subscription_tier_change ON subscriptions IS 'Enforce game limits when subscription tier changes';

-- ============================================================================
-- Step 11: Index for efficient expired game queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_games_expires_locked
  ON games (expires_at, is_locked)
  WHERE expires_at IS NOT NULL AND is_locked = false;

-- ============================================================================
-- Step 12: Comments
-- ============================================================================

COMMENT ON FUNCTION count_active_games IS 'Count active (non-locked, non-expired) games for a team';
COMMENT ON FUNCTION get_team_tier_limits IS 'Get tier configuration for a team subscription';
COMMENT ON FUNCTION lock_excess_games IS 'Lock oldest games when exceeding tier limit';
COMMENT ON FUNCTION unlock_games IS 'Unlock games when capacity becomes available';
COMMENT ON FUNCTION expire_old_games IS 'Mark games as expired based on timestamp';
COMMENT ON FUNCTION enforce_tier_limits IS 'Main entry point for tier enforcement';
