-- Migration 019: Practice Planning System
-- Purpose: Allow coaches to create, manage, and print practice plans

-- ====================
-- PRACTICE PLANS
-- ====================
-- Main practice plan table
CREATE TABLE IF NOT EXISTS practice_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Basic info
  title VARCHAR(200) NOT NULL,
  date DATE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 90,
  location VARCHAR(200),
  notes TEXT,

  -- Status
  is_template BOOLEAN DEFAULT FALSE, -- Reusable template
  template_name VARCHAR(200), -- Name if used as template

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ====================
-- PRACTICE PERIODS
-- ====================
-- Sections within a practice (warmup, individual drills, team periods, etc.)
CREATE TABLE IF NOT EXISTS practice_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_plan_id UUID NOT NULL REFERENCES practice_plans(id) ON DELETE CASCADE,

  -- Period details
  period_order INTEGER NOT NULL, -- Order in practice (1, 2, 3...)
  name VARCHAR(100) NOT NULL, -- "Warmup", "Individual Drills", "Team Period"
  duration_minutes INTEGER NOT NULL,
  period_type VARCHAR(50) DEFAULT 'drill' CHECK (period_type IN ('warmup', 'drill', 'team', 'special_teams', 'conditioning', 'other')),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ====================
-- PRACTICE DRILLS
-- ====================
-- Individual drills/activities within periods
CREATE TABLE IF NOT EXISTS practice_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES practice_periods(id) ON DELETE CASCADE,

  -- Drill details
  drill_order INTEGER NOT NULL, -- Order within period
  drill_name VARCHAR(200) NOT NULL,
  position_group VARCHAR(50), -- 'OL', 'RB', 'WR', 'QB', 'DL', 'LB', 'DB', 'All'
  description TEXT,

  -- Link to playbook
  play_codes TEXT[], -- Array of play codes to practice

  -- Equipment/setup
  equipment_needed TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ====================
-- INDEXES
-- ====================
CREATE INDEX IF NOT EXISTS idx_practice_plans_team ON practice_plans(team_id);
CREATE INDEX IF NOT EXISTS idx_practice_plans_date ON practice_plans(date);
CREATE INDEX IF NOT EXISTS idx_practice_plans_template ON practice_plans(is_template);
CREATE INDEX IF NOT EXISTS idx_practice_periods_plan ON practice_periods(practice_plan_id);
CREATE INDEX IF NOT EXISTS idx_practice_periods_order ON practice_periods(practice_plan_id, period_order);
CREATE INDEX IF NOT EXISTS idx_practice_drills_period ON practice_drills(period_id);
CREATE INDEX IF NOT EXISTS idx_practice_drills_order ON practice_drills(period_id, drill_order);

-- ====================
-- TRIGGERS
-- ====================
CREATE TRIGGER update_practice_plans_updated_at
  BEFORE UPDATE ON practice_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- RLS POLICIES
-- ====================
ALTER TABLE practice_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_drills ENABLE ROW LEVEL SECURITY;

-- Practice Plans: Team members can access
CREATE POLICY "Users can view practice plans for their teams"
  ON practice_plans FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create practice plans for their teams"
  ON practice_plans FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update practice plans for their teams"
  ON practice_plans FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete practice plans for their teams"
  ON practice_plans FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- Practice Periods: Inherit from parent plan
CREATE POLICY "Users can view practice periods"
  ON practice_periods FOR SELECT
  USING (
    practice_plan_id IN (SELECT id FROM practice_plans)
  );

CREATE POLICY "Users can manage practice periods"
  ON practice_periods FOR ALL
  USING (
    practice_plan_id IN (SELECT id FROM practice_plans)
  );

-- Practice Drills: Inherit from parent period
CREATE POLICY "Users can view practice drills"
  ON practice_drills FOR SELECT
  USING (
    period_id IN (SELECT id FROM practice_periods)
  );

CREATE POLICY "Users can manage practice drills"
  ON practice_drills FOR ALL
  USING (
    period_id IN (SELECT id FROM practice_periods)
  );
