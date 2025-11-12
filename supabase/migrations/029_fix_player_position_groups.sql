-- Migration 029: Add missing position columns to players table
-- The players table is missing primary_position, secondary_position, position_group, and depth_order

-- Add primary_position column
ALTER TABLE players
ADD COLUMN IF NOT EXISTS primary_position VARCHAR(20);

-- Add secondary_position column
ALTER TABLE players
ADD COLUMN IF NOT EXISTS secondary_position VARCHAR(20);

-- Add position_group column with constraint
ALTER TABLE players
ADD COLUMN IF NOT EXISTS position_group VARCHAR(20);

-- Add depth_order column
ALTER TABLE players
ADD COLUMN IF NOT EXISTS depth_order INTEGER DEFAULT 1;

-- Add constraint to position_group if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_position_group_check'
  ) THEN
    ALTER TABLE players
    ADD CONSTRAINT players_position_group_check
    CHECK (position_group IN ('offense', 'defense', 'special_teams'));
  END IF;
END $$;

-- Extract first position from position_depths JSONB and set as primary_position
UPDATE players
SET primary_position = (
  SELECT jsonb_object_keys(position_depths)
  LIMIT 1
)
WHERE primary_position IS NULL AND position_depths != '{}'::jsonb;

-- Set position_group based on primary_position - OFFENSE
UPDATE players
SET position_group = 'offense'
WHERE primary_position IN ('QB', 'RB', 'FB', 'WR', 'TE', 'X', 'Y', 'Z', 'SWR', 'LT', 'LG', 'C', 'RG', 'RT', 'OL')
  AND (position_group IS NULL OR position_group != 'offense');

-- Set position_group based on primary_position - DEFENSE
UPDATE players
SET position_group = 'defense'
WHERE primary_position IN ('DE', 'DT', 'DT1', 'DT2', 'NT', 'LB', 'MLB', 'OLB', 'ILB', 'SAM', 'WILL', 'MIKE', 'CB', 'LCB', 'RCB', 'S', 'FS', 'SS', 'DB')
  AND (position_group IS NULL OR position_group != 'defense');

-- Set position_group based on primary_position - SPECIAL TEAMS
UPDATE players
SET position_group = 'special_teams'
WHERE primary_position IN ('K', 'P', 'LS', 'H', 'KR', 'PR')
  AND (position_group IS NULL OR position_group != 'special_teams');

-- Log results
DO $$
DECLARE
  total_count INTEGER;
  offense_count INTEGER;
  defense_count INTEGER;
  special_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM players;
  SELECT COUNT(*) INTO offense_count FROM players WHERE position_group = 'offense';
  SELECT COUNT(*) INTO defense_count FROM players WHERE position_group = 'defense';
  SELECT COUNT(*) INTO special_count FROM players WHERE position_group = 'special_teams';

  RAISE NOTICE 'Total players: %', total_count;
  RAISE NOTICE 'Position groups: % offense, % defense, % special teams',
    offense_count, defense_count, special_count;
END $$;
