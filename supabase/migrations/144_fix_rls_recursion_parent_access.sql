-- Migration 144: Fix infinite RLS recursion between parent_profiles and team_parent_access
--
-- Problem: parent_profiles RLS policy queries team_parent_access,
--          team_parent_access RLS policy queries parent_profiles → infinite loop
--
-- Fix: SECURITY DEFINER function bypasses RLS to get parent_id for current user

-- Create helper function that bypasses RLS
CREATE OR REPLACE FUNCTION get_parent_profile_id_for_user(p_user_id UUID)
RETURNS UUID AS $$
  SELECT id FROM parent_profiles WHERE user_id = p_user_id LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_parent_profile_id_for_user(UUID) TO authenticated;

-- ======================
-- Fix team_parent_access policies (break the cycle here)
-- ======================

DROP POLICY IF EXISTS "Parents can view own team access" ON team_parent_access;
CREATE POLICY "Parents can view own team access"
  ON team_parent_access FOR SELECT
  USING (
    parent_id = get_parent_profile_id_for_user(auth.uid())
  );

-- ======================
-- Fix announcement_reads policies
-- ======================

DROP POLICY IF EXISTS "Parents can manage own announcement reads" ON announcement_reads;
CREATE POLICY "Parents can manage own announcement reads"
  ON announcement_reads FOR ALL
  USING (
    parent_id = get_parent_profile_id_for_user(auth.uid())
  );

-- ======================
-- Fix event_rsvps policies
-- ======================

DROP POLICY IF EXISTS "Parents can manage own RSVPs" ON event_rsvps;
CREATE POLICY "Parents can manage own RSVPs"
  ON event_rsvps FOR ALL
  USING (
    parent_id = get_parent_profile_id_for_user(auth.uid())
  );

-- ======================
-- Fix direct_messages policies
-- ======================

DROP POLICY IF EXISTS "Users can view own messages" ON direct_messages;
CREATE POLICY "Users can view own messages"
  ON direct_messages FOR SELECT
  USING (
    (sender_id = auth.uid())
    OR
    (recipient_type = 'coach' AND recipient_id = auth.uid())
    OR
    (recipient_type = 'parent' AND recipient_id = get_parent_profile_id_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "Users can send messages" ON direct_messages;
CREATE POLICY "Users can send messages"
  ON direct_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    OR
    sender_id = get_parent_profile_id_for_user(auth.uid())
  );

DROP POLICY IF EXISTS "Recipients can mark messages read" ON direct_messages;
CREATE POLICY "Recipients can mark messages read"
  ON direct_messages FOR UPDATE
  USING (
    (recipient_type = 'coach' AND recipient_id = auth.uid())
    OR
    (recipient_type = 'parent' AND recipient_id = get_parent_profile_id_for_user(auth.uid()))
  )
  WITH CHECK (
    read_at IS NOT NULL
  );

-- ======================
-- Fix video_share_targets policies
-- ======================

DROP POLICY IF EXISTS "Parents can view own video share targets" ON video_share_targets;
CREATE POLICY "Parents can view own video share targets"
  ON video_share_targets FOR SELECT
  USING (
    parent_id = get_parent_profile_id_for_user(auth.uid())
  );

DROP POLICY IF EXISTS "Parents can update own view stats" ON video_share_targets;
CREATE POLICY "Parents can update own view stats"
  ON video_share_targets FOR UPDATE
  USING (
    parent_id = get_parent_profile_id_for_user(auth.uid())
  )
  WITH CHECK (
    parent_id = get_parent_profile_id_for_user(auth.uid())
  );

-- ======================
-- Fix report_views policies
-- ======================

DROP POLICY IF EXISTS "Parents can manage own report views" ON report_views;
CREATE POLICY "Parents can manage own report views"
  ON report_views FOR ALL
  USING (
    parent_id = get_parent_profile_id_for_user(auth.uid())
  );

-- ======================
-- Fix shared_reports policies
-- ======================

DROP POLICY IF EXISTS "Parents can view reports shared specifically with them" ON shared_reports;
CREATE POLICY "Parents can view reports shared specifically with them"
  ON shared_reports FOR SELECT
  USING (
    visibility = 'specific_parent'
    AND target_parent_id = get_parent_profile_id_for_user(auth.uid())
  );

-- ======================
-- Fix policies that JOIN parent_profiles with team_parent_access
-- These also trigger the recursion via the parent_profiles RLS policy
-- Replace JOIN pattern with the helper function
-- ======================

-- Announcements: parent view policy
DROP POLICY IF EXISTS "Parents can view team announcements" ON announcements;
CREATE POLICY "Parents can view team announcements"
  ON announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_parent_access tpa
      WHERE tpa.team_id = announcements.team_id
      AND tpa.parent_id = get_parent_profile_id_for_user(auth.uid())
      AND tpa.status = 'active'
    )
  );

