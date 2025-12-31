-- Migration 114: Fix play_code unique constraint to be team-scoped
--
-- Problem: The current constraint UNIQUE(play_code) is global, meaning
-- if Team A has "P-001", Team B cannot also have "P-001".
--
-- Solution: Change to UNIQUE(team_id, play_code) so each team can have
-- their own play codes independently. Within a team, codes are still unique.

-- Step 1: Drop the old global constraint
ALTER TABLE playbook_plays
DROP CONSTRAINT IF EXISTS playbook_plays_play_code_unique;

-- Step 2: Add new team-scoped constraint
-- This allows: Team A has P-001, Team B also has P-001 (different teams = OK)
-- This prevents: Team A has two plays both called P-001 (same team = ERROR)
ALTER TABLE playbook_plays
ADD CONSTRAINT playbook_plays_team_play_code_unique UNIQUE (team_id, play_code);

-- Note: For personal playbooks (team_id = NULL), PostgreSQL UNIQUE constraints
-- treat NULL as distinct values, so multiple users can have personal plays
-- with the same code. If this becomes an issue, we could add a partial index:
-- CREATE UNIQUE INDEX playbook_plays_personal_play_code_unique
-- ON playbook_plays (play_code) WHERE team_id IS NULL;
