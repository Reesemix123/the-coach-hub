-- Manual Position Update Template
-- Use this to manually update specific players by their ID or jersey number

-- First, see all players to get their IDs
SELECT
  id,
  jersey_number,
  first_name,
  last_name,
  primary_position,
  position_group
FROM players
WHERE is_active = true
ORDER BY jersey_number;

-- ==========================================
-- MANUAL UPDATE EXAMPLES
-- Copy and modify the template you need
-- ==========================================

-- Update by player ID
-- UPDATE players
-- SET
--   primary_position = 'QB',
--   position_group = 'offense',
--   position_depths = '{"QB": 1}'::jsonb
-- WHERE id = 'your-player-id-here';

-- Update by jersey number
-- UPDATE players
-- SET
--   primary_position = 'RB',
--   position_group = 'offense',
--   position_depths = '{"RB": 1}'::jsonb
-- WHERE jersey_number = '1';

-- ==========================================
-- QUICK REFERENCE: POSITION CODES
-- ==========================================
--
-- OFFENSE:
--   QB   = Quarterback
--   RB   = Running Back
--   FB   = Fullback
--   X    = Split End (Outside WR)
--   Y    = Slot/TE (Inside receiver)
--   Z    = Flanker (Outside WR)
--   TE   = Tight End
--   LT   = Left Tackle
--   LG   = Left Guard
--   C    = Center
--   RG   = Right Guard
--   RT   = Right Tackle
--
-- DEFENSE:
--   DE   = Defensive End
--   DT   = Defensive Tackle
--   DT1  = Defensive Tackle 1
--   DT2  = Defensive Tackle 2
--   NT   = Nose Tackle
--   LB   = Linebacker
--   MLB  = Middle Linebacker
--   SAM  = Strong Side Linebacker
--   WILL = Weak Side Linebacker
--   LCB  = Left Cornerback
--   RCB  = Right Cornerback
--   S    = Safety
--   FS   = Free Safety
--   SS   = Strong Safety
--
-- SPECIAL TEAMS:
--   K    = Kicker
--   P    = Punter
--   LS   = Long Snapper
--   H    = Holder
--   KR   = Kick Returner
--   PR   = Punt Returner
--
-- ==========================================
-- EXAMPLE: Update test players
-- ==========================================

-- Example: Update Jersey #1 to be QB
UPDATE players
SET
  primary_position = 'QB',
  position_group = 'offense',
  position_depths = '{"QB": 1}'::jsonb
WHERE jersey_number = '1' AND is_active = true;

-- Example: Update Jersey #2 to be RB
UPDATE players
SET
  primary_position = 'RB',
  position_group = 'offense',
  position_depths = '{"RB": 1}'::jsonb
WHERE jersey_number = '2' AND is_active = true;

-- Example: Update Jersey #3 to be WR (using X position)
UPDATE players
SET
  primary_position = 'X',
  position_group = 'offense',
  position_depths = '{"X": 1}'::jsonb
WHERE jersey_number = '3' AND is_active = true;

-- Example: Update Jersey #10 to be DE
UPDATE players
SET
  primary_position = 'DE',
  position_group = 'defense',
  position_depths = '{"DE": 1}'::jsonb
WHERE jersey_number = '10' AND is_active = true;

-- Verify changes
SELECT
  jersey_number AS "#",
  first_name,
  last_name,
  primary_position AS "Pos",
  position_group AS "Group"
FROM players
WHERE is_active = true
ORDER BY jersey_number;
