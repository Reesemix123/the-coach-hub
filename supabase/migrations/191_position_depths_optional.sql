-- ============================================================================
-- Migration 191: Make players.position_depths optional
--
-- Phase 2 Batch 1 of the position architecture redesign.
--
-- Migration 022 made position_depths NOT NULL with a CHECK constraint that
-- required a non-empty JSONB object. After Phase 1 introduced
-- primary_position_category_id, new player INSERTs that only write the
-- category id (without position_depths) fail the NOT-NULL + CHECK pair.
-- This migration relaxes both so the new path works while the column still
-- exists for legacy consumers.
--
-- The column itself stays for now — Phase 2 finishes migrating the 86
-- consumers and a later batch drops it.
-- ============================================================================

ALTER TABLE players DROP CONSTRAINT IF EXISTS valid_position_depths;
ALTER TABLE players ALTER COLUMN position_depths DROP NOT NULL;
ALTER TABLE players ALTER COLUMN position_depths SET DEFAULT '{}'::jsonb;

COMMENT ON COLUMN players.position_depths IS
  'DEPRECATED. Phase 1 of position architecture redesign moved depth assignments to player_scheme_assignments. Reads still work; new writes should target the new tables. Column is retained for legacy consumers and will be dropped in a future Phase 2 batch.';
