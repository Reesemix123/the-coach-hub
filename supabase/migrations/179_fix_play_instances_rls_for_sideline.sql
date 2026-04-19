-- ============================================================================
-- Migration 179: Fix play_instances INSERT RLS for sideline tracker
-- ============================================================================
-- PROBLEM:
--   The existing INSERT policy (migration 013) joins through video_id → videos
--   → games → teams to verify ownership. Sideline-entered plays have
--   video_id = NULL, so the join fails and the insert is blocked by RLS.
--
-- FIX:
--   Drop and recreate the INSERT policy with an additional OR branch that
--   allows inserts when video_id IS NULL, source = 'sideline', and the
--   team_id matches a team the user owns or is a member of.
--
--   Also update SELECT, UPDATE, DELETE policies with the same sideline
--   branch so coaches can read/modify/delete their sideline plays.
-- ============================================================================

-- --------------------------------------------------------------------------
-- INSERT policy
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Owners, coaches, and analysts can create play instances" ON play_instances;

CREATE POLICY "Owners, coaches, and analysts can create play instances"
  ON play_instances FOR INSERT
  WITH CHECK (
    -- Branch 1: Film-tagged plays (video_id present) — existing logic
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
    OR
    -- Branch 2: Sideline-entered plays (video_id NULL) — check team_id directly
    (
      play_instances.video_id IS NULL
      AND play_instances.source = 'sideline'
      AND (
        EXISTS (
          SELECT 1 FROM teams
          WHERE teams.id = play_instances.team_id
            AND teams.user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM team_memberships
          WHERE team_memberships.team_id = play_instances.team_id
            AND team_memberships.user_id = auth.uid()
            AND team_memberships.role IN ('owner', 'coach', 'analyst')
            AND team_memberships.is_active = true
        )
      )
    )
  );

-- --------------------------------------------------------------------------
-- SELECT policy
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view play instances for their teams" ON play_instances;

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
    OR
    (
      play_instances.video_id IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM teams
          WHERE teams.id = play_instances.team_id
            AND teams.user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM team_memberships
          WHERE team_memberships.team_id = play_instances.team_id
            AND team_memberships.user_id = auth.uid()
            AND team_memberships.is_active = true
        )
      )
    )
  );

-- --------------------------------------------------------------------------
-- UPDATE policy
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Owners, coaches, and analysts can update play instances" ON play_instances;

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
    OR
    (
      play_instances.video_id IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM teams
          WHERE teams.id = play_instances.team_id
            AND teams.user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM team_memberships
          WHERE team_memberships.team_id = play_instances.team_id
            AND team_memberships.user_id = auth.uid()
            AND team_memberships.role IN ('owner', 'coach', 'analyst')
            AND team_memberships.is_active = true
        )
      )
    )
  );

-- --------------------------------------------------------------------------
-- DELETE policy
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Owners and coaches can delete play instances" ON play_instances;

CREATE POLICY "Owners and coaches can delete play instances"
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
    OR
    (
      play_instances.video_id IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM teams
          WHERE teams.id = play_instances.team_id
            AND teams.user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM team_memberships
          WHERE team_memberships.team_id = play_instances.team_id
            AND team_memberships.user_id = auth.uid()
            AND team_memberships.role IN ('owner', 'coach')
            AND team_memberships.is_active = true
        )
      )
    )
  );
