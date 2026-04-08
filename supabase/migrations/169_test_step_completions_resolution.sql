-- Migration 169: Add resolution tracking to test_step_completions
-- Adds resolution_status and admin_notes for admin triage of flagged issues.
-- Does NOT rename existing columns — the existing `notes` column remains as-is.

ALTER TABLE test_step_completions
  ADD COLUMN IF NOT EXISTS resolution_status TEXT NOT NULL DEFAULT 'open'
    CHECK (resolution_status IN ('open', 'resolved', 'wont_fix'));

ALTER TABLE test_step_completions
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_test_step_completions_resolution
  ON test_step_completions(resolution_status)
  WHERE flagged_issue = true;

COMMENT ON COLUMN test_step_completions.resolution_status IS 'Admin resolution status for flagged issues';
COMMENT ON COLUMN test_step_completions.admin_notes IS 'Admin internal notes on flagged issues';
