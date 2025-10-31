-- Migration 010: Play Instances - Offensive Line Tracking (Tier 3)
-- Adds OL position tracking and block win/loss grading
-- Enables block win rate analytics by position and player

-- Offensive line positions and results
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS lt_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lt_block_result TEXT CHECK (lt_block_result IN ('win', 'loss', 'neutral')),

  ADD COLUMN IF NOT EXISTS lg_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lg_block_result TEXT CHECK (lg_block_result IN ('win', 'loss', 'neutral')),

  ADD COLUMN IF NOT EXISTS c_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS c_block_result TEXT CHECK (c_block_result IN ('win', 'loss', 'neutral')),

  ADD COLUMN IF NOT EXISTS rg_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rg_block_result TEXT CHECK (rg_block_result IN ('win', 'loss', 'neutral')),

  ADD COLUMN IF NOT EXISTS rt_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rt_block_result TEXT CHECK (rt_block_result IN ('win', 'loss', 'neutral'));

-- Penalty tracking for OL
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS ol_penalty_player_id UUID REFERENCES players(id) ON DELETE SET NULL;

-- Indexes for OL queries
CREATE INDEX IF NOT EXISTS idx_play_instances_lt ON play_instances(lt_id) WHERE lt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_lg ON play_instances(lg_id) WHERE lg_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_c ON play_instances(c_id) WHERE c_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_rg ON play_instances(rg_id) WHERE rg_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_play_instances_rt ON play_instances(rt_id) WHERE rt_id IS NOT NULL;

-- Composite index for OL analysis (all 5 positions)
CREATE INDEX IF NOT EXISTS idx_play_instances_ol_all
  ON play_instances(lt_id, lg_id, c_id, rg_id, rt_id)
  WHERE lt_id IS NOT NULL OR lg_id IS NOT NULL OR c_id IS NOT NULL OR rg_id IS NOT NULL OR rt_id IS NOT NULL;

-- Helper function: Calculate block win rate for a player
CREATE OR REPLACE FUNCTION calculate_block_win_rate(p_player_id UUID)
RETURNS TABLE (
  assignments BIGINT,
  wins BIGINT,
  losses BIGINT,
  neutral BIGINT,
  win_rate NUMERIC
) AS $$
DECLARE
  v_assignments BIGINT := 0;
  v_wins BIGINT := 0;
  v_losses BIGINT := 0;
  v_neutral BIGINT := 0;
BEGIN
  -- Count plays where player was at LT
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE lt_block_result = 'win'),
    COUNT(*) FILTER (WHERE lt_block_result = 'loss'),
    COUNT(*) FILTER (WHERE lt_block_result = 'neutral')
  INTO v_assignments, v_wins, v_losses, v_neutral
  FROM play_instances
  WHERE lt_id = p_player_id;

  -- Add plays where player was at LG
  SELECT
    v_assignments + COUNT(*),
    v_wins + COUNT(*) FILTER (WHERE lg_block_result = 'win'),
    v_losses + COUNT(*) FILTER (WHERE lg_block_result = 'loss'),
    v_neutral + COUNT(*) FILTER (WHERE lg_block_result = 'neutral')
  INTO v_assignments, v_wins, v_losses, v_neutral
  FROM play_instances
  WHERE lg_id = p_player_id;

  -- Add plays where player was at C
  SELECT
    v_assignments + COUNT(*),
    v_wins + COUNT(*) FILTER (WHERE c_block_result = 'win'),
    v_losses + COUNT(*) FILTER (WHERE c_block_result = 'loss'),
    v_neutral + COUNT(*) FILTER (WHERE c_block_result = 'neutral')
  INTO v_assignments, v_wins, v_losses, v_neutral
  FROM play_instances
  WHERE c_id = p_player_id;

  -- Add plays where player was at RG
  SELECT
    v_assignments + COUNT(*),
    v_wins + COUNT(*) FILTER (WHERE rg_block_result = 'win'),
    v_losses + COUNT(*) FILTER (WHERE rg_block_result = 'loss'),
    v_neutral + COUNT(*) FILTER (WHERE rg_block_result = 'neutral')
  INTO v_assignments, v_wins, v_losses, v_neutral
  FROM play_instances
  WHERE rg_id = p_player_id;

  -- Add plays where player was at RT
  SELECT
    v_assignments + COUNT(*),
    v_wins + COUNT(*) FILTER (WHERE rt_block_result = 'win'),
    v_losses + COUNT(*) FILTER (WHERE rt_block_result = 'loss'),
    v_neutral + COUNT(*) FILTER (WHERE rt_block_result = 'neutral')
  INTO v_assignments, v_wins, v_losses, v_neutral
  FROM play_instances
  WHERE rt_id = p_player_id;

  -- Calculate win rate
  RETURN QUERY SELECT
    v_assignments,
    v_wins,
    v_losses,
    v_neutral,
    CASE
      WHEN v_assignments > 0 THEN ROUND((v_wins::NUMERIC / v_assignments) * 100, 1)
      ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: Get OL performance by position
CREATE OR REPLACE FUNCTION get_ol_position_stats(p_position TEXT, p_team_id UUID)
RETURNS TABLE (
  total_plays BIGINT,
  wins BIGINT,
  losses BIGINT,
  neutral BIGINT,
  win_rate NUMERIC
) AS $$
DECLARE
  v_col_id TEXT;
  v_col_result TEXT;
BEGIN
  -- Map position to column names
  v_col_id := p_position || '_id';
  v_col_result := p_position || '_block_result';

  -- Dynamic query based on position
  RETURN QUERY EXECUTE format('
    SELECT
      COUNT(*) FILTER (WHERE %I IS NOT NULL)::BIGINT as total_plays,
      COUNT(*) FILTER (WHERE %I = ''win'')::BIGINT as wins,
      COUNT(*) FILTER (WHERE %I = ''loss'')::BIGINT as losses,
      COUNT(*) FILTER (WHERE %I = ''neutral'')::BIGINT as neutral,
      CASE
        WHEN COUNT(*) FILTER (WHERE %I IS NOT NULL) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE %I = ''win'')::NUMERIC /
              COUNT(*) FILTER (WHERE %I IS NOT NULL)) * 100, 1)
        ELSE NULL
      END as win_rate
    FROM play_instances
    WHERE team_id = $1
  ', v_col_id, v_col_result, v_col_result, v_col_result, v_col_id, v_col_result, v_col_id)
  USING p_team_id;
END;
$$ LANGUAGE plpgsql STABLE;
