-- ============================================================================
-- Migration 178: Add game_id to play_instances
-- ============================================================================
-- PURPOSE:
--   Sideline-entered plays (source='sideline') have video_id=NULL, so they
--   cannot be linked to a game via the existing video_id → videos.game_id path.
--   This column provides a direct game link for all play sources.
--
--   Film-tagged plays continue to use video_id → videos.game_id as the
--   canonical link. game_id on play_instances is supplementary for those plays
--   but required for sideline entries.
-- ============================================================================

ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES games(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_play_instances_game_id
  ON play_instances(game_id) WHERE game_id IS NOT NULL;

COMMENT ON COLUMN play_instances.game_id IS 'Direct game link for sideline-entered plays (video_id is NULL). Film-tagged plays link via video_id → videos.game_id; this column is supplementary for those.';
