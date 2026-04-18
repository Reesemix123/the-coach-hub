-- ============================================================================
-- Migration 177: Add coach_notes to playbook_plays
-- ============================================================================
-- PURPOSE: Dedicated coach notes field for play-level coaching context.
--   Separate from existing `comments` column (which stores extraction/import notes).
--   Max 500 characters enforced at the application level.
-- ============================================================================

ALTER TABLE playbook_plays
  ADD COLUMN IF NOT EXISTS coach_notes TEXT;

COMMENT ON COLUMN playbook_plays.coach_notes IS 'Free-form coach notes for play context, max 500 chars enforced at app level';
