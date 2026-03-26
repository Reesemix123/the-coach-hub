-- Migration 150: Play Clip Sharing — Score Tracking + Mux Clip Delivery State
-- ============================================================================
-- PURPOSE:
--   1. Add per-play running score (team + opponent) for scoreboard overlay
--   2. Add data source tracking for multi-source metadata (manual, auto, ai)
--   3. Add Mux clip delivery columns for parent-facing clip sharing
--   4. Add RLS policies so parents can read shared play metadata
--
-- SAFE TO RUN: All statements use IF NOT EXISTS / additive only.
-- ============================================================================

-- ============================================================================
-- 1. Running score per play
-- ============================================================================

ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS team_score_at_snap INTEGER DEFAULT NULL;

ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS opponent_score_at_snap INTEGER DEFAULT NULL;

COMMENT ON COLUMN play_instances.team_score_at_snap IS 'Running team score at the snap — separate from score_differential';
COMMENT ON COLUMN play_instances.opponent_score_at_snap IS 'Running opponent score at the snap';

-- ============================================================================
-- 2. Data source tracking
-- ============================================================================
-- Tracks how each play's metadata was populated: manual entry, auto-calculated
-- from prior plays, or (future) AI extraction via Gemini OCR.

ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS score_source TEXT DEFAULT 'manual';

-- Use a check constraint only if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'play_instances_score_source_check'
  ) THEN
    ALTER TABLE play_instances
    ADD CONSTRAINT play_instances_score_source_check
    CHECK (score_source IN ('manual', 'auto', 'ai'));
  END IF;
END $$;

COMMENT ON COLUMN play_instances.score_source IS 'How score was populated: manual (coach typed), auto (calculated from prior plays), ai (future Gemini OCR)';

-- ============================================================================
-- 3. Mux clip delivery state
-- ============================================================================

ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS mux_clip_asset_id TEXT DEFAULT NULL;

ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS mux_clip_playback_id TEXT DEFAULT NULL;

ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS mux_clip_status TEXT DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'play_instances_mux_clip_status_check'
  ) THEN
    ALTER TABLE play_instances
    ADD CONSTRAINT play_instances_mux_clip_status_check
    CHECK (mux_clip_status IN ('extracting', 'uploading', 'pending', 'ready', 'errored'));
  END IF;
END $$;

ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS mux_clip_error TEXT DEFAULT NULL;

COMMENT ON COLUMN play_instances.mux_clip_asset_id IS 'Mux asset ID for the extracted clip — NULL until extraction starts';
COMMENT ON COLUMN play_instances.mux_clip_playback_id IS 'Mux signed-playback ID — set by webhook when asset is ready';
COMMENT ON COLUMN play_instances.mux_clip_status IS 'Clip pipeline state: extracting → uploading → pending → ready | errored';
COMMENT ON COLUMN play_instances.mux_clip_error IS 'Error message if Mux encoding failed — cleared on retry';

-- ============================================================================
-- 4. Share tracking
-- ============================================================================

ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS clip_shared_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS clip_share_type TEXT DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'play_instances_clip_share_type_check'
  ) THEN
    ALTER TABLE play_instances
    ADD CONSTRAINT play_instances_clip_share_type_check
    CHECK (clip_share_type IN ('team', 'individual'));
  END IF;
END $$;

ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS clip_coach_note TEXT DEFAULT NULL;

ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS clip_shared_video_id UUID DEFAULT NULL;

-- FK to shared_videos — allows looking up credit/notification state
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'play_instances_clip_shared_video_id_fkey'
  ) THEN
    ALTER TABLE play_instances
    ADD CONSTRAINT play_instances_clip_shared_video_id_fkey
    FOREIGN KEY (clip_shared_video_id) REFERENCES shared_videos(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN play_instances.clip_shared_at IS 'When the coach shared this clip with parents — NULL if never shared';
COMMENT ON COLUMN play_instances.clip_share_type IS 'Whether clip was shared to all team parents or one player''s parents';
COMMENT ON COLUMN play_instances.clip_coach_note IS 'Optional note from coach attached at share time';
COMMENT ON COLUMN play_instances.clip_shared_video_id IS 'FK to shared_videos row — links clip to credit/notification pipeline';

-- ============================================================================
-- 5. Indexes for clip queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_play_instances_mux_clip_asset
  ON play_instances(mux_clip_asset_id)
  WHERE mux_clip_asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_play_instances_clip_shared
  ON play_instances(clip_shared_at)
  WHERE clip_shared_at IS NOT NULL;

-- ============================================================================
-- 6. RLS policies for parent read access on shared plays
-- ============================================================================
-- Parents can read play metadata ONLY for plays that have been shared
-- (clip_shared_at IS NOT NULL) on teams they belong to.
-- Parents can NEVER write to play_instances.

-- Drop if exists to make this migration re-runnable
DROP POLICY IF EXISTS "Parents can view shared play clips" ON play_instances;

CREATE POLICY "Parents can view shared play clips"
  ON play_instances FOR SELECT
  USING (
    clip_shared_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM team_parent_access tpa
      JOIN parent_profiles pp ON pp.id = tpa.parent_id
      WHERE tpa.team_id = play_instances.team_id
      AND pp.user_id = auth.uid()
      AND tpa.status = 'active'
    )
  );
