-- Migration 065: Fix RLS Recursion Between teams and team_memberships
-- This migration fixes the infinite recursion error that occurs when
-- teams policies reference team_memberships and vice versa.
--
-- Solution: Create a SECURITY DEFINER function that bypasses RLS to get
-- user's team IDs, then use that function in policies.

-- ====================
-- HELPER FUNCTION
-- ====================

-- Drop if exists to make this idempotent
DROP FUNCTION IF EXISTS get_user_team_ids();

-- Create a SECURITY DEFINER function that runs with owner privileges
-- This bypasses RLS when called from within a policy, breaking the recursion
CREATE OR REPLACE FUNCTION get_user_team_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Get teams where user is the primary owner
  SELECT id FROM teams WHERE user_id = auth.uid()
  UNION
  -- Get teams where user is a member
  SELECT team_id FROM team_memberships WHERE user_id = auth.uid() AND is_active = true
$$;

-- ====================
-- FIX TEAMS TABLE POLICIES
-- ====================

-- Drop ALL existing policies on teams
DROP POLICY IF EXISTS "teams_modify" ON teams;
DROP POLICY IF EXISTS "Users can view teams they own or are members of" ON teams;
DROP POLICY IF EXISTS "Users can view own teams" ON teams;
DROP POLICY IF EXISTS "Users can insert own teams" ON teams;
DROP POLICY IF EXISTS "Users can update own teams" ON teams;
DROP POLICY IF EXISTS "Users can delete own teams" ON teams;
DROP POLICY IF EXISTS "Users can create their own teams" ON teams;
DROP POLICY IF EXISTS "Users can update their own teams" ON teams;
DROP POLICY IF EXISTS "Users can delete their own teams" ON teams;
DROP POLICY IF EXISTS "Enable read access for own teams" ON teams;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON teams;
DROP POLICY IF EXISTS "Enable update for team owners" ON teams;
DROP POLICY IF EXISTS "Enable delete for team owners" ON teams;

-- Create new, non-recursive policies for teams
-- SELECT: Use the helper function to get team IDs
CREATE POLICY "teams_select_policy"
  ON teams FOR SELECT
  USING (id IN (SELECT get_user_team_ids()));

-- INSERT: Only check user_id (no recursion risk)
CREATE POLICY "teams_insert_policy"
  ON teams FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Only check user_id (primary owner only)
CREATE POLICY "teams_update_policy"
  ON teams FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: Only check user_id (primary owner only)
CREATE POLICY "teams_delete_policy"
  ON teams FOR DELETE
  USING (user_id = auth.uid());

-- ====================
-- FIX TEAM_MEMBERSHIPS TABLE POLICIES
-- ====================

-- Drop all existing policies on team_memberships
DROP POLICY IF EXISTS "Users can view team memberships for their teams" ON team_memberships;
DROP POLICY IF EXISTS "Team owners can add members" ON team_memberships;
DROP POLICY IF EXISTS "Team owners can update memberships" ON team_memberships;
DROP POLICY IF EXISTS "Team owners can remove members" ON team_memberships;

-- Create new, non-recursive policies for team_memberships
-- SELECT: Can view own membership OR memberships of teams you own
CREATE POLICY "team_memberships_select_policy"
  ON team_memberships FOR SELECT
  USING (
    -- Can always see your own membership
    user_id = auth.uid()
    OR
    -- Can see memberships of teams you own (via teams.user_id only, no recursion)
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_memberships.team_id AND teams.user_id = auth.uid())
  );

-- INSERT: Only team owners (via teams.user_id) can add members
CREATE POLICY "team_memberships_insert_policy"
  ON team_memberships FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
  );

-- UPDATE: Only team owners (via teams.user_id) can update memberships
CREATE POLICY "team_memberships_update_policy"
  ON team_memberships FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
  );

-- DELETE: Only team owners (via teams.user_id) can remove members
CREATE POLICY "team_memberships_delete_policy"
  ON team_memberships FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_id AND teams.user_id = auth.uid())
  );

-- ====================
-- GRANT EXECUTE TO PUBLIC
-- ====================

-- Allow the function to be called by authenticated users
GRANT EXECUTE ON FUNCTION get_user_team_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_team_ids() TO anon;

-- ====================
-- COMMENT
-- ====================

COMMENT ON FUNCTION get_user_team_ids() IS
'Returns all team IDs that the current user has access to (as owner or member).
This function uses SECURITY DEFINER to bypass RLS and avoid infinite recursion
when teams and team_memberships policies reference each other.';
