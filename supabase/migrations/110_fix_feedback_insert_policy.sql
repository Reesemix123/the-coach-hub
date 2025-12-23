-- Migration: 110_fix_feedback_insert_policy.sql
-- Purpose: Add missing INSERT policy for feedback_reports so users can submit feedback
-- Issue: Users could not submit feedback due to missing RLS INSERT policy

-- Create INSERT policy to allow authenticated users to submit their own feedback
DROP POLICY IF EXISTS "Users can insert own feedback" ON feedback_reports;

CREATE POLICY "Users can insert own feedback"
  ON feedback_reports FOR INSERT
  WITH CHECK (
    -- User must be authenticated and can only insert their own feedback
    auth.uid() IS NOT NULL AND
    auth.uid() = user_id
  );

-- Also ensure users can view their own feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON feedback_reports;

CREATE POLICY "Users can view own feedback"
  ON feedback_reports FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Note: The "Admins can view all feedback" policy from 093 handles admin access
-- Note: The "Admins can update feedback" policy from 093 handles admin updates
