-- Migration: Add UNIQUE constraint to playbook_plays.play_code
-- Purpose: Required for game_plan_plays foreign key reference
-- This migration should run AFTER 014 and BEFORE 015

-- First, check if there are any duplicate play_codes (there shouldn't be)
-- If there are duplicates, this will fail and you'll need to clean them up first

-- Add UNIQUE constraint to play_code
ALTER TABLE playbook_plays
ADD CONSTRAINT playbook_plays_play_code_unique UNIQUE (play_code);

-- Create index for performance (if not already exists)
CREATE INDEX IF NOT EXISTS idx_playbook_plays_play_code ON playbook_plays(play_code);
