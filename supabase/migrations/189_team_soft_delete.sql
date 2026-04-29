-- ============================================================================
-- Migration 189: Team soft-delete support
--
--   1. Re-ensure the SECURITY DEFINER helper functions used by RLS policies
--      exist (these were originally defined in migrations 065 and 145, but
--      may be missing on environments where those migrations were never
--      applied or were partially rolled back).
--   2. Add deleted_at column + partial index for active-team queries.
--   3. Update RLS SELECT policies on teams to filter out archived teams
--      from user reads (UPDATE/INSERT/DELETE policies stay unchanged so the
--      archive endpoint can still write to an already-archived team).
--   4. Fix games.opponent_team_id FK so a future hard purge wouldn't be
--      blocked: change ON DELETE behavior to SET NULL.
--
-- Apply via: supabase db push  (or paste into the SQL editor)
-- ============================================================================

-- ---------- 0. RLS helper functions (idempotent) ----------

-- Returns team IDs the current user owns or is an active member of.
-- SECURITY DEFINER bypasses RLS to avoid recursion with the teams policies.
-- Originally defined in migration 065. Re-asserted here so this migration is
-- self-contained.
CREATE OR REPLACE FUNCTION get_user_team_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM teams WHERE user_id = auth.uid()
  UNION
  SELECT team_id FROM team_memberships
    WHERE user_id = auth.uid() AND is_active = true
$$;

GRANT EXECUTE ON FUNCTION get_user_team_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_team_ids() TO anon;

-- Returns team IDs the given parent user has active access to via
-- team_parent_access. Originally defined in migration 145.
CREATE OR REPLACE FUNCTION get_parent_team_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tpa.team_id
  FROM team_parent_access tpa
  WHERE tpa.parent_id = (
    SELECT id FROM parent_profiles WHERE user_id = p_user_id LIMIT 1
  )
  AND tpa.status = 'active'
$$;

GRANT EXECUTE ON FUNCTION get_parent_team_ids(UUID) TO authenticated;

-- ---------- 1. Soft-delete column ----------

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN teams.deleted_at IS
  'Soft-delete timestamp. NULL = active, non-NULL = archived. Set by /api/teams/[teamId]/archive. RLS hides archived teams from non-admin reads.';

-- Partial index: only active teams are indexed. Most reads are
-- ".. WHERE deleted_at IS NULL", which scan-skips archived rows entirely.
CREATE INDEX IF NOT EXISTS idx_teams_deleted_at
  ON teams(deleted_at) WHERE deleted_at IS NULL;

-- ---------- 2. RLS SELECT policies ----------

-- Coach / member view (replaces policy from migration 065)
DROP POLICY IF EXISTS "teams_select_policy" ON teams;
CREATE POLICY "teams_select_policy"
  ON teams FOR SELECT
  USING (
    id IN (SELECT get_user_team_ids())
    AND deleted_at IS NULL
  );

-- Parent view (replaces policy from migration 145)
DROP POLICY IF EXISTS "Parents can view their teams" ON teams;
CREATE POLICY "Parents can view their teams"
  ON teams FOR SELECT
  USING (
    id IN (SELECT get_parent_team_ids(auth.uid()))
    AND deleted_at IS NULL
  );

-- ---------- 3. Fix games.opponent_team_id FK ----------

-- Currently has no ON DELETE clause (defaults to NO ACTION), which would
-- block a future hard purge of any team that's been recorded as someone
-- else's opponent. SET NULL preserves the historical game record while
-- letting the team row go.
ALTER TABLE games
  DROP CONSTRAINT IF EXISTS games_opponent_team_id_fkey;

ALTER TABLE games
  ADD CONSTRAINT games_opponent_team_id_fkey
  FOREIGN KEY (opponent_team_id) REFERENCES teams(id) ON DELETE SET NULL;
