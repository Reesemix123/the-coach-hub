-- Migration 140: Communication Hub - Plans & Billing
-- Phase 1: Season-based communication plans, video top-ups, coach history

-- ====================
-- COMMUNICATION PLANS
-- ====================

CREATE TABLE IF NOT EXISTS team_communication_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  purchased_by UUID REFERENCES auth.users(id) NOT NULL,
  purchaser_role TEXT NOT NULL CHECK (purchaser_role IN ('owner', 'coach', 'team_admin')),
  stripe_payment_id TEXT NOT NULL,
  stripe_product_id TEXT,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('rookie', 'varsity', 'all_conference', 'all_state')),
  max_parents INTEGER, -- NULL for unlimited (all_state)
  max_team_videos INTEGER NOT NULL DEFAULT 10,
  team_videos_used INTEGER DEFAULT 0,
  includes_reports BOOLEAN DEFAULT true,
  activated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL, -- activated_at + 6 months
  content_accessible_until TIMESTAMPTZ, -- expires_at + 30 days (parent access window)
  mux_cleanup_at TIMESTAMPTZ, -- expires_at + 60 days (buffer for late renewals)
  coach_override_status TEXT CHECK (coach_override_status IN ('grace_period', 'limited')),
  grace_period_ends_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_team_communication_plans_team_id ON team_communication_plans(team_id);
CREATE INDEX idx_team_communication_plans_status ON team_communication_plans(status);
CREATE INDEX idx_team_communication_plans_expires_at ON team_communication_plans(expires_at);

COMMENT ON TABLE team_communication_plans IS 'Season-based communication plan purchases (6 months)';
COMMENT ON COLUMN team_communication_plans.plan_tier IS 'Plan tier: rookie (20 parents), varsity (40), all_conference (60), all_state (unlimited)';
COMMENT ON COLUMN team_communication_plans.max_parents IS 'Maximum parents allowed - NULL for unlimited';
COMMENT ON COLUMN team_communication_plans.team_videos_used IS 'Count of team videos shared (not individual clips)';
COMMENT ON COLUMN team_communication_plans.content_accessible_until IS 'Parents can view content until this date (30 days after expiration)';
COMMENT ON COLUMN team_communication_plans.mux_cleanup_at IS 'Mux assets deleted after this date (60 days after expiration for late renewal buffer)';
COMMENT ON COLUMN team_communication_plans.coach_override_status IS 'Status when coach subscription lapses: grace_period or limited';

-- Trigger to set expiration dates on insert
CREATE OR REPLACE FUNCTION set_communication_plan_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Set expires_at to 6 months from activation
  NEW.expires_at := COALESCE(NEW.expires_at, NEW.activated_at + interval '6 months');
  -- Set parent access window to 30 days after expiration
  NEW.content_accessible_until := NEW.expires_at + interval '30 days';
  -- Set Mux cleanup to 60 days after expiration (30-day buffer for late renewals)
  NEW.mux_cleanup_at := NEW.expires_at + interval '60 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_communication_plan_dates_trigger
  BEFORE INSERT ON team_communication_plans
  FOR EACH ROW
  EXECUTE FUNCTION set_communication_plan_dates();

-- ====================
-- VIDEO TOP-UP PACKS
-- ====================

CREATE TABLE IF NOT EXISTS video_topup_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  communication_plan_id UUID REFERENCES team_communication_plans(id) ON DELETE CASCADE,
  purchased_by UUID REFERENCES auth.users(id) NOT NULL,
  stripe_payment_id TEXT NOT NULL,
  videos_added INTEGER NOT NULL DEFAULT 5,
  videos_used INTEGER DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_video_topup_purchases_team_id ON video_topup_purchases(team_id);
CREATE INDEX idx_video_topup_purchases_plan_id ON video_topup_purchases(communication_plan_id);
-- Index for FIFO ordering (oldest pack with remaining capacity first)
CREATE INDEX idx_video_topup_purchases_fifo ON video_topup_purchases(purchased_at) WHERE videos_used < videos_added;

COMMENT ON TABLE video_topup_purchases IS 'Video top-up pack purchases (5 videos per pack)';
COMMENT ON COLUMN video_topup_purchases.videos_added IS 'Number of videos in this pack (always 5)';
COMMENT ON COLUMN video_topup_purchases.videos_used IS 'Number of videos consumed from this pack';

-- ====================
-- COACH HISTORY
-- ====================

