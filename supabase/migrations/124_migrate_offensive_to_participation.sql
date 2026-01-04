-- ============================================================================
-- Migration 124: Migrate Offensive Attributions to Player Participation
-- ============================================================================
-- PURPOSE:
--   Migrate existing ball_carrier_id, qb_id, target_id from play_instances
--   to player_participation records. This is the data migration step of the
--   unified player participation model.
--
-- DATA FLOW:
--   play_instances.ball_carrier_id → player_participation (type='rusher')
--   play_instances.qb_id → player_participation (type='passer')
--   play_instances.target_id → player_participation (type='receiver')
--
-- NOTES:
--   - Old columns are kept in play_instances as backup (not dropped)
--   - Result fields (yards_gained, is_touchdown, etc.) are denormalized
--   - Phase is set based on play_type (special teams detection)
-- ============================================================================

-- ============================================================================
-- Step 1: Migrate ball_carrier_id → 'rusher' or 'returner' participation
-- ============================================================================

INSERT INTO player_participation (
  play_instance_id,
  player_id,
  team_id,
  participation_type,
  phase,
  yards_gained,
  is_touchdown,
  is_first_down,
  is_turnover,
  created_at,
  updated_at
)
SELECT
  pi.id,
  pi.ball_carrier_id,
  pi.team_id,
  -- Use 'returner' for special teams plays, 'rusher' for regular offense
  CASE
    WHEN pi.play_type IN ('kick', 'punt') THEN 'returner'
    ELSE 'rusher'
  END,
  -- Set phase based on play_type
  CASE
    WHEN pi.play_type IN ('kick', 'punt', 'pat', 'two_point') THEN 'special_teams'
    ELSE 'offense'
  END,
  pi.yards_gained,
  COALESCE(pi.is_touchdown, pi.scoring_type = 'touchdown', FALSE),
  COALESCE(pi.resulted_in_first_down, FALSE),
  COALESCE(pi.is_turnover, FALSE),
  COALESCE(pi.created_at, NOW()),
  NOW()
FROM play_instances pi
WHERE pi.ball_carrier_id IS NOT NULL
  -- Avoid duplicates if migration is re-run
  AND NOT EXISTS (
    SELECT 1 FROM player_participation pp
    WHERE pp.play_instance_id = pi.id
      AND pp.player_id = pi.ball_carrier_id
      AND pp.participation_type IN ('rusher', 'returner')
  );

-- ============================================================================
-- Step 2: Migrate qb_id → 'passer' participation
-- ============================================================================

INSERT INTO player_participation (
  play_instance_id,
  player_id,
  team_id,
  participation_type,
  phase,
  yards_gained,
  is_touchdown,
  is_first_down,
  is_turnover,
  created_at,
  updated_at
)
SELECT
  pi.id,
  pi.qb_id,
  pi.team_id,
  'passer',
  'offense',
  pi.yards_gained,
  COALESCE(pi.is_touchdown, pi.scoring_type = 'touchdown', FALSE),
  COALESCE(pi.resulted_in_first_down, FALSE),
  COALESCE(pi.is_turnover, FALSE),
  COALESCE(pi.created_at, NOW()),
  NOW()
FROM play_instances pi
WHERE pi.qb_id IS NOT NULL
  -- Avoid duplicates if migration is re-run
  AND NOT EXISTS (
    SELECT 1 FROM player_participation pp
    WHERE pp.play_instance_id = pi.id
      AND pp.player_id = pi.qb_id
      AND pp.participation_type = 'passer'
  );

-- ============================================================================
-- Step 3: Migrate target_id → 'receiver' participation
-- ============================================================================

INSERT INTO player_participation (
  play_instance_id,
  player_id,
  team_id,
  participation_type,
  phase,
  yards_gained,
  is_touchdown,
  is_first_down,
  is_turnover,
  created_at,
  updated_at
)
SELECT
  pi.id,
  pi.target_id,
  pi.team_id,
  'receiver',
  'offense',
  pi.yards_gained,
  COALESCE(pi.is_touchdown, pi.scoring_type = 'touchdown', FALSE),
  COALESCE(pi.resulted_in_first_down, FALSE),
  COALESCE(pi.is_turnover, FALSE),
  COALESCE(pi.created_at, NOW()),
  NOW()
FROM play_instances pi
WHERE pi.target_id IS NOT NULL
  -- Avoid duplicates if migration is re-run
  AND NOT EXISTS (
    SELECT 1 FROM player_participation pp
    WHERE pp.play_instance_id = pi.id
      AND pp.player_id = pi.target_id
      AND pp.participation_type = 'receiver'
  );

-- ============================================================================
-- Step 4: Verification Queries
-- ============================================================================

-- Count records migrated
DO $$
DECLARE
  ball_carrier_count BIGINT;
  rusher_count BIGINT;
  qb_count BIGINT;
  passer_count BIGINT;
  target_count BIGINT;
  receiver_count BIGINT;
BEGIN
  -- Source counts (play_instances)
  SELECT COUNT(*) INTO ball_carrier_count
  FROM play_instances WHERE ball_carrier_id IS NOT NULL;

  SELECT COUNT(*) INTO qb_count
  FROM play_instances WHERE qb_id IS NOT NULL;

  SELECT COUNT(*) INTO target_count
  FROM play_instances WHERE target_id IS NOT NULL;

  -- Destination counts (player_participation)
  SELECT COUNT(*) INTO rusher_count
  FROM player_participation WHERE participation_type IN ('rusher', 'returner');

  SELECT COUNT(*) INTO passer_count
  FROM player_participation WHERE participation_type = 'passer';

  SELECT COUNT(*) INTO receiver_count
  FROM player_participation WHERE participation_type = 'receiver';

  RAISE NOTICE '========== MIGRATION VERIFICATION ==========';
  RAISE NOTICE 'ball_carrier_id records: % → rusher/returner records: %', ball_carrier_count, rusher_count;
  RAISE NOTICE 'qb_id records: % → passer records: %', qb_count, passer_count;
  RAISE NOTICE 'target_id records: % → receiver records: %', target_count, receiver_count;

  IF ball_carrier_count = rusher_count AND qb_count = passer_count AND target_count = receiver_count THEN
    RAISE NOTICE 'SUCCESS: All records migrated correctly!';
  ELSE
    RAISE WARNING 'WARNING: Record counts do not match. Check for issues.';
  END IF;
END $$;

-- Show breakdown by phase
DO $$
DECLARE
  phase_rec RECORD;
BEGIN
  RAISE NOTICE 'Updated breakdown by phase:';
  FOR phase_rec IN
    SELECT phase, COUNT(*) as count
    FROM player_participation
    GROUP BY phase
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  %: %', phase_rec.phase, phase_rec.count;
  END LOOP;
END $$;

-- Show breakdown by participation_type
DO $$
DECLARE
  type_rec RECORD;
BEGIN
  RAISE NOTICE 'Breakdown by participation_type:';
  FOR type_rec IN
    SELECT participation_type, COUNT(*) as count
    FROM player_participation
    GROUP BY participation_type
    ORDER BY count DESC
    LIMIT 20
  LOOP
    RAISE NOTICE '  %: %', type_rec.participation_type, type_rec.count;
  END LOOP;
END $$;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- The old columns (ball_carrier_id, qb_id, target_id) are intentionally kept
-- in play_instances as a backup. They can be dropped in a future migration
-- after the new system is validated.
--
-- Next steps:
-- 1. Update TypeScript types (Phase 3)
-- 2. Update tagging UI to write to participation table only (Phase 4)
-- 3. Update analytics service to read from participation table only (Phase 5)
-- ============================================================================
