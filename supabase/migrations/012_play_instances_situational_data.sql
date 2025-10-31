-- Migration 012: Play Instances - Situational Data (Tier 3)
-- Adds situational tracking for advanced analytics
-- Motion, play action, blitz, box count, target depth, pass location

-- Pre-snap offensive indicators
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS has_motion BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_play_action BOOLEAN DEFAULT false;

-- Defensive situational
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS facing_blitz BOOLEAN DEFAULT false, -- 5+ rushers
  ADD COLUMN IF NOT EXISTS box_count INTEGER CHECK (box_count BETWEEN 4 AND 9); -- Defenders in box

-- Pass-specific situational
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS target_depth TEXT CHECK (target_depth IN ('behind_los', 'short', 'intermediate', 'deep')),
  ADD COLUMN IF NOT EXISTS pass_location TEXT CHECK (pass_location IN ('left', 'middle', 'right'));

-- Play concept (from playbook or manual override)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS play_concept TEXT; -- E.g., 'Inside Zone', 'Power', 'Four Verticals', 'Mesh'

-- Indexes for situational queries
CREATE INDEX IF NOT EXISTS idx_play_instances_motion ON play_instances(has_motion) WHERE has_motion = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_play_action ON play_instances(is_play_action) WHERE is_play_action = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_blitz ON play_instances(facing_blitz) WHERE facing_blitz = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_box_count ON play_instances(box_count) WHERE box_count IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_target_depth ON play_instances(target_depth);
CREATE INDEX IF NOT EXISTS idx_play_instances_play_concept ON play_instances(play_concept);

-- Helper function: Compare situational splits
CREATE OR REPLACE FUNCTION get_situational_split(
  p_team_id UUID,
  p_situation TEXT,
  p_value BOOLEAN
)
RETURNS TABLE (
  plays BIGINT,
  yards BIGINT,
  success_rate NUMERIC,
  explosive_rate NUMERIC,
  yards_per_play NUMERIC
) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT
      COUNT(*)::BIGINT as plays,
      SUM(yards_gained)::BIGINT as yards,
      ROUND(AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) * 100, 1) as success_rate,
      ROUND(AVG(CASE WHEN explosive THEN 1.0 ELSE 0.0 END) * 100, 1) as explosive_rate,
      ROUND(AVG(yards_gained), 1) as yards_per_play
    FROM play_instances
    WHERE team_id = $1
      AND is_opponent_play = false
      AND %I = $2
  ', p_situation)
  USING p_team_id, p_value;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Play concept rankings
CREATE OR REPLACE FUNCTION get_play_concept_rankings(p_team_id UUID, p_min_plays INTEGER DEFAULT 5)
RETURNS TABLE (
  play_concept TEXT,
  plays BIGINT,
  yards BIGINT,
  yards_per_play NUMERIC,
  success_rate NUMERIC,
  explosive_rate NUMERIC,
  first_downs BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pi.play_concept,
    COUNT(*)::BIGINT as plays,
    SUM(pi.yards_gained)::BIGINT as yards,
    ROUND(AVG(pi.yards_gained), 1) as yards_per_play,
    ROUND(AVG(CASE WHEN pi.success THEN 1.0 ELSE 0.0 END) * 100, 1) as success_rate,
    ROUND(AVG(CASE WHEN pi.explosive THEN 1.0 ELSE 0.0 END) * 100, 1) as explosive_rate,
    COUNT(*) FILTER (WHERE pi.resulted_in_first_down)::BIGINT as first_downs
  FROM play_instances pi
  WHERE pi.team_id = p_team_id
    AND pi.is_opponent_play = false
    AND pi.play_concept IS NOT NULL
  GROUP BY pi.play_concept
  HAVING COUNT(*) >= p_min_plays
  ORDER BY AVG(pi.yards_gained) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Down/distance breakdown
CREATE OR REPLACE FUNCTION get_down_distance_stats(p_team_id UUID)
RETURNS TABLE (
  down INTEGER,
  distance_range TEXT,
  plays BIGINT,
  success_rate NUMERIC,
  yards_per_play NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pi.down,
    CASE
      WHEN pi.distance <= 3 THEN 'short'
      WHEN pi.distance BETWEEN 4 AND 7 THEN 'medium'
      ELSE 'long'
    END as distance_range,
    COUNT(*)::BIGINT as plays,
    ROUND(AVG(CASE WHEN pi.success THEN 1.0 ELSE 0.0 END) * 100, 1) as success_rate,
    ROUND(AVG(pi.yards_gained), 1) as yards_per_play
  FROM play_instances pi
  WHERE pi.team_id = p_team_id
    AND pi.is_opponent_play = false
    AND pi.down IS NOT NULL
    AND pi.distance IS NOT NULL
  GROUP BY pi.down, distance_range
  ORDER BY pi.down, distance_range;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Field position splits (own territory vs opponent territory)
CREATE OR REPLACE FUNCTION get_field_position_splits(p_team_id UUID)
RETURNS TABLE (
  field_zone TEXT,
  plays BIGINT,
  success_rate NUMERIC,
  yards_per_play NUMERIC,
  explosive_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN pi.yard_line < 20 THEN 'backed_up' -- Own 20 or less
      WHEN pi.yard_line BETWEEN 20 AND 49 THEN 'own_territory'
      WHEN pi.yard_line BETWEEN 50 AND 79 THEN 'opponent_territory'
      WHEN pi.yard_line >= 80 THEN 'red_zone'
      ELSE 'unknown'
    END as field_zone,
    COUNT(*)::BIGINT as plays,
    ROUND(AVG(CASE WHEN pi.success THEN 1.0 ELSE 0.0 END) * 100, 1) as success_rate,
    ROUND(AVG(pi.yards_gained), 1) as yards_per_play,
    ROUND(AVG(CASE WHEN pi.explosive THEN 1.0 ELSE 0.0 END) * 100, 1) as explosive_rate
  FROM play_instances pi
  WHERE pi.team_id = p_team_id
    AND pi.is_opponent_play = false
    AND pi.yard_line IS NOT NULL
  GROUP BY field_zone
  ORDER BY
    CASE field_zone
      WHEN 'backed_up' THEN 1
      WHEN 'own_territory' THEN 2
      WHEN 'opponent_territory' THEN 3
      WHEN 'red_zone' THEN 4
      ELSE 5
    END;
END;
$$ LANGUAGE plpgsql STABLE;
