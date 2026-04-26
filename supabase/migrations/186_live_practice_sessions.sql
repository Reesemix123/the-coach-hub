-- ============================================================================
-- Migration 186: Live practice sessions for real-time multi-coach timer sync
-- ============================================================================

CREATE TABLE live_practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_plan_id UUID NOT NULL REFERENCES practice_plans(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  current_period_index INTEGER NOT NULL DEFAULT 0,
  timer_started_at TIMESTAMPTZ,
  pause_remaining_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed')),
  started_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active session per practice plan
CREATE UNIQUE INDEX idx_live_practice_active
  ON live_practice_sessions(practice_plan_id)
  WHERE status != 'completed';

-- RLS — matches practice_plans pattern (owner + team memberships)
ALTER TABLE live_practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view live sessions"
  ON live_practice_sessions FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can manage live sessions"
  ON live_practice_sessions FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE live_practice_sessions;
