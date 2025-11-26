-- ============================================================================
-- Check if tagged plays are creating player_participation records
-- ============================================================================

-- 1. Check total player_participation records
SELECT COUNT(*) as total_participations FROM player_participation;

-- 2. Show most recent participations (should include your newly tagged play)
SELECT
  pp.participation_type,
  pp.result,
  p.first_name || ' ' || p.last_name as player_name,
  p.jersey_number,
  pi.play_code,
  pi.down,
  pi.distance,
  pi.yards_gained,
  pp.created_at
FROM player_participation pp
JOIN players p ON p.id = pp.player_id
JOIN play_instances pi ON pi.id = pp.play_instance_id
ORDER BY pp.created_at DESC
LIMIT 20;

-- 3. Check breakdown by participation type
SELECT
  participation_type,
  COUNT(*) as count
FROM player_participation
GROUP BY participation_type
ORDER BY count DESC;

-- 4. Show players with ANY participations (should match analytics)
SELECT
  p.jersey_number,
  p.first_name || ' ' || p.last_name as player_name,
  p.primary_position,
  COUNT(*) as total_participations
FROM player_participation pp
JOIN players p ON p.id = pp.player_id
GROUP BY p.id, p.jersey_number, p.first_name, p.last_name, p.primary_position
ORDER BY total_participations DESC;

-- ============================================================================
-- Expected Results:
-- ============================================================================
-- If your tagged play is working correctly, you should see:
-- 1. NEW records in query #2 with recent timestamps
-- 2. Participation types matching what you tagged (tackles, pressures, etc.)
-- 3. Players from query #4 should match what you see in analytics
-- ============================================================================
