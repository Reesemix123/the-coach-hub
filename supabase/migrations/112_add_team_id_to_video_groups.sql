-- Migration: 112_add_team_id_to_video_groups.sql
-- Adds team_id column to video_groups for timeline support
-- This allows timelines to be associated with teams for proper access control

-- Add team_id column
ALTER TABLE video_groups
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- Create index for efficient team lookups
CREATE INDEX IF NOT EXISTS idx_video_groups_team
ON video_groups(team_id) WHERE team_id IS NOT NULL;

-- Backfill team_id from games where possible
UPDATE video_groups vg
SET team_id = g.team_id
FROM games g
WHERE vg.game_id = g.id
  AND vg.team_id IS NULL;

COMMENT ON COLUMN video_groups.team_id IS
'Team that owns this video group/timeline';

-- Add RLS policy for video_groups based on team ownership
DROP POLICY IF EXISTS "Users can view video_groups for their teams" ON video_groups;
CREATE POLICY "Users can view video_groups for their teams"
ON video_groups FOR SELECT
USING (
  team_id IN (
    SELECT team_id FROM team_memberships WHERE user_id = auth.uid() AND is_active = true
    UNION
    SELECT id FROM teams WHERE user_id = auth.uid()
  )
  OR game_id IN (
    SELECT g.id FROM games g
    JOIN teams t ON g.team_id = t.id
    WHERE t.user_id = auth.uid()
       OR t.id IN (SELECT team_id FROM team_memberships WHERE user_id = auth.uid() AND is_active = true)
  )
);

DROP POLICY IF EXISTS "Users can insert video_groups for their teams" ON video_groups;
CREATE POLICY "Users can insert video_groups for their teams"
ON video_groups FOR INSERT
WITH CHECK (
  team_id IN (
    SELECT team_id FROM team_memberships WHERE user_id = auth.uid() AND is_active = true
    UNION
    SELECT id FROM teams WHERE user_id = auth.uid()
  )
  OR game_id IN (
    SELECT g.id FROM games g
    JOIN teams t ON g.team_id = t.id
    WHERE t.user_id = auth.uid()
       OR t.id IN (SELECT team_id FROM team_memberships WHERE user_id = auth.uid() AND is_active = true)
  )
);

DROP POLICY IF EXISTS "Users can update video_groups for their teams" ON video_groups;
CREATE POLICY "Users can update video_groups for their teams"
ON video_groups FOR UPDATE
USING (
  team_id IN (
    SELECT team_id FROM team_memberships WHERE user_id = auth.uid() AND is_active = true
    UNION
    SELECT id FROM teams WHERE user_id = auth.uid()
  )
  OR game_id IN (
    SELECT g.id FROM games g
    JOIN teams t ON g.team_id = t.id
    WHERE t.user_id = auth.uid()
       OR t.id IN (SELECT team_id FROM team_memberships WHERE user_id = auth.uid() AND is_active = true)
  )
);

DROP POLICY IF EXISTS "Users can delete video_groups for their teams" ON video_groups;
CREATE POLICY "Users can delete video_groups for their teams"
ON video_groups FOR DELETE
USING (
  team_id IN (
    SELECT team_id FROM team_memberships WHERE user_id = auth.uid() AND is_active = true
    UNION
    SELECT id FROM teams WHERE user_id = auth.uid()
  )
  OR game_id IN (
    SELECT g.id FROM games g
    JOIN teams t ON g.team_id = t.id
    WHERE t.user_id = auth.uid()
       OR t.id IN (SELECT team_id FROM team_memberships WHERE user_id = auth.uid() AND is_active = true)
  )
);

-- Make sure RLS is enabled
ALTER TABLE video_groups ENABLE ROW LEVEL SECURITY;
