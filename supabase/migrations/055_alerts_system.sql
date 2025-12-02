-- Migration: 055_alerts_system.sql
-- Purpose: Create alerts system for credit warnings and other notifications
-- Part of Block 10: AI Credits Tracking (Continued)

-- ============================================================================
-- ALERTS TABLE
-- Stores system alerts for teams (credit warnings, subscription notices, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Targeting
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Alert content
  alert_type TEXT NOT NULL,  -- 'credit_warning', 'credit_exhausted', 'subscription_expiring', 'trial_ending', etc.
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'success')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Action (optional)
  action_url TEXT,           -- URL to navigate to for resolution
  action_label TEXT,         -- Button text for action

  -- State
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,
  dismissed_by UUID REFERENCES auth.users(id),

  -- Deduplication
  alert_key TEXT,            -- Unique key to prevent duplicate alerts (e.g., 'credit_warning:team_id:2024-01')

  -- Metadata
  metadata JSONB DEFAULT '{}',  -- Additional context (credits_used, credits_allowed, etc.)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,    -- Optional expiration (e.g., warning no longer relevant after period ends)

  -- Ensure at least one target is set
  CONSTRAINT alert_has_target CHECK (
    team_id IS NOT NULL OR user_id IS NOT NULL OR organization_id IS NOT NULL
  ),

  -- Unique constraint for deduplication
  CONSTRAINT unique_alert_key UNIQUE (alert_key)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast lookup by team
CREATE INDEX idx_alerts_team_id ON alerts(team_id) WHERE team_id IS NOT NULL;

-- Fast lookup by user
CREATE INDEX idx_alerts_user_id ON alerts(user_id) WHERE user_id IS NOT NULL;

-- Fast lookup by org
CREATE INDEX idx_alerts_organization_id ON alerts(organization_id) WHERE organization_id IS NOT NULL;

-- Active alerts (not dismissed, not expired)
CREATE INDEX idx_alerts_active ON alerts(team_id, is_dismissed, expires_at)
  WHERE is_dismissed = FALSE;

-- Alert type for filtering
CREATE INDEX idx_alerts_type ON alerts(alert_type);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Users can view alerts for their teams
CREATE POLICY "Users can view their team alerts"
  ON alerts FOR SELECT
  USING (
    -- Direct user alert
    user_id = auth.uid()
    OR
    -- Team alert - user owns or is member of team
    (team_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM teams WHERE teams.id = alerts.team_id AND teams.user_id = auth.uid())
      OR
      EXISTS (SELECT 1 FROM team_memberships WHERE team_memberships.team_id = alerts.team_id AND team_memberships.user_id = auth.uid())
    ))
    OR
    -- Organization alert - user is member of org
    (organization_id IS NOT NULL AND
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.organization_id = alerts.organization_id)
    )
  );

-- Users can update (dismiss) alerts they can view
CREATE POLICY "Users can dismiss their alerts"
  ON alerts FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM teams WHERE teams.id = alerts.team_id AND teams.user_id = auth.uid())
      OR
      EXISTS (SELECT 1 FROM team_memberships WHERE team_memberships.team_id = alerts.team_id AND team_memberships.user_id = auth.uid())
    ))
    OR
    (organization_id IS NOT NULL AND
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.organization_id = alerts.organization_id)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR
    (team_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM teams WHERE teams.id = alerts.team_id AND teams.user_id = auth.uid())
      OR
      EXISTS (SELECT 1 FROM team_memberships WHERE team_memberships.team_id = alerts.team_id AND team_memberships.user_id = auth.uid())
    ))
    OR
    (organization_id IS NOT NULL AND
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.organization_id = alerts.organization_id)
    )
  );

-- System can insert alerts (service role)
CREATE POLICY "Service role can insert alerts"
  ON alerts FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================================
-- HELPER FUNCTION: Create Credit Warning Alert
-- ============================================================================

