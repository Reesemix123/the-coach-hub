-- Migration: Add is_offensive_drive flag to drives table
-- This enables tracking whether a drive is offensive (our team) or defensive (opponent possession)

-- Add is_offensive_drive column to drives table
ALTER TABLE drives
ADD COLUMN is_offensive_drive BOOLEAN DEFAULT true NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN drives.is_offensive_drive IS
'True if this is an offensive drive (our team has possession), false if defensive (opponent has possession)';

-- Create index for filtering drives by type
CREATE INDEX idx_drives_is_offensive ON drives(is_offensive_drive);

-- Create index for team + drive type queries (common analytics pattern)
CREATE INDEX idx_drives_team_offensive ON drives(team_id, is_offensive_drive);

-- Update existing drives to be offensive by default
-- (Most teams will have tagged their own offensive drives first)
UPDATE drives SET is_offensive_drive = true WHERE is_offensive_drive IS NULL;

-- Note: Coaches will need to manually mark defensive drives or we can add UI to toggle this
