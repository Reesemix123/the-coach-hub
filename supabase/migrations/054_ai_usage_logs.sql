-- Migration 054: AI Usage Logs
-- Tracks granular AI credit usage for time series analytics and accountability
--
-- This enables:
-- 1. Time series charts showing AI usage over time
-- 2. Per-user tracking of who used AI features
-- 3. Per-feature breakdown (which AI features are most used)
-- 4. Automatic incrementing of ai_credits.credits_used

-- ============================================================================
-- 1. CREATE AI_USAGE_LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who used the AI
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- What was used
  feature VARCHAR(100) NOT NULL,
  -- Supported features:
  -- 'auto_tagging' - AI-assisted play tagging
  -- 'strategy_assistant' - Strategy chat/suggestions
  -- 'play_recognition' - Auto-recognition of plays from video
  -- 'scouting_analysis' - Opponent scouting AI
  -- 'other' - Catch-all for new features

  -- How much was used
  credits_used INTEGER NOT NULL DEFAULT 1,

  -- Optional context
  metadata JSONB,
  -- Could include: play_id, game_id, question asked, etc.

  -- When
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_team_date ON ai_usage_logs(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user ON ai_usage_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature ON ai_usage_logs(feature);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at DESC);

COMMENT ON TABLE ai_usage_logs IS 'Granular AI credit usage tracking for analytics and accountability';

-- ============================================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can view AI usage for teams they belong to
CREATE POLICY "Users can view AI usage for their teams"
  ON ai_usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = ai_usage_logs.team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = ai_usage_logs.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
  );

-- Only allow inserts through service role or from authenticated users on their teams
CREATE POLICY "Users can log AI usage for their teams"
  ON ai_usage_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = ai_usage_logs.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
  );

-- ============================================================================
-- 3. FUNCTION TO LOG AI USAGE AND INCREMENT CREDITS
-- ============================================================================

-- This function logs AI usage and automatically increments the credits_used
-- in the ai_credits table for the current period
CREATE OR REPLACE FUNCTION log_ai_usage(
  p_team_id UUID,
  p_user_id UUID,
  p_feature VARCHAR(100),
  p_credits INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_current_period_start TIMESTAMPTZ;
  v_current_period_end TIMESTAMPTZ;
BEGIN
  -- Calculate current billing period (monthly, starting on the 1st)
  v_current_period_start := date_trunc('month', NOW());
  v_current_period_end := v_current_period_start + INTERVAL '1 month';

  -- Insert the usage log
  INSERT INTO ai_usage_logs (team_id, user_id, feature, credits_used, metadata)
  VALUES (p_team_id, p_user_id, p_feature, p_credits, p_metadata)
  RETURNING id INTO v_log_id;

  -- Update or create ai_credits record for current period
  INSERT INTO ai_credits (team_id, credits_used, credits_allowed, period_start, period_end)
  VALUES (p_team_id, p_credits, 0, v_current_period_start, v_current_period_end)
  ON CONFLICT (team_id, period_start)
  DO UPDATE SET
    credits_used = ai_credits.credits_used + p_credits,
    updated_at = NOW();

  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION log_ai_usage IS 'Logs AI usage and automatically increments credits_used in ai_credits table';

-- ============================================================================
-- 4. HELPER VIEW FOR USAGE ANALYTICS
-- ============================================================================

-- View to easily query AI usage by team with user info
CREATE OR REPLACE VIEW ai_usage_summary AS
SELECT
  aul.team_id,
  t.name as team_name,
  aul.user_id,
  p.email as user_email,
  aul.feature,
  date_trunc('day', aul.created_at) as usage_date,
  SUM(aul.credits_used) as total_credits,
  COUNT(*) as usage_count
FROM ai_usage_logs aul
JOIN teams t ON t.id = aul.team_id
LEFT JOIN profiles p ON p.id = aul.user_id
GROUP BY aul.team_id, t.name, aul.user_id, p.email, aul.feature, date_trunc('day', aul.created_at);

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

-- Allow authenticated users to call the log_ai_usage function
GRANT EXECUTE ON FUNCTION log_ai_usage TO authenticated;