-- Shared videos: parent view team videos
DROP POLICY IF EXISTS "Parents can view published team videos" ON shared_videos;
CREATE POLICY "Parents can view published team videos"
  ON shared_videos FOR SELECT
  USING (
    publish_confirmed = true
    AND share_type = 'team'
    AND EXISTS (
      SELECT 1 FROM team_parent_access tpa
      WHERE tpa.team_id = shared_videos.team_id
      AND tpa.parent_id = get_parent_profile_id_for_user(auth.uid())
      AND tpa.status = 'active'
    )
  );

-- Shared videos: parent view individual videos
DROP POLICY IF EXISTS "Parents can view individual videos shared with them" ON shared_videos;
CREATE POLICY "Parents can view individual videos shared with them"
  ON shared_videos FOR SELECT
  USING (
    publish_confirmed = true
    AND share_type = 'individual'
    AND EXISTS (
      SELECT 1 FROM video_share_targets vst
      WHERE vst.video_id = shared_videos.id
      AND vst.parent_id = get_parent_profile_id_for_user(auth.uid())
    )
  );

-- Shared reports: parent view team reports
DROP POLICY IF EXISTS "Parents can view reports shared with all parents" ON shared_reports;
CREATE POLICY "Parents can view reports shared with all parents"
  ON shared_reports FOR SELECT
  USING (
    visibility = 'parents'
    AND EXISTS (
      SELECT 1 FROM team_parent_access tpa
      WHERE tpa.team_id = shared_reports.team_id
      AND tpa.parent_id = get_parent_profile_id_for_user(auth.uid())
      AND tpa.status = 'active'
    )
  );

-- Game summaries: parent view published
DROP POLICY IF EXISTS "Parents can view published game summaries" ON game_summaries;
CREATE POLICY "Parents can view published game summaries"
  ON game_summaries FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM team_parent_access tpa
      WHERE tpa.team_id = game_summaries.team_id
      AND tpa.parent_id = get_parent_profile_id_for_user(auth.uid())
      AND tpa.status = 'active'
    )
  );

-- ======================
-- Fix parent_profiles "Coaches can view" policy (the other side of the cycle)
-- Use team_parent_access without triggering parent_profiles RLS
-- ======================

-- Note: "Coaches can view team parent profiles" on parent_profiles queries
-- team_parent_access, but now team_parent_access policies use
-- get_parent_profile_id_for_user() instead of querying parent_profiles,
-- so the recursion cycle is broken. No change needed for this policy.

-- ======================
-- Fix player_parent_links policy
-- ======================

DROP POLICY IF EXISTS "Parents can view own child links" ON player_parent_links;
CREATE POLICY "Parents can view own child links"
  ON player_parent_links FOR SELECT
  USING (
    parent_id = get_parent_profile_id_for_user(auth.uid())
  );

-- ======================
-- Fix parent_consent_log policies
-- ======================

DROP POLICY IF EXISTS "Parents can view own consent log" ON parent_consent_log;
CREATE POLICY "Parents can view own consent log"
  ON parent_consent_log FOR SELECT
  USING (
    parent_id = get_parent_profile_id_for_user(auth.uid())
  );

DROP POLICY IF EXISTS "Parents can insert consent" ON parent_consent_log;
CREATE POLICY "Parents can insert consent"
  ON parent_consent_log FOR INSERT
  WITH CHECK (
    parent_id = get_parent_profile_id_for_user(auth.uid())
  );

-- ======================
-- Fix parent_email_changes policies
-- ======================

DROP POLICY IF EXISTS "Parents can view own email changes" ON parent_email_changes;
CREATE POLICY "Parents can view own email changes"
  ON parent_email_changes FOR SELECT
  USING (
    parent_id = get_parent_profile_id_for_user(auth.uid())
  );

-- ======================
-- Fix parent_invitations: Parent Champions policy uses JOIN pattern
-- ======================

DROP POLICY IF EXISTS "Parent Champions can view invitations" ON parent_invitations;
CREATE POLICY "Parent Champions can view invitations"
  ON parent_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_parent_access tpa
      WHERE tpa.parent_id = get_parent_profile_id_for_user(auth.uid())
      AND tpa.team_id = parent_invitations.team_id
      AND tpa.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM parent_profiles pp
      WHERE pp.id = get_parent_profile_id_for_user(auth.uid())
      AND pp.is_champion = true
    )
  );
