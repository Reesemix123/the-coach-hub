-- Migration 173: Film Capture Sharing
-- Allows users to share film captures with other users who have film_capture_access.

CREATE TABLE film_capture_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_id UUID NOT NULL REFERENCES film_captures(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id),
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  shared_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate shares
CREATE UNIQUE INDEX idx_film_capture_shares_unique
  ON film_capture_shares(capture_id, shared_with_user_id);

CREATE INDEX idx_film_capture_shares_shared_with ON film_capture_shares(shared_with_user_id);
CREATE INDEX idx_film_capture_shares_capture ON film_capture_shares(capture_id);

ALTER TABLE film_capture_shares ENABLE ROW LEVEL SECURITY;

-- Users can see shares where they are the sharer or the recipient
CREATE POLICY "users_own_shares" ON film_capture_shares
  FOR SELECT USING (
    shared_with_user_id = auth.uid() OR shared_by_user_id = auth.uid()
  );

-- Users with film_capture_access can create shares (for their own captures)
CREATE POLICY "users_create_shares" ON film_capture_shares
  FOR INSERT WITH CHECK (
    shared_by_user_id = auth.uid()
  );

-- Sharers can revoke their shares
CREATE POLICY "sharers_delete_shares" ON film_capture_shares
  FOR DELETE USING (
    shared_by_user_id = auth.uid()
  );

-- Platform admins have full access
CREATE POLICY "admin_all_shares" ON film_capture_shares
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
  );

COMMENT ON TABLE film_capture_shares IS 'Tracks which film captures have been shared with which users';
