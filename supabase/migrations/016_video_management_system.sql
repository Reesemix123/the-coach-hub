-- Migration 016: Video Management System
-- Purpose: Video consolidation, virtual timelines, and multi-angle overlay support

-- ====================
-- VIDEO GROUPS
-- ====================
-- Groups related videos together (e.g., all videos from one game)
CREATE TABLE IF NOT EXISTS video_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- e.g., "Full Game - All Angles"
  description TEXT,
  group_type VARCHAR(50) DEFAULT 'sequence' CHECK (group_type IN ('sequence', 'overlay', 'multi_angle')),

  -- For overlay groups
  layout_preset VARCHAR(50), -- 'pip', 'side_by_side', 'stacked', 'quad'
  primary_video_id UUID, -- Which video is the "main" one

  -- Processing status
  has_merged_video BOOLEAN DEFAULT false,
  merged_video_id UUID, -- References videos table if merged

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ====================
-- VIDEO GROUP MEMBERS
-- ====================
-- Links videos to groups with ordering and metadata
CREATE TABLE IF NOT EXISTS video_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_group_id UUID NOT NULL REFERENCES video_groups(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,

  -- For sequence groups (virtual timeline)
  sequence_order INTEGER, -- Order in the timeline (0, 1, 2...)
  start_offset_ms INTEGER DEFAULT 0, -- Trim start (milliseconds)
  end_offset_ms INTEGER, -- Trim end (null = full duration)

  -- For overlay groups (sync points)
  sync_point_ms INTEGER DEFAULT 0, -- Where this video starts relative to primary
  overlay_position VARCHAR(50), -- 'full', 'top_right', 'bottom_left', etc.
  overlay_scale DECIMAL(3,2) DEFAULT 1.0, -- Scale factor (0.25 = 25% size)
  overlay_z_index INTEGER DEFAULT 0, -- Stacking order

  -- Audio handling
  include_audio BOOLEAN DEFAULT true,
  audio_volume DECIMAL(3,2) DEFAULT 1.0, -- 0.0 to 1.0

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(video_group_id, video_id) -- Each video appears once per group
);

-- ====================
-- VIDEO PROCESSING JOBS
-- ====================
-- Track background video processing tasks
CREATE TABLE IF NOT EXISTS video_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_group_id UUID REFERENCES video_groups(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('merge', 'overlay', 'transcode', 'thumbnail')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Progress tracking
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  current_step VARCHAR(255), -- e.g., "Merging video 2 of 5"

  -- Result
  output_video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  error_message TEXT,

  -- Performance metrics
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  processing_duration_seconds INTEGER,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ====================
-- VIRTUAL TIMELINE MARKERS
-- ====================
-- Map play instances to virtual timeline positions
-- Allows tagging plays across multiple videos in a group
CREATE TABLE IF NOT EXISTS video_timeline_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_group_id UUID NOT NULL REFERENCES video_groups(id) ON DELETE CASCADE,
  play_instance_id UUID REFERENCES play_instances(id) ON DELETE CASCADE,

  -- Virtual timeline position (across all videos in group)
  virtual_timestamp_start_ms INTEGER NOT NULL,
  virtual_timestamp_end_ms INTEGER,

  -- Physical video reference (which actual video contains this)
  actual_video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  actual_timestamp_start_ms INTEGER,
  actual_timestamp_end_ms INTEGER,

  -- Metadata
  label VARCHAR(255), -- e.g., "Play 1 - Power Right"
  marker_type VARCHAR(50) DEFAULT 'play' CHECK (marker_type IN ('play', 'quarter', 'timeout', 'custom')),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ====================
-- INDEXES
-- ====================
CREATE INDEX IF NOT EXISTS idx_video_groups_game ON video_groups(game_id);
CREATE INDEX IF NOT EXISTS idx_video_groups_type ON video_groups(group_type);
CREATE INDEX IF NOT EXISTS idx_video_group_members_group ON video_group_members(video_group_id);
CREATE INDEX IF NOT EXISTS idx_video_group_members_video ON video_group_members(video_id);
CREATE INDEX IF NOT EXISTS idx_video_group_members_order ON video_group_members(video_group_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_video_processing_jobs_group ON video_processing_jobs(video_group_id);
CREATE INDEX IF NOT EXISTS idx_video_processing_jobs_status ON video_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_timeline_markers_group ON video_timeline_markers(video_group_id);
CREATE INDEX IF NOT EXISTS idx_video_timeline_markers_play ON video_timeline_markers(play_instance_id);

-- ====================
-- TRIGGERS
-- ====================
CREATE TRIGGER update_video_groups_updated_at
  BEFORE UPDATE ON video_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_processing_jobs_updated_at
  BEFORE UPDATE ON video_processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- RLS POLICIES
-- ====================
ALTER TABLE video_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_timeline_markers ENABLE ROW LEVEL SECURITY;

-- Video Groups: Users can access groups for their games
CREATE POLICY "Users can view video groups for their games"
  ON video_groups FOR SELECT
  USING (
    game_id IN (
      SELECT games.id FROM games
      WHERE games.team_id IN (
        SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
        UNION
        SELECT id FROM teams WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create video groups for their games"
  ON video_groups FOR INSERT
  WITH CHECK (
    game_id IN (
      SELECT games.id FROM games
      WHERE games.team_id IN (
        SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
        UNION
        SELECT id FROM teams WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update video groups for their games"
  ON video_groups FOR UPDATE
  USING (
    game_id IN (
      SELECT games.id FROM games
      WHERE games.team_id IN (
        SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
        UNION
        SELECT id FROM teams WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete video groups for their games"
  ON video_groups FOR DELETE
  USING (
    game_id IN (
      SELECT games.id FROM games
      WHERE games.team_id IN (
        SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
        UNION
        SELECT id FROM teams WHERE user_id = auth.uid()
      )
    )
  );

-- Video Group Members: Inherit from parent group
CREATE POLICY "Users can view video group members"
  ON video_group_members FOR SELECT
  USING (
    video_group_id IN (SELECT id FROM video_groups)
  );

CREATE POLICY "Users can manage video group members"
  ON video_group_members FOR ALL
  USING (
    video_group_id IN (SELECT id FROM video_groups)
  );

-- Processing Jobs: Users can view their jobs
CREATE POLICY "Users can view their processing jobs"
  ON video_processing_jobs FOR SELECT
  USING (
    video_group_id IN (SELECT id FROM video_groups)
  );

CREATE POLICY "Users can create processing jobs"
  ON video_processing_jobs FOR INSERT
  WITH CHECK (
    video_group_id IN (SELECT id FROM video_groups)
  );

CREATE POLICY "System can update processing jobs"
  ON video_processing_jobs FOR UPDATE
  USING (true); -- Allow system updates for job progress

-- Timeline Markers: Inherit from parent group
CREATE POLICY "Users can view timeline markers"
  ON video_timeline_markers FOR SELECT
  USING (
    video_group_id IN (SELECT id FROM video_groups)
  );

CREATE POLICY "Users can manage timeline markers"
  ON video_timeline_markers FOR ALL
  USING (
    video_group_id IN (SELECT id FROM video_groups)
  );
