-- ============================================================================
-- Migration 190: Position architecture foundation (Phase 1)
--
-- All position-related data prior to this migration is test data and is
-- discarded. No backfill required.
--
--   1. New tables: position_categories, team_schemes, scheme_positions,
--      player_scheme_assignments
--   2. Seed position_categories with 12 football rows
--   3. Modify players: ADD primary_position_category_id (LEAVE position_depths
--      in place — Phase 2 migrates the 86 consumers and drops the column)
--   4. Modify play_personnel: drop FK to sport_positions, rename position_id
--      to scheme_position_id, repoint FK to scheme_positions, add a separate
--      position_category_id direct FK
--   5. Drop sport_positions
--   6. Rewrite the 8 player stats functions to JOIN
--      players.primary_position_category_id → position_categories.code
--      instead of the dropped players.primary_position
--   7. RLS on all new tables
--
-- Apply via: supabase db push  (or paste into the SQL editor)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. position_categories — 12 stable identities (sport-scoped)
-- ---------------------------------------------------------------------------

CREATE TABLE position_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('offense', 'defense', 'special_teams', 'flex')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sport, code)
);

COMMENT ON TABLE position_categories IS
  'Broad position identities used for roster, stats, and reports. Sport-scoped. Stable across schemes.';

ALTER TABLE position_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_position_categories"
  ON position_categories FOR SELECT
  USING (true);

INSERT INTO position_categories (sport, code, name, unit, sort_order) VALUES
  ('football', 'QB',  'Quarterback',         'offense',        1),
  ('football', 'RB',  'Running Back',        'offense',        2),
  ('football', 'WR',  'Wide Receiver',       'offense',        3),
  ('football', 'TE',  'Tight End',           'offense',        4),
  ('football', 'OL',  'Offensive Lineman',   'offense',        5),
  ('football', 'DL',  'Defensive Lineman',   'defense',       10),
  ('football', 'LB',  'Linebacker',          'defense',       11),
  ('football', 'DB',  'Defensive Back',      'defense',       12),
  ('football', 'K',   'Kicker',              'special_teams', 20),
  ('football', 'P',   'Punter',              'special_teams', 21),
  ('football', 'LS',  'Long Snapper',        'special_teams', 22),
  ('football', 'ATH', 'Athlete',             'flex',          30);

-- ---------------------------------------------------------------------------
-- 2. team_schemes — per-team scheme definitions
-- ---------------------------------------------------------------------------

CREATE TABLE team_schemes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  sport TEXT NOT NULL DEFAULT 'football',
  template_key TEXT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('offense', 'defense', 'special_teams')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN team_schemes.template_key IS
  'Stable system-template id (e.g., 4-3-base) preserved across renames for cross-team analytics. NULL for fully-custom schemes.';

CREATE INDEX idx_team_schemes_team ON team_schemes(team_id);
CREATE UNIQUE INDEX team_schemes_one_default_per_unit
  ON team_schemes(team_id, unit) WHERE is_default = true;

ALTER TABLE team_schemes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_schemes_select"
  ON team_schemes FOR SELECT
  USING (team_id IN (SELECT get_user_team_ids()));

CREATE POLICY "team_schemes_insert"
  ON team_schemes FOR INSERT
  WITH CHECK (team_id IN (SELECT get_user_team_ids()));

CREATE POLICY "team_schemes_update"
  ON team_schemes FOR UPDATE
  USING (team_id IN (SELECT get_user_team_ids()));

CREATE POLICY "team_schemes_delete"
  ON team_schemes FOR DELETE
  USING (team_id IN (SELECT get_user_team_ids()));

-- ---------------------------------------------------------------------------
-- 3. scheme_positions — slots within a scheme
-- ---------------------------------------------------------------------------

CREATE TABLE scheme_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheme_id UUID NOT NULL REFERENCES team_schemes(id) ON DELETE CASCADE,
  position_category_id UUID NOT NULL REFERENCES position_categories(id) ON DELETE RESTRICT,
  slot_code TEXT NOT NULL,
  display_label TEXT NOT NULL,
  diagram_x NUMERIC,
  diagram_y NUMERIC,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (scheme_id, slot_code)
);

