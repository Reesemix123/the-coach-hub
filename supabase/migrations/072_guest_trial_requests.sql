-- Migration 072: Support Guest Trial Requests
-- Allows unauthenticated visitors to request trials with just their email
-- Admins can then review and approve, sending signup instructions

-- ============================================================================
-- Step 1: Modify trial_requests table to support guest requests
-- ============================================================================

-- Make user_id nullable (guests won't have one)
ALTER TABLE trial_requests
  ALTER COLUMN user_id DROP NOT NULL;

-- Add guest contact fields
ALTER TABLE trial_requests
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- Add constraint: must have either user_id OR guest_email
-- First drop if exists (for re-runs)
ALTER TABLE trial_requests
  DROP CONSTRAINT IF EXISTS trial_requests_contact_required;

ALTER TABLE trial_requests
  ADD CONSTRAINT trial_requests_contact_required
  CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL);

-- Index for looking up by guest email
CREATE INDEX IF NOT EXISTS idx_trial_requests_guest_email
  ON trial_requests(guest_email)
  WHERE guest_email IS NOT NULL;

-- ============================================================================
-- Step 2: Add RLS policy for anonymous trial request creation
-- ============================================================================

-- Drop existing policy if it exists (for clean re-run)
DROP POLICY IF EXISTS "Anyone can create guest trial requests" ON trial_requests;

-- Allow anonymous users to create trial requests (with guest_email required)
CREATE POLICY "Anyone can create guest trial requests"
  ON trial_requests FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
    AND guest_email IS NOT NULL
    AND guest_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

-- ============================================================================
-- Step 3: Grant permissions to anon role
-- ============================================================================

-- Allow anonymous users to insert into trial_requests
GRANT INSERT ON trial_requests TO anon;

-- ============================================================================
-- Step 4: Add approval notification tracking
-- ============================================================================

-- Track when approval notification was sent
ALTER TABLE trial_requests
  ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notification_type TEXT;

-- Comment for documentation
COMMENT ON COLUMN trial_requests.guest_email IS 'Email address for unauthenticated trial requesters';
COMMENT ON COLUMN trial_requests.guest_name IS 'Optional name for unauthenticated trial requesters';
COMMENT ON COLUMN trial_requests.notification_sent_at IS 'When the approval/denial notification was sent';
COMMENT ON COLUMN trial_requests.notification_type IS 'Type of notification sent (email, etc)';
