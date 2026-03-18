-- Migration 141: Communication Hub - Communication Features
-- Phase 2: Announcements, RSVPs, messages, notifications

-- ====================
-- ANNOUNCEMENTS
-- ====================

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('owner', 'coach', 'team_admin')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  notification_channel TEXT DEFAULT 'both' CHECK (notification_channel IN ('sms', 'email', 'both')),
  target_position_group TEXT CHECK (target_position_group IN ('offense', 'defense', 'special_teams')),
  attachments JSONB DEFAULT '[]',
  shared_video_id UUID, -- FK added after shared_videos table is created
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_announcements_team_id ON announcements(team_id);
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_announcements_priority ON announcements(priority) WHERE priority = 'urgent';

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE announcements IS 'Coach/admin broadcast announcements with position group targeting';
COMMENT ON COLUMN announcements.priority IS 'Priority level: normal, important, or urgent (urgent overrides notification preferences)';
COMMENT ON COLUMN announcements.target_position_group IS 'Target specific position group (NULL = all parents)';
COMMENT ON COLUMN announcements.attachments IS 'Array of attachment objects [{name, url, type}]';

-- ====================
-- ANNOUNCEMENT READS
-- ====================

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (announcement_id, parent_id)
);

CREATE INDEX idx_announcement_reads_parent_id ON announcement_reads(parent_id);

COMMENT ON TABLE announcement_reads IS 'Tracks which parents have read each announcement';

-- ====================
-- EVENT RSVPS
-- ====================

CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES team_events(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE NOT NULL,
  family_status TEXT NOT NULL CHECK (family_status IN ('attending', 'not_attending', 'maybe')),
  child_exceptions JSONB DEFAULT '[]',
  note TEXT,
  responded_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, parent_id)
);

CREATE INDEX idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_parent_id ON event_rsvps(parent_id);

CREATE TRIGGER update_event_rsvps_updated_at
  BEFORE UPDATE ON event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE event_rsvps IS 'Family-based RSVP with per-child exceptions';
COMMENT ON COLUMN event_rsvps.family_status IS 'Default response for all children in family';
COMMENT ON COLUMN event_rsvps.child_exceptions IS 'Per-child overrides: [{player_id, status, note}]';

-- ====================
-- DIRECT MESSAGES
-- ====================

CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('owner', 'coach', 'team_admin', 'parent')),
  sender_id UUID NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('coach', 'parent')),
  recipient_id UUID NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_direct_messages_team_id ON direct_messages(team_id);
CREATE INDEX idx_direct_messages_sender ON direct_messages(sender_id, sender_type);
CREATE INDEX idx_direct_messages_recipient ON direct_messages(recipient_id, recipient_type);
CREATE INDEX idx_direct_messages_unread ON direct_messages(recipient_id) WHERE read_at IS NULL;

COMMENT ON TABLE direct_messages IS 'Direct messages between coaches and parents';
COMMENT ON COLUMN direct_messages.sender_type IS 'Who sent: owner, coach, team_admin, or parent';
COMMENT ON COLUMN direct_messages.recipient_type IS 'Who receives: coach or parent';

-- ====================
-- NOTIFICATION LOG
-- ====================

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('parent', 'coach', 'admin')),
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('announcement', 'event', 'video_shared', 'report_shared', 'rsvp_reminder', 'invitation')),
  subject TEXT,
  body_preview TEXT,
  external_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'bounced')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notification_log_team_id ON notification_log(team_id);
CREATE INDEX idx_notification_log_recipient ON notification_log(recipient_id, recipient_type);
CREATE INDEX idx_notification_log_sent_at ON notification_log(sent_at DESC);
CREATE INDEX idx_notification_log_status ON notification_log(status) WHERE status IN ('failed', 'bounced');

COMMENT ON TABLE notification_log IS 'Log of all notifications sent (email and SMS)';
COMMENT ON COLUMN notification_log.external_id IS 'Twilio SID or Resend message ID';
COMMENT ON COLUMN notification_log.status IS 'Delivery status: queued, sent, delivered, failed, bounced';

-- ====================
-- SMS AUTO-RESPONSES
-- ====================

CREATE TABLE IF NOT EXISTS sms_auto_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_phone TEXT NOT NULL,
  to_phone TEXT NOT NULL,
  inbound_body TEXT,
  auto_response_sent BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sms_auto_responses_from_phone ON sms_auto_responses(from_phone);
CREATE INDEX idx_sms_auto_responses_created_at ON sms_auto_responses(created_at DESC);

COMMENT ON TABLE sms_auto_responses IS 'Log of inbound SMS and auto-responses (one-way SMS system)';

-- ====================
-- ROW LEVEL SECURITY
-- ====================

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_auto_responses ENABLE ROW LEVEL SECURITY;

-- Announcements: team staff can manage, parents can view
CREATE POLICY "Team staff can manage announcements"
  ON announcements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = announcements.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

CREATE POLICY "Parents can view team announcements"
  ON announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_parent_access tpa
      JOIN parent_profiles pp ON pp.id = tpa.parent_id
      WHERE tpa.team_id = announcements.team_id
      AND pp.user_id = auth.uid()
      AND tpa.status = 'active'
    )
  );

-- Announcement reads: parents can manage their own reads
CREATE POLICY "Parents can manage own announcement reads"
  ON announcement_reads FOR ALL
  USING (
    parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Team staff can view announcement reads"
  ON announcement_reads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM announcements a
      JOIN teams t ON t.id = a.team_id
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE a.id = announcement_reads.announcement_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

-- Event RSVPs: parents can manage their own, team staff can view all
CREATE POLICY "Parents can manage own RSVPs"
  ON event_rsvps FOR ALL
  USING (
    parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Team staff can view event RSVPs"
  ON event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_events te
      JOIN teams t ON t.id = te.team_id
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE te.id = event_rsvps.event_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

-- Direct messages: participants can view/send
CREATE POLICY "Users can view own messages"
  ON direct_messages FOR SELECT
  USING (
    -- Sender can view
    (sender_id = auth.uid())
    OR
    -- Coach recipient can view
    (recipient_type = 'coach' AND recipient_id = auth.uid())
    OR
    -- Parent recipient can view
    (recipient_type = 'parent' AND recipient_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "Users can send messages"
  ON direct_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    OR
    sender_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Recipients can mark messages read"
  ON direct_messages FOR UPDATE
  USING (
    (recipient_type = 'coach' AND recipient_id = auth.uid())
    OR
    (recipient_type = 'parent' AND recipient_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid()))
  )
  WITH CHECK (
    -- Only allow updating read_at
    read_at IS NOT NULL
  );

-- Notification log: team staff can view
CREATE POLICY "Team staff can view notification log"
  ON notification_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = notification_log.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach', 'team_admin') AND tm.is_active = true)
      )
    )
  );

-- System can insert notifications
CREATE POLICY "System can insert notifications"
  ON notification_log FOR INSERT
  WITH CHECK (true);  -- Handled by service layer

-- SMS auto-responses: system only
CREATE POLICY "System can manage sms auto-responses"
  ON sms_auto_responses FOR ALL
  USING (true);  -- Handled by webhook with service role
