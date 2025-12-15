-- Migration 099: Quarter-by-quarter score tracking and film session management
-- Adds quarter scores, film analysis status, and resume position tracking to games table
-- Extends marker types for game period markers

-- ============================================================================
-- 1. Add quarter scores JSONB to games table
-- ============================================================================
ALTER TABLE games
ADD COLUMN IF NOT EXISTS quarter_scores JSONB DEFAULT '{}';

COMMENT ON COLUMN games.quarter_scores IS 'Quarter-by-quarter scores. Structure: { calculated: { team: { q1, q2, q3, q4, ot, total }, opponent: {...} }, manual: {...}, source: "calculated"|"manual", mismatch_acknowledged: bool }';

-- ============================================================================
-- 2. Add film analysis status tracking
-- ============================================================================
ALTER TABLE games
ADD COLUMN IF NOT EXISTS film_analysis_status VARCHAR(20) DEFAULT 'not_started';

ALTER TABLE games
ADD COLUMN IF NOT EXISTS film_analysis_completed_at TIMESTAMPTZ;

ALTER TABLE games
ADD COLUMN IF NOT EXISTS film_analysis_completed_by UUID REFERENCES auth.users(id);

-- Add constraint for valid status values
ALTER TABLE games
DROP CONSTRAINT IF EXISTS games_film_analysis_status_check;

ALTER TABLE games
ADD CONSTRAINT games_film_analysis_status_check
CHECK (film_analysis_status IN ('not_started', 'in_progress', 'complete'));

COMMENT ON COLUMN games.film_analysis_status IS 'Status of film tagging: not_started, in_progress, complete';
COMMENT ON COLUMN games.film_analysis_completed_at IS 'Timestamp when coach marked tagging as complete';
COMMENT ON COLUMN games.film_analysis_completed_by IS 'User who marked tagging as complete';

-- ============================================================================
-- 3. Add resume position tracking (per-game, tracks which video and position)
-- ============================================================================
ALTER TABLE games
ADD COLUMN IF NOT EXISTS last_tagging_video_id UUID REFERENCES videos(id) ON DELETE SET NULL;

ALTER TABLE games
ADD COLUMN IF NOT EXISTS last_tagging_position_ms INTEGER DEFAULT 0;

ALTER TABLE games
ADD COLUMN IF NOT EXISTS last_tagging_at TIMESTAMPTZ;

ALTER TABLE games
ADD COLUMN IF NOT EXISTS last_tagging_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN games.last_tagging_video_id IS 'Last video worked on for film tagging resume functionality';
COMMENT ON COLUMN games.last_tagging_position_ms IS 'Last position in milliseconds where coach left off';
COMMENT ON COLUMN games.last_tagging_at IS 'Timestamp of last tagging activity';
COMMENT ON COLUMN games.last_tagging_by IS 'User who last worked on tagging';

-- ============================================================================
-- 4. Extend video_timeline_markers marker types with game_start and game_end
-- ============================================================================
ALTER TABLE video_timeline_markers
DROP CONSTRAINT IF EXISTS video_timeline_markers_marker_type_check;

ALTER TABLE video_timeline_markers
ADD CONSTRAINT video_timeline_markers_marker_type_check
CHECK (marker_type IN (
  'play',           -- Play marker
  'quarter_start',  -- Quarter boundary start
  'quarter_end',    -- Quarter boundary end
  'halftime',       -- Halftime break
  'overtime',       -- Overtime period
  'big_play',       -- Significant play
  'turnover',       -- Turnover marker
  'timeout',        -- Timeout marker
  'custom',         -- Custom marker
  'game_start',     -- NEW: Start of game
  'game_end'        -- NEW: End of game
));

-- ============================================================================
-- 5. Update quarter column constraint to allow multiple OT periods
-- ============================================================================
-- Current: CHECK (quarter BETWEEN 1 AND 5) - only allows OT1
-- New: Allow higher values for OT2, OT3, etc. (quarter 6, 7, 8...)

ALTER TABLE video_timeline_markers
DROP CONSTRAINT IF EXISTS video_timeline_markers_quarter_check;

ALTER TABLE video_timeline_markers
ADD CONSTRAINT video_timeline_markers_quarter_check
CHECK (quarter >= 1 AND quarter <= 10);  -- Allow up to OT6 (quarters 5-10)

COMMENT ON COLUMN video_timeline_markers.quarter IS 'Game quarter: 1-4 for regulation, 5+ for overtime periods (5=OT1, 6=OT2, etc.)';

-- ============================================================================
-- 6. Add index for game period marker queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_video_timeline_markers_game_periods
ON video_timeline_markers(video_id, marker_type)
WHERE marker_type IN ('game_start', 'quarter_start', 'quarter_end', 'halftime', 'overtime', 'game_end');

