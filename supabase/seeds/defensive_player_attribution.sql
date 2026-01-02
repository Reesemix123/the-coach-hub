-- ============================================================================
-- Defensive Player Attribution Seed Data
-- ============================================================================
-- Purpose: Add defensive player-level attribution to existing play instances
-- This supplements ai_coaching_test_data.sql to enable queries like:
--   - "How is my defense doing by position group?"
--   - "Who's my leading tackler?"
--   - "Who's generating the most pressure?"
--   - "How is our secondary in coverage?"
--
-- Defensive Performance Profile (creates realistic variance):
--   DL (Defensive Line):
--     - DE1 (Marcus Lee #91): Elite - High pressure rate, solid tackles
--     - DE2 (Jason White #95): Good - Consistent run defender
--     - DT (Darius Jackson #99): Excellent - Interior disruptor, TFL machine
--
--   LB (Linebackers):
--     - MLB (Carlos Rodriguez #52): Elite - Leading tackler, sideline-to-sideline
--     - OLB1 (Trey Harris #56): Good - Solid in run fits
--     - OLB2 (Malik Robinson #58): Developing - Sophomore, learning the position
--
--   DB (Defensive Backs):
--     - CB1 (Terrance Moore #21): Elite - Shutdown corner, low targets
--     - CB2 (Devon Clark #24): Struggling - Giving up completions
--     - SS (Isaiah Wright #32): Excellent - Physical, great tackler
--     - FS (Jordan King #27): Good - Ball hawk, coverage specialist
-- ============================================================================

DO $$
DECLARE
  v_team_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  -- Defensive Line
  v_de1_id UUID := '11111111-1111-1111-1111-111111111115';  -- Marcus Lee #91 (Elite pass rusher)
  v_de2_id UUID := '11111111-1111-1111-1111-111111111116';  -- Jason White #95 (Solid)
  v_dt_id UUID := '11111111-1111-1111-1111-111111111117';   -- Darius Jackson #99 (Interior beast)

  -- Linebackers
  v_mlb_id UUID := '11111111-1111-1111-1111-111111111118';  -- Carlos Rodriguez #52 (Leading tackler)
  v_olb1_id UUID := '11111111-1111-1111-1111-111111111119'; -- Trey Harris #56 (Solid)
  v_olb2_id UUID := '11111111-1111-1111-1111-111111111120'; -- Malik Robinson #58 (Developing)

  -- Defensive Backs
  v_cb1_id UUID := '11111111-1111-1111-1111-111111111121';  -- Terrance Moore #21 (Shutdown)
  v_cb2_id UUID := '11111111-1111-1111-1111-111111111122';  -- Devon Clark #24 (Struggling)
  v_ss_id UUID := '11111111-1111-1111-1111-111111111123';   -- Isaiah Wright #32 (Physical)
  v_fs_id UUID := '11111111-1111-1111-1111-111111111124';   -- Jordan King #27 (Ball hawk)

  v_play RECORD;
  v_rand FLOAT;
  v_rand2 FLOAT;
  v_primary_tackler UUID;
  v_assist_tackler UUID;
  v_pressure_players UUID[];
  v_coverage_player UUID;
  v_coverage_result TEXT;
  v_is_tfl BOOLEAN;
  v_is_sack BOOLEAN;
  v_is_pbu BOOLEAN;
  v_is_forced_fumble BOOLEAN;
  v_tackler_array UUID[];

BEGIN
  -- Loop through all opponent plays (when defense is on the field)
  FOR v_play IN
    SELECT id, play_type, yards_gained, result, is_turnover
    FROM play_instances
    WHERE team_id = v_team_id
      AND is_opponent_play = true
  LOOP
    -- Reset values
    v_primary_tackler := NULL;
    v_assist_tackler := NULL;
    v_pressure_players := ARRAY[]::UUID[];
    v_coverage_player := NULL;
    v_coverage_result := NULL;
    v_is_tfl := false;
    v_is_sack := false;
    v_is_pbu := false;
    v_is_forced_fumble := false;
    v_tackler_array := ARRAY[]::UUID[];

    -- ========================================================================
    -- TACKLER ATTRIBUTION
    -- ========================================================================
    -- Distribute tackles based on realistic position frequency:
    -- MLB: 30%, OLBs: 25%, SS: 15%, DL: 15%, CBs: 10%, FS: 5%

    v_rand := random();

    IF v_rand < 0.30 THEN
      -- MLB (Carlos Rodriguez) - leading tackler
      v_primary_tackler := v_mlb_id;
      -- 40% chance of assist
      IF random() < 0.40 THEN
        v_rand2 := random();
        IF v_rand2 < 0.4 THEN v_assist_tackler := v_olb1_id;
        ELSIF v_rand2 < 0.7 THEN v_assist_tackler := v_ss_id;
        ELSE v_assist_tackler := v_dt_id;
        END IF;
      END IF;

    ELSIF v_rand < 0.45 THEN
      -- OLB1 (Trey Harris)
      v_primary_tackler := v_olb1_id;
      IF random() < 0.35 THEN
        v_rand2 := random();
        IF v_rand2 < 0.5 THEN v_assist_tackler := v_mlb_id;
        ELSE v_assist_tackler := v_de1_id;
        END IF;
      END IF;

    ELSIF v_rand < 0.55 THEN
      -- OLB2 (Malik Robinson - developing, fewer tackles)
      v_primary_tackler := v_olb2_id;
      -- Higher assist rate (needs help)
      IF random() < 0.50 THEN
        v_rand2 := random();
        IF v_rand2 < 0.6 THEN v_assist_tackler := v_mlb_id;
        ELSE v_assist_tackler := v_ss_id;
        END IF;
      END IF;

    ELSIF v_rand < 0.70 THEN
      -- SS (Isaiah Wright - physical, high tackle rate)
      v_primary_tackler := v_ss_id;
      IF random() < 0.30 THEN
        v_assist_tackler := v_mlb_id;
      END IF;

    ELSIF v_rand < 0.80 THEN
      -- DL tackles (split between DT and DEs)
      v_rand2 := random();
      IF v_rand2 < 0.5 THEN
        v_primary_tackler := v_dt_id;
      ELSIF v_rand2 < 0.8 THEN
        v_primary_tackler := v_de1_id;
      ELSE
        v_primary_tackler := v_de2_id;
      END IF;
      IF random() < 0.45 THEN
        v_assist_tackler := v_mlb_id;
      END IF;

    ELSIF v_rand < 0.90 THEN
      -- CB tackles
      IF random() < 0.6 THEN
        v_primary_tackler := v_cb1_id;
      ELSE
        v_primary_tackler := v_cb2_id;
      END IF;

    ELSE
      -- FS (Jordan King - fewer tackles, more coverage)
      v_primary_tackler := v_fs_id;
    END IF;

    -- Build tackler array
    IF v_primary_tackler IS NOT NULL THEN
      v_tackler_array := ARRAY[v_primary_tackler];
      IF v_assist_tackler IS NOT NULL THEN
        v_tackler_array := v_tackler_array || v_assist_tackler;
      END IF;
    END IF;

    -- ========================================================================
    -- TFL DETECTION (Tackle for Loss)
    -- ========================================================================
    -- TFL on negative yardage plays (more likely from DL and MLB)
    IF v_play.yards_gained IS NOT NULL AND v_play.yards_gained < 0 THEN
      v_is_tfl := true;
      -- Reassign TFL credit to more likely players
      IF random() < 0.40 THEN
        v_primary_tackler := v_dt_id;  -- DT gets a lot of TFLs
      ELSIF random() < 0.60 THEN
        v_primary_tackler := v_de1_id; -- DE1 is elite
      ELSIF random() < 0.80 THEN
        v_primary_tackler := v_mlb_id; -- MLB in the gaps
      END IF;
      v_tackler_array := ARRAY[v_primary_tackler];
    END IF;

    -- ========================================================================
    -- SACK DETECTION (Pass plays with negative yards or sack result)
    -- ========================================================================
    IF v_play.play_type = 'pass' AND
       (v_play.result ILIKE '%sack%' OR (v_play.yards_gained IS NOT NULL AND v_play.yards_gained < -3)) THEN
      v_is_sack := true;
      v_is_tfl := true;
      -- Sacks go to pass rushers
      v_rand := random();
      IF v_rand < 0.45 THEN
        v_primary_tackler := v_de1_id;  -- Elite pass rusher
      ELSIF v_rand < 0.70 THEN
        v_primary_tackler := v_dt_id;   -- Interior pressure
      ELSIF v_rand < 0.85 THEN
        v_primary_tackler := v_de2_id;  -- Cleanup sacks
      ELSE
        v_primary_tackler := v_olb1_id; -- Blitzing LB
      END IF;
      v_tackler_array := ARRAY[v_primary_tackler];
    END IF;

    -- ========================================================================
    -- PRESSURE ATTRIBUTION (Pass plays)
    -- ========================================================================
    IF v_play.play_type = 'pass' THEN
      v_pressure_players := ARRAY[]::UUID[];

      -- DE1 (Marcus Lee) - 35% pressure rate (elite)
      IF random() < 0.35 THEN
        v_pressure_players := v_pressure_players || v_de1_id;
      END IF;

      -- DT (Darius Jackson) - 25% pressure rate (interior beast)
      IF random() < 0.25 THEN
        v_pressure_players := v_pressure_players || v_dt_id;
      END IF;

      -- DE2 (Jason White) - 18% pressure rate (solid)
      IF random() < 0.18 THEN
        v_pressure_players := v_pressure_players || v_de2_id;
      END IF;

      -- OLB1 blitz pressure - 12%
      IF random() < 0.12 THEN
        v_pressure_players := v_pressure_players || v_olb1_id;
      END IF;

      -- MLB blitz pressure - 8%
      IF random() < 0.08 THEN
        v_pressure_players := v_pressure_players || v_mlb_id;
      END IF;
    END IF;

    -- ========================================================================
    -- COVERAGE ATTRIBUTION (Pass plays)
    -- ========================================================================
    IF v_play.play_type = 'pass' THEN
      -- Assign coverage player based on realistic target distribution
      v_rand := random();

      IF v_rand < 0.30 THEN
        -- CB1 (Terrance Moore) - Shutdown, rarely targeted
        v_coverage_player := v_cb1_id;
        -- 75% win rate (elite)
        IF random() < 0.75 THEN
          v_coverage_result := 'win';
        ELSIF random() < 0.85 THEN
          v_coverage_result := 'neutral';
        ELSE
          v_coverage_result := 'loss';
        END IF;

      ELSIF v_rand < 0.55 THEN
        -- CB2 (Devon Clark) - Gets targeted a lot, struggling
        v_coverage_player := v_cb2_id;
        -- 45% win rate (struggling)
        IF random() < 0.45 THEN
          v_coverage_result := 'win';
        ELSIF random() < 0.70 THEN
          v_coverage_result := 'neutral';
        ELSE
          v_coverage_result := 'loss';
        END IF;

      ELSIF v_rand < 0.70 THEN
        -- SS (Isaiah Wright) - Physical, good in short coverage
        v_coverage_player := v_ss_id;
        -- 62% win rate
        IF random() < 0.62 THEN
          v_coverage_result := 'win';
        ELSIF random() < 0.82 THEN
          v_coverage_result := 'neutral';
        ELSE
          v_coverage_result := 'loss';
        END IF;

      ELSIF v_rand < 0.85 THEN
        -- FS (Jordan King) - Ball hawk, good coverage
        v_coverage_player := v_fs_id;
        -- 68% win rate
        IF random() < 0.68 THEN
          v_coverage_result := 'win';
        ELSIF random() < 0.88 THEN
          v_coverage_result := 'neutral';
        ELSE
          v_coverage_result := 'loss';
        END IF;

      ELSE
        -- LB in coverage (usually not great)
        IF random() < 0.6 THEN
          v_coverage_player := v_mlb_id;
        ELSE
          v_coverage_player := v_olb1_id;
        END IF;
        -- 50% win rate (LBs in coverage)
        IF random() < 0.50 THEN
          v_coverage_result := 'win';
        ELSIF random() < 0.75 THEN
          v_coverage_result := 'neutral';
        ELSE
          v_coverage_result := 'loss';
        END IF;
      END IF;

      -- PBU on incomplete passes with coverage win
      IF v_play.result ILIKE '%incomplete%' AND v_coverage_result = 'win' AND random() < 0.30 THEN
        v_is_pbu := true;
      END IF;
    END IF;

    -- ========================================================================
    -- FORCED FUMBLE (on turnovers)
    -- ========================================================================
    IF v_play.is_turnover = true AND v_play.result ILIKE '%fumble%' THEN
      v_is_forced_fumble := true;
      -- Credit to a physical player
      v_rand := random();
      IF v_rand < 0.35 THEN
        v_primary_tackler := v_ss_id;  -- Isaiah Wright is physical
      ELSIF v_rand < 0.55 THEN
        v_primary_tackler := v_mlb_id;
      ELSIF v_rand < 0.75 THEN
        v_primary_tackler := v_dt_id;
      ELSE
        v_primary_tackler := v_de1_id;
      END IF;
      v_tackler_array := ARRAY[v_primary_tackler];
    END IF;

    -- ========================================================================
    -- UPDATE THE PLAY INSTANCE
    -- ========================================================================
    UPDATE play_instances
    SET
      tackler_ids = CASE WHEN array_length(v_tackler_array, 1) > 0 THEN v_tackler_array ELSE NULL END,
      pressure_player_ids = CASE WHEN array_length(v_pressure_players, 1) > 0 THEN v_pressure_players ELSE NULL END,
      coverage_player_id = v_coverage_player,
      coverage_result = v_coverage_result,
      is_tfl = v_is_tfl,
      is_sack = v_is_sack,
      is_pbu = v_is_pbu,
      is_forced_fumble = v_is_forced_fumble
    WHERE id = v_play.id;

  END LOOP;

  RAISE NOTICE 'Defensive attribution added to all opponent plays';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Tackle leaders
SELECT
  'Tackle Leaders' as report,
  p.jersey_number,
  p.first_name || ' ' || p.last_name as player_name,
  p.position_depths::text as position,
  COUNT(*) as primary_tackles,
  COUNT(CASE WHEN pi.is_tfl THEN 1 END) as tfls,
  COUNT(CASE WHEN pi.is_sack THEN 1 END) as sacks
FROM play_instances pi
CROSS JOIN LATERAL unnest(pi.tackler_ids) WITH ORDINALITY AS t(tackler_id, ord)
JOIN players p ON p.id = t.tackler_id
WHERE pi.team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  AND pi.is_opponent_play = true
  AND t.ord = 1  -- Primary tackler only
GROUP BY p.id, p.jersey_number, p.first_name, p.last_name, p.position_depths
ORDER BY primary_tackles DESC;

-- Pressure leaders
SELECT
  'Pressure Leaders' as report,
  p.jersey_number,
  p.first_name || ' ' || p.last_name as player_name,
  COUNT(*) as pressures,
  COUNT(CASE WHEN pi.is_sack AND pi.tackler_ids[1] = p.id THEN 1 END) as sacks
FROM play_instances pi
CROSS JOIN LATERAL unnest(pi.pressure_player_ids) AS pressure_id
JOIN players p ON p.id = pressure_id
WHERE pi.team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  AND pi.is_opponent_play = true
GROUP BY p.id, p.jersey_number, p.first_name, p.last_name
ORDER BY pressures DESC;

-- Coverage stats
SELECT
  'Coverage Stats' as report,
  p.jersey_number,
  p.first_name || ' ' || p.last_name as player_name,
  COUNT(*) as targets,
  COUNT(CASE WHEN pi.coverage_result = 'win' THEN 1 END) as wins,
  COUNT(CASE WHEN pi.coverage_result = 'loss' THEN 1 END) as losses,
  ROUND(100.0 * COUNT(CASE WHEN pi.coverage_result = 'win' THEN 1 END) / NULLIF(COUNT(*), 0), 1) as win_pct,
  COUNT(CASE WHEN pi.is_pbu THEN 1 END) as pbus
FROM play_instances pi
JOIN players p ON p.id = pi.coverage_player_id
WHERE pi.team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  AND pi.is_opponent_play = true
  AND pi.play_type = 'pass'
GROUP BY p.id, p.jersey_number, p.first_name, p.last_name
ORDER BY targets DESC;

-- Summary stats
SELECT
  'Defensive Summary' as report,
  COUNT(*) as total_defensive_plays,
  COUNT(CASE WHEN tackler_ids IS NOT NULL THEN 1 END) as plays_with_tackles,
  COUNT(CASE WHEN is_tfl THEN 1 END) as total_tfls,
  COUNT(CASE WHEN is_sack THEN 1 END) as total_sacks,
  COUNT(CASE WHEN is_pbu THEN 1 END) as total_pbus,
  COUNT(CASE WHEN is_forced_fumble THEN 1 END) as forced_fumbles,
  COUNT(CASE WHEN pressure_player_ids IS NOT NULL THEN 1 END) as plays_with_pressure
FROM play_instances
WHERE team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  AND is_opponent_play = true;
