-- Migration 014: Team Schedule & Calendar
-- Adds location and time fields to games
-- Creates team_events table for practices, meetings, and other events

-- ====================
-- UPDATE GAMES TABLE
-- ====================

-- Add location, time, and notes fields to games
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS location VARCHAR(255),
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ====================
-- TEAM EVENTS TABLE
-- ====================

-- Create team_events table for practices, meetings, and other team activities
CREATE TABLE IF NOT EXISTS team_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('practice', 'meeting', 'other')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location VARCHAR(255),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_team_events_team_id ON team_events(team_id);
CREATE INDEX idx_team_events_date ON team_events(date);
CREATE INDEX idx_team_events_type ON team_events(event_type);

-- Create updated_at trigger
CREATE TRIGGER update_team_events_updated_at
  BEFORE UPDATE ON team_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- RLS POLICIES FOR TEAM_EVENTS
-- ====================

-- Enable RLS
ALTER TABLE team_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view events for their teams
CREATE POLICY "Users can view events for their teams"
  ON team_events FOR SELECT
  USING (
    -- Primary owner
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_events.team_id AND teams.user_id = auth.uid())
    OR
    -- Team member
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = team_events.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
  );

-- Policy: Owners, coaches can create events
CREATE POLICY "Owners and coaches can create events"
  ON team_events FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = team_events.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach')
      AND team_memberships.is_active = true
    )
  );

-- Policy: Owners and coaches can update events
CREATE POLICY "Owners and coaches can update events"
  ON team_events FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = team_events.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach')
      AND team_memberships.is_active = true
    )
  );

-- Policy: Only owners can delete events
CREATE POLICY "Only owners can delete events"
  ON team_events FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
  );

-- ====================
-- COMMENTS
-- ====================

COMMENT ON TABLE team_events IS 'Team calendar events: practices, meetings, and other activities';
COMMENT ON COLUMN team_events.event_type IS 'Type of event: practice, meeting, or other';
COMMENT ON COLUMN team_events.location IS 'Where the event takes place (field, gym, etc.)';
COMMENT ON COLUMN team_events.start_time IS 'Event start time';
COMMENT ON COLUMN team_events.end_time IS 'Event end time';

COMMENT ON COLUMN games.location IS 'Game location (stadium, field name, address)';
COMMENT ON COLUMN games.start_time IS 'Game start time (kickoff time)';
COMMENT ON COLUMN games.notes IS 'Additional notes about the game';
