-- Migration 158: Create parent_profile_subscriptions table + access function + deferred RLS policies

-- Table: parent_profile_subscriptions
CREATE TABLE IF NOT EXISTS parent_profile_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parent_profiles(id) ON DELETE CASCADE,
  athlete_profile_id UUID NOT NULL REFERENCES athlete_profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'lapsed')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  is_gifted BOOLEAN NOT NULL DEFAULT false,
  gifted_by_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  lapsed_at TIMESTAMPTZ,
  data_archive_scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_parent_profile_subs_parent ON parent_profile_subscriptions(parent_id);
CREATE INDEX idx_parent_profile_subs_athlete ON parent_profile_subscriptions(athlete_profile_id);
CREATE INDEX idx_parent_profile_subs_stripe ON parent_profile_subscriptions(stripe_subscription_id);
CREATE INDEX idx_parent_profile_subs_status ON parent_profile_subscriptions(status);
CREATE UNIQUE INDEX idx_parent_profile_subs_unique ON parent_profile_subscriptions(parent_id, athlete_profile_id) WHERE status IN ('active', 'past_due');

-- RLS
ALTER TABLE parent_profile_subscriptions ENABLE ROW LEVEL SECURITY;

-- Parents can read their own subscriptions
CREATE POLICY "Parents can read own subscriptions"
  ON parent_profile_subscriptions FOR SELECT
  USING (
    parent_id = (
      SELECT id FROM parent_profiles WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Parents can update their own subscriptions (cancel_at_period_end toggle)
CREATE POLICY "Parents can update own subscriptions"
  ON parent_profile_subscriptions FOR UPDATE
  USING (
    parent_id = (
      SELECT id FROM parent_profiles WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_parent_profile_subs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parent_profile_subs_updated_at
  BEFORE UPDATE ON parent_profile_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_parent_profile_subs_updated_at();

-- ============================================================
-- SECURITY DEFINER function: parent_can_access_athlete_content
-- Checks if a parent has access to an athlete's clips/reports
-- Returns true if EITHER:
--   1. Active parent_profile_subscription exists for this parent + athlete
--   2. The athlete's team has an active Comm Hub plan
-- ============================================================

CREATE OR REPLACE FUNCTION parent_can_access_athlete_content(
  p_athlete_profile_id UUID,
  p_parent_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  has_subscription BOOLEAN := false;
  has_active_plan BOOLEAN := false;
BEGIN
  -- Check 1: Active parent profile subscription
  SELECT EXISTS(
    SELECT 1 FROM parent_profile_subscriptions
    WHERE parent_id = p_parent_id
      AND athlete_profile_id = p_athlete_profile_id
      AND status = 'active'
  ) INTO has_subscription;

  IF has_subscription THEN
    RETURN true;
  END IF;

  -- Check 2: Active Comm Hub plan on any team the athlete is on
  -- AND the parent has active access to that team
  SELECT EXISTS(
    SELECT 1
    FROM athlete_seasons ase
    JOIN team_communication_plans tcp ON tcp.team_id = ase.team_id
    JOIN team_parent_access tpa ON tpa.team_id = ase.team_id AND tpa.parent_id = p_parent_id
    WHERE ase.athlete_profile_id = p_athlete_profile_id
      AND tcp.status = 'active'
      AND tcp.expires_at > now()
      AND tpa.status = 'active'
  ) INTO has_active_plan;

  RETURN has_active_plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION parent_can_access_athlete_content IS 'Checks if parent can access athlete content via subscription OR active Comm Hub plan. Used by RLS policies.';

-- ============================================================
-- Deferred parent RLS policies for player_clips and player_reports
-- ============================================================

-- Parents can read approved, non-suppressed clips if they have content access
CREATE POLICY "Parents can read approved clips for their athletes"
  ON player_clips FOR SELECT
  USING (
    coach_approved = true
    AND coach_suppressed = false
    AND parent_can_access_athlete_content(
      athlete_profile_id,
      (SELECT id FROM parent_profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    AND athlete_profile_id IN (
      SELECT id FROM athlete_profiles
      WHERE created_by_parent_id = (
        SELECT id FROM parent_profiles WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

-- Parents can read published reports if they have content access
CREATE POLICY "Parents can read published reports for their athletes"
  ON player_reports FOR SELECT
  USING (
    is_published_to_parent = true
    AND parent_can_access_athlete_content(
      athlete_profile_id,
      (SELECT id FROM parent_profiles WHERE user_id = auth.uid() LIMIT 1)
    )
    AND athlete_profile_id IN (
      SELECT id FROM athlete_profiles
      WHERE created_by_parent_id = (
        SELECT id FROM parent_profiles WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

COMMENT ON TABLE parent_profile_subscriptions IS 'Annual parent subscriptions for persistent athlete profile access. Anchored to athlete, not season.';
COMMENT ON COLUMN parent_profile_subscriptions.is_gifted IS 'True when subscription was gifted via All-State Comm Hub plan purchase.';
COMMENT ON COLUMN parent_profile_subscriptions.data_archive_scheduled_at IS '90 days after lapsed_at. Data archived (not deleted) after this date.';
