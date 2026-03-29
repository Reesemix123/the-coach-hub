-- Migration 159: Add Mux status tracking columns to player_clips
-- Matches the pattern used on play_instances for clip lifecycle tracking

ALTER TABLE player_clips
  ADD COLUMN IF NOT EXISTS mux_clip_status TEXT DEFAULT 'pending'
    CHECK (mux_clip_status IN ('pending', 'extracting', 'ready', 'errored')),
  ADD COLUMN IF NOT EXISTS mux_clip_error TEXT,
  ADD COLUMN IF NOT EXISTS mux_upload_id TEXT;

-- Index for webhook lookups (upload ID → asset ID mapping)
CREATE INDEX IF NOT EXISTS idx_player_clips_mux_upload ON player_clips(mux_upload_id)
  WHERE mux_upload_id IS NOT NULL;

-- Index for webhook lookups (asset ready/errored)
CREATE INDEX IF NOT EXISTS idx_player_clips_mux_asset ON player_clips(mux_asset_id)
  WHERE mux_asset_id IS NOT NULL;

-- Index for status-based queries (coach review queue)
CREATE INDEX IF NOT EXISTS idx_player_clips_mux_status ON player_clips(mux_clip_status);
