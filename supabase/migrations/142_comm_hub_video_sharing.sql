-- Migration 142: Communication Hub - Video Sharing (Mux)
-- Phase 3: Shared videos, targets, publish confirmations, Mux cleanup

-- ====================
-- SHARED VIDEOS
-- ====================

CREATE TABLE IF NOT EXISTS shared_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  coach_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  mux_asset_id TEXT NOT NULL,
  mux_playback_id TEXT NOT NULL,
  mux_asset_status TEXT DEFAULT 'preparing' CHECK (mux_asset_status IN ('preparing', 'ready', 'errored')),
  thumbnail_time DECIMAL DEFAULT 0,
  duration_seconds INTEGER,
  share_type TEXT NOT NULL DEFAULT 'team' CHECK (share_type IN ('team', 'individual')),
  coach_notes TEXT,
  source_film_id UUID,
  source_tag_id UUID,
  notification_channel TEXT DEFAULT 'email' CHECK (notification_channel IN ('sms', 'email', 'both')),
  publish_confirmed BOOLEAN NOT NULL DEFAULT false,
  publish_confirmed_at TIMESTAMPTZ,
  signed_url_expires_hours INTEGER DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_shared_videos_team_id ON shared_videos(team_id);
CREATE INDEX idx_shared_videos_coach_id ON shared_videos(coach_id);
CREATE INDEX idx_shared_videos_share_type ON shared_videos(share_type);
CREATE INDEX idx_shared_videos_mux_asset_id ON shared_videos(mux_asset_id);

COMMENT ON TABLE shared_videos IS 'Videos shared with parents via Mux';
COMMENT ON COLUMN shared_videos.mux_asset_id IS 'Mux asset ID for the video';
COMMENT ON COLUMN shared_videos.mux_playback_id IS 'Mux playback ID for generating signed URLs';
COMMENT ON COLUMN shared_videos.mux_asset_status IS 'Mux encoding status: preparing, ready, or errored';
COMMENT ON COLUMN shared_videos.thumbnail_time IS 'Seconds into video for auto-generated thumbnail';
COMMENT ON COLUMN shared_videos.share_type IS 'team = counts against limit, individual = unlimited';
COMMENT ON COLUMN shared_videos.publish_confirmed IS 'Coach must confirm before video is visible to parents';
COMMENT ON COLUMN shared_videos.signed_url_expires_hours IS 'Signed URL expiration (default 24 hours)';

-- Add FK from announcements to shared_videos
ALTER TABLE announcements
ADD CONSTRAINT announcements_shared_video_fk
FOREIGN KEY (shared_video_id) REFERENCES shared_videos(id) ON DELETE SET NULL;

-- ====================
-- VIDEO SHARE TARGETS
-- ====================

CREATE TABLE IF NOT EXISTS video_share_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES shared_videos(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES parent_profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  UNIQUE(video_id, parent_id)
);

CREATE INDEX idx_video_share_targets_video_id ON video_share_targets(video_id);
CREATE INDEX idx_video_share_targets_parent_id ON video_share_targets(parent_id);
CREATE INDEX idx_video_share_targets_player_id ON video_share_targets(player_id);

COMMENT ON TABLE video_share_targets IS 'Tracks which parents received individual video shares and view stats';
COMMENT ON COLUMN video_share_targets.view_count IS 'Number of times parent has watched this video';

-- ====================
-- VIDEO PUBLISH CONFIRMATIONS
-- ====================

CREATE TABLE IF NOT EXISTS video_publish_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES shared_videos(id) ON DELETE CASCADE NOT NULL,
  coach_id UUID REFERENCES auth.users(id) NOT NULL,
  confirmation_text TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_video_publish_confirmations_video_id ON video_publish_confirmations(video_id);

COMMENT ON TABLE video_publish_confirmations IS 'Audit trail for video publishing confirmations';
COMMENT ON COLUMN video_publish_confirmations.confirmation_text IS 'Exact text coach agreed to when confirming publish';

-- ====================
-- MUX CLEANUP QUEUE
-- ====================

CREATE TABLE IF NOT EXISTS mux_cleanup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_plan_id UUID REFERENCES team_communication_plans(id) ON DELETE CASCADE,
  mux_asset_id TEXT NOT NULL,
  scheduled_cleanup_at TIMESTAMPTZ NOT NULL,
  cleaned_up_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'retained')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mux_cleanup_queue_scheduled ON mux_cleanup_queue(scheduled_cleanup_at) WHERE status = 'pending';
