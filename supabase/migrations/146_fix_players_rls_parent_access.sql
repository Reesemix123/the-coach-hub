-- Migration 146: Allow parents to view their linked players
--
-- Problem: players table RLS only allows coaches/owners to view players.
-- Parents need to see their own children's player records.

CREATE OR REPLACE FUNCTION get_parent_player_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
  SELECT ppl.player_id
  FROM player_parent_links ppl
  WHERE ppl.parent_id = (
    SELECT id FROM parent_profiles WHERE user_id = p_user_id LIMIT 1
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_parent_player_ids(UUID) TO authenticated;

-- Allow parents to view their children's player records
CREATE POLICY "Parents can view their children"
  ON players FOR SELECT
  USING (
    id IN (SELECT get_parent_player_ids(auth.uid()))
  );
