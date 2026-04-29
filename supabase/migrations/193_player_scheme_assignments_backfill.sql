-- ============================================================================
-- Migration 193: Backfill player_scheme_assignments from position_depths
-- ============================================================================
-- Reads every player's position_depths JSONB and inserts one
-- player_scheme_assignments row per [slot_code, depth] pair, where the
-- slot_code matches a scheme_positions row in one of the team's default
-- schemes.
--
-- Skipped pairs (slot_code doesn't match any default scheme slot) are
-- logged to _backfill_skipped_assignments for review.
--
-- A pre-backfill snapshot of position_depths is taken into
-- _backfill_position_depths_snapshot so the JSONB data isn't lost when
-- 5D drops the column.
--
-- Prerequisites:
--   - Migration 190 (scheme tables exist)
--   - Migration 192 (team_schemes / scheme_positions seeded for old teams)
--
-- Idempotent: ON CONFLICT DO NOTHING. Re-running won't duplicate rows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Snapshot players.position_depths before backfill
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS _backfill_position_depths_snapshot (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL,
  position_depths JSONB,
  snapshotted_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE _backfill_position_depths_snapshot IS
  'Pre-backfill snapshot of players.position_depths captured by migration 193. Retain until position_depths column is dropped (Phase 2 Batch 5D) and assignments are verified in production.';

INSERT INTO _backfill_position_depths_snapshot (player_id, team_id, position_depths)
SELECT id, team_id, position_depths
FROM players
WHERE position_depths IS NOT NULL
  AND position_depths != '{}'::jsonb
ON CONFLICT (player_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Audit log for skipped pairs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS _backfill_skipped_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID,
  team_id UUID,
  legacy_slot_code TEXT,
  legacy_depth INTEGER,
  reason TEXT,
  logged_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE _backfill_skipped_assignments IS
  'Pairs from players.position_depths that did not map to any scheme_positions row in the team default schemes. Coach can re-assign manually.';

CREATE INDEX IF NOT EXISTS idx_backfill_skipped_team ON _backfill_skipped_assignments(team_id);

-- ---------------------------------------------------------------------------
-- 3. Backfill — for each player, expand position_depths and try to match
-- ---------------------------------------------------------------------------

WITH expanded AS (
  -- Expand each player's JSONB into one row per [slot_code, depth] pair
  SELECT
    p.id   AS player_id,
    p.team_id,
    kv.key AS legacy_slot,
    (kv.value)::int AS legacy_depth
  FROM players p
  CROSS JOIN LATERAL jsonb_each(p.position_depths) AS kv
  WHERE p.position_depths IS NOT NULL
    AND p.position_depths != '{}'::jsonb
),
matched AS (
  -- Find scheme_positions row for each pair (any default scheme on the team)
  SELECT
    e.player_id,
    e.team_id,
    e.legacy_slot,
    e.legacy_depth,
    sp.id AS scheme_position_id
  FROM expanded e
  LEFT JOIN team_schemes ts
    ON ts.team_id = e.team_id
   AND ts.is_default = true
  LEFT JOIN scheme_positions sp
    ON sp.scheme_id = ts.id
   AND sp.slot_code = e.legacy_slot
)

-- Insert matches
INSERT INTO player_scheme_assignments (player_id, scheme_position_id, depth)
SELECT player_id, scheme_position_id, legacy_depth
FROM matched
WHERE scheme_position_id IS NOT NULL
  AND legacy_depth BETWEEN 1 AND 5
ON CONFLICT (player_id, scheme_position_id) DO NOTHING;

-- Log unmatched
WITH expanded AS (
  SELECT
    p.id   AS player_id,
    p.team_id,
    kv.key AS legacy_slot,
    (kv.value)::int AS legacy_depth
  FROM players p
  CROSS JOIN LATERAL jsonb_each(p.position_depths) AS kv
  WHERE p.position_depths IS NOT NULL
    AND p.position_depths != '{}'::jsonb
),
unmatched AS (
  SELECT
    e.player_id,
    e.team_id,
    e.legacy_slot,
    e.legacy_depth
  FROM expanded e
  WHERE NOT EXISTS (
    SELECT 1
    FROM team_schemes ts
    JOIN scheme_positions sp ON sp.scheme_id = ts.id
    WHERE ts.team_id = e.team_id
      AND ts.is_default = true
      AND sp.slot_code = e.legacy_slot
  )
)
INSERT INTO _backfill_skipped_assignments (player_id, team_id, legacy_slot_code, legacy_depth, reason)
SELECT
  player_id,
  team_id,
  legacy_slot,
  legacy_depth,
  'no matching slot_code in team default schemes'
FROM unmatched;

-- Log out-of-range depths (defensive — shouldn't happen given pre-existing CHECK)
INSERT INTO _backfill_skipped_assignments (player_id, team_id, legacy_slot_code, legacy_depth, reason)
SELECT
  p.id,
  p.team_id,
  kv.key,
  (kv.value)::int,
  'depth out of range (must be 1-5)'
FROM players p
CROSS JOIN LATERAL jsonb_each(p.position_depths) AS kv
WHERE p.position_depths IS NOT NULL
  AND p.position_depths != '{}'::jsonb
  AND ((kv.value)::int < 1 OR (kv.value)::int > 5);

-- ---------------------------------------------------------------------------
-- 4. Summary report — visible in migration logs
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  total_psa INTEGER;
  total_skipped INTEGER;
  total_snapshotted INTEGER;
BEGIN
  SELECT count(*) INTO total_psa FROM player_scheme_assignments;
  SELECT count(*) INTO total_skipped FROM _backfill_skipped_assignments;
  SELECT count(*) INTO total_snapshotted FROM _backfill_position_depths_snapshot;
  RAISE NOTICE 'Migration 193 backfill summary: % PSA rows, % skipped pairs, % player snapshots',
    total_psa, total_skipped, total_snapshotted;
END $$;
