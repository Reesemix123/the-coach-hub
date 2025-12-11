-- Migration: 092_feedback_notifications.sql
-- Purpose: Create notifications table for feedback system and general user notifications

-- ============================================================================
-- NOTIFICATIONS TABLE
-- Stores user notifications for feedback updates, system messages, etc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target user
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification content
  type TEXT NOT NULL CHECK (type IN ('feedback_update', 'feedback_reply', 'system', 'team_invite')),
  reference_id UUID,  -- ID of related entity (feedback_id, team_id, etc.)
  title TEXT NOT NULL,
  body TEXT,

  -- State
  is_read BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast lookup by user (primary query pattern)
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Filter by read status
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read)
  WHERE is_read = FALSE;

-- Order by created_at for recent notifications
CREATE INDEX idx_notifications_created_at ON notifications(user_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- Allow authenticated users to insert notifications for any user
-- This allows admins to create notifications for users
CREATE POLICY "Authenticated users can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- FEEDBACK MESSAGES TABLE
-- Stores conversation between user and admin on feedback
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to feedback
  feedback_id UUID NOT NULL REFERENCES feedback_reports(id) ON DELETE CASCADE,

  -- Sender info
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'admin')),

  -- Message content
  message TEXT NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FEEDBACK MESSAGES INDEXES
-- ============================================================================

CREATE INDEX idx_feedback_messages_feedback_id ON feedback_messages(feedback_id);
CREATE INDEX idx_feedback_messages_created_at ON feedback_messages(feedback_id, created_at);

-- ============================================================================
-- FEEDBACK MESSAGES RLS
-- ============================================================================

ALTER TABLE feedback_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages for their own feedback
CREATE POLICY "Users can view messages on own feedback"
  ON feedback_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM feedback_reports
      WHERE feedback_reports.id = feedback_messages.feedback_id
      AND feedback_reports.user_id = auth.uid()
    )
    OR
    -- Admins can view all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = TRUE
    )
  );

-- Users can insert messages on their own feedback
CREATE POLICY "Users can send messages on own feedback"
  ON feedback_messages FOR INSERT
  WITH CHECK (
    (
      sender_type = 'user' AND
      EXISTS (
        SELECT 1 FROM feedback_reports
        WHERE feedback_reports.id = feedback_messages.feedback_id
        AND feedback_reports.user_id = auth.uid()
      )
    )
    OR
    -- Admins can insert admin messages
    (
      sender_type = 'admin' AND
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_platform_admin = TRUE
      )
    )
  );

-- ============================================================================
-- ENABLE REALTIME FOR NOTIFICATIONS
-- ============================================================================

-- Note: Run this in Supabase dashboard if needed:
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE notifications IS 'User notifications for feedback updates, system messages, etc.';
COMMENT ON COLUMN notifications.type IS 'Notification type: feedback_update, feedback_reply, system, team_invite';
COMMENT ON COLUMN notifications.reference_id IS 'ID of related entity (feedback_id, team_id, etc.)';
COMMENT ON TABLE feedback_messages IS 'Conversation thread between user and admin on feedback reports';
