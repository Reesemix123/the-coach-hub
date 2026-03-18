-- Migration 145: Allow parents to view teams they have access to
--
-- Problem: teams RLS policy (teams_select_policy) uses get_user_team_ids() which only
-- returns teams owned by or with team_memberships for the user. Parents aren't owners
-- or team members, so they can't see any teams.
--
-- Fix: SECURITY DEFINER function to get parent team IDs without triggering RLS recursion

CREATE OR REPLACE FUNCTION get_parent_team_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
  SELECT tpa.team_id
  FROM team_parent_access tpa
  WHERE tpa.parent_id = (
    SELECT id FROM parent_profiles WHERE user_id = p_user_id LIMIT 1
  )
  AND tpa.status = 'active';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_parent_team_ids(UUID) TO authenticated;

-- Allow parents to view teams they have access to
DROP POLICY IF EXISTS "Parents can view their teams" ON teams;
CREATE POLICY "Parents can view their teams"
  ON teams FOR SELECT
  USING (
    id IN (SELECT get_parent_team_ids(auth.uid()))
  );
