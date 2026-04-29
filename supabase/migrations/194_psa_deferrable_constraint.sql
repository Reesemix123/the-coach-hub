-- ============================================================================
-- Migration 194: Make player_scheme_assignments depth UNIQUE deferrable
-- ============================================================================
-- The UNIQUE (scheme_position_id, depth) constraint defined in migration 190
-- prevents two players from sharing the same depth at a slot. That's the
-- right invariant — but it makes naïve depth swaps fail because there's a
-- mid-state where both rows briefly hold the same depth.
--
-- Marking it DEFERRABLE INITIALLY DEFERRED lets the swap UI run two UPDATEs
-- inside a transaction; the constraint only checks at commit time, so the
-- intermediate violation is allowed.
-- ============================================================================

ALTER TABLE player_scheme_assignments
  DROP CONSTRAINT IF EXISTS player_scheme_assignments_scheme_position_id_depth_key;

ALTER TABLE player_scheme_assignments
  ADD CONSTRAINT player_scheme_assignments_scheme_position_id_depth_key
  UNIQUE (scheme_position_id, depth)
  DEFERRABLE INITIALLY DEFERRED;
