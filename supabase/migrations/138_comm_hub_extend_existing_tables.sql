-- Migration 138: Communication Hub - Extend Existing Tables
-- Phase 1: Extends team_memberships and team_events for Communication Hub

-- ====================
-- EXTEND TEAM_MEMBERSHIPS
-- ====================

-- Add 'team_admin' role to team_memberships
ALTER TABLE team_memberships
DROP CONSTRAINT IF EXISTS team_memberships_role_check;

ALTER TABLE team_memberships
ADD CONSTRAINT team_memberships_role_check
CHECK (role IN ('owner', 'coach', 'analyst', 'viewer', 'team_admin'));

COMMENT ON COLUMN team_memberships.role IS 'User role: owner (head coach), coach, analyst, viewer, team_admin (team mom/logistics)';

-- ====================
-- EXTEND TEAM_EVENTS
-- ====================

-- Expand event_type constraint to include new event types
ALTER TABLE team_events
DROP CONSTRAINT IF EXISTS team_events_event_type_check;

ALTER TABLE team_events
ADD CONSTRAINT team_events_event_type_check
CHECK (event_type IN ('practice', 'game', 'meeting', 'scrimmage', 'team_bonding', 'film_session', 'parent_meeting', 'fundraiser', 'other'));

-- Add new columns for enhanced event data
ALTER TABLE team_events
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS location_lng DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS location_notes TEXT,
  ADD COLUMN IF NOT EXISTS opponent TEXT,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB,
  ADD COLUMN IF NOT EXISTS notification_channel TEXT DEFAULT 'both' CHECK (notification_channel IN ('sms', 'email', 'both')),
  ADD COLUMN IF NOT EXISTS start_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_datetime TIMESTAMPTZ;

-- Add index for datetime queries
CREATE INDEX IF NOT EXISTS idx_team_events_start_datetime ON team_events(start_datetime);

COMMENT ON COLUMN team_events.location_address IS 'Full address for the event location';
COMMENT ON COLUMN team_events.location_lat IS 'Latitude for map display';
COMMENT ON COLUMN team_events.location_lng IS 'Longitude for map display';
COMMENT ON COLUMN team_events.location_notes IS 'Additional location notes (parking, entrance, etc.)';
COMMENT ON COLUMN team_events.opponent IS 'Opponent name for games/scrimmages';
COMMENT ON COLUMN team_events.is_recurring IS 'Whether this event repeats';
COMMENT ON COLUMN team_events.recurrence_rule IS 'iCal-style recurrence rule as JSON';
COMMENT ON COLUMN team_events.notification_channel IS 'How to notify parents: sms, email, or both';
COMMENT ON COLUMN team_events.start_datetime IS 'Full datetime for event start (replaces date + start_time for timezone support)';
COMMENT ON COLUMN team_events.end_datetime IS 'Full datetime for event end';

-- ====================
-- UPDATE RLS FOR TEAM_ADMIN
-- ====================

-- Update team_events policies to include team_admin role
DROP POLICY IF EXISTS "Owners and coaches can create events" ON team_events;
CREATE POLICY "Owners, coaches, and team_admins can create events"
  ON team_events FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = team_events.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach', 'team_admin')
      AND team_memberships.is_active = true
    )
  );

DROP POLICY IF EXISTS "Owners and coaches can update events" ON team_events;
CREATE POLICY "Owners, coaches, and team_admins can update events"
  ON team_events FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = team_events.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach', 'team_admin')
      AND team_memberships.is_active = true
    )
  );
