-- ============================================================================
-- Migration: 106_fix_security_definer_views.sql
-- Description: Fix SECURITY DEFINER views to use SECURITY INVOKER
--
-- Issue: Views with SECURITY DEFINER bypass RLS policies, allowing any
-- authenticated user to see all data regardless of team membership.
--
-- Fix: Recreate views with SECURITY INVOKER so they respect the calling
-- user's permissions and RLS policies on underlying tables.
-- ============================================================================

-- ============================================================================
-- 1. FIX: video_moderation_queue
-- ============================================================================
DROP VIEW IF EXISTS video_moderation_queue;

CREATE VIEW video_moderation_queue
WITH (security_invoker = true)
AS
SELECT
  v.id,
  v.name,
  v.file_path,
  v.url,
  v.file_size_bytes,
  v.mime_type,
  v.duration_seconds,
  v.moderation_status,
  v.created_at AS uploaded_at,
  v.uploaded_by,
  v.upload_ip,
  v.moderated_at,
  v.moderated_by,
  v.moderation_notes,
  v.flagged_reason,
  v.game_id,
  g.name AS game_name,
  g.team_id,
  t.name AS team_name,
  p.email AS uploader_email,
  p.full_name AS uploader_name,
  mp.email AS moderator_email
FROM videos v
LEFT JOIN games g ON v.game_id = g.id
LEFT JOIN teams t ON g.team_id = t.id
LEFT JOIN profiles p ON v.uploaded_by = p.id
LEFT JOIN profiles mp ON v.moderated_by = mp.id
WHERE v.is_virtual = false OR v.is_virtual IS NULL;

COMMENT ON VIEW video_moderation_queue IS 'Video moderation queue with SECURITY INVOKER to respect RLS policies';

-- ============================================================================
-- 2. FIX: ai_usage_summary
-- ============================================================================
DROP VIEW IF EXISTS ai_usage_summary;

CREATE VIEW ai_usage_summary
WITH (security_invoker = true)
AS
SELECT
  aul.team_id,
  t.name as team_name,
  aul.user_id,
  p.email as user_email,
  aul.feature,
  date_trunc('day', aul.created_at) as usage_date,
  SUM(aul.credits_used) as total_credits,
  COUNT(*) as usage_count
FROM ai_usage_logs aul
JOIN teams t ON t.id = aul.team_id
LEFT JOIN profiles p ON p.id = aul.user_id
GROUP BY aul.team_id, t.name, aul.user_id, p.email, aul.feature, date_trunc('day', aul.created_at);

COMMENT ON VIEW ai_usage_summary IS 'AI usage summary with SECURITY INVOKER to respect RLS policies';

-- ============================================================================
-- 3. FIX: active_games
-- ============================================================================
DROP VIEW IF EXISTS active_games;

CREATE VIEW active_games
WITH (security_invoker = true)
AS
SELECT g.*
FROM games g
WHERE g.is_locked = false
  AND (g.expires_at IS NULL OR g.expires_at > NOW());

COMMENT ON VIEW active_games IS 'Games that are accessible (not locked or expired) - uses SECURITY INVOKER';

-- ============================================================================
-- 4. FIX: game_scoring_summary
-- ============================================================================
DROP VIEW IF EXISTS game_scoring_summary;

CREATE VIEW game_scoring_summary
WITH (security_invoker = true)
AS
SELECT
  g.id as game_id,
  g.team_id,
  g.name as game_name,
  g.opponent,
  g.date as game_date,
  COUNT(*) FILTER (WHERE pi.scoring_type = 'touchdown' OR pi.is_touchdown = TRUE) as touchdowns,
  COUNT(*) FILTER (WHERE pi.scoring_type = 'field_goal') as field_goals,
  COUNT(*) FILTER (WHERE pi.scoring_type = 'extra_point') as extra_points,
  COUNT(*) FILTER (WHERE pi.scoring_type = 'two_point_conversion') as two_point_conversions,
  COUNT(*) FILTER (WHERE pi.scoring_type = 'safety') as safeties,
  COALESCE(SUM(pi.scoring_points), 0) as total_points,
  COUNT(*) FILTER (WHERE pi.penalty_on_play = TRUE) as total_penalties,
  COALESCE(SUM(pi.penalty_yards) FILTER (WHERE pi.penalty_on_play = TRUE), 0) as total_penalty_yards,
  COUNT(*) FILTER (WHERE pi.penalty_on_us = TRUE) as penalties_on_us,
  COUNT(*) FILTER (WHERE pi.penalty_on_us = FALSE AND pi.penalty_on_play = TRUE) as penalties_on_opponent
FROM games g
LEFT JOIN videos v ON v.game_id = g.id
LEFT JOIN play_instances pi ON pi.video_id = v.id AND pi.is_opponent_play = FALSE
GROUP BY g.id, g.team_id, g.name, g.opponent, g.date;

GRANT SELECT ON game_scoring_summary TO authenticated;

COMMENT ON VIEW game_scoring_summary IS 'Aggregated scoring and penalty summary per game - uses SECURITY INVOKER';

-- ============================================================================
-- 5. FIX: game_penalty_breakdown
-- ============================================================================
DROP VIEW IF EXISTS game_penalty_breakdown;

CREATE VIEW game_penalty_breakdown
WITH (security_invoker = true)
AS
SELECT
  g.id as game_id,
  g.team_id,
  pi.penalty_type,
  pi.penalty_on_us,
  COUNT(*) as occurrences,
  SUM(pi.penalty_yards) as total_yards
FROM games g
JOIN videos v ON v.game_id = g.id
JOIN play_instances pi ON pi.video_id = v.id
WHERE pi.penalty_on_play = TRUE
  AND pi.penalty_type IS NOT NULL
GROUP BY g.id, g.team_id, pi.penalty_type, pi.penalty_on_us;

GRANT SELECT ON game_penalty_breakdown TO authenticated;

COMMENT ON VIEW game_penalty_breakdown IS 'Penalty type breakdown by game - uses SECURITY INVOKER';

-- ============================================================================
-- VERIFICATION: Check all views now use SECURITY INVOKER
-- ============================================================================
-- Run this query after migration to verify:
-- SELECT viewname,
--        (SELECT relrowsecurity FROM pg_class WHERE oid = c.oid) as rls_enabled
-- FROM pg_views v
-- JOIN pg_class c ON c.relname = v.viewname
-- WHERE schemaname = 'public'
-- AND viewname IN ('video_moderation_queue', 'ai_usage_summary',
--                  'game_penalty_breakdown', 'game_scoring_summary', 'active_games');
