-- Migration: 093_fix_feedback_messages_rls.sql
-- Purpose: Fix RLS policies for feedback_messages to properly allow admin access

-- Drop existing policies and recreate with simpler logic
DROP POLICY IF EXISTS "Users can view messages on own feedback" ON feedback_messages;
DROP POLICY IF EXISTS "Users can send messages on own feedback" ON feedback_messages;

-- Simpler SELECT policy - allow anyone to read messages on feedback they submitted
-- or if they're an admin
CREATE POLICY "feedback_messages_select_policy"
  ON feedback_messages FOR SELECT
  USING (
    -- User owns the feedback
    EXISTS (
      SELECT 1 FROM feedback_reports
      WHERE feedback_reports.id = feedback_messages.feedback_id
      AND feedback_reports.user_id = auth.uid()
    )
    OR
    -- User is platform admin (check profiles table)
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = TRUE
    )
  );

-- INSERT policy - users can send on their own feedback, admins can send on any
CREATE POLICY "feedback_messages_insert_policy"
  ON feedback_messages FOR INSERT
  WITH CHECK (
    -- User sending message on their own feedback
    (
      sender_type = 'user' AND
      EXISTS (
        SELECT 1 FROM feedback_reports
        WHERE feedback_reports.id = feedback_messages.feedback_id
        AND feedback_reports.user_id = auth.uid()
      )
    )
    OR
    -- Admin sending admin message
    (
      sender_type = 'admin' AND
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_platform_admin = TRUE
      )
    )
  );

-- Also ensure feedback_reports has proper admin read access
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback_reports;

CREATE POLICY "Admins can view all feedback"
  ON feedback_reports FOR SELECT
  USING (
    -- User owns the feedback
    user_id = auth.uid()
    OR
    -- User is platform admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = TRUE
    )
  );

-- Admin can update any feedback
DROP POLICY IF EXISTS "Admins can update feedback" ON feedback_reports;

CREATE POLICY "Admins can update feedback"
  ON feedback_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = TRUE
    )
  );
