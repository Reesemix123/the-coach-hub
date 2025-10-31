-- Migration 008: Drives Table (Drive-Level Analytics)
-- Enables Points Per Drive, 3-and-outs, Red Zone TD%, and drive efficiency metrics
-- Critical for Tier 2+ analytics

CREATE TABLE drives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

  -- Drive identification
  drive_number INTEGER NOT NULL, -- Sequential within game
  quarter INTEGER CHECK (quarter BETWEEN 1 AND 5), -- 1-4, 5 = OT

  -- Timing
  start_time INTEGER, -- Seconds remaining when drive started
  end_time INTEGER, -- Seconds remaining when drive ended

  -- Field position (0-100 scale: 0 = your goal line, 100 = opponent goal line)
  start_yard_line INTEGER CHECK (start_yard_line BETWEEN 0 AND 100),
  end_yard_line INTEGER CHECK (end_yard_line BETWEEN 0 AND 100),

  -- Drive statistics
  plays_count INTEGER DEFAULT 0,
  yards_gained INTEGER DEFAULT 0,
  first_downs INTEGER DEFAULT 0,

  -- Drive outcome
  result TEXT NOT NULL CHECK (result IN (
    'touchdown', 'field_goal', 'punt', 'turnover', 'downs', 'end_half', 'end_game', 'safety'
  )),
  points INTEGER DEFAULT 0,

  -- Advanced metrics (computed)
  three_and_out BOOLEAN DEFAULT false, -- plays_count <= 3 AND first_downs = 0
  reached_red_zone BOOLEAN DEFAULT false, -- Max yard_line >= 80
  scoring_drive BOOLEAN DEFAULT false, -- points > 0

  -- Metadata
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_drives_game ON drives(game_id);
CREATE INDEX idx_drives_team ON drives(team_id);
CREATE INDEX idx_drives_result ON drives(result);
CREATE INDEX idx_drives_scoring ON drives(scoring_drive);
CREATE INDEX idx_drives_three_and_out ON drives(three_and_out);

-- Unique constraint: one drive number per game per team
CREATE UNIQUE INDEX idx_drives_game_team_number
  ON drives(game_id, team_id, drive_number);

-- Trigger for updated_at
CREATE TRIGGER update_drives_updated_at
  BEFORE UPDATE ON drives
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-compute derived fields on insert/update
CREATE OR REPLACE FUNCTION compute_drive_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Three and out detection
  NEW.three_and_out := (NEW.plays_count <= 3 AND NEW.first_downs = 0);

  -- Scoring drive detection
  NEW.scoring_drive := (NEW.points > 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compute_drive_metrics_trigger
  BEFORE INSERT OR UPDATE ON drives
  FOR EACH ROW
  EXECUTE FUNCTION compute_drive_metrics();

-- Row Level Security
ALTER TABLE drives ENABLE ROW LEVEL SECURITY;

-- Multi-coach aware policies
CREATE POLICY "Users can view drives for their teams"
  ON drives FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = drives.team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = drives.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Owners, coaches, and analysts can create drives"
  ON drives FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = drives.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach', 'analyst')
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Owners, coaches, and analysts can update drives"
  ON drives FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = drives.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach', 'analyst')
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Only owners and coaches can delete drives"
  ON drives FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = drives.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach')
      AND team_memberships.is_active = true
    )
  );

-- Helper function: Calculate Points Per Drive for a team
CREATE OR REPLACE FUNCTION calculate_ppd(p_team_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_points INTEGER;
  total_drives INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(points), 0),
    COUNT(*)
  INTO total_points, total_drives
  FROM drives
  WHERE team_id = p_team_id;

  IF total_drives = 0 THEN
    RETURN NULL;
  END IF;

  RETURN ROUND(total_points::NUMERIC / total_drives, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Calculate 3-and-out rate for a team
CREATE OR REPLACE FUNCTION calculate_three_and_out_rate(p_team_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  three_and_outs INTEGER;
  total_drives INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE three_and_out = true),
    COUNT(*)
  INTO three_and_outs, total_drives
  FROM drives
  WHERE team_id = p_team_id;

  IF total_drives = 0 THEN
    RETURN NULL;
  END IF;

  RETURN ROUND((three_and_outs::NUMERIC / total_drives) * 100, 1);
END;
$$ LANGUAGE plpgsql STABLE;