CREATE OR REPLACE FUNCTION create_credit_warning_alert(
  p_team_id UUID,
  p_credits_used INTEGER,
  p_credits_allowed INTEGER,
  p_period_end TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_percentage INTEGER;
  v_alert_key TEXT;
  v_alert_id UUID;
  v_team_name TEXT;
BEGIN
  -- Calculate percentage
  v_percentage := ROUND((p_credits_used::NUMERIC / NULLIF(p_credits_allowed, 0)) * 100);

  -- Generate alert key for deduplication (one warning per team per period)
  v_alert_key := 'credit_warning:' || p_team_id::TEXT || ':' || TO_CHAR(p_period_end, 'YYYY-MM');

  -- Get team name
  SELECT name INTO v_team_name FROM teams WHERE id = p_team_id;

  -- Only create if >= 80% and not exhausted (separate alert for exhausted)
  IF v_percentage >= 80 AND v_percentage < 100 THEN
    INSERT INTO alerts (
      team_id,
      alert_type,
      severity,
      title,
      message,
      action_url,
      action_label,
      alert_key,
      metadata,
      expires_at
    )
    VALUES (
      p_team_id,
      'credit_warning',
      'warning',
      'AI Credits Running Low',
      'You''ve used ' || v_percentage || '% of your AI credits this period. ' ||
      'You have ' || (p_credits_allowed - p_credits_used) || ' credits remaining.',
      '/teams/' || p_team_id::TEXT || '/settings',
      'View Usage',
      v_alert_key,
      jsonb_build_object(
        'credits_used', p_credits_used,
        'credits_allowed', p_credits_allowed,
        'percentage_used', v_percentage,
        'period_end', p_period_end
      ),
      p_period_end  -- Alert expires when period ends
    )
    ON CONFLICT (alert_key) DO UPDATE SET
      message = EXCLUDED.message,
      metadata = EXCLUDED.metadata
    RETURNING id INTO v_alert_id;

    RETURN v_alert_id;
  END IF;

  -- If exhausted (100%), create exhausted alert instead
  IF v_percentage >= 100 THEN
    v_alert_key := 'credit_exhausted:' || p_team_id::TEXT || ':' || TO_CHAR(p_period_end, 'YYYY-MM');

    INSERT INTO alerts (
      team_id,
      alert_type,
      severity,
      title,
      message,
      action_url,
      action_label,
      alert_key,
      metadata,
      expires_at
    )
    VALUES (
      p_team_id,
      'credit_exhausted',
      'error',
      'AI Credits Exhausted',
      'You''ve used all your AI credits for this period. ' ||
      'Upgrade your plan for more credits or wait until your next billing period.',
      '/teams/' || p_team_id::TEXT || '/settings',
      'Upgrade Plan',
      v_alert_key,
      jsonb_build_object(
        'credits_used', p_credits_used,
        'credits_allowed', p_credits_allowed,
        'percentage_used', v_percentage,
        'period_end', p_period_end
      ),
      p_period_end
    )
    ON CONFLICT (alert_key) DO UPDATE SET
      message = EXCLUDED.message,
      metadata = EXCLUDED.metadata
    RETURNING id INTO v_alert_id;

    RETURN v_alert_id;
  END IF;

  RETURN NULL;
END;
$$;

-- ============================================================================
-- HELPER FUNCTION: Check and Create Credit Warnings
-- Called periodically to check all teams for credit warnings
-- ============================================================================

CREATE OR REPLACE FUNCTION check_credit_warnings()
RETURNS TABLE (team_id UUID, alert_id UUID, percentage_used INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.team_id,
    create_credit_warning_alert(
      c.team_id,
      c.credits_used,
      c.credits_allowed,
      c.period_end
    ) as alert_id,
    ROUND((c.credits_used::NUMERIC / NULLIF(c.credits_allowed, 0)) * 100)::INTEGER as percentage_used
  FROM ai_credits c
  WHERE
    c.period_start <= NOW()
    AND c.period_end >= NOW()
    AND c.credits_used >= (c.credits_allowed * 0.8)  -- 80% threshold
    AND c.credits_allowed > 0;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE alerts IS 'System alerts for credit warnings, subscription notices, and other notifications';
COMMENT ON COLUMN alerts.alert_type IS 'Type of alert: credit_warning, credit_exhausted, subscription_expiring, trial_ending, etc.';
COMMENT ON COLUMN alerts.severity IS 'Alert severity: info, warning, error, success';
COMMENT ON COLUMN alerts.alert_key IS 'Unique key for deduplication - prevents duplicate alerts';
COMMENT ON COLUMN alerts.expires_at IS 'When the alert is no longer relevant (e.g., after billing period ends)';
COMMENT ON FUNCTION create_credit_warning_alert IS 'Creates or updates credit warning/exhausted alerts for a team';
COMMENT ON FUNCTION check_credit_warnings IS 'Checks all teams for credit warnings and creates alerts as needed';
