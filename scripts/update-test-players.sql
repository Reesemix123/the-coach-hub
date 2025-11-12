-- Update Test Players to Standard Positions
-- Customize this script based on your test players' jersey numbers

-- First, see current players
SELECT
  jersey_number AS "#",
  first_name || ' ' || last_name AS "Name",
  primary_position AS "Current Pos",
  position_group AS "Group"
FROM players
WHERE is_active = true
ORDER BY jersey_number::int;

-- ==========================================
-- CUSTOMIZE THESE UPDATES FOR YOUR ROSTER
-- ==========================================
-- Edit the jersey numbers and positions below to match your test players

BEGIN;

-- OFFENSE
-- Update Jersey #1 to QB
UPDATE players
SET
  primary_position = 'QB',
  position_group = 'offense',
  position_depths = '{"QB": 1}'::jsonb
WHERE jersey_number = '1' AND is_active = true;

-- Update Jersey #2 to RB
UPDATE players
SET
  primary_position = 'RB',
  position_group = 'offense',
  position_depths = '{"RB": 1}'::jsonb
WHERE jersey_number = '2' AND is_active = true;

-- Update Jersey #3 to FB
UPDATE players
SET
  primary_position = 'FB',
  position_group = 'offense',
  position_depths = '{"FB": 1}'::jsonb
WHERE jersey_number = '3' AND is_active = true;

-- Update Jersey #4 to WR/X (Split End)
UPDATE players
SET
  primary_position = 'X',
  position_group = 'offense',
  position_depths = '{"X": 1}'::jsonb
WHERE jersey_number = '4' AND is_active = true;

-- Update Jersey #5 to WR/Z (Flanker)
UPDATE players
SET
  primary_position = 'Z',
  position_group = 'offense',
  position_depths = '{"Z": 1}'::jsonb
WHERE jersey_number = '5' AND is_active = true;

-- Update Jersey #6 to TE
UPDATE players
SET
  primary_position = 'TE',
  position_group = 'offense',
  position_depths = '{"TE": 1}'::jsonb
WHERE jersey_number = '6' AND is_active = true;

-- OFFENSIVE LINE
-- Update Jersey #70 to LT
UPDATE players
SET
  primary_position = 'LT',
  position_group = 'offense',
  position_depths = '{"LT": 1}'::jsonb
WHERE jersey_number = '70' AND is_active = true;

-- Update Jersey #71 to LG
UPDATE players
SET
  primary_position = 'LG',
  position_group = 'offense',
  position_depths = '{"LG": 1}'::jsonb
WHERE jersey_number = '71' AND is_active = true;

-- Update Jersey #72 to C
UPDATE players
SET
  primary_position = 'C',
  position_group = 'offense',
  position_depths = '{"C": 1}'::jsonb
WHERE jersey_number = '72' AND is_active = true;

-- Update Jersey #73 to RG
UPDATE players
SET
  primary_position = 'RG',
  position_group = 'offense',
  position_depths = '{"RG": 1}'::jsonb
WHERE jersey_number = '73' AND is_active = true;

-- Update Jersey #74 to RT
UPDATE players
SET
  primary_position = 'RT',
  position_group = 'offense',
  position_depths = '{"RT": 1}'::jsonb
WHERE jersey_number = '74' AND is_active = true;

-- DEFENSE - DEFENSIVE LINE
-- Update Jersey #90 to DE
UPDATE players
SET
  primary_position = 'DE',
  position_group = 'defense',
  position_depths = '{"DE": 1}'::jsonb
WHERE jersey_number = '90' AND is_active = true;

-- Update Jersey #91 to DT
UPDATE players
SET
  primary_position = 'DT',
  position_group = 'defense',
  position_depths = '{"DT": 1}'::jsonb
WHERE jersey_number = '91' AND is_active = true;

-- Update Jersey #92 to NT (Nose Tackle)
UPDATE players
SET
  primary_position = 'NT',
  position_group = 'defense',
  position_depths = '{"NT": 1}'::jsonb
WHERE jersey_number = '92' AND is_active = true;

-- DEFENSE - LINEBACKERS
-- Update Jersey #50 to MLB (Middle Linebacker)
UPDATE players
SET
  primary_position = 'MLB',
  position_group = 'defense',
  position_depths = '{"MLB": 1}'::jsonb
WHERE jersey_number = '50' AND is_active = true;

-- Update Jersey #51 to SAM (Strong Side LB)
UPDATE players
SET
  primary_position = 'SAM',
  position_group = 'defense',
  position_depths = '{"SAM": 1}'::jsonb
WHERE jersey_number = '51' AND is_active = true;

-- Update Jersey #52 to WILL (Weak Side LB)
UPDATE players
SET
  primary_position = 'WILL',
  position_group = 'defense',
  position_depths = '{"WILL": 1}'::jsonb
WHERE jersey_number = '52' AND is_active = true;

-- DEFENSE - DEFENSIVE BACKS
-- Update Jersey #20 to LCB (Left Cornerback)
UPDATE players
SET
  primary_position = 'LCB',
  position_group = 'defense',
  position_depths = '{"LCB": 1}'::jsonb
WHERE jersey_number = '20' AND is_active = true;

-- Update Jersey #21 to RCB (Right Cornerback)
UPDATE players
SET
  primary_position = 'RCB',
  position_group = 'defense',
  position_depths = '{"RCB": 1}'::jsonb
WHERE jersey_number = '21' AND is_active = true;

-- Update Jersey #30 to FS (Free Safety)
UPDATE players
SET
  primary_position = 'FS',
  position_group = 'defense',
  position_depths = '{"FS": 1}'::jsonb
WHERE jersey_number = '30' AND is_active = true;

-- Update Jersey #31 to SS (Strong Safety)
UPDATE players
SET
  primary_position = 'SS',
  position_group = 'defense',
  position_depths = '{"SS": 1}'::jsonb
WHERE jersey_number = '31' AND is_active = true;

-- SPECIAL TEAMS
-- Update Jersey #7 to K (Kicker)
UPDATE players
SET
  primary_position = 'K',
  position_group = 'special_teams',
  position_depths = '{"K": 1}'::jsonb
WHERE jersey_number = '7' AND is_active = true;

-- Update Jersey #8 to P (Punter)
UPDATE players
SET
  primary_position = 'P',
  position_group = 'special_teams',
  position_depths = '{"P": 1}'::jsonb
WHERE jersey_number = '8' AND is_active = true;

-- Update Jersey #9 to H (Holder)
UPDATE players
SET
  primary_position = 'H',
  position_group = 'special_teams',
  position_depths = '{"H": 1}'::jsonb
WHERE jersey_number = '9' AND is_active = true;

-- Show updated players
SELECT
  jersey_number AS "#",
  first_name || ' ' || last_name AS "Name",
  primary_position AS "New Pos",
  position_group AS "Group"
FROM players
WHERE is_active = true
ORDER BY jersey_number::int;

-- If correct, commit the changes:
-- COMMIT;

-- If not correct, rollback:
-- ROLLBACK;

\echo ''
\echo '==================================================================='
\echo 'REVIEW THE CHANGES ABOVE'
\echo 'If correct, type: COMMIT;'
\echo 'If incorrect, type: ROLLBACK; and edit the script'
\echo '==================================================================='
