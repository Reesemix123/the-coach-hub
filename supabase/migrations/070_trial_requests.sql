-- Trial Requests System
-- Allows users to request trials which admins can approve

-- Create trial_requests table
CREATE TABLE IF NOT EXISTS trial_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Requester info
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  -- Request details
  requested_tier TEXT NOT NULL DEFAULT 'hs_basic'
    CHECK (requested_tier IN ('little_league', 'hs_basic', 'hs_advanced', 'ai_powered')),
  reason TEXT, -- Optional: why they want a trial

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),

  -- Admin response
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,

  -- If approved, the granted trial duration (days)
  granted_trial_days INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_trial_requests_user ON trial_requests(user_id);
CREATE INDEX idx_trial_requests_team ON trial_requests(team_id);
CREATE INDEX idx_trial_requests_status ON trial_requests(status);
CREATE INDEX idx_trial_requests_created ON trial_requests(created_at DESC);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_trial_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trial_requests_updated_at
  BEFORE UPDATE ON trial_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_trial_requests_updated_at();

-- Enable RLS
ALTER TABLE trial_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own trial requests"
  ON trial_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create requests for themselves
CREATE POLICY "Users can create trial requests"
  ON trial_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Platform admins can view all requests
CREATE POLICY "Platform admins can view all trial requests"
  ON trial_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Platform admins can update requests (approve/deny)
CREATE POLICY "Platform admins can update trial requests"
  ON trial_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );

-- Grant permissions
GRANT ALL ON trial_requests TO authenticated;
