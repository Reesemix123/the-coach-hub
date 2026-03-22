-- Seed data: Farmington game — Win 28-14
-- Balanced run/pass, lots of penalties, great QB performance
-- Team: 4feec66c-a6e3-428b-b9ea-3c9485d70f66
-- Game: cdbc48d5-65b4-4dd6-bc6e-99d75566feeb
-- Video: b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d
--
-- Players:
--   Test Player (#1)   = abd3921f  — QB
--   Test WR Test (#13)  = 0bb78eb6  — WR
--   test dl test (#24)  = b871fa3d  — RB (reusing as RB for offense)
--   Test LB Test LB (#35) = f655a7c0  — LB/Defense
--   Test Safety Test Safety (#56) = 16bebf8e  — Safety/Defense

-- Step 1: Update game with score
UPDATE games SET
  team_score = 28,
  opponent_score = 14,
  game_result = 'win'
WHERE id = 'cdbc48d5-65b4-4dd6-bc6e-99d75566feeb';

-- Step 2: Insert play instances (40 plays — balanced run/pass with penalties)
-- Using video_id = b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d

-- ===== DRIVE 1: Opening drive, 5 plays, TD =====
-- Play 1: 1st & 10, pass complete 12 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000001', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 1000, 1500, 1, 10, 25, 'complete', 12, true, false, false, false);

-- Play 2: 1st & 10, run 6 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000002', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 2000, 2500, 1, 10, 37, 'run', 6, false, false, false, false);

-- Play 3: 2nd & 4, PENALTY — false start, 5 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play, penalty_type, penalty_yards, penalty_on_us)
VALUES ('a0000001-0001-0001-0001-000000000003', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 3000, 3200, 2, 4, 43, 'penalty', -5, false, false, false, true, 'false_start', 5, true);

-- Play 4: 2nd & 9, pass complete 15 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000004', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 4000, 4600, 2, 9, 38, 'complete', 15, true, false, false, false);

-- Play 5: 1st & 10, run TD 22 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000005', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 5000, 5800, 1, 10, 78, 'run', 22, false, true, false, false);

-- ===== DRIVE 2: 6 plays, FG range but stalled =====
-- Play 6: 1st & 10, pass complete 8 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000006', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 10000, 10500, 1, 10, 30, 'complete', 8, true, false, false, false);

-- Play 7: 2nd & 2, PENALTY — holding offense, 10 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play, penalty_type, penalty_yards, penalty_on_us)
VALUES ('a0000001-0001-0001-0001-000000000007', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 11000, 11200, 2, 2, 38, 'penalty', -10, false, false, false, true, 'holding_offense', 10, true);

-- Play 8: 2nd & 12, run 4 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000008', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 12000, 12400, 2, 12, 28, 'run', 4, false, false, false, false);

-- Play 9: 3rd & 8, pass complete 9 yards — 3rd down conversion!
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000009', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 13000, 13500, 3, 8, 32, 'complete', 9, true, false, false, false);

-- Play 10: 1st & 10, run 5 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000010', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 14000, 14400, 1, 10, 41, 'run', 5, false, false, false, false);

-- Play 11: 2nd & 5, PENALTY — illegal formation, 5 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play, penalty_type, penalty_yards, penalty_on_us)
VALUES ('a0000001-0001-0001-0001-000000000011', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 15000, 15200, 2, 5, 46, 'penalty', -5, false, false, false, true, 'illegal_formation', 5, true);

-- ===== DRIVE 3: 5 plays, passing TD =====
-- Play 12: 1st & 10, pass complete 7 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000012', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 20000, 20500, 1, 10, 35, 'complete', 7, true, false, false, false);

-- Play 13: 2nd & 3, run 3 yards — first down
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000013', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 21000, 21400, 2, 3, 42, 'run', 3, false, false, false, false);

-- Play 14: 1st & 10, PENALTY — holding on defense (good for us), 10 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play, penalty_type, penalty_yards, penalty_on_us)
VALUES ('a0000001-0001-0001-0001-000000000014', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 22000, 22200, 1, 10, 55, 'penalty', 10, false, false, false, true, 'holding_defense', 10, false);

-- Play 15: 1st & 10, pass complete 25 yards — big play!
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000015', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 23000, 23800, 1, 10, 65, 'complete', 25, true, false, false, false);

-- Play 16: 1st & goal, pass TD 10 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000016', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 24000, 24600, 1, 10, 90, 'complete', 10, true, true, false, false);

-- ===== DRIVE 4: 5 plays, mixed with penalties =====
-- Play 17: 1st & 10, run 8 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000017', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 30000, 30500, 1, 10, 30, 'run', 8, false, false, false, false);

-- Play 18: 2nd & 2, PENALTY — delay of game, 5 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play, penalty_type, penalty_yards, penalty_on_us)
VALUES ('a0000001-0001-0001-0001-000000000018', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 31000, 31200, 2, 2, 38, 'penalty', -5, false, false, false, true, 'delay_of_game', 5, true);

