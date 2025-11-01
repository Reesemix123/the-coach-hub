-- Migration 017: Simplified Virtual Videos
-- Adds columns to videos table to support virtual/combined videos
-- without requiring separate video_groups table

-- Add columns to videos table
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_video_ids UUID[],
  ADD COLUMN IF NOT EXISTS virtual_name TEXT,
  ADD COLUMN IF NOT EXISTS video_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS video_group_id UUID REFERENCES video_groups(id) ON DELETE CASCADE;

-- Add index for virtual videos queries
CREATE INDEX IF NOT EXISTS idx_videos_is_virtual ON videos(is_virtual);
CREATE INDEX IF NOT EXISTS idx_videos_game_id_is_virtual ON videos(game_id, is_virtual);

-- Add comment explaining the schema
COMMENT ON COLUMN videos.is_virtual IS 'True if this is a virtual/combined video made from multiple source videos';
COMMENT ON COLUMN videos.source_video_ids IS 'Array of video IDs that make up this virtual video (only populated if is_virtual=true)';
COMMENT ON COLUMN videos.virtual_name IS 'Display name for virtual videos (e.g., "Full Game", "First Half")';
COMMENT ON COLUMN videos.video_count IS 'Number of source videos (1 for regular videos, N for virtual videos)';

-- Update existing videos to have video_count = 1
UPDATE videos SET video_count = 1 WHERE video_count IS NULL;
