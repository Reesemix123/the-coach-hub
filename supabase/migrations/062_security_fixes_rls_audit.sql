-- Migration 062: Security Fixes from RLS Audit
-- Purpose: Fix security vulnerabilities identified in RLS audit
-- Date: 2024-12-02

-- ============================================================================
-- ISSUE 1 (CRITICAL): team_members table has RLS disabled
-- The team_members table appears to be a view - check and enable RLS if it's a table
-- ============================================================================

-- Check if team_members is a table (not a view) and enable RLS
DO $$
BEGIN
  -- Only proceed if team_members exists and is a table (not a view)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'team_members'
    AND table_type = 'BASE TABLE'
  ) THEN
    -- Enable RLS
    ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

    -- Check if it has a team_id column for policies
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'team_members'
      AND column_name = 'team_id'
    ) THEN
      -- Create SELECT policy - users can view team members for their teams
      EXECUTE 'CREATE POLICY IF NOT EXISTS "Users can view team members for their teams"
        ON team_members FOR SELECT
        USING (
          EXISTS (SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND teams.user_id = auth.uid())
          OR
          EXISTS (
            SELECT 1 FROM team_memberships
            WHERE team_memberships.team_id = team_members.team_id
            AND team_memberships.user_id = auth.uid()
            AND team_memberships.is_active = true
          )
        )';

      -- Create INSERT policy - owners and coaches can add team members
      EXECUTE 'CREATE POLICY IF NOT EXISTS "Owners and coaches can add team members"
        ON team_members FOR INSERT
        WITH CHECK (
          EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
          OR
          EXISTS (
            SELECT 1 FROM team_memberships
            WHERE team_memberships.team_id = team_members.team_id
            AND team_memberships.user_id = auth.uid()
            AND team_memberships.role IN (''owner'', ''coach'')
            AND team_memberships.is_active = true
          )
        )';

      -- Create UPDATE policy - owners and coaches can update team members
      EXECUTE 'CREATE POLICY IF NOT EXISTS "Owners and coaches can update team members"
        ON team_members FOR UPDATE
        USING (
          EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
          OR
          EXISTS (
            SELECT 1 FROM team_memberships
            WHERE team_memberships.team_id = team_members.team_id
            AND team_memberships.user_id = auth.uid()
            AND team_memberships.role IN (''owner'', ''coach'')
            AND team_memberships.is_active = true
          )
        )';

      -- Create DELETE policy - only owners can delete team members
      EXECUTE 'CREATE POLICY IF NOT EXISTS "Only owners can delete team members"
        ON team_members FOR DELETE
        USING (
          EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
          OR
          EXISTS (
            SELECT 1 FROM team_memberships
            WHERE team_memberships.team_id = team_members.team_id
            AND team_memberships.user_id = auth.uid()
            AND team_memberships.role = ''owner''
            AND team_memberships.is_active = true
          )
        )';

      RAISE NOTICE 'Created RLS policies for team_members table';
    ELSE
      RAISE NOTICE 'team_members table exists but has no team_id column - manual policy creation needed';
    END IF;
  ELSE
    RAISE NOTICE 'team_members is not a base table (might be a view) - skipping RLS enable';
  END IF;
END $$;


-- ============================================================================
-- ISSUE 2 (HIGH): Drop overly permissive policies on games table
-- The games_select_policy with USING(true) conflicts with proper team-scoped policy
-- ============================================================================

-- Drop the overly permissive policy if it exists
DROP POLICY IF EXISTS "games_select_policy" ON games;


-- ============================================================================
-- ISSUE 3 (HIGH): Drop overly permissive policies on play_instances table
-- These policies use USING(true) which allows anyone to access any data
-- ============================================================================

DROP POLICY IF EXISTS "play_instances_select_policy" ON play_instances;
DROP POLICY IF EXISTS "play_instances_insert_policy" ON play_instances;
DROP POLICY IF EXISTS "play_instances_update_policy" ON play_instances;
DROP POLICY IF EXISTS "play_instances_delete_policy" ON play_instances;


-- ============================================================================
-- ISSUE 4 (HIGH): Drop overly permissive policies on videos table
-- These legacy policies use USING(true) and conflict with team-scoped policies
-- ============================================================================

DROP POLICY IF EXISTS "videos_select_policy" ON videos;
DROP POLICY IF EXISTS "videos_insert_policy" ON videos;
DROP POLICY IF EXISTS "videos_update_policy" ON videos;
DROP POLICY IF EXISTS "videos_delete_policy" ON videos;


-- ============================================================================
-- ISSUE 5 (HIGH): Fix video_processing_jobs UPDATE policy
-- Current policy uses USING(true) - needs to restrict to service role operations
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can update processing jobs" ON video_processing_jobs;

-- Create a more restrictive policy that checks video group ownership
-- Note: Background jobs will need to use service_role key to bypass RLS
CREATE POLICY "Users can update their processing jobs"
  ON video_processing_jobs FOR UPDATE
  USING (
    video_group_id IN (
      SELECT vg.id FROM video_groups vg
      JOIN games g ON g.id = vg.game_id
      WHERE g.team_id IN (
        SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
        UNION
        SELECT id FROM teams WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    video_group_id IN (
      SELECT vg.id FROM video_groups vg
      JOIN games g ON g.id = vg.game_id
      WHERE g.team_id IN (
        SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
        UNION
        SELECT id FROM teams WHERE user_id = auth.uid()
      )
    )
  );


-- ============================================================================
-- ISSUE 6 (HIGH): Fix alerts INSERT policy
-- Current policy uses WITH CHECK(true) - needs to restrict to service role
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can insert alerts" ON alerts;

-- Alerts should only be created by:
-- 1. System/service role (for automated alerts like credit warnings)
-- 2. Platform admins (for manual alerts)
-- Since regular users shouldn't create alerts, we restrict INSERT to platform admins only
-- Service role operations bypass RLS automatically
CREATE POLICY "Platform admins can insert alerts"
  ON alerts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_platform_admin = true
    )
  );


-- ============================================================================
-- VERIFICATION: Log the current state of RLS for auditing
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '--- RLS Status After Migration ---';
  FOR r IN
    SELECT
      schemaname,
      tablename,
      CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    RAISE NOTICE 'Table: % - RLS: %', r.tablename, r.rls_status;
  END LOOP;
END $$;


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Users can update their processing jobs" ON video_processing_jobs IS
  'Restricts video processing job updates to users who own the associated video group. Service role bypasses RLS for background job updates.';

COMMENT ON POLICY "Platform admins can insert alerts" ON alerts IS
  'Restricts alert creation to platform admins. Automated alerts (credit warnings) use service role which bypasses RLS.';
