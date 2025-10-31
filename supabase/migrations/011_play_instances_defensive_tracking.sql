-- Migration 011: Play Instances - Defensive Tracking (Tier 3)
-- Adds defensive player tracking for tackles, pressures, coverage
-- Enables defensive player analytics and havoc rate calculations

-- Defensive player attribution (arrays for multiple players)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS tackler_ids UUID[] DEFAULT '{}', -- Primary + assists
  ADD COLUMN IF NOT EXISTS missed_tackle_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pressure_player_ids UUID[] DEFAULT '{}';

-- Single player fields
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS sack_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coverage_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coverage_result TEXT CHECK (coverage_result IN ('win', 'loss', 'neutral'));

-- Defensive event flags (for havoc rate calculation)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS is_tfl BOOLEAN DEFAULT false, -- Tackle for loss
  ADD COLUMN IF NOT EXISTS is_sack BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_forced_fumble BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pbu BOOLEAN DEFAULT false, -- Pass breakup
  ADD COLUMN IF NOT EXISTS is_interception BOOLEAN DEFAULT false;

-- QB grading (Tier 3 - offensive perspective)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS qb_decision_grade INTEGER CHECK (qb_decision_grade BETWEEN 0 AND 2); -- 0=bad, 1=ok, 2=great

-- Contain/edge discipline
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS contain_set_edge BOOLEAN DEFAULT false;

-- Indexes for defensive queries
CREATE INDEX IF NOT EXISTS idx_play_instances_tacklers ON play_instances USING GIN (tackler_ids);
CREATE INDEX IF NOT EXISTS idx_play_instances_missed_tackles ON play_instances USING GIN (missed_tackle_ids);
CREATE INDEX IF NOT EXISTS idx_play_instances_pressures ON play_instances USING GIN (pressure_player_ids);
CREATE INDEX IF NOT EXISTS idx_play_instances_sack_player ON play_instances(sack_player_id) WHERE sack_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_coverage_player ON play_instances(coverage_player_id) WHERE coverage_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_tfl ON play_instances(is_tfl) WHERE is_tfl = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_sacks ON play_instances(is_sack) WHERE is_sack = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_pbu ON play_instances(is_pbu) WHERE is_pbu = true;

-- Helper function: Calculate tackle participation rate for a player
CREATE OR REPLACE FUNCTION calculate_tackle_participation(p_player_id UUID, p_team_id UUID)
RETURNS TABLE (
  defensive_snaps BIGINT,
  primary_tackles BIGINT,
  assist_tackles BIGINT,
  total_tackles BIGINT,
  missed_tackles BIGINT,
  participation_rate NUMERIC,
  missed_tackle_rate NUMERIC
) AS $$
DECLARE
  v_defensive_snaps BIGINT;
  v_primary BIGINT;
  v_assists BIGINT;
  v_total BIGINT;
  v_missed BIGINT;
BEGIN
  -- Count total defensive snaps for this team
  SELECT COUNT(*)
  INTO v_defensive_snaps
  FROM play_instances
  WHERE team_id = p_team_id
    AND is_opponent_play = false; -- Defensive snaps from team's perspective

  -- Count tackles (player is first in tackler_ids array = primary)
  SELECT
    COUNT(*) FILTER (WHERE tackler_ids[1] = p_player_id),
    COUNT(*) FILTER (WHERE p_player_id = ANY(tackler_ids) AND tackler_ids[1] != p_player_id),
    COUNT(*) FILTER (WHERE p_player_id = ANY(tackler_ids)),
    COUNT(*) FILTER (WHERE p_player_id = ANY(missed_tackle_ids))
  INTO v_primary, v_assists, v_total, v_missed
  FROM play_instances
  WHERE team_id = p_team_id
    AND is_opponent_play = false;

  RETURN QUERY SELECT
    v_defensive_snaps,
    v_primary,
    v_assists,
    v_total,
    v_missed,
    CASE
      WHEN v_defensive_snaps > 0 THEN ROUND((v_total::NUMERIC / v_defensive_snaps) * 100, 1)
      ELSE NULL
    END as participation_rate,
    CASE
      WHEN (v_total + v_missed) > 0 THEN ROUND((v_missed::NUMERIC / (v_total + v_missed)) * 100, 1)
      ELSE NULL
    END as missed_tackle_rate;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Calculate pressure rate for a player