CREATE TABLE IF NOT EXISTS team_coach_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  coach_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('joined', 'left', 'transferred', 'downgraded', 'upgraded')),
  previous_coach_id UUID REFERENCES auth.users(id),
  communication_plan_status TEXT CHECK (communication_plan_status IN ('unaffected', 'grace_period', 'limited')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_team_coach_history_team_id ON team_coach_history(team_id);
CREATE INDEX idx_team_coach_history_coach_id ON team_coach_history(coach_id);

COMMENT ON TABLE team_coach_history IS 'Audit trail for coach changes affecting communication plans';
COMMENT ON COLUMN team_coach_history.action IS 'What happened: joined, left, transferred, downgraded subscription, upgraded subscription';
COMMENT ON COLUMN team_coach_history.communication_plan_status IS 'Impact on communication plan: unaffected, grace_period, or limited';

-- ====================
-- ROW LEVEL SECURITY
-- ====================

ALTER TABLE team_communication_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_topup_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_coach_history ENABLE ROW LEVEL SECURITY;

-- Communication plans: viewable by team staff and parents
CREATE POLICY "Team staff can view communication plans"
  ON team_communication_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = team_communication_plans.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.is_active = true)
      )
    )
  );

CREATE POLICY "Parents can view team communication plans"
  ON team_communication_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_parent_access tpa
      JOIN parent_profiles pp ON pp.id = tpa.parent_id
      WHERE tpa.team_id = team_communication_plans.team_id
      AND pp.user_id = auth.uid()
      AND tpa.status = 'active'
    )
  );

-- Only head coach and team_admin can purchase/manage plans
CREATE POLICY "Head coach and team admin can manage plans"
  ON team_communication_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = team_communication_plans.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role = 'team_admin' AND tm.is_active = true)
      )
    )
  );

-- Video top-ups: same permissions as plans
CREATE POLICY "Team staff can view video top-ups"
  ON video_topup_purchases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = video_topup_purchases.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.is_active = true)
      )
    )
  );

CREATE POLICY "Head coach and team admin can purchase top-ups"
  ON video_topup_purchases FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = video_topup_purchases.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role = 'team_admin' AND tm.is_active = true)
      )
    )
  );

-- Coach history: viewable by team owner only
CREATE POLICY "Team owner can view coach history"
  ON team_coach_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_coach_history.team_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert coach history"
  ON team_coach_history FOR INSERT
  WITH CHECK (true);  -- Handled by service layer with service role

-- ====================
-- HELPER FUNCTIONS
-- ====================

-- Function to get active communication plan for a team
CREATE OR REPLACE FUNCTION get_active_communication_plan(p_team_id UUID)
RETURNS team_communication_plans AS $$
DECLARE
  result team_communication_plans;
BEGIN
  SELECT * INTO result
  FROM team_communication_plans
  WHERE team_id = p_team_id
    AND status = 'active'
    AND expires_at > now()
  ORDER BY activated_at DESC
  LIMIT 1;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if team can share another video (FIFO logic)
CREATE OR REPLACE FUNCTION can_share_team_video(p_team_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  plan team_communication_plans;
  available_in_topups INTEGER;
BEGIN
  -- Get active plan
  SELECT * INTO plan FROM get_active_communication_plan(p_team_id);

  IF plan IS NULL THEN
    RETURN false;
  END IF;

  -- Check base plan capacity
  IF plan.team_videos_used < plan.max_team_videos THEN
    RETURN true;
  END IF;

  -- Check top-up packs (any pack with remaining capacity)
  SELECT COUNT(*) INTO available_in_topups
  FROM video_topup_purchases
  WHERE communication_plan_id = plan.id
    AND videos_used < videos_added;

  RETURN available_in_topups > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to consume a video credit (FIFO logic)
CREATE OR REPLACE FUNCTION consume_video_credit(p_team_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  plan team_communication_plans;
  topup_id UUID;
BEGIN
  -- Get active plan
  SELECT * INTO plan FROM get_active_communication_plan(p_team_id);

  IF plan IS NULL THEN
    RETURN false;
  END IF;

  -- Try base plan first
  IF plan.team_videos_used < plan.max_team_videos THEN
    UPDATE team_communication_plans
    SET team_videos_used = team_videos_used + 1
    WHERE id = plan.id;
    RETURN true;
  END IF;

  -- Try oldest top-up pack with remaining capacity (FIFO)
  SELECT id INTO topup_id
  FROM video_topup_purchases
  WHERE communication_plan_id = plan.id
    AND videos_used < videos_added
  ORDER BY purchased_at ASC
  LIMIT 1;

  IF topup_id IS NOT NULL THEN
    UPDATE video_topup_purchases
    SET videos_used = videos_used + 1
    WHERE id = topup_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get remaining video credits
CREATE OR REPLACE FUNCTION get_remaining_video_credits(p_team_id UUID)
RETURNS TABLE (base_remaining INTEGER, topup_remaining INTEGER, total_remaining INTEGER) AS $$
DECLARE
  plan team_communication_plans;
  base_left INTEGER;
  topup_left INTEGER;
BEGIN
  -- Get active plan
  SELECT * INTO plan FROM get_active_communication_plan(p_team_id);

  IF plan IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  -- Calculate base plan remaining
  base_left := plan.max_team_videos - plan.team_videos_used;

  -- Calculate top-up remaining
  SELECT COALESCE(SUM(videos_added - videos_used), 0) INTO topup_left
  FROM video_topup_purchases
  WHERE communication_plan_id = plan.id;

  RETURN QUERY SELECT base_left, topup_left, base_left + topup_left;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