COMMENT ON TABLE scheme_positions IS
  'Specific slots within a scheme (LDE, DT1, MIKE, LCB, etc.). Each slot links back to a position_category for stat aggregation.';

CREATE INDEX idx_scheme_positions_scheme ON scheme_positions(scheme_id);
CREATE INDEX idx_scheme_positions_category ON scheme_positions(position_category_id);

ALTER TABLE scheme_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheme_positions_select"
  ON scheme_positions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM team_schemes ts
    WHERE ts.id = scheme_positions.scheme_id
      AND ts.team_id IN (SELECT get_user_team_ids())
  ));

CREATE POLICY "scheme_positions_insert"
  ON scheme_positions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM team_schemes ts
    WHERE ts.id = scheme_id
      AND ts.team_id IN (SELECT get_user_team_ids())
  ));

CREATE POLICY "scheme_positions_update"
  ON scheme_positions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM team_schemes ts
    WHERE ts.id = scheme_positions.scheme_id
      AND ts.team_id IN (SELECT get_user_team_ids())
  ));

CREATE POLICY "scheme_positions_delete"
  ON scheme_positions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM team_schemes ts
    WHERE ts.id = scheme_positions.scheme_id
      AND ts.team_id IN (SELECT get_user_team_ids())
  ));

-- ---------------------------------------------------------------------------
-- 4. player_scheme_assignments — depth chart entries
-- ---------------------------------------------------------------------------

CREATE TABLE player_scheme_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  scheme_position_id UUID NOT NULL REFERENCES scheme_positions(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL CHECK (depth >= 1 AND depth <= 5),
  notes TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (player_id, scheme_position_id),
  UNIQUE (scheme_position_id, depth)
);

COMMENT ON TABLE player_scheme_assignments IS
  'Depth chart links. Replaces players.position_depths JSONB. One player → many assignments across schemes.';

CREATE INDEX idx_psa_player ON player_scheme_assignments(player_id);
CREATE INDEX idx_psa_scheme_position ON player_scheme_assignments(scheme_position_id);

ALTER TABLE player_scheme_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psa_select"
  ON player_scheme_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM scheme_positions sp
    JOIN team_schemes ts ON ts.id = sp.scheme_id
    WHERE sp.id = player_scheme_assignments.scheme_position_id
      AND ts.team_id IN (SELECT get_user_team_ids())
  ));

CREATE POLICY "psa_insert"
  ON player_scheme_assignments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM scheme_positions sp
    JOIN team_schemes ts ON ts.id = sp.scheme_id
    WHERE sp.id = scheme_position_id
      AND ts.team_id IN (SELECT get_user_team_ids())
  ));

CREATE POLICY "psa_update"
  ON player_scheme_assignments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM scheme_positions sp
    JOIN team_schemes ts ON ts.id = sp.scheme_id
    WHERE sp.id = player_scheme_assignments.scheme_position_id
      AND ts.team_id IN (SELECT get_user_team_ids())
  ));

CREATE POLICY "psa_delete"
  ON player_scheme_assignments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM scheme_positions sp
    JOIN team_schemes ts ON ts.id = sp.scheme_id
    WHERE sp.id = player_scheme_assignments.scheme_position_id
      AND ts.team_id IN (SELECT get_user_team_ids())
  ));

-- ---------------------------------------------------------------------------
-- 5. Modify players (Option C: keep position_depths nullable, drop in Phase 2)
-- ---------------------------------------------------------------------------

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS primary_position_category_id UUID REFERENCES position_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_players_primary_category
  ON players(primary_position_category_id);

-- Wipe existing roster — test data only, no preservation needed.
-- This also clears old position_depths content; the column itself stays.
TRUNCATE TABLE players CASCADE;

-- ---------------------------------------------------------------------------
-- 6. Repoint play_personnel to the new scheme_positions FK
-- ---------------------------------------------------------------------------

-- Wipe play_personnel — its position_id values point at sport_positions which
-- is being dropped. Test data only.
TRUNCATE TABLE play_personnel CASCADE;

ALTER TABLE play_personnel
  DROP CONSTRAINT IF EXISTS play_personnel_position_id_fkey;

ALTER TABLE play_personnel
  RENAME COLUMN position_id TO scheme_position_id;