CREATE OR REPLACE FUNCTION calculate_pressure_rate(p_player_id UUID, p_team_id UUID)
RETURNS TABLE (
  defensive_snaps BIGINT,
  pressures BIGINT,
  sacks BIGINT,
  pressure_rate NUMERIC,
  sack_rate NUMERIC
) AS $$
DECLARE
  v_defensive_snaps BIGINT;
  v_pressures BIGINT;
  v_sacks BIGINT;
BEGIN
  -- Count total defensive snaps
  SELECT COUNT(*)
  INTO v_defensive_snaps
  FROM play_instances
  WHERE team_id = p_team_id
    AND is_opponent_play = false;

  -- Count pressures and sacks
  SELECT
    COUNT(*) FILTER (WHERE p_player_id = ANY(pressure_player_ids)),
    COUNT(*) FILTER (WHERE sack_player_id = p_player_id)
  INTO v_pressures, v_sacks
  FROM play_instances
  WHERE team_id = p_team_id
    AND is_opponent_play = false;

  RETURN QUERY SELECT
    v_defensive_snaps,
    v_pressures,
    v_sacks,
    CASE
      WHEN v_defensive_snaps > 0 THEN ROUND((v_pressures::NUMERIC / v_defensive_snaps) * 100, 1)
      ELSE NULL
    END as pressure_rate,
    CASE
      WHEN v_defensive_snaps > 0 THEN ROUND((v_sacks::NUMERIC / v_defensive_snaps) * 100, 1)
      ELSE NULL
    END as sack_rate;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Calculate havoc rate for a team
CREATE OR REPLACE FUNCTION calculate_havoc_rate(p_team_id UUID)
RETURNS TABLE (
  defensive_snaps BIGINT,
  havoc_plays BIGINT,
  havoc_rate NUMERIC,
  tfls BIGINT,
  sacks BIGINT,
  forced_fumbles BIGINT,
  interceptions BIGINT,
  pbus BIGINT
) AS $$
DECLARE
  v_defensive_snaps BIGINT;
  v_havoc BIGINT;
  v_tfls BIGINT;
  v_sacks BIGINT;
  v_ff BIGINT;
  v_int BIGINT;
  v_pbu BIGINT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_tfl OR is_sack OR is_forced_fumble OR is_interception OR is_pbu),
    COUNT(*) FILTER (WHERE is_tfl),
    COUNT(*) FILTER (WHERE is_sack),
    COUNT(*) FILTER (WHERE is_forced_fumble),
    COUNT(*) FILTER (WHERE is_interception),
    COUNT(*) FILTER (WHERE is_pbu)
  INTO v_defensive_snaps, v_havoc, v_tfls, v_sacks, v_ff, v_int, v_pbu
  FROM play_instances
  WHERE team_id = p_team_id
    AND is_opponent_play = false;

  RETURN QUERY SELECT
    v_defensive_snaps,
    v_havoc,
    CASE
      WHEN v_defensive_snaps > 0 THEN ROUND((v_havoc::NUMERIC / v_defensive_snaps) * 100, 1)
      ELSE NULL
    END as havoc_rate,
    v_tfls,
    v_sacks,
    v_ff,
    v_int,
    v_pbu;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Coverage success rate
CREATE OR REPLACE FUNCTION calculate_coverage_success(p_player_id UUID, p_team_id UUID)
RETURNS TABLE (
  targets BIGINT,
  successes BIGINT, -- Incompletion, INT, PBU, or sack
  success_rate NUMERIC
) AS $$
DECLARE
  v_targets BIGINT;
  v_successes BIGINT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE coverage_result = 'win')
  INTO v_targets, v_successes
  FROM play_instances
  WHERE coverage_player_id = p_player_id
    AND team_id = p_team_id;

  RETURN QUERY SELECT
    v_targets,
    v_successes,
    CASE
      WHEN v_targets > 0 THEN ROUND((v_successes::NUMERIC / v_targets) * 100, 1)
      ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql STABLE;
