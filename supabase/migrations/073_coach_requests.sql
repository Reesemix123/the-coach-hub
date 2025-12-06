-- Migration 073: Coach Access Requests for Trial Users
-- Allows trial users to request the ability to add coaches to their team
-- Admins can review and approve/deny requests

-- ============================================================================
-- Step 1: Create coach_requests table
-- ============================================================================

CREATE TABLE IF NOT EXISTS coach_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  -- If approved, how many coaches were granted
  granted_coach_slots INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Step 2: Create indexes for efficient queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_coach_requests_team ON coach_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_coach_requests_user ON coach_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_requests_status ON coach_requests(status);
CREATE INDEX IF NOT EXISTS idx_coach_requests_created_at ON coach_requests(created_at DESC);

-- ============================================================================
-- Step 3: Enable RLS
-- ============================================================================

ALTER TABLE coach_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 4: Create RLS policies
-- ============================================================================

-- Users can view their own requests
DROP POLICY IF EXISTS "Users can view own coach requests" ON coach_requests;
CREATE POLICY "Users can view own coach requests"
  ON coach_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create requests for teams they own
DROP POLICY IF EXISTS "Users can create coach requests for owned teams" ON coach_requests;
CREATE POLICY "Users can create coach requests for owned teams"
  ON coach_requests FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND team_id IN (SELECT id FROM teams WHERE user_id = auth.uid())
  );

-- Platform admins can view all requests
DROP POLICY IF EXISTS "Admins can view all coach requests" ON coach_requests;
CREATE POLICY "Admins can view all coach requests"
  ON coach_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_platform_admin = true
    )
  );

-- Platform admins can update requests (approve/deny)
DROP POLICY IF EXISTS "Admins can update coach requests" ON coach_requests;
CREATE POLICY "Admins can update coach requests"
  ON coach_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_platform_admin = true
    )
  );

-- ============================================================================
-- Step 5: Add updated_at trigger
-- ============================================================================

DROP TRIGGER IF EXISTS set_coach_requests_updated_at ON coach_requests;
CREATE TRIGGER set_coach_requests_updated_at
  BEFORE UPDATE ON coach_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Step 6: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE coach_requests IS 'Requests from trial users to add coaches to their team';
COMMENT ON COLUMN coach_requests.status IS 'pending = awaiting review, approved = user can add coaches, denied = request rejected';
COMMENT ON COLUMN coach_requests.granted_coach_slots IS 'Number of coach slots approved for trial (NULL if not approved or unlimited)';
