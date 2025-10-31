-- Migration 013: Update RLS Policies for Multi-Coach Access
-- Updates games, videos, and play_instances to support team_memberships
-- Backward compatible: still checks teams.user_id (primary owner)

-- ====================
-- GAMES TABLE
-- ====================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view games" ON games;
DROP POLICY IF EXISTS "Users can create games" ON games;
DROP POLICY IF EXISTS "Users can update their own games" ON games;
DROP POLICY IF EXISTS "Users can delete their own games" ON games;

-- New multi-coach aware policies
CREATE POLICY "Users can view games for their teams"
  ON games FOR SELECT
  USING (
    -- Primary owner
    EXISTS (SELECT 1 FROM teams WHERE teams.id = games.team_id AND teams.user_id = auth.uid())
    OR
    -- Team member
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = games.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Owners, coaches, and analysts can create games"
  ON games FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = games.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach', 'analyst')
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Owners and coaches can update games"
  ON games FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = games.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach')
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Only owners can delete games"
  ON games FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = games.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role = 'owner'
      AND team_memberships.is_active = true
    )
  );

-- ====================
-- VIDEOS TABLE
-- ====================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view videos" ON videos;
DROP POLICY IF EXISTS "Users can create videos" ON videos;
DROP POLICY IF EXISTS "Users can update videos" ON videos;
DROP POLICY IF EXISTS "Users can delete videos" ON videos;

-- New multi-coach aware policies
CREATE POLICY "Users can view videos for their teams"
  ON videos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM games
      JOIN teams ON teams.id = games.team_id
      WHERE games.id = videos.game_id
      AND teams.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM games
      JOIN team_memberships ON team_memberships.team_id = games.team_id
      WHERE games.id = videos.game_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Owners, coaches, and analysts can create videos"
  ON videos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games
      JOIN teams ON teams.id = games.team_id
      WHERE games.id = videos.game_id
      AND teams.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM games
      JOIN team_memberships ON team_memberships.team_id = games.team_id
      WHERE games.id = videos.game_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach', 'analyst')
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Owners and coaches can update videos"
  ON videos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM games
      JOIN teams ON teams.id = games.team_id
      WHERE games.id = videos.game_id
      AND teams.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM games
      JOIN team_memberships ON team_memberships.team_id = games.team_id
      WHERE games.id = videos.game_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach')
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Only owners can delete videos"
  ON videos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM games
      JOIN teams ON teams.id = games.team_id
      WHERE games.id = videos.game_id
      AND teams.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM games
      JOIN team_memberships ON team_memberships.team_id = games.team_id
      WHERE games.id = videos.game_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role = 'owner'
      AND team_memberships.is_active = true
    )
  );

-- ====================
-- PLAY_INSTANCES TABLE
-- ====================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view play instances" ON play_instances;
DROP POLICY IF EXISTS "Users can create play instances" ON play_instances;
DROP POLICY IF EXISTS "Users can update play instances" ON play_instances;
DROP POLICY IF EXISTS "Users can delete play instances" ON play_instances;

-- New multi-coach aware policies
CREATE POLICY "Users can view play instances for their teams"
  ON play_instances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM videos
      JOIN games ON games.id = videos.game_id
      JOIN teams ON teams.id = games.team_id
      WHERE videos.id = play_instances.video_id
      AND teams.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM videos
      JOIN games ON games.id = videos.game_id
      JOIN team_memberships ON team_memberships.team_id = games.team_id
      WHERE videos.id = play_instances.video_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Owners, coaches, and analysts can create play instances"
  ON play_instances FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM videos
      JOIN games ON games.id = videos.game_id
      JOIN teams ON teams.id = games.team_id
      WHERE videos.id = play_instances.video_id
      AND teams.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM videos
      JOIN games ON games.id = videos.game_id
      JOIN team_memberships ON team_memberships.team_id = games.team_id
      WHERE videos.id = play_instances.video_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach', 'analyst')
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Owners, coaches, and analysts can update play instances"
  ON play_instances FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM videos
      JOIN games ON games.id = videos.game_id
      JOIN teams ON teams.id = games.team_id
      WHERE videos.id = play_instances.video_id
      AND teams.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM videos
      JOIN games ON games.id = videos.game_id
      JOIN team_memberships ON team_memberships.team_id = games.team_id
      WHERE videos.id = play_instances.video_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach', 'analyst')
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Only owners and coaches can delete play instances"
  ON play_instances FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM videos
      JOIN games ON games.id = videos.game_id
      JOIN teams ON teams.id = games.team_id
      WHERE videos.id = play_instances.video_id
      AND teams.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM videos
      JOIN games ON games.id = videos.game_id
      JOIN team_memberships ON team_memberships.team_id = games.team_id
      WHERE videos.id = play_instances.video_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach')
      AND team_memberships.is_active = true
    )
  );

-- ====================
-- PLAYBOOK_PLAYS TABLE (bonus)
-- ====================

-- Check if policies exist before dropping
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'playbook_plays' AND policyname LIKE '%can view%'
  ) THEN
    DROP POLICY "Users can view plays" ON playbook_plays;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'playbook_plays'
  ) THEN
    -- Drop any other existing policies
    EXECUTE (
      SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON playbook_plays', '; ')
      FROM pg_policies
      WHERE tablename = 'playbook_plays'
    );
  END IF;
END $$;

-- New multi-coach aware policies for playbook
CREATE POLICY "Users can view playbook plays for their teams"
  ON playbook_plays FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = playbook_plays.team_id AND teams.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = playbook_plays.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Owners and coaches can create playbook plays"
  ON playbook_plays FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = playbook_plays.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach')
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Owners and coaches can update playbook plays"
  ON playbook_plays FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = playbook_plays.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role IN ('owner', 'coach')
      AND team_memberships.is_active = true
    )
  );

CREATE POLICY "Only owners can delete playbook plays"
  ON playbook_plays FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM team_memberships
      WHERE team_memberships.team_id = playbook_plays.team_id
      AND team_memberships.user_id = auth.uid()
      AND team_memberships.role = 'owner'
      AND team_memberships.is_active = true
    )
  );
