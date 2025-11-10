-- Migration 022: Multi-Position Player Support with Per-Position Depth Tracking
-- Remove backward compatibility and implement position_depths JSONB object
-- Each position has its own depth: {"QB": 1, "RB": 2, "S": 3}

-- Step 1: Add new position_depths JSONB column
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS position_depths JSONB DEFAULT '{}'::jsonb;

-- Step 2: Migrate existing data to new structure
-- Convert old positions/position_groups arrays or primary_position to position_depths object
-- Handle ALL players (both active and inactive)
UPDATE players
SET position_depths = (
  SELECT jsonb_object_agg(pos, COALESCE(depth_order, 1))
  FROM unnest(
    CASE
      -- Use new positions array if available (from previous incomplete migration)
      WHEN positions IS NOT NULL AND jsonb_typeof(positions) = 'array' AND jsonb_array_length(positions) > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(positions))
      -- Fallback to old primary_position + secondary_position
      WHEN primary_position IS NOT NULL
        THEN ARRAY[primary_position] ||
             CASE WHEN secondary_position IS NOT NULL
                  THEN ARRAY[secondary_position]
                  ELSE ARRAY[]::text[]
             END
      -- Last resort: empty array (will be handled by constraint)
      ELSE ARRAY[]::text[]
    END
  ) AS pos
  WHERE pos IS NOT NULL AND pos != ''
)
WHERE position_depths = '{}'::jsonb;

-- Step 3: For any players with empty position_depths, set a default
-- This catches any edge cases where the above query didn't populate data
UPDATE players
SET position_depths = '{"QB": 1}'::jsonb
WHERE position_depths = '{}'::jsonb;

-- Step 4: Set position_depths to NOT NULL
ALTER TABLE players
  ALTER COLUMN position_depths SET NOT NULL;

-- Step 5: Drop old columns (BREAKING CHANGE - removes backward compatibility)
ALTER TABLE players
  DROP COLUMN IF EXISTS primary_position,
  DROP COLUMN IF EXISTS secondary_position,
  DROP COLUMN IF EXISTS position_group,
  DROP COLUMN IF EXISTS positions,
  DROP COLUMN IF EXISTS position_groups,
  DROP COLUMN IF EXISTS depth_order;

-- Step 6: Drop old indexes if they exist
DROP INDEX IF EXISTS idx_players_positions;
DROP INDEX IF EXISTS idx_players_position_groups;
DROP INDEX IF EXISTS idx_players_position;
DROP INDEX IF EXISTS idx_players_depth;

-- Step 7: Add validation constraint
-- Ensure position_depths is an object and not empty
-- Note: Depth value validation (1-4) is handled at application layer
ALTER TABLE players
  ADD CONSTRAINT valid_position_depths CHECK (
    jsonb_typeof(position_depths) = 'object' AND
    position_depths != '{}'::jsonb
  );

-- Step 8: Add GIN index for efficient position queries
CREATE INDEX IF NOT EXISTS idx_players_position_depths ON players USING GIN (position_depths);

-- Step 9: Drop existing functions if they exist (from previous migration attempts)
DROP FUNCTION IF EXISTS player_positions(jsonb);
DROP FUNCTION IF EXISTS player_has_position(jsonb, text);
DROP FUNCTION IF EXISTS player_position_depth(jsonb, text);

-- Step 10: Add helper function to get positions for a player
CREATE FUNCTION player_positions(player_depths jsonb)
RETURNS text[] AS $$
  SELECT ARRAY(SELECT jsonb_object_keys(player_depths))
$$ LANGUAGE SQL IMMUTABLE;

-- Step 11: Add helper function to check if player plays a position
CREATE FUNCTION player_has_position(player_depths jsonb, pos text)
RETURNS boolean AS $$
  SELECT player_depths ? pos
$$ LANGUAGE SQL IMMUTABLE;

-- Step 12: Add helper function to get depth for a position
CREATE FUNCTION player_position_depth(player_depths jsonb, pos text)
RETURNS integer AS $$
  SELECT COALESCE((player_depths->>pos)::integer, NULL)
$$ LANGUAGE SQL IMMUTABLE;

-- Step 13: Add documentation
COMMENT ON COLUMN players.position_depths IS 'JSONB object mapping position codes to depth orders. Example: {"QB": 1, "RB": 2, "S": 3} means 1st team QB, 2nd team RB, 3rd team Safety';

-- Example queries:
-- Get all players who play QB:
--   SELECT * FROM players WHERE position_depths ? 'QB';
-- Get 1st team QBs:
--   SELECT * FROM players WHERE position_depths @> '{"QB": 1}'::jsonb;
-- Get all QBs or RBs:
--   SELECT * FROM players WHERE position_depths ?| array['QB', 'RB'];
