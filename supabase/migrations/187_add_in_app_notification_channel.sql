-- ============================================================================
-- Migration 187: Add 'in_app' to announcements notification_channel constraint
-- ============================================================================
-- When notification_channel = 'in_app', no SMS or email is sent.
-- The announcement is created and visible to parents in the app only.
-- ============================================================================

ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_notification_channel_check;
ALTER TABLE announcements ADD CONSTRAINT announcements_notification_channel_check
  CHECK (notification_channel IN ('sms', 'email', 'both', 'in_app'));
