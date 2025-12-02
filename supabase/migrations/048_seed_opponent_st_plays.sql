-- Seed Opponent Special Teams Play Instances for Testing
-- Creates opponent ST plays for Mountain Ridge game

DO $$
DECLARE
  team_uuid UUID := '99ef9d88-454e-42bf-8f52-04d37b34a9d6';
  video_uuid UUID := '5a05ff43-daaf-464a-810c-65b90cb83eee';
BEGIN

-- KICKOFF plays (opponent kicking off to us - 6 plays)
INSERT INTO play_instances (video_id, team_id, is_opponent_play, special_teams_unit, kickoff_type, kick_distance, kick_result, timestamp_start, quarter)
VALUES
  (video_uuid, team_uuid, true, 'kickoff', 'deep_center', 65, 'touchback', 0, 1),
  (video_uuid, team_uuid, true, 'kickoff', 'deep_left', 62, 'returned', 100, 1),
  (video_uuid, team_uuid, true, 'kickoff', 'deep_right', 58, 'returned', 200, 2),
  (video_uuid, team_uuid, true, 'kickoff', 'deep_center', 64, 'touchback', 300, 2),
  (video_uuid, team_uuid, true, 'kickoff', 'deep_left', 60, 'returned', 400, 3),
  (video_uuid, team_uuid, true, 'kickoff', 'squib_center', 45, 'returned', 500, 4);

-- KICK RETURN plays (opponent returning our kicks - 6 plays)
INSERT INTO play_instances (video_id, team_id, is_opponent_play, special_teams_unit, kick_result, return_yards, result, timestamp_start, quarter)
VALUES
  (video_uuid, team_uuid, true, 'kick_return', 'returned', 22, 'tackle', 600, 1),
  (video_uuid, team_uuid, true, 'kick_return', 'returned', 18, 'tackle', 700, 1),
  (video_uuid, team_uuid, true, 'kick_return', 'touchback', 0, 'touchback', 800, 2),
  (video_uuid, team_uuid, true, 'kick_return', 'returned', 25, 'tackle', 900, 2),
  (video_uuid, team_uuid, true, 'kick_return', 'returned', 15, 'tackle', 1000, 3),
  (video_uuid, team_uuid, true, 'kick_return', 'touchback', 0, 'touchback', 1100, 4);

-- PUNT plays (opponent punting - 5 plays)
INSERT INTO play_instances (video_id, team_id, is_opponent_play, special_teams_unit, kick_distance, punt_hang_time, kick_result, timestamp_start, quarter)
VALUES
  (video_uuid, team_uuid, true, 'punt', 42, 4.2, 'returned', 1200, 1),
  (video_uuid, team_uuid, true, 'punt', 38, 3.8, 'fair_catch', 1300, 2),
  (video_uuid, team_uuid, true, 'punt', 45, 4.5, 'downed', 1400, 2),
  (video_uuid, team_uuid, true, 'punt', 35, 3.5, 'returned', 1500, 3),
  (video_uuid, team_uuid, true, 'punt', 41, 4.0, 'fair_catch', 1600, 4);

-- PUNT RETURN plays (opponent returning our punts - 5 plays)
INSERT INTO play_instances (video_id, team_id, is_opponent_play, special_teams_unit, return_yards, is_fair_catch, result, timestamp_start, quarter)
VALUES
  (video_uuid, team_uuid, true, 'punt_return', 8, false, 'tackle', 1700, 1),
  (video_uuid, team_uuid, true, 'punt_return', 0, true, 'fair_catch', 1800, 2),
  (video_uuid, team_uuid, true, 'punt_return', 12, false, 'tackle', 1900, 2),
  (video_uuid, team_uuid, true, 'punt_return', 0, true, 'fair_catch', 2000, 3),
  (video_uuid, team_uuid, true, 'punt_return', 5, false, 'tackle', 2100, 4);

-- FIELD GOAL plays (opponent attempting FGs - 4 plays)
INSERT INTO play_instances (video_id, team_id, is_opponent_play, special_teams_unit, kick_distance, kick_result, result, timestamp_start, quarter)
VALUES
  (video_uuid, team_uuid, true, 'field_goal', 32, 'made', 'made', 2200, 1),
  (video_uuid, team_uuid, true, 'field_goal', 28, 'made', 'made', 2300, 2),
  (video_uuid, team_uuid, true, 'field_goal', 45, 'missed', 'missed', 2400, 3),
  (video_uuid, team_uuid, true, 'field_goal', 38, 'made', 'made', 2500, 4);

-- PAT plays (opponent PAT attempts - 4 plays)
INSERT INTO play_instances (video_id, team_id, is_opponent_play, special_teams_unit, kick_result, result, timestamp_start, quarter)
VALUES
  (video_uuid, team_uuid, true, 'pat', 'made', 'made', 2600, 1),
  (video_uuid, team_uuid, true, 'pat', 'made', 'made', 2700, 2),
  (video_uuid, team_uuid, true, 'pat', 'made', 'made', 2800, 3),
  (video_uuid, team_uuid, true, 'pat', 'made', 'made', 2900, 4);

END $$;
