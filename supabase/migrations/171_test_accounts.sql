-- Migration 171: Test accounts for QA testing
-- Scoped to suites — every account in a suite is available to all cases in that suite.

CREATE TABLE test_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID NOT NULL REFERENCES test_suites(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL REFERENCES auth.users(id),
  account_type TEXT NOT NULL CHECK (account_type IN ('coach', 'parent')),
  label TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  team_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_accounts_suite ON test_accounts(suite_id);
CREATE INDEX idx_test_accounts_auth_user ON test_accounts(auth_user_id);

ALTER TABLE test_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_test_accounts" ON test_accounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

CREATE POLICY "tester_select_test_accounts" ON test_accounts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_tester = true)
  );

COMMENT ON TABLE test_accounts IS 'Test user accounts scoped to suites for QA testing';
COMMENT ON COLUMN test_accounts.account_type IS 'coach or parent — determines what profile/team setup is created';
COMMENT ON COLUMN test_accounts.password IS 'Stored in plaintext for tester convenience — these are throwaway test accounts';