CREATE INDEX idx_mux_cleanup_queue_plan_id ON mux_cleanup_queue(communication_plan_id);

COMMENT ON TABLE mux_cleanup_queue IS 'Queue for automated Mux asset deletion (60 days after plan expiration)';
COMMENT ON COLUMN mux_cleanup_queue.scheduled_cleanup_at IS 'When to delete the Mux asset';
COMMENT ON COLUMN mux_cleanup_queue.status IS 'pending, completed, or retained (if plan renewed)';

-- ====================
-- ROW LEVEL SECURITY
-- ====================

ALTER TABLE shared_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_share_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_publish_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mux_cleanup_queue ENABLE ROW LEVEL SECURITY;

-- Shared videos: coaches can manage, parents can view published team videos or targeted individual videos
CREATE POLICY "Coaches can manage shared videos"
  ON shared_videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE t.id = shared_videos.team_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach') AND tm.is_active = true)
      )
    )
  );

CREATE POLICY "Parents can view published team videos"
  ON shared_videos FOR SELECT
  USING (
    publish_confirmed = true
    AND share_type = 'team'
    AND EXISTS (
      SELECT 1 FROM team_parent_access tpa
      JOIN parent_profiles pp ON pp.id = tpa.parent_id
      WHERE tpa.team_id = shared_videos.team_id
      AND pp.user_id = auth.uid()
      AND tpa.status = 'active'
    )
  );

CREATE POLICY "Parents can view individual videos shared with them"
  ON shared_videos FOR SELECT
  USING (
    publish_confirmed = true
    AND share_type = 'individual'
    AND EXISTS (
      SELECT 1 FROM video_share_targets vst
      JOIN parent_profiles pp ON pp.id = vst.parent_id
      WHERE vst.video_id = shared_videos.id
      AND pp.user_id = auth.uid()
    )
  );

-- Video share targets: coaches can manage, parents can view/update their own
CREATE POLICY "Coaches can manage video share targets"
  ON video_share_targets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shared_videos sv
      JOIN teams t ON t.id = sv.team_id
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE sv.id = video_share_targets.video_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach') AND tm.is_active = true)
      )
    )
  );

CREATE POLICY "Parents can view own video share targets"
  ON video_share_targets FOR SELECT
  USING (
    parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Parents can update own view stats"
  ON video_share_targets FOR UPDATE
  USING (
    parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    parent_id IN (SELECT id FROM parent_profiles WHERE user_id = auth.uid())
  );

-- Video publish confirmations: coaches can insert/view
CREATE POLICY "Coaches can manage publish confirmations"
  ON video_publish_confirmations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM shared_videos sv
      JOIN teams t ON t.id = sv.team_id
      LEFT JOIN team_memberships tm ON tm.team_id = t.id
      WHERE sv.id = video_publish_confirmations.video_id
      AND (
        t.user_id = auth.uid()
        OR (tm.user_id = auth.uid() AND tm.role IN ('owner', 'coach') AND tm.is_active = true)
      )
    )
  );

-- Mux cleanup queue: system only
CREATE POLICY "System can manage mux cleanup queue"
  ON mux_cleanup_queue FOR ALL
  USING (true);  -- Handled by service role in background jobs

-- ====================
-- HELPER FUNCTIONS
-- ====================

-- Function to record video view
CREATE OR REPLACE FUNCTION record_video_view(p_video_id UUID, p_parent_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE video_share_targets
  SET
    viewed_at = COALESCE(viewed_at, now()),
    view_count = view_count + 1,
    last_viewed_at = now()
  WHERE video_id = p_video_id AND parent_id = p_parent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to queue Mux asset for cleanup when plan expires
CREATE OR REPLACE FUNCTION queue_mux_cleanup_for_plan(p_plan_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO mux_cleanup_queue (communication_plan_id, mux_asset_id, scheduled_cleanup_at)
  SELECT
    p_plan_id,
    sv.mux_asset_id,
    tcp.mux_cleanup_at
  FROM shared_videos sv
  JOIN team_communication_plans tcp ON tcp.team_id = sv.team_id AND tcp.id = p_plan_id
  WHERE sv.share_type = 'team'
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to retain Mux assets when plan is renewed
CREATE OR REPLACE FUNCTION retain_mux_assets_for_plan(p_old_plan_id UUID, p_new_plan_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Mark old cleanup entries as retained
  UPDATE mux_cleanup_queue
  SET status = 'retained'
  WHERE communication_plan_id = p_old_plan_id AND status = 'pending';

  -- Note: New plan's assets will be queued when it expires
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
