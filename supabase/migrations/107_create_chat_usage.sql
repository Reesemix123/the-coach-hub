-- ============================================================================
-- Migration: 107_create_chat_usage.sql
-- Description: Create chat_usage table for rate limiting AI help chat
--
-- Rate limits by tier:
-- - Basic (free): 20 messages/day
-- - Plus: 50 messages/day
-- - Premium: Unlimited
-- ============================================================================

-- ============================================================================
-- 1. CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

COMMENT ON TABLE chat_usage IS 'Tracks daily AI help chat message counts for rate limiting';
COMMENT ON COLUMN chat_usage.user_id IS 'The user who sent the messages';
COMMENT ON COLUMN chat_usage.date IS 'The date for this usage record';
COMMENT ON COLUMN chat_usage.message_count IS 'Number of messages sent on this date';

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;

-- Users can only view and manage their own chat usage
CREATE POLICY "Users can view own chat usage"
  ON chat_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat usage"
  ON chat_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat usage"
  ON chat_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_chat_usage_user_date
  ON chat_usage(user_id, date);

-- ============================================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_chat_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_usage_updated_at
  BEFORE UPDATE ON chat_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_usage_updated_at();

-- ============================================================================
-- 5. HELPER FUNCTION: Increment usage and return remaining
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_chat_usage(
  p_user_id UUID,
  p_limit INTEGER
)
RETURNS TABLE (
  new_count INTEGER,
  remaining INTEGER,
  allowed BOOLEAN
) AS $$
DECLARE
  v_current_count INTEGER;
  v_new_count INTEGER;
BEGIN
  -- Try to get current count for today
  SELECT message_count INTO v_current_count
  FROM chat_usage
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  -- If no record exists, create one
  IF v_current_count IS NULL THEN
    INSERT INTO chat_usage (user_id, date, message_count)
    VALUES (p_user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, date)
    DO UPDATE SET message_count = chat_usage.message_count + 1
    RETURNING message_count INTO v_new_count;
  ELSE
    -- Check if already at limit (unless unlimited)
    IF p_limit > 0 AND v_current_count >= p_limit THEN
      RETURN QUERY SELECT
        v_current_count,
        0,
        FALSE;
      RETURN;
    END IF;

    -- Increment the count
    UPDATE chat_usage
    SET message_count = message_count + 1
    WHERE user_id = p_user_id AND date = CURRENT_DATE
    RETURNING message_count INTO v_new_count;
  END IF;

  -- Calculate remaining (handle unlimited case)
  IF p_limit <= 0 THEN
    RETURN QUERY SELECT
      v_new_count,
      -1, -- -1 indicates unlimited
      TRUE;
  ELSE
    RETURN QUERY SELECT
      v_new_count,
      GREATEST(0, p_limit - v_new_count),
      TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_chat_usage IS
  'Atomically increments chat usage count and returns new count, remaining, and whether allowed';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION increment_chat_usage TO authenticated;

-- ============================================================================
-- 6. HELPER FUNCTION: Get current usage
-- ============================================================================

CREATE OR REPLACE FUNCTION get_chat_usage(
  p_user_id UUID,
  p_limit INTEGER
)
RETURNS TABLE (
  count INTEGER,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Get current count for today
  SELECT COALESCE(message_count, 0) INTO v_count
  FROM chat_usage
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  IF v_count IS NULL THEN
    v_count := 0;
  END IF;

  -- Calculate remaining and reset time
  IF p_limit <= 0 THEN
    RETURN QUERY SELECT
      v_count,
      -1, -- -1 indicates unlimited
      (CURRENT_DATE + INTERVAL '1 day')::TIMESTAMPTZ;
  ELSE
    RETURN QUERY SELECT
      v_count,
      GREATEST(0, p_limit - v_count),
      (CURRENT_DATE + INTERVAL '1 day')::TIMESTAMPTZ;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_chat_usage IS
  'Returns current chat usage count, remaining messages, and reset time';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_chat_usage TO authenticated;
