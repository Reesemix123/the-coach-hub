-- Migration 168: Test Hub Schema
-- Platform-level QA testing system for coordinating friend-based testing.
-- All tables use test_ prefix. No team scoping — platform-level tests.

-- ============================================================================
-- Step 1: Add is_tester flag to profiles (same pattern as is_platform_admin)
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_tester BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_profiles_tester ON profiles(is_tester) WHERE is_tester = true;

-- ============================================================================
-- Step 2: test_suites — named grouping of test cases
-- ============================================================================

CREATE TABLE test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sport TEXT NOT NULL DEFAULT 'football',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_suites_status ON test_suites(status);
CREATE INDEX idx_test_suites_created_by ON test_suites(created_by);

-- ============================================================================
-- Step 3: test_cases — one testable feature within a suite
-- ============================================================================

CREATE TABLE test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  display_order INTEGER NOT NULL DEFAULT 0,
  checkout_mode TEXT NOT NULL DEFAULT 'exclusive' CHECK (checkout_mode IN ('exclusive', 'parallel')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'active', 'archived')),
  auto_generated BOOLEAN NOT NULL DEFAULT false,
  source_feature_key TEXT,
  sport TEXT NOT NULL DEFAULT 'football',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_cases_suite ON test_cases(suite_id);
CREATE INDEX idx_test_cases_status ON test_cases(status);
CREATE INDEX idx_test_cases_category ON test_cases(category);

-- ============================================================================
-- Step 4: test_steps — individual checklist items within a test case
-- ============================================================================

CREATE TABLE test_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL DEFAULT 'test' CHECK (step_type IN ('setup', 'test')),
  display_order INTEGER NOT NULL DEFAULT 0,
  instruction TEXT NOT NULL,
  expected_outcome TEXT
);

CREATE INDEX idx_test_steps_case ON test_steps(test_case_id);

-- ============================================================================
-- Step 5: test_sessions — a tester's active claim on a test case
-- ============================================================================

CREATE TABLE test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  tester_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'released')),
  checked_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_test_sessions_case ON test_sessions(test_case_id);
CREATE INDEX idx_test_sessions_tester ON test_sessions(tester_id);
CREATE INDEX idx_test_sessions_status ON test_sessions(status);

-- ============================================================================
-- Step 6: test_step_completions — per-step results within a session
-- ============================================================================

CREATE TABLE test_step_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES test_steps(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pass', 'fail', 'skip')),
  notes TEXT,
  flagged_issue BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_test_step_completions_session ON test_step_completions(session_id);
CREATE INDEX idx_test_step_completions_step ON test_step_completions(step_id);

-- ============================================================================
-- Step 7: time_logs — active time tracking per session
-- ============================================================================

CREATE TABLE time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
  tester_id UUID NOT NULL REFERENCES auth.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_time_logs_session ON time_logs(session_id);
CREATE INDEX idx_time_logs_tester ON time_logs(tester_id);
CREATE INDEX idx_time_logs_active ON time_logs(is_active) WHERE is_active = true;

-- ============================================================================
-- Step 8: Enable RLS on all test_ tables
-- ============================================================================

ALTER TABLE test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_step_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 9: RLS policies — Platform admins get full access to all tables
-- ============================================================================

-- Helper: reusable admin check
-- (Inline subquery used in each policy for clarity)

-- test_suites: admin full CRUD
CREATE POLICY "admin_all_test_suites" ON test_suites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

-- test_cases: admin full CRUD
CREATE POLICY "admin_all_test_cases" ON test_cases
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

-- test_steps: admin full CRUD
CREATE POLICY "admin_all_test_steps" ON test_steps
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

-- test_sessions: admin full CRUD
CREATE POLICY "admin_all_test_sessions" ON test_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

-- test_step_completions: admin full CRUD
CREATE POLICY "admin_all_test_step_completions" ON test_step_completions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

-- time_logs: admin full CRUD
CREATE POLICY "admin_all_time_logs" ON time_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

-- ============================================================================
-- Step 10: RLS policies — Testers get scoped access
-- ============================================================================

-- Testers can SELECT active suites
CREATE POLICY "tester_select_active_suites" ON test_suites
  FOR SELECT USING (
    status = 'active'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_tester = true)
  );

-- Testers can SELECT active test cases
CREATE POLICY "tester_select_active_cases" ON test_cases
  FOR SELECT USING (
    status = 'active'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_tester = true)
  );

-- Testers can SELECT steps for active test cases
CREATE POLICY "tester_select_steps" ON test_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM test_cases
      WHERE test_cases.id = test_steps.test_case_id
        AND test_cases.status = 'active'
    )
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_tester = true)
  );

-- Testers can CRUD their own sessions
CREATE POLICY "tester_crud_own_sessions" ON test_sessions
  FOR ALL USING (tester_id = auth.uid())
  WITH CHECK (tester_id = auth.uid());

-- Testers can CRUD their own step completions (via session ownership)
CREATE POLICY "tester_crud_own_completions" ON test_step_completions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM test_sessions
      WHERE test_sessions.id = test_step_completions.session_id
        AND test_sessions.tester_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM test_sessions
      WHERE test_sessions.id = test_step_completions.session_id
        AND test_sessions.tester_id = auth.uid()
    )
  );

-- Testers can CRUD their own time logs
CREATE POLICY "tester_crud_own_time_logs" ON time_logs
  FOR ALL USING (tester_id = auth.uid())
  WITH CHECK (tester_id = auth.uid());

-- ============================================================================
-- Step 11: Comments
-- ============================================================================

COMMENT ON TABLE test_suites IS 'Named grouping of test cases (e.g. "Sprint 12 — Film Room")';
COMMENT ON TABLE test_cases IS 'One testable feature within a suite';
COMMENT ON TABLE test_steps IS 'Individual checklist items within a test case';
COMMENT ON TABLE test_sessions IS 'A tester''s active claim on a test case. Exclusive checkout enforced in API layer.';
COMMENT ON TABLE test_step_completions IS 'Per-step pass/fail/skip results within a session';
COMMENT ON TABLE time_logs IS 'Active time tracking per test session';
COMMENT ON COLUMN profiles.is_tester IS 'Whether this user has access to the Test Hub';
COMMENT ON COLUMN test_cases.checkout_mode IS 'exclusive: only one active session at a time. parallel: multiple testers can test simultaneously.';
COMMENT ON COLUMN test_cases.source_feature_key IS 'References APP_FEATURES category id from features.ts when auto-generated';