-- Play 19: 2nd & 7, pass complete 11 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000019', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 32000, 32500, 2, 7, 33, 'complete', 11, true, false, false, false);

-- Play 20: 1st & 10, pass incomplete
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000020', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 33000, 33400, 1, 10, 44, 'incomplete', 0, false, false, false, false);

-- Play 21: 2nd & 10, run 7 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000021', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 34000, 34500, 2, 10, 44, 'run', 7, false, false, false, false);

-- ===== DRIVE 5: 4 plays, rushing TD =====
-- Play 22: 1st & 10, pass complete 18 yards — big play
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000022', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 40000, 40600, 1, 10, 40, 'complete', 18, true, false, false, false);

-- Play 23: 1st & 10, PENALTY — unsportsmanlike, 15 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play, penalty_type, penalty_yards, penalty_on_us)
VALUES ('a0000001-0001-0001-0001-000000000023', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 41000, 41200, 1, 10, 58, 'penalty', -15, false, false, false, true, 'unsportsmanlike', 15, true);

-- Play 24: 1st & 25, run 12 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000024', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 42000, 42600, 1, 25, 43, 'run', 12, false, false, false, false);

-- Play 25: 2nd & 13, pass complete 13 yards — first down
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000025', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 43000, 43600, 2, 13, 55, 'complete', 13, true, false, false, false);

-- Play 26: 1st & goal, run TD 8 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000026', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 44000, 44600, 1, 8, 92, 'run', 8, false, true, false, false);

-- ===== DRIVE 6: 5 plays, stalled with penalties =====
-- Play 27: 1st & 10, run 3 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000027', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 50000, 50400, 1, 10, 25, 'run', 3, false, false, false, false);

-- Play 28: 2nd & 7, PENALTY — false start, 5 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play, penalty_type, penalty_yards, penalty_on_us)
VALUES ('a0000001-0001-0001-0001-000000000028', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 51000, 51200, 2, 7, 28, 'penalty', -5, false, false, false, true, 'false_start', 5, true);

-- Play 29: 2nd & 12, pass complete 6 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000029', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 52000, 52400, 2, 12, 23, 'complete', 6, true, false, false, false);

-- Play 30: 3rd & 6, pass incomplete
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000030', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 53000, 53400, 3, 6, 29, 'incomplete', 0, false, false, false, false);

-- Play 31: 4th & 6, punt (just a play that ends the drive)
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000031', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 54000, 54400, 4, 6, 29, 'punt', 0, false, false, false, false);

-- ===== DRIVE 7: 4 plays, passing TD to close game =====
-- Play 32: 1st & 10, pass complete 14 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000032', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 60000, 60600, 1, 10, 45, 'complete', 14, true, false, false, false);

-- Play 33: 1st & 10, run 6 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000033', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 61000, 61400, 1, 10, 59, 'run', 6, false, false, false, false);

-- Play 34: 2nd & 4, PENALTY — holding, 10 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play, penalty_type, penalty_yards, penalty_on_us)
VALUES ('a0000001-0001-0001-0001-000000000034', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 62000, 62200, 2, 4, 65, 'penalty', -10, false, false, false, true, 'holding_offense', 10, true);

-- Play 35: 2nd & 14, pass complete 20 yards — big play!
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000035', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 63000, 63700, 2, 14, 55, 'complete', 20, true, false, false, false);

