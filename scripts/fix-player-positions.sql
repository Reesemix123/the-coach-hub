-- Fix Player Positions Script
-- This script updates players to have standard position codes

-- First, show current state
\echo 'Current player positions:'
SELECT
  jersey_number AS "#",
  first_name,
  last_name,
  primary_position AS "Current Pos",
  position_group AS "Group",
  position_depths AS "Position Depths"
FROM players
WHERE is_active = true
ORDER BY jersey_number;

\echo ''
\echo 'Standard Position Codes:'
\echo 'OFFENSE: QB, RB, FB, WR, TE, X, Y, Z, LT, LG, C, RG, RT'
\echo 'DEFENSE: DE, DT, DT1, DT2, NT, LB, MLB, SAM, WILL, LCB, RCB, S, FS, SS'
\echo 'SPECIAL TEAMS: K, P, LS, H, KR, PR'
\echo ''

-- BEGIN TRANSACTION to allow rollback if needed
BEGIN;

-- Fix players based on their names (common test player naming patterns)
-- You'll need to customize this based on your actual player names

-- Example: If you have a player named "QB Test", set them to QB
UPDATE players
SET
  primary_position = 'QB',
  position_group = 'offense',
  position_depths = '{"QB": 1}'::jsonb
WHERE
  (first_name ILIKE '%QB%' OR last_name ILIKE '%QB%' OR first_name || ' ' || last_name ILIKE '%quarterback%')
  AND primary_position != 'QB';

-- Example: RB Test -> RB
UPDATE players
SET
  primary_position = 'RB',
  position_group = 'offense',
  position_depths = '{"RB": 1}'::jsonb
WHERE
  (first_name ILIKE '%RB%' OR last_name ILIKE '%RB%' OR first_name || ' ' || last_name ILIKE '%running%back%')
  AND primary_position != 'RB';

-- WR Test -> WR (or X for split end)
UPDATE players
SET
  primary_position = 'X',
  position_group = 'offense',
  position_depths = '{"X": 1}'::jsonb
WHERE
  (first_name ILIKE '%WR%' OR last_name ILIKE '%WR%' OR first_name || ' ' || last_name ILIKE '%receiver%')
  AND primary_position NOT IN ('X', 'Y', 'Z', 'WR');

-- TE Test -> TE
UPDATE players
SET
  primary_position = 'TE',
  position_group = 'offense',
  position_depths = '{"TE": 1}'::jsonb
WHERE
  (first_name ILIKE '%TE%' OR last_name ILIKE '%TE%' OR first_name || ' ' || last_name ILIKE '%tight%end%')
  AND primary_position != 'TE';

-- OL positions (LT, LG, C, RG, RT)
UPDATE players
SET
  primary_position = 'LT',
  position_group = 'offense',
  position_depths = '{"LT": 1}'::jsonb
WHERE
  (first_name ILIKE '%LT%' OR first_name || ' ' || last_name ILIKE '%left%tackle%')
  AND primary_position != 'LT';

UPDATE players
SET
  primary_position = 'LG',
  position_group = 'offense',
  position_depths = '{"LG": 1}'::jsonb
WHERE
  (first_name ILIKE '%LG%' OR first_name || ' ' || last_name ILIKE '%left%guard%')
  AND primary_position != 'LG';

UPDATE players
SET
  primary_position = 'C',
  position_group = 'offense',
  position_depths = '{"C": 1}'::jsonb
WHERE
  (first_name ILIKE '%C %' OR first_name = 'C' OR first_name || ' ' || last_name ILIKE '%center%')
  AND primary_position != 'C'
  AND position_group != 'defense'; -- Exclude if it's a cornerback

UPDATE players
SET
  primary_position = 'RG',
  position_group = 'offense',
  position_depths = '{"RG": 1}'::jsonb
WHERE
  (first_name ILIKE '%RG%' OR first_name || ' ' || last_name ILIKE '%right%guard%')
  AND primary_position != 'RG';

UPDATE players
SET
  primary_position = 'RT',
  position_group = 'offense',
  position_depths = '{"RT": 1}'::jsonb
WHERE
  (first_name ILIKE '%RT%' OR first_name || ' ' || last_name ILIKE '%right%tackle%')
  AND primary_position != 'RT';

-- Defensive positions
UPDATE players
SET
  primary_position = 'DE',
  position_group = 'defense',
  position_depths = '{"DE": 1}'::jsonb
WHERE
  (first_name ILIKE '%DE%' OR first_name || ' ' || last_name ILIKE '%defensive%end%')
  AND primary_position != 'DE';

UPDATE players
SET
  primary_position = 'DT',
  position_group = 'defense',
  position_depths = '{"DT": 1}'::jsonb
WHERE
  (first_name ILIKE '%DT%' OR first_name || ' ' || last_name ILIKE '%defensive%tackle%' OR first_name || ' ' || last_name ILIKE '%nose%tackle%')
  AND primary_position NOT IN ('DT', 'DT1', 'DT2', 'NT');

UPDATE players
SET
  primary_position = 'LB',
  position_group = 'defense',
  position_depths = '{"LB": 1}'::jsonb
WHERE
  (first_name ILIKE '%LB%' OR first_name || ' ' || last_name ILIKE '%linebacker%')
  AND primary_position NOT IN ('LB', 'MLB', 'SAM', 'WILL');

UPDATE players
SET
  primary_position = 'LCB',
  position_group = 'defense',
  position_depths = '{"LCB": 1}'::jsonb
WHERE
  (first_name ILIKE '%CB%' OR first_name || ' ' || last_name ILIKE '%corner%')
  AND primary_position NOT IN ('LCB', 'RCB', 'CB');

UPDATE players
SET
  primary_position = 'S',
  position_group = 'defense',
  position_depths = '{"S": 1}'::jsonb
WHERE
  (first_name ILIKE '%S %' OR first_name = 'S' OR first_name || ' ' || last_name ILIKE '%safety%')
  AND primary_position NOT IN ('S', 'FS', 'SS')
  AND position_group != 'offense'; -- Exclude if it might be slot receiver

-- Show the updated players
\echo ''
\echo 'Updated player positions:'
SELECT
  jersey_number AS "#",
  first_name,
  last_name,
  primary_position AS "New Pos",
  position_group AS "Group",
  position_depths AS "Position Depths"
FROM players
WHERE is_active = true
ORDER BY jersey_number;

-- IMPORTANT: Review the changes above before committing!
-- To apply changes: COMMIT;
-- To undo changes: ROLLBACK;

\echo ''
\echo '==================================================================='
\echo 'REVIEW THE CHANGES ABOVE'
\echo 'If correct, type: COMMIT;'
\echo 'If incorrect, type: ROLLBACK; and manually update'
\echo '==================================================================='
