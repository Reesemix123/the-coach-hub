-- Migration 100: Add opponent_scored field for special teams scoring attribution
-- When your team punts/kicks off and opponent returns for TD, the scoring should
-- be attributed to the opponent, not your team.

-- ============================================================================
-- 1. Add opponent_scored boolean to play_instances
-- ============================================================================
ALTER TABLE play_instances
ADD COLUMN IF NOT EXISTS opponent_scored BOOLEAN DEFAULT false;

COMMENT ON COLUMN play_instances.opponent_scored IS 'True when opponent scores on this play (e.g., punt returned for TD). Used for proper score attribution in special teams.';

-- ============================================================================
-- 2. Update the calculate_game_quarter_scores function to handle opponent_scored
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_game_quarter_scores(p_game_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_team_scores JSONB;
  v_opponent_scores JSONB;
BEGIN
  -- Calculate team scores by quarter
  -- Team scores when: (is_opponent_play = false AND opponent_scored = false)
  -- This handles normal offensive/special teams scoring for our team
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
    AND COALESCE(pi.opponent_scored, false) = false
    AND pi.scoring_points > 0;

  -- Calculate opponent scores by quarter
  -- Opponent scores when: (is_opponent_play = true) OR (is_opponent_play = false AND opponent_scored = true)
  -- This handles: 1) opponent offensive plays we tag, 2) opponent scores on our special teams
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
    AND (
      pi.is_opponent_play = true
      OR (pi.is_opponent_play = false AND COALESCE(pi.opponent_scored, false) = true)
    )
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

-- ============================================================================
-- 3. Create index for efficient opponent_scored queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_play_instances_opponent_scored
ON play_instances(video_id, opponent_scored)
WHERE opponent_scored = true;