-- Play 36: 1st & goal, pass TD 5 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000036', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 64000, 64500, 1, 5, 95, 'complete', 5, true, true, false, false);

-- ===== EXTRA PLAYS: Some defensive stops + more penalties =====
-- Play 37: 1st & 10, pass incomplete (opponent has ball conceptually, but tagged as our analysis)
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000037', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 70000, 70400, 1, 10, 50, 'incomplete', 0, false, false, false, false);

-- Play 38: 2nd & 10, run 2 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000038', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 71000, 71400, 2, 10, 50, 'run', 2, false, false, false, false);

-- Play 39: 3rd & 8, pass complete 5 yards (short of first down)
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play)
VALUES ('a0000001-0001-0001-0001-000000000039', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 72000, 72500, 3, 8, 52, 'complete', 5, true, false, false, false);

-- Play 40: 1st & 10, PENALTY — offsides on defense (not on us), 5 yards
INSERT INTO play_instances (id, video_id, team_id, timestamp_start, timestamp_end, down, distance, yard_line, result, yards_gained, is_complete, is_touchdown, is_turnover, penalty_on_play, penalty_type, penalty_yards, penalty_on_us)
VALUES ('a0000001-0001-0001-0001-000000000040', 'b837e0ec-1b9d-4982-b8f1-03ddbcfeaf8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 73000, 73200, 1, 10, 40, 'penalty', 5, false, false, false, true, 'offsides', 5, false);


-- Step 3: Insert player participation records
-- QB (Test Player #1) — passer on all pass plays
INSERT INTO player_participation (play_instance_id, player_id, team_id, participation_type, phase, yards_gained, is_touchdown)
VALUES
  ('a0000001-0001-0001-0001-000000000001', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 12, false),
  ('a0000001-0001-0001-0001-000000000004', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 15, false),
  ('a0000001-0001-0001-0001-000000000006', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 8, false),
  ('a0000001-0001-0001-0001-000000000009', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 9, false),
  ('a0000001-0001-0001-0001-000000000012', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 7, false),
  ('a0000001-0001-0001-0001-000000000015', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 25, false),
  ('a0000001-0001-0001-0001-000000000016', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 10, true),
  ('a0000001-0001-0001-0001-000000000019', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 11, false),
  ('a0000001-0001-0001-0001-000000000020', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 0, false),
  ('a0000001-0001-0001-0001-000000000022', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 18, false),
  ('a0000001-0001-0001-0001-000000000025', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 13, false),
  ('a0000001-0001-0001-0001-000000000029', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 6, false),
  ('a0000001-0001-0001-0001-000000000030', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 0, false),
  ('a0000001-0001-0001-0001-000000000032', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 14, false),
  ('a0000001-0001-0001-0001-000000000035', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 20, false),
  ('a0000001-0001-0001-0001-000000000036', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 5, true),
  ('a0000001-0001-0001-0001-000000000039', 'abd3921f-d244-4da7-98c2-02c2bd885dd4', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'passer', 'offense', 5, false);

-- WR (Test WR #13) — receiver on pass completions
INSERT INTO player_participation (play_instance_id, player_id, team_id, participation_type, phase, yards_gained, is_touchdown)
VALUES
  ('a0000001-0001-0001-0001-000000000001', '0bb78eb6-9ca6-403e-a821-b2e1c973b4a8', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'receiver', 'offense', 12, false),
  ('a0000001-0001-0001-0001-000000000004', '0bb78eb6-9ca6-403e-a821-b2e1c973b4a8', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'receiver', 'offense', 15, false),
  ('a0000001-0001-0001-0001-000000000009', '0bb78eb6-9ca6-403e-a821-b2e1c973b4a8', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'receiver', 'offense', 9, false),
  ('a0000001-0001-0001-0001-000000000015', '0bb78eb6-9ca6-403e-a821-b2e1c973b4a8', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'receiver', 'offense', 25, false),
  ('a0000001-0001-0001-0001-000000000016', '0bb78eb6-9ca6-403e-a821-b2e1c973b4a8', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'receiver', 'offense', 10, true),
  ('a0000001-0001-0001-0001-000000000022', '0bb78eb6-9ca6-403e-a821-b2e1c973b4a8', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'receiver', 'offense', 18, false),
  ('a0000001-0001-0001-0001-000000000032', '0bb78eb6-9ca6-403e-a821-b2e1c973b4a8', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'receiver', 'offense', 14, false),
  ('a0000001-0001-0001-0001-000000000035', '0bb78eb6-9ca6-403e-a821-b2e1c973b4a8', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'receiver', 'offense', 20, false),
  ('a0000001-0001-0001-0001-000000000036', '0bb78eb6-9ca6-403e-a821-b2e1c973b4a8', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'receiver', 'offense', 5, true);

-- RB (test dl #24 — reusing as RB) — rusher on run plays
INSERT INTO player_participation (play_instance_id, player_id, team_id, participation_type, phase, yards_gained, is_touchdown)
VALUES
  ('a0000001-0001-0001-0001-000000000002', 'b871fa3d-100c-4732-984d-11b30de23b8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'rusher', 'offense', 6, false),
  ('a0000001-0001-0001-0001-000000000005', 'b871fa3d-100c-4732-984d-11b30de23b8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'rusher', 'offense', 22, true),
  ('a0000001-0001-0001-0001-000000000008', 'b871fa3d-100c-4732-984d-11b30de23b8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'rusher', 'offense', 4, false),
  ('a0000001-0001-0001-0001-000000000010', 'b871fa3d-100c-4732-984d-11b30de23b8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'rusher', 'offense', 5, false),
  ('a0000001-0001-0001-0001-000000000013', 'b871fa3d-100c-4732-984d-11b30de23b8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'rusher', 'offense', 3, false),
  ('a0000001-0001-0001-0001-000000000017', 'b871fa3d-100c-4732-984d-11b30de23b8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'rusher', 'offense', 8, false),
  ('a0000001-0001-0001-0001-000000000021', 'b871fa3d-100c-4732-984d-11b30de23b8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'rusher', 'offense', 7, false),
  ('a0000001-0001-0001-0001-000000000024', 'b871fa3d-100c-4732-984d-11b30de23b8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'rusher', 'offense', 12, false),
  ('a0000001-0001-0001-0001-000000000026', 'b871fa3d-100c-4732-984d-11b30de23b8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'rusher', 'offense', 8, true),
  ('a0000001-0001-0001-0001-000000000027', 'b871fa3d-100c-4732-984d-11b30de23b8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'rusher', 'offense', 3, false),
  ('a0000001-0001-0001-0001-000000000033', 'b871fa3d-100c-4732-984d-11b30de23b8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'rusher', 'offense', 6, false),
  ('a0000001-0001-0001-0001-000000000038', 'b871fa3d-100c-4732-984d-11b30de23b8d', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'rusher', 'offense', 2, false);

-- LB (Test LB #35) — defensive tackles
INSERT INTO player_participation (play_instance_id, player_id, team_id, participation_type, phase, yards_gained, is_touchdown)
VALUES
  ('a0000001-0001-0001-0001-000000000037', 'f655a7c0-3bb1-463b-8410-b772c115a110', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'primary_tackle', 'defense', 0, false),
  ('a0000001-0001-0001-0001-000000000038', 'f655a7c0-3bb1-463b-8410-b772c115a110', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'primary_tackle', 'defense', 2, false),
  ('a0000001-0001-0001-0001-000000000039', 'f655a7c0-3bb1-463b-8410-b772c115a110', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'tackle_for_loss', 'defense', -2, false);

-- Safety (Test Safety #56) — defensive plays
INSERT INTO player_participation (play_instance_id, player_id, team_id, participation_type, phase, yards_gained, is_touchdown)
VALUES
  ('a0000001-0001-0001-0001-000000000037', '16bebf8e-0cd5-4f6e-960f-e04adf6004a9', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'assist_tackle', 'defense', 0, false),
  ('a0000001-0001-0001-0001-000000000039', '16bebf8e-0cd5-4f6e-960f-e04adf6004a9', '4feec66c-a6e3-428b-b9ea-3c9485d70f66', 'pass_breakup', 'defense', 0, false);
