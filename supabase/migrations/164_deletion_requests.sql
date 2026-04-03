-- Migration 164: Create deletion_requests table
-- Tracks parent requests for athlete profile deletion with admin review workflow

CREATE TABLE IF NOT EXISTS deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_profile_id UUID NOT NULL REFERENCES athlete_profiles(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parent_profiles(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  deletion_summary JSONB
);

CREATE INDEX idx_deletion_requests_status ON deletion_requests(status);
CREATE INDEX idx_deletion_requests_parent ON deletion_requests(parent_id);
CREATE INDEX idx_deletion_requests_athlete ON deletion_requests(athlete_profile_id);

-- Prevent duplicate pending requests for the same athlete
CREATE UNIQUE INDEX idx_deletion_requests_pending
  ON deletion_requests(athlete_profile_id) WHERE status = 'pending';

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view own deletion requests"
  ON deletion_requests FOR SELECT
  USING (parent_id = (
    SELECT id FROM parent_profiles WHERE user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "Parents can create deletion requests"
  ON deletion_requests FOR INSERT
  WITH CHECK (parent_id = (
    SELECT id FROM parent_profiles WHERE user_id = auth.uid() LIMIT 1
  ));

COMMENT ON TABLE deletion_requests IS 'Tracks parent requests for athlete profile deletion. Admin reviews before execution.';
COMMENT ON COLUMN deletion_requests.deletion_summary IS 'JSONB snapshot of what was deleted — captured before cascade for audit trail.';