ALTER TABLE play_personnel
  ADD CONSTRAINT play_personnel_scheme_position_id_fkey
  FOREIGN KEY (scheme_position_id) REFERENCES scheme_positions(id) ON DELETE SET NULL;

ALTER TABLE play_personnel
  ADD COLUMN position_category_id UUID REFERENCES position_categories(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS idx_play_personnel_position;

CREATE INDEX idx_play_personnel_scheme_position
  ON play_personnel(scheme_position_id) WHERE scheme_position_id IS NOT NULL;

CREATE INDEX idx_play_personnel_category
  ON play_personnel(position_category_id) WHERE position_category_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 7. Drop sport_positions
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "anyone_can_read_sport_positions" ON sport_positions;
DROP POLICY IF EXISTS "admin_manage_sport_positions" ON sport_positions;
DROP TABLE IF EXISTS sport_positions CASCADE;

-- ---------------------------------------------------------------------------
-- 8. Rewrite the 8 player stats functions
--    Pattern: replace `p.primary_position` filters with a join to
--    position_categories via players.primary_position_category_id.
--    Output schema is preserved so React components don't have to change.
-- ---------------------------------------------------------------------------

-- ---------- QB ----------

CREATE OR REPLACE FUNCTION get_qb_stats(p_team_id UUID, p_game_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  WITH video_filter AS (
    SELECT v.id AS video_id
    FROM videos v
    JOIN games g ON g.id = v.game_id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  qb_plays AS (
    SELECT
      pp.player_id,
      p.first_name, p.last_name, p.jersey_number, pc.code AS position_code,
      pp.play_instance_id, pp.result, pp.yards_gained, pp.is_touchdown, pp.is_turnover,
      pi.is_sack
    FROM player_participation pp
    JOIN play_instances pi ON pi.id = pp.play_instance_id
    JOIN video_filter vf ON vf.video_id = pi.video_id
    JOIN players p ON p.id = pp.player_id
    JOIN position_categories pc ON pc.id = p.primary_position_category_id
    WHERE pp.team_id = p_team_id
      AND pp.participation_type = 'passer'
      AND pi.is_opponent_play = false
      AND pc.code = 'QB'
  ),
  agg AS (
    SELECT
      player_id, first_name, last_name, jersey_number, position_code,
      COUNT(play_instance_id)                              AS pass_attempts,
      COUNT(*) FILTER (WHERE result = 'success')           AS completions,
      COALESCE(SUM(yards_gained), 0)                       AS passing_yards,
      COUNT(*) FILTER (WHERE is_touchdown)                 AS pass_tds,
      COUNT(*) FILTER (WHERE is_turnover)                  AS interceptions,
      COUNT(*) FILTER (WHERE is_sack)                      AS sacks
    FROM qb_plays
    GROUP BY player_id, first_name, last_name, jersey_number, position_code
  )
  SELECT jsonb_agg(jsonb_build_object(
    'playerId',        player_id,
    'playerName',      first_name || ' ' || last_name,
    'jerseyNumber',    jersey_number,
    'position',        position_code,
    'passAttempts',    pass_attempts,
    'completions',     completions,
    'completionPct',   CASE WHEN pass_attempts = 0 THEN 0
                            ELSE ROUND(100.0 * completions / pass_attempts, 1) END,
    'passingYards',    passing_yards,
    'yardsPerAttempt', CASE WHEN pass_attempts = 0 THEN 0
                            ELSE ROUND(passing_yards::NUMERIC / pass_attempts, 1) END,
    'passTDs',         pass_tds,
    'interceptions',   interceptions,
    'sacks',           sacks,
    'qbRating',        0
  )) INTO result
  FROM agg;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_qb_stats(UUID, UUID) TO authenticated;

-- ---------- RB ----------

CREATE OR REPLACE FUNCTION get_rb_stats(p_team_id UUID, p_game_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  WITH video_filter AS (
    SELECT v.id AS video_id
    FROM videos v
    JOIN games g ON g.id = v.game_id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  rb_rushing AS (
    SELECT
      pp.player_id,
      p.first_name, p.last_name, p.jersey_number, pc.code AS position_code,
      pp.yards_gained, pp.is_touchdown
    FROM player_participation pp
    JOIN play_instances pi ON pi.id = pp.play_instance_id
    JOIN video_filter vf ON vf.video_id = pi.video_id
    JOIN players p ON p.id = pp.player_id
    JOIN position_categories pc ON pc.id = p.primary_position_category_id
    WHERE pp.team_id = p_team_id
      AND pp.participation_type = 'rusher'
      AND pi.is_opponent_play = false
      AND pc.code = 'RB'
  ),
  rb_receiving AS (
    SELECT
      pp.player_id,
      p.first_name, p.last_name, p.jersey_number, pc.code AS position_code,
      pp.yards_gained, pp.is_touchdown, pp.result
    FROM player_participation pp
    JOIN play_instances pi ON pi.id = pp.play_instance_id
    JOIN video_filter vf ON vf.video_id = pi.video_id
    JOIN players p ON p.id = pp.player_id
    JOIN position_categories pc ON pc.id = p.primary_position_category_id
    WHERE pp.team_id = p_team_id
      AND pp.participation_type = 'receiver'
      AND pi.is_opponent_play = false
      AND pc.code = 'RB'
  ),
  rushing_agg AS (
    SELECT
      player_id, first_name, last_name, jersey_number, position_code,
      COUNT(*)                              AS carries,
      COALESCE(SUM(yards_gained), 0)        AS rush_yards,
      COUNT(*) FILTER (WHERE is_touchdown)  AS rush_tds,
      COALESCE(MAX(yards_gained), 0)        AS longest_run,
      COUNT(*) FILTER (WHERE yards_gained >= 12) AS explosive_runs
    FROM rb_rushing
    GROUP BY player_id, first_name, last_name, jersey_number, position_code
  ),
  receiving_agg AS (
    SELECT
      player_id, first_name, last_name, jersey_number, position_code,
      COUNT(*)                                AS targets,
      COUNT(*) FILTER (WHERE result = 'success') AS receptions,
      COALESCE(SUM(yards_gained), 0)          AS rec_yards,
      COUNT(*) FILTER (WHERE is_touchdown)    AS rec_tds
    FROM rb_receiving
    GROUP BY player_id, first_name, last_name, jersey_number, position_code
  ),
  combined AS (
    SELECT
      COALESCE(r.player_id, c.player_id) AS player_id,
      COALESCE(r.first_name, c.first_name) AS first_name,
      COALESCE(r.last_name, c.last_name) AS last_name,
      COALESCE(r.jersey_number, c.jersey_number) AS jersey_number,
      COALESCE(r.position_code, c.position_code) AS position_code,
      COALESCE(r.carries, 0) AS carries,
      COALESCE(r.rush_yards, 0) AS rush_yards,
      COALESCE(r.rush_tds, 0) AS rush_tds,
      COALESCE(r.longest_run, 0) AS longest_run,
      COALESCE(r.explosive_runs, 0) AS explosive_runs,
      COALESCE(c.targets, 0) AS targets,
      COALESCE(c.receptions, 0) AS receptions,
      COALESCE(c.rec_yards, 0) AS rec_yards,
      COALESCE(c.rec_tds, 0) AS rec_tds
    FROM rushing_agg r
    FULL OUTER JOIN receiving_agg c ON c.player_id = r.player_id
  )
  SELECT jsonb_agg(jsonb_build_object(
    'playerId',     player_id,
    'playerName',   first_name || ' ' || last_name,
    'jerseyNumber', jersey_number,
    'position',     position_code,
    'carries',      carries,
    'rushYards',    rush_yards,
    'rushAvg',      CASE WHEN carries = 0 THEN 0 ELSE ROUND(rush_yards::NUMERIC / carries, 1) END,
    'rushTDs',      rush_tds,
    'longestRun',   longest_run,
    'explosiveRuns', explosive_runs,
    'targets',      targets,
    'receptions',   receptions,
    'recYards',     rec_yards,
    'recTDs',       rec_tds,
    'totalYards',   rush_yards + rec_yards,
    'totalTDs',     rush_tds + rec_tds
  )) INTO result
  FROM combined;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_rb_stats(UUID, UUID) TO authenticated;

-- ---------- WR/TE ----------

CREATE OR REPLACE FUNCTION get_wrte_stats(p_team_id UUID, p_game_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  WITH video_filter AS (
    SELECT v.id AS video_id
    FROM videos v
    JOIN games g ON g.id = v.game_id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  rec_plays AS (
    SELECT
      pp.player_id,
      p.first_name, p.last_name, p.jersey_number, pc.code AS position_code,
      pp.yards_gained, pp.is_touchdown, pp.result
    FROM player_participation pp
    JOIN play_instances pi ON pi.id = pp.play_instance_id
    JOIN video_filter vf ON vf.video_id = pi.video_id
    JOIN players p ON p.id = pp.player_id
    JOIN position_categories pc ON pc.id = p.primary_position_category_id
    WHERE pp.team_id = p_team_id
      AND pp.participation_type = 'receiver'
      AND pi.is_opponent_play = false
      AND pc.code IN ('WR', 'TE')
  ),
  agg AS (
    SELECT
      player_id, first_name, last_name, jersey_number, position_code,
      COUNT(*)                                       AS targets,
      COUNT(*) FILTER (WHERE result = 'success')     AS receptions,
      COALESCE(SUM(yards_gained), 0)                 AS rec_yards,
      COUNT(*) FILTER (WHERE is_touchdown)           AS rec_tds,
      COUNT(*) FILTER (WHERE result = 'success' AND yards_gained >= 16) AS explosive_catches
    FROM rec_plays
    GROUP BY player_id, first_name, last_name, jersey_number, position_code
  )
  SELECT jsonb_agg(jsonb_build_object(
    'playerId',        player_id,
    'playerName',      first_name || ' ' || last_name,
    'jerseyNumber',    jersey_number,
    'position',        position_code,
    'targets',         targets,
    'receptions',      receptions,
    'recYards',        rec_yards,
    'recAvg',          CASE WHEN receptions = 0 THEN 0
                            ELSE ROUND(rec_yards::NUMERIC / receptions, 1) END,
    'recTDs',          rec_tds,
    'catchRate',       CASE WHEN targets = 0 THEN 0
                            ELSE ROUND(100.0 * receptions / targets, 1) END,
    'explosiveCatches', explosive_catches
  )) INTO result
  FROM agg;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_wrte_stats(UUID, UUID) TO authenticated;

-- ---------- DL ----------

CREATE OR REPLACE FUNCTION get_dl_stats(p_team_id UUID, p_game_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  WITH video_filter AS (
    SELECT v.id AS video_id
    FROM videos v
    JOIN games g ON g.id = v.game_id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  dl_plays AS (
    SELECT
      pp.player_id,
      p.first_name, p.last_name, p.jersey_number, pc.code AS position_code,
      pp.participation_type, pp.result
    FROM player_participation pp
    JOIN play_instances pi ON pi.id = pp.play_instance_id
    JOIN video_filter vf ON vf.video_id = pi.video_id
    JOIN players p ON p.id = pp.player_id
    JOIN position_categories pc ON pc.id = p.primary_position_category_id
    WHERE pp.team_id = p_team_id
      AND pi.is_opponent_play = false
      AND pc.code = 'DL'
  ),
  agg AS (
    SELECT
      player_id, first_name, last_name, jersey_number, position_code,
      COUNT(*) FILTER (WHERE participation_type = 'primary_tackle')                   AS primary_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'assist_tackle')                    AS assist_tackles,
      COUNT(*) FILTER (WHERE participation_type IN ('primary_tackle','assist_tackle')) AS total_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'missed_tackle')                    AS missed_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'pressure')                         AS pressures,
      COUNT(*) FILTER (WHERE participation_type = 'pressure' AND result = 'sack')     AS sacks,
      COUNT(*) FILTER (WHERE participation_type = 'tackle_for_loss')                  AS tfls,
      COUNT(*) FILTER (WHERE participation_type = 'forced_fumble')                    AS forced_fumbles,
      COUNT(*) FILTER (WHERE participation_type IN ('tackle_for_loss','forced_fumble')) AS havoc_plays
    FROM dl_plays
    GROUP BY player_id, first_name, last_name, jersey_number, position_code
  )
  SELECT jsonb_agg(jsonb_build_object(
    'playerId',       player_id,
    'playerName',     first_name || ' ' || last_name,
    'jerseyNumber',   jersey_number,
    'position',       position_code,
    'primaryTackles', primary_tackles,
    'assistTackles',  assist_tackles,
    'totalTackles',   total_tackles,
    'missedTackles',  missed_tackles,
    'pressures',      pressures,
    'sacks',          sacks,
    'tfls',           tfls,
    'forcedFumbles',  forced_fumbles,
    'havocPlays',     havoc_plays
  )) INTO result
  FROM agg;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_dl_stats(UUID, UUID) TO authenticated;

-- ---------- LB ----------

CREATE OR REPLACE FUNCTION get_lb_stats(p_team_id UUID, p_game_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  WITH video_filter AS (
    SELECT v.id AS video_id
    FROM videos v
    JOIN games g ON g.id = v.game_id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  lb_plays AS (
    SELECT
      pp.player_id,
      p.first_name, p.last_name, p.jersey_number, pc.code AS position_code,
      pp.participation_type, pp.result
    FROM player_participation pp
    JOIN play_instances pi ON pi.id = pp.play_instance_id
    JOIN video_filter vf ON vf.video_id = pi.video_id
    JOIN players p ON p.id = pp.player_id
    JOIN position_categories pc ON pc.id = p.primary_position_category_id
    WHERE pp.team_id = p_team_id
      AND pi.is_opponent_play = false
      AND pc.code = 'LB'
  ),
  agg AS (
    SELECT
      player_id, first_name, last_name, jersey_number, position_code,
      COUNT(*) FILTER (WHERE participation_type = 'primary_tackle')                                AS primary_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'assist_tackle')                                 AS assist_tackles,
      COUNT(*) FILTER (WHERE participation_type IN ('primary_tackle','assist_tackle'))             AS total_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'missed_tackle')                                 AS missed_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'pressure')                                      AS pressures,
      COUNT(*) FILTER (WHERE participation_type = 'pressure' AND result = 'sack')                  AS sacks,
      COUNT(*) FILTER (WHERE participation_type = 'coverage_assignment')                           AS coverage_snaps,
      COUNT(*) FILTER (WHERE participation_type = 'tackle_for_loss')                               AS tfls,
      COUNT(*) FILTER (WHERE participation_type = 'forced_fumble')                                 AS forced_fumbles,
      COUNT(*) FILTER (WHERE participation_type = 'interception')                                  AS interceptions,
      COUNT(*) FILTER (WHERE participation_type = 'pass_breakup')                                  AS pbus,
      COUNT(*) FILTER (WHERE participation_type IN ('tackle_for_loss','forced_fumble','interception','pass_breakup')) AS havoc_plays
    FROM lb_plays
    GROUP BY player_id, first_name, last_name, jersey_number, position_code
  )
  SELECT jsonb_agg(jsonb_build_object(
    'playerId',       player_id,
    'playerName',     first_name || ' ' || last_name,
    'jerseyNumber',   jersey_number,
    'position',       position_code,
    'primaryTackles', primary_tackles,
    'assistTackles',  assist_tackles,
    'totalTackles',   total_tackles,
    'missedTackles',  missed_tackles,
    'pressures',      pressures,
    'sacks',          sacks,
    'coverageSnaps',  coverage_snaps,
    'tfls',           tfls,
    'forcedFumbles',  forced_fumbles,
    'interceptions',  interceptions,
    'pbus',           pbus,
    'havocPlays',     havoc_plays
  )) INTO result
  FROM agg;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_lb_stats(UUID, UUID) TO authenticated;

-- ---------- DB ----------

CREATE OR REPLACE FUNCTION get_db_stats(p_team_id UUID, p_game_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  WITH video_filter AS (
    SELECT v.id AS video_id
    FROM videos v
    JOIN games g ON g.id = v.game_id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  db_plays AS (
    SELECT
      pp.player_id,
      p.first_name, p.last_name, p.jersey_number, pc.code AS position_code,
      pp.participation_type, pp.result
    FROM player_participation pp
    JOIN play_instances pi ON pi.id = pp.play_instance_id
    JOIN video_filter vf ON vf.video_id = pi.video_id
    JOIN players p ON p.id = pp.player_id
    JOIN position_categories pc ON pc.id = p.primary_position_category_id
    WHERE pp.team_id = p_team_id
      AND pi.is_opponent_play = false
      AND pc.code = 'DB'
  ),
  agg AS (
    SELECT
      player_id, first_name, last_name, jersey_number, position_code,
      COUNT(*) FILTER (WHERE participation_type = 'primary_tackle')                                                   AS primary_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'assist_tackle')                                                    AS assist_tackles,
      COUNT(*) FILTER (WHERE participation_type IN ('primary_tackle','assist_tackle'))                                AS total_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'missed_tackle')                                                    AS missed_tackles,
      COUNT(*) FILTER (WHERE participation_type = 'coverage_assignment')                                              AS coverage_snaps,
      COUNT(*) FILTER (WHERE participation_type = 'interception')                                                     AS interceptions,
      COUNT(*) FILTER (WHERE participation_type = 'pass_breakup')                                                     AS pbus,
      COUNT(*) FILTER (WHERE participation_type = 'forced_fumble')                                                    AS forced_fumbles,
      COUNT(*) FILTER (WHERE participation_type IN ('interception','pass_breakup','forced_fumble'))                   AS havoc_plays
    FROM db_plays
    GROUP BY player_id, first_name, last_name, jersey_number, position_code
  )
  SELECT jsonb_agg(jsonb_build_object(
    'playerId',       player_id,
    'playerName',     first_name || ' ' || last_name,
    'jerseyNumber',   jersey_number,
    'position',       position_code,
    'primaryTackles', primary_tackles,
    'assistTackles',  assist_tackles,
    'totalTackles',   total_tackles,
    'missedTackles',  missed_tackles,
    'coverageSnaps',  coverage_snaps,
    'interceptions',  interceptions,
    'pbus',           pbus,
    'forcedFumbles',  forced_fumbles,
    'havocPlays',     havoc_plays
  )) INTO result
  FROM agg;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_db_stats(UUID, UUID) TO authenticated;

-- ---------- Kicker / Punter ----------

CREATE OR REPLACE FUNCTION get_kicker_stats(p_team_id UUID, p_game_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  WITH video_filter AS (
    SELECT v.id AS video_id
    FROM videos v
    JOIN games g ON g.id = v.game_id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  k_plays AS (
    SELECT
      pp.player_id,
      p.first_name, p.last_name, p.jersey_number, pc.code AS position_code,
      pi.kick_result, pi.kick_distance
    FROM player_participation pp
    JOIN play_instances pi ON pi.id = pp.play_instance_id
    JOIN video_filter vf ON vf.video_id = pi.video_id
    JOIN players p ON p.id = pp.player_id
    JOIN position_categories pc ON pc.id = p.primary_position_category_id
    WHERE pp.team_id = p_team_id
      AND pp.participation_type IN ('kicker', 'punter')
      AND pi.is_opponent_play = false
      AND pc.code IN ('K', 'P')
  ),
  agg AS (
    SELECT
      player_id, first_name, last_name, jersey_number, position_code,
      COUNT(*) FILTER (WHERE kick_result = 'fg_made')                AS fg_made,
      COUNT(*) FILTER (WHERE kick_result IN ('fg_made','fg_missed')) AS fg_attempts,
      COUNT(*) FILTER (WHERE kick_result = 'xp_made')                AS xp_made,
      COUNT(*) FILTER (WHERE kick_result IN ('xp_made','xp_missed')) AS xp_attempts,
      COUNT(*) FILTER (WHERE kick_result = 'punt')                   AS punts,
      COALESCE(AVG(kick_distance) FILTER (WHERE kick_result = 'punt'), 0) AS punt_avg,
      COALESCE(MAX(kick_distance) FILTER (WHERE kick_result = 'punt'), 0) AS longest_punt
    FROM k_plays
    GROUP BY player_id, first_name, last_name, jersey_number, position_code
  )
  SELECT jsonb_agg(jsonb_build_object(
    'playerId',     player_id,
    'playerName',   first_name || ' ' || last_name,
    'jerseyNumber', jersey_number,
    'position',     position_code,
    'fgMade',       fg_made,
    'fgAttempts',   fg_attempts,
    'fgPct',        CASE WHEN fg_attempts = 0 THEN 0 ELSE ROUND(100.0 * fg_made / fg_attempts, 1) END,
    'xpMade',       xp_made,
    'xpAttempts',   xp_attempts,
    'xpPct',        CASE WHEN xp_attempts = 0 THEN 0 ELSE ROUND(100.0 * xp_made / xp_attempts, 1) END,
    'punts',        punts,
    'puntAvg',      ROUND(punt_avg::NUMERIC, 1),
    'longestPunt',  longest_punt,
    'totalPoints',  3 * fg_made + xp_made
  )) INTO result
  FROM agg;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_kicker_stats(UUID, UUID) TO authenticated;

-- ---------- Returner (any category that returns kicks/punts) ----------

CREATE OR REPLACE FUNCTION get_returner_stats(p_team_id UUID, p_game_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE result JSONB;
BEGIN
  WITH video_filter AS (
    SELECT v.id AS video_id
    FROM videos v
    JOIN games g ON g.id = v.game_id
    WHERE g.team_id = p_team_id
      AND (p_game_id IS NULL OR v.game_id = p_game_id)
  ),
  returns AS (
    SELECT
      pp.player_id,
      p.first_name, p.last_name, p.jersey_number, pc.code AS position_code,
      pp.participation_type, pp.yards_gained, pp.is_touchdown
    FROM player_participation pp
    JOIN play_instances pi ON pi.id = pp.play_instance_id
    JOIN video_filter vf ON vf.video_id = pi.video_id
    JOIN players p ON p.id = pp.player_id
    JOIN position_categories pc ON pc.id = p.primary_position_category_id
    WHERE pp.team_id = p_team_id
      AND pp.participation_type IN ('kickoff_return', 'punt_return')
      AND pi.is_opponent_play = false
  ),
  agg AS (
    SELECT
      player_id, first_name, last_name, jersey_number, position_code,
      COUNT(*) FILTER (WHERE participation_type = 'kickoff_return')                                AS kick_returns,
      COALESCE(SUM(yards_gained) FILTER (WHERE participation_type = 'kickoff_return'), 0)          AS kick_return_yards,
      COUNT(*) FILTER (WHERE participation_type = 'kickoff_return' AND is_touchdown)               AS kick_return_tds,
      COALESCE(MAX(yards_gained) FILTER (WHERE participation_type = 'kickoff_return'), 0)          AS longest_kick_return,
      COUNT(*) FILTER (WHERE participation_type = 'punt_return')                                   AS punt_returns,
      COALESCE(SUM(yards_gained) FILTER (WHERE participation_type = 'punt_return'), 0)             AS punt_return_yards,
      COUNT(*) FILTER (WHERE participation_type = 'punt_return' AND is_touchdown)                  AS punt_return_tds,
      COALESCE(MAX(yards_gained) FILTER (WHERE participation_type = 'punt_return'), 0)             AS longest_punt_return
    FROM returns
    GROUP BY player_id, first_name, last_name, jersey_number, position_code
  )
  SELECT jsonb_agg(jsonb_build_object(
    'playerId',           player_id,
    'playerName',         first_name || ' ' || last_name,
    'jerseyNumber',       jersey_number,
    'position',           position_code,
    'kickReturns',        kick_returns,
    'kickReturnYards',    kick_return_yards,
    'kickReturnAvg',      CASE WHEN kick_returns = 0 THEN 0 ELSE ROUND(kick_return_yards::NUMERIC / kick_returns, 1) END,
    'kickReturnTDs',      kick_return_tds,
    'longestKickReturn',  longest_kick_return,
    'puntReturns',        punt_returns,
    'puntReturnYards',    punt_return_yards,
    'puntReturnAvg',      CASE WHEN punt_returns = 0 THEN 0 ELSE ROUND(punt_return_yards::NUMERIC / punt_returns, 1) END,
    'puntReturnTDs',      punt_return_tds,
    'longestPuntReturn',  longest_punt_return,
    'totalReturns',       kick_returns + punt_returns,
    'totalYards',         kick_return_yards + punt_return_yards,
    'totalTDs',           kick_return_tds + punt_return_tds
  )) INTO result
  FROM agg;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_returner_stats(UUID, UUID) TO authenticated;
