-- Check if there's any OL data in player_participation table

-- 1. Count OL participation records
SELECT
  participation_type,
  COUNT(*) as record_count,
  COUNT(DISTINCT player_id) as unique_players,
  COUNT(DISTINCT play_instance_id) as unique_plays
FROM player_participation
WHERE participation_type IN ('ol_lt', 'ol_lg', 'ol_c', 'ol_rg', 'ol_rt')
GROUP BY participation_type
ORDER BY participation_type;

-- 2. Show sample OL records with player and game details
SELECT
  pp.participation_type,
  pp.result as block_result,
  p.first_name || ' ' || p.last_name as player_name,
  p.jersey_number,
  p.primary_position,
  pp.team_id
FROM player_participation pp
JOIN players p ON pp.player_id = p.id
WHERE pp.participation_type IN ('ol_lt', 'ol_lg', 'ol_c', 'ol_rg', 'ol_rt')
LIMIT 20;

-- 3. Count block results by position
SELECT
  participation_type,
  result as block_result,
  COUNT(*) as count
FROM player_participation
WHERE participation_type IN ('ol_lt', 'ol_lg', 'ol_c', 'ol_rg', 'ol_rt')
GROUP BY participation_type, result
ORDER BY participation_type, result;

-- 4. Check if there are OLD duplicate columns still being used
SELECT
  COUNT(*) as plays_with_old_ol_columns,
  COUNT(lt_id) as plays_with_lt,
  COUNT(lg_id) as plays_with_lg,
  COUNT(c_id) as plays_with_c,
  COUNT(rg_id) as plays_with_rg,
  COUNT(rt_id) as plays_with_rt
FROM play_instances;
