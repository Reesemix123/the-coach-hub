-- ============================================================================
-- Debug Script: Why is player_participation INSERT failing?
-- ============================================================================

-- 1. Check your user ID
SELECT auth.uid() as my_user_id;

-- 2. Check what teams you own
SELECT 
  id as team_id,
  name as team_name,
  user_id as owner_id,
  CASE 
    WHEN user_id = auth.uid() THEN '✓ YOU OWN THIS'
    ELSE '✗ You do NOT own this'
  END as ownership
FROM teams
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check recent play instances and their team_ids
SELECT 
  pi.id as play_instance_id,
  pi.team_id,
  t.name as team_name,
  t.user_id as team_owner,
  CASE 
    WHEN t.user_id = auth.uid() THEN '✓ You own this team'
    ELSE '✗ You do NOT own this team'
  END as can_insert_participation
FROM play_instances pi
LEFT JOIN teams t ON t.id = pi.team_id
ORDER BY pi.created_at DESC
LIMIT 10;

-- 4. Test if you can manually insert a participation record
-- IMPORTANT: Replace these values with actual IDs from your data!
-- 
-- Example test insert (UNCOMMENT and modify):
-- INSERT INTO player_participation (
--   play_instance_id, 
--   team_id, 
--   player_id, 
--   participation_type, 
--   result
-- )
-- SELECT 
--   'YOUR_PLAY_INSTANCE_ID'::uuid,
--   'YOUR_TEAM_ID'::uuid,
--   'YOUR_PLAYER_ID'::uuid,
--   'primary_tackle',
--   'made'
-- WHERE EXISTS (
--   SELECT 1 FROM teams 
--   WHERE id = 'YOUR_TEAM_ID'::uuid 
--   AND user_id = auth.uid()
-- );

-- 5. Check if you have any existing participations
SELECT COUNT(*) as my_participations
FROM player_participation pp
WHERE EXISTS (
  SELECT 1 FROM teams t
  WHERE t.id = pp.team_id
  AND t.user_id = auth.uid()
);
