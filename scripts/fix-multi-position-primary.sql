-- Fix Primary Position for Multi-Position Players
-- This script intelligently sets primary_position to the most important position
-- Priority: Offense/Defense positions > Special Teams positions

-- Show current state
\echo 'Players with multiple positions:'
SELECT
  jersey_number AS "#",
  first_name || ' ' || last_name AS "Name",
  primary_position AS "Current Primary",
  position_group AS "Group",
  position_depths AS "All Positions"
FROM players
WHERE is_active = true
  AND jsonb_object_keys(position_depths) IS NOT NULL
ORDER BY jersey_number::int;

BEGIN;

-- Define position priority function
-- Returns the highest priority position from a player's position_depths
CREATE OR REPLACE FUNCTION get_primary_position(pos_depths JSONB)
RETURNS TEXT AS $$
DECLARE
  positions TEXT[];
  pos TEXT;
BEGIN
  -- Get all position keys from JSONB
  SELECT array_agg(key ORDER BY value::int)
  INTO positions
  FROM jsonb_each_text(pos_depths);

  -- Priority 1: Offensive skill positions (QB, RB, FB, WR/X/Y/Z, TE)
  FOREACH pos IN ARRAY positions LOOP
    IF pos IN ('QB', 'RB', 'FB', 'X', 'Y', 'Z', 'TE') THEN
      RETURN pos;
    END IF;
  END LOOP;

  -- Priority 2: Offensive line (LT, LG, C, RG, RT)
  FOREACH pos IN ARRAY positions LOOP
    IF pos IN ('LT', 'LG', 'C', 'RG', 'RT') THEN
      RETURN pos;
    END IF;
  END LOOP;

  -- Priority 3: Defensive backs (LCB, RCB, S, FS, SS, CB)
  FOREACH pos IN ARRAY positions LOOP
    IF pos IN ('LCB', 'RCB', 'S', 'FS', 'SS', 'CB') THEN
      RETURN pos;
    END IF;
  END LOOP;

  -- Priority 4: Linebackers (LB, MLB, SAM, WILL, OLB, ILB)
  FOREACH pos IN ARRAY positions LOOP
    IF pos IN ('LB', 'MLB', 'SAM', 'WILL', 'OLB', 'ILB') THEN
      RETURN pos;
    END IF;
  END LOOP;

  -- Priority 5: Defensive line (DE, DT, DT1, DT2, NT)
  FOREACH pos IN ARRAY positions LOOP
    IF pos IN ('DE', 'DT', 'DT1', 'DT2', 'NT') THEN
      RETURN pos;
    END IF;
  END LOOP;

  -- Priority 6: Special teams (lowest priority)
  FOREACH pos IN ARRAY positions LOOP
    IF pos IN ('K', 'P', 'LS', 'H', 'KR', 'PR') THEN
      RETURN pos;
    END IF;
  END LOOP;

  -- Fallback: return first position
  RETURN positions[1];
END;
$$ LANGUAGE plpgsql;

-- Update all players' primary_position using smart priority
UPDATE players
SET primary_position = get_primary_position(position_depths)
WHERE position_depths IS NOT NULL
  AND position_depths != '{}'::jsonb;

-- Update position_group based on new primary_position
UPDATE players
SET position_group = CASE
  WHEN primary_position IN ('QB', 'RB', 'FB', 'WR', 'TE', 'X', 'Y', 'Z', 'SWR', 'LT', 'LG', 'C', 'RG', 'RT', 'OL')
    THEN 'offense'
  WHEN primary_position IN ('DE', 'DT', 'DT1', 'DT2', 'NT', 'LB', 'MLB', 'OLB', 'ILB', 'SAM', 'WILL', 'MIKE', 'CB', 'LCB', 'RCB', 'S', 'FS', 'SS', 'DB')
    THEN 'defense'
  WHEN primary_position IN ('K', 'P', 'LS', 'H', 'KR', 'PR')
    THEN 'special_teams'
  ELSE position_group
END
WHERE primary_position IS NOT NULL;

-- Show updated state
\echo ''
\echo 'Updated players:'
SELECT
  jersey_number AS "#",
  first_name || ' ' || last_name AS "Name",
  primary_position AS "New Primary",
  position_group AS "Group",
  position_depths AS "All Positions"
FROM players
WHERE is_active = true
ORDER BY jersey_number::int;

-- Cleanup function
DROP FUNCTION get_primary_position(JSONB);

\echo ''
\echo '==================================================================='
\echo 'EXPLANATION:'
\echo 'primary_position is now set to the most important position for stats'
\echo 'Priority: Skill positions > OL > DBs > LBs > DL > Special Teams'
\echo ''
\echo 'Example: A player with {"H": 1, "QB": 2} now has primary_position="QB"'
\echo '         because QB is higher priority than H (Holder)'
\echo ''
\echo 'All positions are still preserved in position_depths for depth charts'
\echo '==================================================================='
\echo ''
\echo 'If correct, type: COMMIT;'
\echo 'If incorrect, type: ROLLBACK;'
