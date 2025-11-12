-- Check current player positions
-- Run this to see what position codes are currently stored

SELECT
  id,
  jersey_number,
  first_name,
  last_name,
  primary_position,
  secondary_position,
  position_group,
  position_depths
FROM players
WHERE is_active = true
ORDER BY jersey_number;