-- ============================================================================
-- 7. Create function to calculate quarter scores from tagged plays
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_game_quarter_scores(p_game_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_team_scores JSONB;
  v_opponent_scores JSONB;
BEGIN
  -- Calculate team scores by quarter (join through videos table)
  SELECT jsonb_build_object(
    'q1', COALESCE(SUM(CASE WHEN pi.quarter = 1 THEN pi.scoring_points ELSE 0 END), 0),
    'q2', COALESCE(SUM(CASE WHEN pi.quarter = 2 THEN pi.scoring_points ELSE 0 END), 0),
    'q3', COALESCE(SUM(CASE WHEN pi.quarter = 3 THEN pi.scoring_points ELSE 0 END), 0),
    'q4', COALESCE(SUM(CASE WHEN pi.quarter = 4 THEN pi.scoring_points ELSE 0 END), 0),
    'ot', COALESCE(SUM(CASE WHEN pi.quarter >= 5 THEN pi.scoring_points ELSE 0 END), 0),
    'total', COALESCE(SUM(pi.scoring_points), 0)
  )
  INTO v_team_scores
  FROM play_instances pi
  JOIN videos v ON pi.video_id = v.id
  WHERE v.game_id = p_game_id
    AND pi.is_opponent_play = false
    AND pi.scoring_points > 0;

  -- Calculate opponent scores by quarter (join through videos table)
  SELECT jsonb_build_object(
    'q1', COALESCE(SUM(CASE WHEN pi.quarter = 1 THEN pi.scoring_points ELSE 0 END), 0),
    'q2', COALESCE(SUM(CASE WHEN pi.quarter = 2 THEN pi.scoring_points ELSE 0 END), 0),
    'q3', COALESCE(SUM(CASE WHEN pi.quarter = 3 THEN pi.scoring_points ELSE 0 END), 0),
    'q4', COALESCE(SUM(CASE WHEN pi.quarter = 4 THEN pi.scoring_points ELSE 0 END), 0),
    'ot', COALESCE(SUM(CASE WHEN pi.quarter >= 5 THEN pi.scoring_points ELSE 0 END), 0),
    'total', COALESCE(SUM(pi.scoring_points), 0)
  )
  INTO v_opponent_scores
  FROM play_instances pi
  JOIN videos v ON pi.video_id = v.id
  WHERE v.game_id = p_game_id
    AND pi.is_opponent_play = true
    AND pi.scoring_points > 0;

  -- Build result object
  v_result := jsonb_build_object(
    'calculated', jsonb_build_object(
      'team', COALESCE(v_team_scores, '{"q1":0,"q2":0,"q3":0,"q4":0,"ot":0,"total":0}'::jsonb),
      'opponent', COALESCE(v_opponent_scores, '{"q1":0,"q2":0,"q3":0,"q4":0,"ot":0,"total":0}'::jsonb)
    ),
    'last_calculated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION calculate_game_quarter_scores TO authenticated;

-- ============================================================================
-- 8. Create function to update quarter scores on a game
-- ============================================================================
CREATE OR REPLACE FUNCTION update_game_quarter_scores(p_game_id UUID)
RETURNS VOID AS $$
DECLARE
  v_calculated JSONB;
  v_existing JSONB;
  v_new_scores JSONB;
BEGIN
  -- Get calculated scores
  v_calculated := calculate_game_quarter_scores(p_game_id);

  -- Get existing quarter_scores
  SELECT quarter_scores INTO v_existing
  FROM games
  WHERE id = p_game_id;

  -- Merge with existing (preserve manual scores and source preference)
  v_new_scores := COALESCE(v_existing, '{}'::jsonb);
  v_new_scores := v_new_scores || jsonb_build_object(
    'calculated', v_calculated->'calculated',
    'last_calculated_at', v_calculated->'last_calculated_at'
  );

  -- Update game
  UPDATE games
  SET quarter_scores = v_new_scores
  WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION update_game_quarter_scores TO authenticated;

-- ============================================================================
-- 9. Create function to set manual quarter scores
-- ============================================================================
CREATE OR REPLACE FUNCTION set_game_manual_scores(
  p_game_id UUID,
  p_team_scores JSONB,
  p_opponent_scores JSONB,
  p_source VARCHAR DEFAULT 'manual'
)
RETURNS VOID AS $$
DECLARE
  v_existing JSONB;
  v_new_scores JSONB;
BEGIN
  -- Get existing quarter_scores
  SELECT quarter_scores INTO v_existing
  FROM games
  WHERE id = p_game_id;

  -- Build new scores object
  v_new_scores := COALESCE(v_existing, '{}'::jsonb);
  v_new_scores := v_new_scores || jsonb_build_object(
    'manual', jsonb_build_object(
      'team', p_team_scores,
      'opponent', p_opponent_scores
    ),
    'source', p_source,
    'mismatch_acknowledged', false
  );

  -- Update game
  UPDATE games
  SET quarter_scores = v_new_scores
  WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION set_game_manual_scores TO authenticated;

-- ============================================================================
-- 10. Create function to check for score mismatch
-- ============================================================================
CREATE OR REPLACE FUNCTION check_game_score_mismatch(p_game_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_scores JSONB;
  v_calc_team_total INTEGER;
  v_calc_opp_total INTEGER;
  v_manual_team_total INTEGER;
  v_manual_opp_total INTEGER;
  v_has_mismatch BOOLEAN;
  v_has_manual BOOLEAN;
  v_has_calculated BOOLEAN;
BEGIN
  SELECT quarter_scores INTO v_scores
  FROM games
  WHERE id = p_game_id;

  -- Check if we have both scores
  v_has_calculated := v_scores->'calculated'->'team' IS NOT NULL;
  v_has_manual := v_scores->'manual'->'team' IS NOT NULL;

  IF NOT v_has_calculated OR NOT v_has_manual THEN
    RETURN jsonb_build_object(
      'has_mismatch', false,
      'reason', 'missing_data',
      'has_calculated', v_has_calculated,
      'has_manual', v_has_manual
    );
  END IF;

  -- Get totals
  v_calc_team_total := (v_scores->'calculated'->'team'->>'total')::INTEGER;
  v_calc_opp_total := (v_scores->'calculated'->'opponent'->>'total')::INTEGER;
  v_manual_team_total := (v_scores->'manual'->'team'->>'total')::INTEGER;
  v_manual_opp_total := (v_scores->'manual'->'opponent'->>'total')::INTEGER;

  -- Check mismatch
  v_has_mismatch := (v_calc_team_total != v_manual_team_total) OR (v_calc_opp_total != v_manual_opp_total);

  RETURN jsonb_build_object(
    'has_mismatch', v_has_mismatch,
    'calculated_team_total', v_calc_team_total,
    'calculated_opponent_total', v_calc_opp_total,
    'manual_team_total', v_manual_team_total,
    'manual_opponent_total', v_manual_opp_total,
    'mismatch_acknowledged', COALESCE((v_scores->>'mismatch_acknowledged')::BOOLEAN, false)
  );
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION check_game_score_mismatch TO authenticated;

-- ============================================================================
-- 11. Create function to acknowledge mismatch
-- ============================================================================
CREATE OR REPLACE FUNCTION acknowledge_game_score_mismatch(p_game_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE games
  SET quarter_scores = quarter_scores || '{"mismatch_acknowledged": true}'::jsonb
  WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION acknowledge_game_score_mismatch TO authenticated;

-- ============================================================================
-- 12. Create function to update film analysis status
-- ============================================================================
CREATE OR REPLACE FUNCTION update_film_analysis_status(
  p_game_id UUID,
  p_status VARCHAR,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE games
  SET
    film_analysis_status = p_status,
    film_analysis_completed_at = CASE WHEN p_status = 'complete' THEN now() ELSE NULL END,
    film_analysis_completed_by = CASE WHEN p_status = 'complete' THEN COALESCE(p_user_id, auth.uid()) ELSE NULL END
  WHERE id = p_game_id;

  -- If marking as complete, recalculate quarter scores
  IF p_status = 'complete' THEN
    PERFORM update_game_quarter_scores(p_game_id);
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION update_film_analysis_status TO authenticated;

-- ============================================================================
-- 13. Create function to save tagging position
-- ============================================================================
CREATE OR REPLACE FUNCTION save_tagging_position(
  p_game_id UUID,
  p_video_id UUID,
  p_position_ms INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE games
  SET
    last_tagging_video_id = p_video_id,
    last_tagging_position_ms = p_position_ms,
    last_tagging_at = now(),
    last_tagging_by = auth.uid(),
    -- Also update status to in_progress if not already
    film_analysis_status = CASE
      WHEN film_analysis_status = 'not_started' THEN 'in_progress'
      ELSE film_analysis_status
    END
  WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION save_tagging_position TO authenticated;

-- ============================================================================
-- 14. Add index for efficient score queries
-- ============================================================================
-- Index on play_instances for scoring queries (video_id is the join key to games via videos table)
CREATE INDEX IF NOT EXISTS idx_play_instances_scoring
ON play_instances(video_id, is_opponent_play, quarter)
WHERE scoring_points > 0;

-- Ensure videos.game_id is indexed for efficient game lookups
CREATE INDEX IF NOT EXISTS idx_videos_game_id
ON videos(game_id);

-- ============================================================================
-- 15. Update all existing games to have default structure
-- ============================================================================
UPDATE games
SET quarter_scores = '{}'::jsonb
WHERE quarter_scores IS NULL;
