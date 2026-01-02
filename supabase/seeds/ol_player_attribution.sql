-- ============================================================================
-- OL Player Attribution Seed Data
-- ============================================================================
-- Purpose: Add offensive line player-level attribution to existing play instances
-- This supplements ai_coaching_test_data.sql to enable queries like:
--   - "How is my offensive line doing by position?"
--   - "Who's my best run blocker?"
--   - "Which lineman is struggling?"
--
-- OL Performance Profile (creates realistic variance):
--   - LT (David Garcia #72): Excellent - 78% win rate (senior, anchor)
--   - LG (James Brown #64): Good - 68% win rate (junior, solid)
--   - C  (Ryan Miller #55): Very Good - 72% win rate (senior, smart)
--   - RG (Kevin Anderson #66): Struggling - 55% win rate (junior, needs work)
--   - RT (Anthony Thomas #78): Good - 70% win rate (senior, consistent)
-- ============================================================================

-- OL Player IDs from seed data
DO $$
DECLARE
  v_team_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  v_lt_id UUID := '11111111-1111-1111-1111-111111111110';  -- David Garcia #72
  v_lg_id UUID := '11111111-1111-1111-1111-111111111111';  -- James Brown #64
  v_c_id UUID := '11111111-1111-1111-1111-111111111112';   -- Ryan Miller #55
  v_rg_id UUID := '11111111-1111-1111-1111-111111111113';  -- Kevin Anderson #66
  v_rt_id UUID := '11111111-1111-1111-1111-111111111114';  -- Anthony Thomas #78

  v_play RECORD;
  v_rand FLOAT;
  v_lt_result TEXT;
  v_lg_result TEXT;
  v_c_result TEXT;
  v_rg_result TEXT;
  v_rt_result TEXT;
BEGIN
  -- Loop through all offensive plays (run and pass) for this team
  FOR v_play IN
    SELECT id, play_type, yards_gained, success
    FROM play_instances
    WHERE team_id = v_team_id
      AND is_opponent_play = false
      AND play_type IN ('run', 'pass')
  LOOP
    -- Generate block results based on position performance profiles
    -- Adjust thresholds based on play success (successful plays = more OL wins)

    -- LT (David Garcia) - 78% win rate baseline
    v_rand := random();
    IF v_play.success THEN
      -- On successful plays, even better performance
      v_lt_result := CASE
        WHEN v_rand < 0.85 THEN 'win'
        WHEN v_rand < 0.95 THEN 'neutral'
        ELSE 'loss'
      END;
    ELSE
      v_lt_result := CASE
        WHEN v_rand < 0.65 THEN 'win'
        WHEN v_rand < 0.85 THEN 'neutral'
        ELSE 'loss'
      END;
    END IF;

    -- LG (James Brown) - 68% win rate baseline
    v_rand := random();
    IF v_play.success THEN
      v_lg_result := CASE
        WHEN v_rand < 0.78 THEN 'win'
        WHEN v_rand < 0.92 THEN 'neutral'
        ELSE 'loss'
      END;
    ELSE
      v_lg_result := CASE
        WHEN v_rand < 0.55 THEN 'win'
        WHEN v_rand < 0.80 THEN 'neutral'
        ELSE 'loss'
      END;
    END IF;

    -- C (Ryan Miller) - 72% win rate baseline
    v_rand := random();
    IF v_play.success THEN
      v_c_result := CASE
        WHEN v_rand < 0.82 THEN 'win'
        WHEN v_rand < 0.94 THEN 'neutral'
        ELSE 'loss'
      END;
    ELSE
      v_c_result := CASE
        WHEN v_rand < 0.58 THEN 'win'
        WHEN v_rand < 0.82 THEN 'neutral'
        ELSE 'loss'
      END;
    END IF;

    -- RG (Kevin Anderson) - 55% win rate baseline (struggling)
    v_rand := random();
    IF v_play.success THEN
      v_rg_result := CASE
        WHEN v_rand < 0.65 THEN 'win'
        WHEN v_rand < 0.85 THEN 'neutral'
        ELSE 'loss'
      END;
    ELSE
      v_rg_result := CASE
        WHEN v_rand < 0.40 THEN 'win'
        WHEN v_rand < 0.70 THEN 'neutral'
        ELSE 'loss'
      END;
    END IF;

    -- RT (Anthony Thomas) - 70% win rate baseline
    v_rand := random();
    IF v_play.success THEN
      v_rt_result := CASE
        WHEN v_rand < 0.80 THEN 'win'
        WHEN v_rand < 0.93 THEN 'neutral'
        ELSE 'loss'
      END;
    ELSE
      v_rt_result := CASE
        WHEN v_rand < 0.56 THEN 'win'
        WHEN v_rand < 0.80 THEN 'neutral'
        ELSE 'loss'
      END;
    END IF;

    -- Update the play instance with OL attribution
    UPDATE play_instances
    SET
      lt_id = v_lt_id,
      lt_block_result = v_lt_result,
      lg_id = v_lg_id,
      lg_block_result = v_lg_result,
      c_id = v_c_id,
      c_block_result = v_c_result,
      rg_id = v_rg_id,
      rg_block_result = v_rg_result,
      rt_id = v_rt_id,
      rt_block_result = v_rt_result
    WHERE id = v_play.id;

  END LOOP;

  RAISE NOTICE 'OL attribution added to all offensive plays';
END $$;

-- Verify the update
SELECT
  'OL Attribution Summary' as report,
  COUNT(*) as total_plays,
  COUNT(lt_id) as plays_with_ol_data,
  ROUND(100.0 * COUNT(CASE WHEN lt_block_result = 'win' THEN 1 END) / NULLIF(COUNT(lt_id), 0), 1) as lt_win_pct,
  ROUND(100.0 * COUNT(CASE WHEN lg_block_result = 'win' THEN 1 END) / NULLIF(COUNT(lg_id), 0), 1) as lg_win_pct,
  ROUND(100.0 * COUNT(CASE WHEN c_block_result = 'win' THEN 1 END) / NULLIF(COUNT(c_id), 0), 1) as c_win_pct,
  ROUND(100.0 * COUNT(CASE WHEN rg_block_result = 'win' THEN 1 END) / NULLIF(COUNT(rg_id), 0), 1) as rg_win_pct,
  ROUND(100.0 * COUNT(CASE WHEN rt_block_result = 'win' THEN 1 END) / NULLIF(COUNT(rt_id), 0), 1) as rt_win_pct
FROM play_instances
WHERE team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  AND is_opponent_play = false;
