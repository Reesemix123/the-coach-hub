-- Migration 014a: Fix Duplicate Play Codes
-- Purpose: Remove duplicate play_code entries before adding UNIQUE constraint
-- Keeps the oldest record for each play_code (by created_at timestamp)

-- STEP 1: View duplicates (for reference - this won't modify data)
-- Uncomment to see what will be deleted:
/*
SELECT
  play_code,
  COUNT(*) as count,
  array_agg(id ORDER BY created_at) as all_ids,
  array_agg(play_name ORDER BY created_at) as all_names,
  MIN(created_at) as oldest_created
FROM playbook_plays
GROUP BY play_code
HAVING COUNT(*) > 1
ORDER BY play_code;
*/

-- STEP 2: Delete duplicates, keeping only the oldest record for each play_code
DELETE FROM playbook_plays
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      play_code,
      ROW_NUMBER() OVER (
        PARTITION BY play_code
        ORDER BY created_at ASC, id ASC
      ) as row_num
    FROM playbook_plays
  ) ranked
  WHERE row_num > 1
);

-- STEP 3: Verify no duplicates remain
-- This should return 0 rows:
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT play_code
    FROM playbook_plays
    GROUP BY play_code
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Still found % duplicate play_codes after cleanup', duplicate_count;
  ELSE
    RAISE NOTICE 'Successfully removed all duplicate play_codes';
  END IF;
END $$;
