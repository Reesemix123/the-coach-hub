-- ============================================================================
-- Special Teams Player Attribution Seed Data
-- ============================================================================
-- Purpose: Add special teams players and play instances with player-level attribution
-- This supplements ai_coaching_test_data.sql to enable queries like:
--   - "How is my kicking game?"
--   - "Who's my best return man?"
--   - "How is our punt coverage?"
--   - "What's our field goal percentage?"
--
-- Special Teams Performance Profiles:
--   Kicking:
--     - K (Ethan Reynolds #3): Reliable - 80% FG, strong kickoffs
--     - P (Lucas Chen #9): Excellent - 42 yard avg, good hang time
--     - LS (Noah Williams #48): Consistent - 95% snap accuracy
--     - H (Marcus Thompson #7): QB doubles as holder
--
--   Returns:
--     - KR1 (Jaylen Davis #1): Electric - 24 yard avg, explosive
--     - KR2 (DeShawn Carter #22): Solid - 20 yard avg backup
--     - PR (Chris Martinez #11): Safe - fair catch decision maker
--
--   Coverage:
--     - Gunner1 (Terrance Moore #21): Elite - leads in tackles
--     - Gunner2 (Devon Clark #24): Good - reliable coverage
--     - Coverage (Jordan King #27): Cleanup tackle leader
-- ============================================================================

DO $$
DECLARE
  v_team_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  -- Special Teams Players (new IDs for specialists)
  v_kicker_id UUID := '11111111-1111-1111-1111-111111111131';   -- Ethan Reynolds #3
  v_punter_id UUID := '11111111-1111-1111-1111-111111111132';   -- Lucas Chen #9
  v_ls_id UUID := '11111111-1111-1111-1111-111111111133';       -- Noah Williams #48

  -- Players who also play special teams (reuse existing IDs)
  v_qb1_id UUID := '11111111-1111-1111-1111-111111111101';      -- Marcus Thompson #7 (Holder)
  v_wr1_id UUID := '11111111-1111-1111-1111-111111111106';      -- Jaylen Davis #1 (KR1)
  v_rb1_id UUID := '11111111-1111-1111-1111-111111111103';      -- DeShawn Carter #22 (KR2)
  v_wr2_id UUID := '11111111-1111-1111-1111-111111111107';      -- Chris Martinez #11 (PR)
  v_cb1_id UUID := '11111111-1111-1111-1111-111111111121';      -- Terrance Moore #21 (Gunner1)
  v_cb2_id UUID := '11111111-1111-1111-1111-111111111122';      -- Devon Clark #24 (Gunner2)
  v_fs_id UUID := '11111111-1111-1111-1111-111111111124';       -- Jordan King #27 (Coverage)
  v_ss_id UUID := '11111111-1111-1111-1111-111111111123';       -- Isaiah Wright #32 (Coverage)

  -- Video IDs (one per game)
  v_video1_id UUID := '33333333-3333-3333-3333-333333333301';
  v_video2_id UUID := '33333333-3333-3333-3333-333333333302';
  v_video3_id UUID := '33333333-3333-3333-3333-333333333303';
  v_video4_id UUID := '33333333-3333-3333-3333-333333333304';
  v_video5_id UUID := '33333333-3333-3333-3333-333333333305';
  v_video6_id UUID := '33333333-3333-3333-3333-333333333306';
  v_video7_id UUID := '33333333-3333-3333-3333-333333333307';
  v_video8_id UUID := '33333333-3333-3333-3333-333333333308';

  -- Variables for play generation
  v_play_id UUID;
  v_video_ids UUID[];
  v_video_id UUID;
  v_game_num INT;
  v_play_num INT;
  v_kickoff_result TEXT;
  v_punt_result TEXT;
  v_kick_distance INT;
  v_return_yards INT;
  v_rand FLOAT;
  v_timestamp INT;  -- For timestamp_start

BEGIN
  -- ============================================================================
  -- ADD SPECIAL TEAMS SPECIALISTS
  -- ============================================================================

  INSERT INTO players (id, team_id, jersey_number, first_name, last_name, position_depths, is_active, grade_level)
  VALUES
    (v_kicker_id, v_team_id, '3', 'Ethan', 'Reynolds', '{"K": 1, "KO": 1}'::jsonb, true, 'Junior'),
    (v_punter_id, v_team_id, '9', 'Lucas', 'Chen', '{"P": 1}'::jsonb, true, 'Senior'),
    (v_ls_id, v_team_id, '48', 'Noah', 'Williams', '{"LS": 1}'::jsonb, true, 'Senior')
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    position_depths = EXCLUDED.position_depths;

  -- Update existing players to include special teams positions
  UPDATE players SET position_depths = position_depths || '{"H": 1}'::jsonb
  WHERE id = v_qb1_id AND NOT position_depths ? 'H';

  UPDATE players SET position_depths = position_depths || '{"KR": 1, "Gunner": 1}'::jsonb
  WHERE id = v_wr1_id AND NOT position_depths ? 'KR';

  UPDATE players SET position_depths = position_depths || '{"KR": 2}'::jsonb
  WHERE id = v_rb1_id AND NOT position_depths ? 'KR';

  UPDATE players SET position_depths = position_depths || '{"PR": 1}'::jsonb
  WHERE id = v_wr2_id AND NOT position_depths ? 'PR';

  UPDATE players SET position_depths = position_depths || '{"Gunner": 1}'::jsonb
  WHERE id = v_cb1_id AND NOT position_depths ? 'Gunner';

  UPDATE players SET position_depths = position_depths || '{"Gunner": 2}'::jsonb
  WHERE id = v_cb2_id AND NOT position_depths ? 'Gunner';

  UPDATE players SET position_depths = position_depths || '{"Coverage": 1}'::jsonb
  WHERE id = v_fs_id AND NOT position_depths ? 'Coverage';

  UPDATE players SET position_depths = position_depths || '{"Coverage": 2}'::jsonb
  WHERE id = v_ss_id AND NOT position_depths ? 'Coverage';

  -- ============================================================================
  -- VIDEO ID ARRAY
  -- ============================================================================
  v_video_ids := ARRAY[
    v_video1_id, v_video2_id, v_video3_id, v_video4_id,
    v_video5_id, v_video6_id, v_video7_id, v_video8_id
  ];

  -- ============================================================================
  -- CREATE SPECIAL TEAMS PLAY INSTANCES
  -- Each game gets: 4-6 kickoffs, 3-5 punts, 2-4 PATs, 0-2 FGs
  -- ============================================================================

  FOR v_game_num IN 1..8 LOOP
    v_video_id := v_video_ids[v_game_num];
    v_timestamp := 100; -- Reset timestamp for each game

    -- ========================================================================
    -- KICKOFFS (4-6 per game) - Our team kicking off
    -- ========================================================================
    FOR v_play_num IN 1..(4 + FLOOR(RANDOM() * 3)::INT) LOOP
      v_play_id := gen_random_uuid();
      v_rand := RANDOM();
      v_timestamp := v_timestamp + 300 + FLOOR(RANDOM() * 600)::INT; -- 5-15 min intervals

      -- 70% touchback, 25% returned, 5% out of bounds
      IF v_rand < 0.70 THEN
        v_kickoff_result := 'touchback';
        v_kick_distance := 65;
        v_return_yards := 0;
      ELSIF v_rand < 0.95 THEN
        v_kickoff_result := 'returned';
        v_kick_distance := 55 + FLOOR(RANDOM() * 15)::INT;
        v_return_yards := 15 + FLOOR(RANDOM() * 25)::INT;
      ELSE
        v_kickoff_result := 'out_of_bounds';
        v_kick_distance := 50;
        v_return_yards := 0;
      END IF;

      INSERT INTO play_instances (
        id, video_id, team_id,
        special_teams_unit, kicker_id, kick_result, kick_distance,
        kickoff_type, return_yards,
        is_opponent_play, quarter, down, distance, yard_line,
        timestamp_start, created_at
      ) VALUES (
        v_play_id, v_video_id, v_team_id,
        'kickoff', v_kicker_id, v_kickoff_result, v_kick_distance,
        CASE WHEN v_rand < 0.8 THEN 'deep_center' WHEN v_rand < 0.9 THEN 'deep_left' ELSE 'deep_right' END,
        v_return_yards,
        FALSE, -- Our kickoff
        CASE WHEN v_play_num <= 2 THEN 1 WHEN v_play_num <= 4 THEN 3 ELSE 4 END,
        NULL, NULL, 35,
        v_timestamp,
        NOW() - INTERVAL '1 day' * (8 - v_game_num) * 7 + INTERVAL '1 minute' * v_play_num
      );
    END LOOP;

    -- ========================================================================
    -- KICK RETURNS (3-5 per game) - Opponent kicking to us
    -- ========================================================================
    FOR v_play_num IN 1..(3 + FLOOR(RANDOM() * 3)::INT) LOOP
      v_play_id := gen_random_uuid();
      v_rand := RANDOM();
      v_timestamp := v_timestamp + 300 + FLOOR(RANDOM() * 600)::INT;

      -- Jaylen Davis is primary returner (70%), DeShawn Carter backup (30%)
      IF v_rand < 0.30 THEN
        v_kickoff_result := 'touchback';
        v_return_yards := 0;
      ELSIF v_rand < 0.95 THEN
        v_kickoff_result := 'returned';
        IF RANDOM() < 0.7 THEN
          -- Jaylen Davis (electric)
          v_return_yards := 18 + FLOOR(RANDOM() * 20)::INT;
          IF RANDOM() < 0.10 THEN
            v_return_yards := 35 + FLOOR(RANDOM() * 30)::INT;
          END IF;
          INSERT INTO play_instances (
            id, video_id, team_id,
            special_teams_unit, returner_id, kick_result, return_yards,
            coverage_tackler_id,
            is_opponent_play, quarter, down, distance, yard_line,
            yards_gained, success, explosive,
            timestamp_start, created_at
          ) VALUES (
            v_play_id, v_video_id, v_team_id,
            'kick_return', v_wr1_id, v_kickoff_result, v_return_yards,
            NULL,
            FALSE,
            CASE WHEN v_play_num <= 2 THEN 1 WHEN v_play_num <= 3 THEN 2 ELSE 3 END,
            NULL, NULL, 25 + v_return_yards,
            v_return_yards, v_return_yards >= 22, v_return_yards >= 30,
            v_timestamp,
            NOW() - INTERVAL '1 day' * (8 - v_game_num) * 7 + INTERVAL '1 minute' * (v_play_num + 10)
          );
        ELSE
          -- DeShawn Carter (backup)
          v_return_yards := 15 + FLOOR(RANDOM() * 15)::INT;
          INSERT INTO play_instances (
            id, video_id, team_id,
            special_teams_unit, returner_id, kick_result, return_yards,
            is_opponent_play, quarter, down, distance, yard_line,
            yards_gained, success, explosive,
            timestamp_start, created_at
          ) VALUES (
            v_play_id, v_video_id, v_team_id,
            'kick_return', v_rb1_id, v_kickoff_result, v_return_yards,
            FALSE,
            CASE WHEN v_play_num <= 2 THEN 2 WHEN v_play_num <= 3 THEN 3 ELSE 4 END,
            NULL, NULL, 25 + v_return_yards,
            v_return_yards, v_return_yards >= 20, v_return_yards >= 30,
            v_timestamp,
            NOW() - INTERVAL '1 day' * (8 - v_game_num) * 7 + INTERVAL '1 minute' * (v_play_num + 10)
          );
        END IF;
        CONTINUE;
      ELSE
        v_kickoff_result := 'fair_catch';
        v_return_yards := 0;
      END IF;

      -- Default insert for touchbacks and fair catches
      IF v_kickoff_result IN ('touchback', 'fair_catch') THEN
        INSERT INTO play_instances (
          id, video_id, team_id,
          special_teams_unit, returner_id, kick_result, return_yards,
          is_fair_catch, is_touchback,
          is_opponent_play, quarter, down, distance, yard_line,
          timestamp_start, created_at
        ) VALUES (
          v_play_id, v_video_id, v_team_id,
          'kick_return', v_wr1_id, v_kickoff_result, 0,
          v_kickoff_result = 'fair_catch', v_kickoff_result = 'touchback',
          FALSE,
          CASE WHEN v_play_num <= 2 THEN 1 WHEN v_play_num <= 3 THEN 2 ELSE 3 END,
          NULL, NULL, 25,
          v_timestamp,
          NOW() - INTERVAL '1 day' * (8 - v_game_num) * 7 + INTERVAL '1 minute' * (v_play_num + 10)
        );
      END IF;
    END LOOP;

    -- ========================================================================
    -- PUNTS (3-5 per game) - Our team punting
    -- ========================================================================
    FOR v_play_num IN 1..(3 + FLOOR(RANDOM() * 3)::INT) LOOP
      v_play_id := gen_random_uuid();
      v_rand := RANDOM();
      v_timestamp := v_timestamp + 300 + FLOOR(RANDOM() * 600)::INT;

      -- Lucas Chen: 42 yard average, good hang time
      v_kick_distance := 35 + FLOOR(RANDOM() * 20)::INT;

      -- 15% fair catch, 10% downed, 10% touchback, 65% returned
      IF v_rand < 0.15 THEN
        v_punt_result := 'fair_catch';
        v_return_yards := 0;
      ELSIF v_rand < 0.25 THEN
        v_punt_result := 'downed';
        v_return_yards := 0;
      ELSIF v_rand < 0.35 THEN
        v_punt_result := 'touchback';
        v_return_yards := 0;
        v_kick_distance := 55 + FLOOR(RANDOM() * 10)::INT;
      ELSE
        v_punt_result := 'returned';
        v_return_yards := 5 + FLOOR(RANDOM() * 12)::INT;
      END IF;

      INSERT INTO play_instances (
        id, video_id, team_id,
        special_teams_unit, punter_id, long_snapper_id, kick_result, kick_distance,
        punt_type, return_yards,
        gunner_tackle_id, snap_quality,
        is_opponent_play, quarter, down, distance, yard_line,
        timestamp_start, created_at
      ) VALUES (
        v_play_id, v_video_id, v_team_id,
        'punt', v_punter_id, v_ls_id, v_punt_result, v_kick_distance,
        CASE WHEN RANDOM() < 0.7 THEN 'standard' WHEN RANDOM() < 0.85 THEN 'directional_left' ELSE 'directional_right' END,
        v_return_yards,
        CASE WHEN v_punt_result = 'returned' AND v_return_yards < 8 THEN
          CASE WHEN RANDOM() < 0.6 THEN v_cb1_id ELSE v_cb2_id END
        ELSE NULL END,
        CASE WHEN RANDOM() < 0.95 THEN 'good' WHEN RANDOM() < 0.5 THEN 'low' ELSE 'high' END,
        FALSE,
        4,
        4, 8, 30 + FLOOR(RANDOM() * 20)::INT,
        v_timestamp,
        NOW() - INTERVAL '1 day' * (8 - v_game_num) * 7 + INTERVAL '1 minute' * (v_play_num + 20)
      );
    END LOOP;

    -- ========================================================================
    -- PUNT RETURNS (2-4 per game) - Opponent punting to us
    -- ========================================================================
    FOR v_play_num IN 1..(2 + FLOOR(RANDOM() * 3)::INT) LOOP
      v_play_id := gen_random_uuid();
      v_rand := RANDOM();
      v_timestamp := v_timestamp + 300 + FLOOR(RANDOM() * 600)::INT;

      -- Chris Martinez is PR - makes good decisions, safe
      IF v_rand < 0.40 THEN
        INSERT INTO play_instances (
          id, video_id, team_id,
          special_teams_unit, returner_id, kick_result,
          is_fair_catch,
          is_opponent_play, quarter, down, distance, yard_line,
          timestamp_start, created_at
        ) VALUES (
          v_play_id, v_video_id, v_team_id,
          'punt_return', v_wr2_id, 'fair_catch',
          TRUE,
          FALSE,
          CASE WHEN v_play_num = 1 THEN 2 WHEN v_play_num = 2 THEN 3 ELSE 4 END,
          NULL, NULL, 15 + FLOOR(RANDOM() * 20)::INT,
          v_timestamp,
          NOW() - INTERVAL '1 day' * (8 - v_game_num) * 7 + INTERVAL '1 minute' * (v_play_num + 30)
        );
      ELSIF v_rand < 0.95 THEN
        v_return_yards := 5 + FLOOR(RANDOM() * 15)::INT;
        IF RANDOM() < 0.05 THEN
          v_return_yards := 25 + FLOOR(RANDOM() * 30)::INT;
        END IF;
        INSERT INTO play_instances (
          id, video_id, team_id,
          special_teams_unit, returner_id, kick_result, return_yards,
          is_opponent_play, quarter, down, distance, yard_line,
          yards_gained, success, explosive,
          timestamp_start, created_at
        ) VALUES (
          v_play_id, v_video_id, v_team_id,
          'punt_return', v_wr2_id, 'returned', v_return_yards,
          FALSE,
          CASE WHEN v_play_num = 1 THEN 2 WHEN v_play_num = 2 THEN 3 ELSE 4 END,
          NULL, NULL, 15 + v_return_yards,
          v_return_yards, v_return_yards >= 8, v_return_yards >= 20,
          v_timestamp,
          NOW() - INTERVAL '1 day' * (8 - v_game_num) * 7 + INTERVAL '1 minute' * (v_play_num + 30)
        );
      ELSE
        -- Muffed punt (rare)
        INSERT INTO play_instances (
          id, video_id, team_id,
          special_teams_unit, returner_id, kick_result,
          is_muffed,
          is_opponent_play, quarter, down, distance, yard_line,
          is_turnover, result,
          timestamp_start, created_at
        ) VALUES (
          v_play_id, v_video_id, v_team_id,
          'punt_return', v_wr2_id, 'muffed',
          TRUE,
          FALSE,
          CASE WHEN v_play_num = 1 THEN 2 ELSE 3 END,
          NULL, NULL, 20,
          TRUE, 'fumble',
          v_timestamp,
          NOW() - INTERVAL '1 day' * (8 - v_game_num) * 7 + INTERVAL '1 minute' * (v_play_num + 30)
        );
      END IF;
    END LOOP;

    -- ========================================================================
    -- FIELD GOALS (0-2 per game based on scoring)
    -- ========================================================================
    FOR v_play_num IN 1..(FLOOR(RANDOM() * 3)::INT) LOOP
      v_play_id := gen_random_uuid();
      v_rand := RANDOM();
      v_timestamp := v_timestamp + 300 + FLOOR(RANDOM() * 600)::INT;

      -- Ethan Reynolds: 80% overall, distance-dependent
      v_kick_distance := 25 + FLOOR(RANDOM() * 25)::INT;

      IF v_kick_distance < 30 THEN
        v_kickoff_result := CASE WHEN RANDOM() < 0.95 THEN 'made' ELSE 'missed' END;
      ELSIF v_kick_distance < 40 THEN
        v_kickoff_result := CASE WHEN RANDOM() < 0.85 THEN 'made' ELSE 'missed' END;
      ELSE
        v_kickoff_result := CASE WHEN RANDOM() < 0.70 THEN 'made' ELSE 'missed' END;
      END IF;

      IF RANDOM() < 0.03 THEN
        v_kickoff_result := 'blocked';
      END IF;

      INSERT INTO play_instances (
        id, video_id, team_id,
        special_teams_unit, kicker_id, holder_id, long_snapper_id,
        kick_result, kick_distance, snap_quality,
        is_opponent_play, quarter, down, distance, yard_line,
        result,
        timestamp_start, created_at
      ) VALUES (
        v_play_id, v_video_id, v_team_id,
        'field_goal', v_kicker_id, v_qb1_id, v_ls_id,
        v_kickoff_result, v_kick_distance,
        CASE WHEN RANDOM() < 0.95 THEN 'good' ELSE 'low' END,
        FALSE,
        CASE WHEN v_play_num = 1 THEN 2 ELSE 4 END,
        4, 3, 100 - v_kick_distance + 17,
        CASE WHEN v_kickoff_result = 'made' THEN 'field_goal' ELSE 'missed_fg' END,
        v_timestamp,
        NOW() - INTERVAL '1 day' * (8 - v_game_num) * 7 + INTERVAL '1 minute' * (v_play_num + 40)
      );
    END LOOP;

    -- ========================================================================
    -- PATs (2-4 per game based on TDs scored)
    -- ========================================================================
    DECLARE
      v_pats_needed INT;
    BEGIN
      v_pats_needed := CASE v_game_num
        WHEN 1 THEN 3
        WHEN 2 THEN 2
        WHEN 3 THEN 4
        WHEN 4 THEN 2
        WHEN 5 THEN 5
        WHEN 6 THEN 3
        WHEN 7 THEN 1
        WHEN 8 THEN 4
        ELSE 3
      END;

      FOR v_play_num IN 1..v_pats_needed LOOP
        v_play_id := gen_random_uuid();
        v_timestamp := v_timestamp + 300 + FLOOR(RANDOM() * 600)::INT;

        v_kickoff_result := CASE WHEN RANDOM() < 0.98 THEN 'made' ELSE 'missed' END;

        INSERT INTO play_instances (
          id, video_id, team_id,
          special_teams_unit, kicker_id, holder_id, long_snapper_id,
          kick_result, kick_distance, snap_quality,
          is_opponent_play, quarter, down, distance, yard_line,
          result,
          timestamp_start, created_at
        ) VALUES (
          v_play_id, v_video_id, v_team_id,
          'pat', v_kicker_id, v_qb1_id, v_ls_id,
          v_kickoff_result, 20,
          'good',
          FALSE,
          CASE WHEN v_play_num <= 2 THEN 2 WHEN v_play_num <= 3 THEN 3 ELSE 4 END,
          NULL, NULL, 97,
          CASE WHEN v_kickoff_result = 'made' THEN 'pat_made' ELSE 'pat_missed' END,
          v_timestamp,
          NOW() - INTERVAL '1 day' * (8 - v_game_num) * 7 + INTERVAL '1 minute' * (v_play_num + 50)
        );
      END LOOP;
    END;

  END LOOP; -- End of game loop

  -- ============================================================================
  -- KICKOFF COVERAGE (add coverage tackler to opponent kick returns)
  -- ============================================================================
  UPDATE play_instances
  SET coverage_tackler_id = CASE
    WHEN RANDOM() < 0.35 THEN v_cb1_id
    WHEN RANDOM() < 0.55 THEN v_cb2_id
    WHEN RANDOM() < 0.70 THEN v_fs_id
    WHEN RANDOM() < 0.85 THEN v_ss_id
    ELSE v_wr1_id
  END
  WHERE team_id = v_team_id
    AND special_teams_unit = 'kickoff'
    AND kick_result = 'returned'
    AND coverage_tackler_id IS NULL;

END $$;

-- ============================================================================
-- SUMMARY STATISTICS (for verification)
-- ============================================================================
-- After running, you can verify with:
--
-- SELECT
--   special_teams_unit,
--   kick_result,
--   COUNT(*) as plays,
--   ROUND(AVG(kick_distance), 1) as avg_distance,
--   ROUND(AVG(return_yards), 1) as avg_return
-- FROM play_instances
-- WHERE team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
--   AND special_teams_unit IS NOT NULL
-- GROUP BY special_teams_unit, kick_result
-- ORDER BY special_teams_unit, plays DESC;
