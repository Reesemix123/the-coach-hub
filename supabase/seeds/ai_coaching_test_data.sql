-- ============================================================================
-- AI Coaching Intelligence Test Data
-- ============================================================================
-- Purpose: Realistic youth football data for testing AI coaching queries like:
--   - "How's my run game trending?"
--   - "What formations work best on 3rd down?"
--   - "Who's my most efficient runner?"
--   - "Are we better passing left or right?"
--   - "How are we doing in the red zone?"
--
-- Data Summary:
--   - 1 Team: Central Eagles (Youth HS)
--   - 22 Players: Full two-deep roster
--   - 18 Playbook Plays: Mix of run/pass concepts
--   - 8 Games: Season with 5-3 record
--   - ~450 Play Instances across all games
--   - ~80 Drives with proper analytics
--
-- Youth Football Tendencies Modeled:
--   - 65% run, 35% pass (run-heavy)
--   - Simple formations: I-Form, Shotgun, Trips, Wing-T
--   - Lower completion % (45-55%)
--   - Shorter average gains
--   - 1-2 turnovers per game average
-- ============================================================================

-- Test user: testcoach@youthcoachhub.test
DO $$
DECLARE
  v_user_id UUID := 'bcbfba82-a493-4674-89cc-573cd8d7b65a';
  v_team_id UUID := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  -- Player IDs (offense)
  v_qb1_id UUID := '11111111-1111-1111-1111-111111111101';
  v_qb2_id UUID := '11111111-1111-1111-1111-111111111102';
  v_rb1_id UUID := '11111111-1111-1111-1111-111111111103';
  v_rb2_id UUID := '11111111-1111-1111-1111-111111111104';
  v_fb_id UUID := '11111111-1111-1111-1111-111111111105';
  v_wr1_id UUID := '11111111-1111-1111-1111-111111111106';
  v_wr2_id UUID := '11111111-1111-1111-1111-111111111107';
  v_wr3_id UUID := '11111111-1111-1111-1111-111111111108';
  v_te1_id UUID := '11111111-1111-1111-1111-111111111109';
  v_lt_id UUID := '11111111-1111-1111-1111-111111111110';
  v_lg_id UUID := '11111111-1111-1111-1111-111111111111';
  v_c_id UUID := '11111111-1111-1111-1111-111111111112';
  v_rg_id UUID := '11111111-1111-1111-1111-111111111113';
  v_rt_id UUID := '11111111-1111-1111-1111-111111111114';

  -- Player IDs (defense)
  v_de1_id UUID := '11111111-1111-1111-1111-111111111115';
  v_de2_id UUID := '11111111-1111-1111-1111-111111111116';
  v_dt_id UUID := '11111111-1111-1111-1111-111111111117';
  v_mlb_id UUID := '11111111-1111-1111-1111-111111111118';
  v_olb1_id UUID := '11111111-1111-1111-1111-111111111119';
  v_olb2_id UUID := '11111111-1111-1111-1111-111111111120';
  v_cb1_id UUID := '11111111-1111-1111-1111-111111111121';
  v_cb2_id UUID := '11111111-1111-1111-1111-111111111122';
  v_ss_id UUID := '11111111-1111-1111-1111-111111111123';
  v_fs_id UUID := '11111111-1111-1111-1111-111111111124';

  -- Game IDs
  v_game1_id UUID := '22222222-2222-2222-2222-222222222201';
  v_game2_id UUID := '22222222-2222-2222-2222-222222222202';
  v_game3_id UUID := '22222222-2222-2222-2222-222222222203';
  v_game4_id UUID := '22222222-2222-2222-2222-222222222204';
  v_game5_id UUID := '22222222-2222-2222-2222-222222222205';
  v_game6_id UUID := '22222222-2222-2222-2222-222222222206';
  v_game7_id UUID := '22222222-2222-2222-2222-222222222207';
  v_game8_id UUID := '22222222-2222-2222-2222-222222222208';

  -- Video IDs (one per game)
  v_video1_id UUID := '33333333-3333-3333-3333-333333333301';
  v_video2_id UUID := '33333333-3333-3333-3333-333333333302';
  v_video3_id UUID := '33333333-3333-3333-3333-333333333303';
  v_video4_id UUID := '33333333-3333-3333-3333-333333333304';
  v_video5_id UUID := '33333333-3333-3333-3333-333333333305';
  v_video6_id UUID := '33333333-3333-3333-3333-333333333306';
  v_video7_id UUID := '33333333-3333-3333-3333-333333333307';
  v_video8_id UUID := '33333333-3333-3333-3333-333333333308';

BEGIN
  -- ============================================================================
  -- TEAM
  -- ============================================================================
  INSERT INTO teams (id, name, level, colors, user_id, created_at)
  VALUES (
    v_team_id,
    'Central Eagles',
    'Youth HS',
    '{"primary": "#1e40af", "secondary": "#fbbf24"}'::jsonb,
    v_user_id,
    NOW() - INTERVAL '6 months'
  )
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  -- ============================================================================
  -- PLAYERS (22-man roster)
  -- ============================================================================

  -- Offense
  INSERT INTO players (id, team_id, jersey_number, first_name, last_name, position_depths, is_active, grade_level)
  VALUES
    (v_qb1_id, v_team_id, '7', 'Marcus', 'Thompson', '{"QB": 1}'::jsonb, true, 'Junior'),
    (v_qb2_id, v_team_id, '12', 'Jake', 'Williams', '{"QB": 2}'::jsonb, true, 'Sophomore'),
    (v_rb1_id, v_team_id, '22', 'DeShawn', 'Carter', '{"RB": 1}'::jsonb, true, 'Senior'),
    (v_rb2_id, v_team_id, '28', 'Tyler', 'Brooks', '{"RB": 2}'::jsonb, true, 'Junior'),
    (v_fb_id, v_team_id, '44', 'Mike', 'Johnson', '{"FB": 1}'::jsonb, true, 'Senior'),
    (v_wr1_id, v_team_id, '1', 'Jaylen', 'Davis', '{"WR": 1}'::jsonb, true, 'Senior'),
    (v_wr2_id, v_team_id, '11', 'Chris', 'Martinez', '{"WR": 2}'::jsonb, true, 'Junior'),
    (v_wr3_id, v_team_id, '15', 'Andre', 'Wilson', '{"WR": 3}'::jsonb, true, 'Sophomore'),
    (v_te1_id, v_team_id, '85', 'Brandon', 'Taylor', '{"TE": 1}'::jsonb, true, 'Senior'),
    (v_lt_id, v_team_id, '72', 'David', 'Garcia', '{"LT": 1}'::jsonb, true, 'Senior'),
    (v_lg_id, v_team_id, '64', 'James', 'Brown', '{"LG": 1}'::jsonb, true, 'Junior'),
    (v_c_id, v_team_id, '55', 'Ryan', 'Miller', '{"C": 1}'::jsonb, true, 'Senior'),
    (v_rg_id, v_team_id, '66', 'Kevin', 'Anderson', '{"RG": 1}'::jsonb, true, 'Junior'),
    (v_rt_id, v_team_id, '78', 'Anthony', 'Thomas', '{"RT": 1}'::jsonb, true, 'Senior')
  ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name;

  -- Defense
  INSERT INTO players (id, team_id, jersey_number, first_name, last_name, position_depths, is_active, grade_level)
  VALUES
    (v_de1_id, v_team_id, '91', 'Marcus', 'Lee', '{"DE": 1}'::jsonb, true, 'Senior'),
    (v_de2_id, v_team_id, '95', 'Jason', 'White', '{"DE": 2}'::jsonb, true, 'Junior'),
    (v_dt_id, v_team_id, '99', 'Darius', 'Jackson', '{"DT": 1}'::jsonb, true, 'Senior'),
    (v_mlb_id, v_team_id, '52', 'Carlos', 'Rodriguez', '{"MLB": 1}'::jsonb, true, 'Senior'),
    (v_olb1_id, v_team_id, '56', 'Trey', 'Harris', '{"OLB": 1}'::jsonb, true, 'Junior'),
    (v_olb2_id, v_team_id, '58', 'Malik', 'Robinson', '{"OLB": 2}'::jsonb, true, 'Sophomore'),
    (v_cb1_id, v_team_id, '21', 'Terrance', 'Moore', '{"CB": 1}'::jsonb, true, 'Senior'),
    (v_cb2_id, v_team_id, '24', 'Devon', 'Clark', '{"CB": 2}'::jsonb, true, 'Junior'),
    (v_ss_id, v_team_id, '32', 'Isaiah', 'Wright', '{"SS": 1}'::jsonb, true, 'Senior'),
    (v_fs_id, v_team_id, '27', 'Jordan', 'King', '{"FS": 1}'::jsonb, true, 'Junior')
  ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name;

  -- ============================================================================
  -- PLAYBOOK PLAYS (24 plays - offense, defense, special teams)
  -- ============================================================================

  -- OFFENSIVE PLAYS (12 plays)
  -- Run Plays with I-Formation
  INSERT INTO playbook_plays (id, team_id, play_code, play_name, attributes, diagram, is_archived, created_at)
  VALUES
    (gen_random_uuid(), v_team_id, 'R-001', 'Inside Zone Left',
     '{"odk": "offense", "formation": "I-Formation", "playType": "Run", "runConcept": "Inside Zone", "personnel": "21 (2RB-1TE-2WR)", "targetHole": "1", "ballCarrier": "TB"}'::jsonb,
     '{"players": [{"position": "X", "x": 50, "y": 200, "label": "X", "assignment": "Block"}, {"position": "LT", "x": 220, "y": 200, "label": "LT", "blockType": "Run Block"}, {"position": "LG", "x": 260, "y": 200, "label": "LG", "blockType": "Run Block"}, {"position": "C", "x": 300, "y": 200, "label": "C", "blockType": "Run Block"}, {"position": "RG", "x": 340, "y": 200, "label": "RG", "blockType": "Run Block"}, {"position": "RT", "x": 380, "y": 200, "label": "RT", "blockType": "Run Block"}, {"position": "TE", "x": 420, "y": 200, "label": "TE", "blockType": "Run Block"}, {"position": "QB", "x": 300, "y": 215, "label": "QB", "assignment": "Handoff"}, {"position": "FB", "x": 300, "y": 245, "label": "FB", "assignment": "Lead Block"}, {"position": "TB", "x": 300, "y": 280, "label": "TB", "assignment": "Inside Zone", "isPrimary": true}, {"position": "Z", "x": 550, "y": 210, "label": "Z", "assignment": "Block"}], "routes": [], "formation": "I-Formation", "odk": "offense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'R-002', 'Inside Zone Right',
     '{"odk": "offense", "formation": "I-Formation", "playType": "Run", "runConcept": "Inside Zone", "personnel": "21 (2RB-1TE-2WR)", "targetHole": "2", "ballCarrier": "TB"}'::jsonb,
     '{"players": [{"position": "X", "x": 50, "y": 200, "label": "X", "assignment": "Block"}, {"position": "LT", "x": 220, "y": 200, "label": "LT", "blockType": "Run Block"}, {"position": "LG", "x": 260, "y": 200, "label": "LG", "blockType": "Run Block"}, {"position": "C", "x": 300, "y": 200, "label": "C", "blockType": "Run Block"}, {"position": "RG", "x": 340, "y": 200, "label": "RG", "blockType": "Run Block"}, {"position": "RT", "x": 380, "y": 200, "label": "RT", "blockType": "Run Block"}, {"position": "TE", "x": 420, "y": 200, "label": "TE", "blockType": "Run Block"}, {"position": "QB", "x": 300, "y": 215, "label": "QB", "assignment": "Handoff"}, {"position": "FB", "x": 300, "y": 245, "label": "FB", "assignment": "Lead Block"}, {"position": "TB", "x": 300, "y": 280, "label": "TB", "assignment": "Inside Zone", "isPrimary": true}, {"position": "Z", "x": 550, "y": 210, "label": "Z", "assignment": "Block"}], "routes": [], "formation": "I-Formation", "odk": "offense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'R-003', 'Power Left',
     '{"odk": "offense", "formation": "Power I", "playType": "Run", "runConcept": "Power", "personnel": "22 (2RB-2TE-1WR)", "targetHole": "3", "ballCarrier": "TB"}'::jsonb,
     '{"players": [{"position": "LT", "x": 200, "y": 200, "label": "LT", "blockType": "Run Block"}, {"position": "LG", "x": 260, "y": 200, "label": "LG", "blockType": "Run Block"}, {"position": "C", "x": 300, "y": 200, "label": "C", "blockType": "Run Block"}, {"position": "RG", "x": 340, "y": 200, "label": "RG", "blockType": "Pull"}, {"position": "RT", "x": 380, "y": 200, "label": "RT", "blockType": "Run Block"}, {"position": "TE1", "x": 140, "y": 200, "label": "TE1", "blockType": "Run Block"}, {"position": "TE2", "x": 440, "y": 200, "label": "TE2", "blockType": "Run Block"}, {"position": "QB", "x": 300, "y": 215, "label": "QB", "assignment": "Handoff"}, {"position": "FB", "x": 300, "y": 245, "label": "FB", "assignment": "Kick Out"}, {"position": "TB", "x": 300, "y": 280, "label": "TB", "assignment": "Power", "isPrimary": true}, {"position": "FL", "x": 50, "y": 210, "label": "FL", "assignment": "Block"}], "routes": [], "formation": "Power I", "odk": "offense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'R-004', 'Power Right',
     '{"odk": "offense", "formation": "Power I", "playType": "Run", "runConcept": "Power", "personnel": "22 (2RB-2TE-1WR)", "targetHole": "4", "ballCarrier": "TB"}'::jsonb,
     '{"players": [{"position": "LT", "x": 200, "y": 200, "label": "LT", "blockType": "Run Block"}, {"position": "LG", "x": 260, "y": 200, "label": "LG", "blockType": "Pull"}, {"position": "C", "x": 300, "y": 200, "label": "C", "blockType": "Run Block"}, {"position": "RG", "x": 340, "y": 200, "label": "RG", "blockType": "Run Block"}, {"position": "RT", "x": 380, "y": 200, "label": "RT", "blockType": "Run Block"}, {"position": "TE1", "x": 140, "y": 200, "label": "TE1", "blockType": "Run Block"}, {"position": "TE2", "x": 440, "y": 200, "label": "TE2", "blockType": "Run Block"}, {"position": "QB", "x": 300, "y": 215, "label": "QB", "assignment": "Handoff"}, {"position": "FB", "x": 300, "y": 245, "label": "FB", "assignment": "Kick Out"}, {"position": "TB", "x": 300, "y": 280, "label": "TB", "assignment": "Power", "isPrimary": true}, {"position": "FL", "x": 50, "y": 210, "label": "FL", "assignment": "Block"}], "routes": [], "formation": "Power I", "odk": "offense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'R-005', 'Counter Left',
     '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Run", "runConcept": "Counter", "personnel": "11 (1RB-1TE-3WR)", "targetHole": "3", "ballCarrier": "RB"}'::jsonb,
     '{"players": [{"position": "X", "x": 50, "y": 200, "label": "X", "assignment": "Block"}, {"position": "LT", "x": 220, "y": 200, "label": "LT", "blockType": "Run Block"}, {"position": "LG", "x": 260, "y": 200, "label": "LG", "blockType": "Run Block"}, {"position": "C", "x": 300, "y": 200, "label": "C", "blockType": "Run Block"}, {"position": "RG", "x": 340, "y": 200, "label": "RG", "blockType": "Pull"}, {"position": "RT", "x": 380, "y": 200, "label": "RT", "blockType": "Run Block"}, {"position": "TE", "x": 420, "y": 200, "label": "TE", "blockType": "Pull"}, {"position": "SL", "x": 180, "y": 210, "label": "SL", "assignment": "Block"}, {"position": "Z", "x": 550, "y": 210, "label": "Z", "assignment": "Block"}, {"position": "QB", "x": 300, "y": 260, "label": "QB", "assignment": "Handoff"}, {"position": "RB", "x": 340, "y": 260, "label": "RB", "assignment": "Counter", "isPrimary": true}], "routes": [], "formation": "Shotgun Spread", "odk": "offense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'R-006', 'Counter Right',
     '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Run", "runConcept": "Counter", "personnel": "11 (1RB-1TE-3WR)", "targetHole": "4", "ballCarrier": "RB"}'::jsonb,
     '{"players": [{"position": "X", "x": 50, "y": 200, "label": "X", "assignment": "Block"}, {"position": "LT", "x": 220, "y": 200, "label": "LT", "blockType": "Run Block"}, {"position": "LG", "x": 260, "y": 200, "label": "LG", "blockType": "Pull"}, {"position": "C", "x": 300, "y": 200, "label": "C", "blockType": "Run Block"}, {"position": "RG", "x": 340, "y": 200, "label": "RG", "blockType": "Run Block"}, {"position": "RT", "x": 380, "y": 200, "label": "RT", "blockType": "Run Block"}, {"position": "TE", "x": 420, "y": 200, "label": "TE", "blockType": "Run Block"}, {"position": "SL", "x": 180, "y": 210, "label": "SL", "assignment": "Block"}, {"position": "Z", "x": 550, "y": 210, "label": "Z", "assignment": "Block"}, {"position": "QB", "x": 300, "y": 260, "label": "QB", "assignment": "Handoff"}, {"position": "RB", "x": 340, "y": 260, "label": "RB", "assignment": "Counter", "isPrimary": true}], "routes": [], "formation": "Shotgun Spread", "odk": "offense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'R-007', 'Sweep Left',
     '{"odk": "offense", "formation": "Wing-T", "playType": "Run", "runConcept": "Sweep", "personnel": "21 (2RB-1TE-2WR)", "targetHole": "7", "ballCarrier": "TB"}'::jsonb,
     '{"players": [{"position": "SE", "x": 50, "y": 200, "label": "SE", "assignment": "Block"}, {"position": "LT", "x": 220, "y": 200, "label": "LT", "blockType": "Run Block"}, {"position": "LG", "x": 260, "y": 200, "label": "LG", "blockType": "Pull"}, {"position": "C", "x": 300, "y": 200, "label": "C", "blockType": "Run Block"}, {"position": "RG", "x": 340, "y": 200, "label": "RG", "blockType": "Pull"}, {"position": "RT", "x": 380, "y": 200, "label": "RT", "blockType": "Run Block"}, {"position": "TE", "x": 420, "y": 200, "label": "TE", "blockType": "Run Block"}, {"position": "QB", "x": 300, "y": 215, "label": "QB", "assignment": "Handoff"}, {"position": "FB", "x": 300, "y": 245, "label": "FB", "assignment": "Lead Block"}, {"position": "TB", "x": 300, "y": 280, "label": "TB", "assignment": "Sweep", "isPrimary": true}, {"position": "WB", "x": 460, "y": 210, "label": "WB", "assignment": "Block"}], "routes": [], "formation": "Wing-T", "odk": "offense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'R-008', 'Sweep Right',
     '{"odk": "offense", "formation": "Wing-T", "playType": "Run", "runConcept": "Sweep", "personnel": "21 (2RB-1TE-2WR)", "targetHole": "8", "ballCarrier": "TB"}'::jsonb,
     '{"players": [{"position": "SE", "x": 50, "y": 200, "label": "SE", "assignment": "Block"}, {"position": "LT", "x": 220, "y": 200, "label": "LT", "blockType": "Run Block"}, {"position": "LG", "x": 260, "y": 200, "label": "LG", "blockType": "Pull"}, {"position": "C", "x": 300, "y": 200, "label": "C", "blockType": "Run Block"}, {"position": "RG", "x": 340, "y": 200, "label": "RG", "blockType": "Pull"}, {"position": "RT", "x": 380, "y": 200, "label": "RT", "blockType": "Run Block"}, {"position": "TE", "x": 420, "y": 200, "label": "TE", "blockType": "Run Block"}, {"position": "QB", "x": 300, "y": 215, "label": "QB", "assignment": "Handoff"}, {"position": "FB", "x": 300, "y": 245, "label": "FB", "assignment": "Lead Block"}, {"position": "TB", "x": 300, "y": 280, "label": "TB", "assignment": "Sweep", "isPrimary": true}, {"position": "WB", "x": 460, "y": 210, "label": "WB", "assignment": "Block"}], "routes": [], "formation": "Wing-T", "odk": "offense"}'::jsonb, false, NOW())
  ON CONFLICT DO NOTHING;

  -- Pass Plays
  INSERT INTO playbook_plays (id, team_id, play_code, play_name, attributes, diagram, is_archived, created_at)
  VALUES
    (gen_random_uuid(), v_team_id, 'P-001', 'Slant-Flat',
     '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Slant-Flat", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man (Slide)"}'::jsonb,
     '{"players": [{"position": "X", "x": 50, "y": 200, "label": "X", "assignment": "Slant", "isPrimary": true}, {"position": "LT", "x": 220, "y": 200, "label": "LT", "blockType": "Pass Block"}, {"position": "LG", "x": 260, "y": 200, "label": "LG", "blockType": "Pass Block"}, {"position": "C", "x": 300, "y": 200, "label": "C", "blockType": "Pass Block"}, {"position": "RG", "x": 340, "y": 200, "label": "RG", "blockType": "Pass Block"}, {"position": "RT", "x": 380, "y": 200, "label": "RT", "blockType": "Pass Block"}, {"position": "TE", "x": 420, "y": 200, "label": "TE", "assignment": "Flat"}, {"position": "SL", "x": 180, "y": 210, "label": "SL", "assignment": "Slant"}, {"position": "Z", "x": 550, "y": 210, "label": "Z", "assignment": "Go"}, {"position": "QB", "x": 300, "y": 260, "label": "QB", "assignment": "Pass"}, {"position": "RB", "x": 340, "y": 260, "label": "RB", "assignment": "Block"}], "routes": [{"id": "r1", "playerId": "X", "path": [{"x": 50, "y": 200}, {"x": 100, "y": 150}], "type": "pass", "routeType": "Slant", "isPrimary": true}], "formation": "Shotgun Spread", "odk": "offense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'P-002', 'Curl-Flat',
     '{"odk": "offense", "formation": "Gun Trips Right", "playType": "Pass", "passConcept": "Curl-Flat", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man (Slide)"}'::jsonb,
     '{"players": [{"position": "X", "x": 50, "y": 200, "label": "X", "assignment": "Curl", "isPrimary": true}, {"position": "LT", "x": 220, "y": 200, "label": "LT", "blockType": "Pass Block"}, {"position": "LG", "x": 260, "y": 200, "label": "LG", "blockType": "Pass Block"}, {"position": "C", "x": 300, "y": 200, "label": "C", "blockType": "Pass Block"}, {"position": "RG", "x": 340, "y": 200, "label": "RG", "blockType": "Pass Block"}, {"position": "RT", "x": 380, "y": 200, "label": "RT", "blockType": "Pass Block"}, {"position": "Y", "x": 460, "y": 200, "label": "Y", "assignment": "Flat"}, {"position": "Z", "x": 510, "y": 210, "label": "Z", "assignment": "Curl"}, {"position": "SL", "x": 420, "y": 215, "label": "SL", "assignment": "Out"}, {"position": "QB", "x": 300, "y": 260, "label": "QB", "assignment": "Pass"}, {"position": "RB", "x": 260, "y": 260, "label": "RB", "assignment": "Check Release"}], "routes": [{"id": "r1", "playerId": "X", "path": [{"x": 50, "y": 200}, {"x": 50, "y": 120}, {"x": 70, "y": 130}], "type": "pass", "routeType": "Curl", "isPrimary": true}], "formation": "Gun Trips Right", "odk": "offense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'P-003', 'Screen Left',
     '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Screen", "passConcept": "Screen", "personnel": "11 (1RB-1TE-3WR)", "protection": "Screen Protection"}'::jsonb,
     '{"players": [{"position": "X", "x": 50, "y": 200, "label": "X", "assignment": "Block"}, {"position": "LT", "x": 220, "y": 200, "label": "LT", "blockType": "Pass Block", "assignment": "Release Left"}, {"position": "LG", "x": 260, "y": 200, "label": "LG", "blockType": "Pass Block", "assignment": "Release Left"}, {"position": "C", "x": 300, "y": 200, "label": "C", "blockType": "Pass Block", "assignment": "Release Left"}, {"position": "RG", "x": 340, "y": 200, "label": "RG", "blockType": "Pass Block"}, {"position": "RT", "x": 380, "y": 200, "label": "RT", "blockType": "Pass Block"}, {"position": "TE", "x": 420, "y": 200, "label": "TE", "assignment": "Block"}, {"position": "SL", "x": 180, "y": 210, "label": "SL", "assignment": "Block"}, {"position": "Z", "x": 550, "y": 210, "label": "Z", "assignment": "Clear Out"}, {"position": "QB", "x": 300, "y": 260, "label": "QB", "assignment": "Screen Pass"}, {"position": "RB", "x": 340, "y": 260, "label": "RB", "assignment": "Screen Left", "isPrimary": true}], "routes": [], "formation": "Shotgun Spread", "odk": "offense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'P-004', 'Screen Right',
     '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Screen", "passConcept": "Screen", "personnel": "11 (1RB-1TE-3WR)", "protection": "Screen Protection"}'::jsonb,
     '{"players": [{"position": "X", "x": 50, "y": 200, "label": "X", "assignment": "Clear Out"}, {"position": "LT", "x": 220, "y": 200, "label": "LT", "blockType": "Pass Block"}, {"position": "LG", "x": 260, "y": 200, "label": "LG", "blockType": "Pass Block"}, {"position": "C", "x": 300, "y": 200, "label": "C", "blockType": "Pass Block", "assignment": "Release Right"}, {"position": "RG", "x": 340, "y": 200, "label": "RG", "blockType": "Pass Block", "assignment": "Release Right"}, {"position": "RT", "x": 380, "y": 200, "label": "RT", "blockType": "Pass Block", "assignment": "Release Right"}, {"position": "TE", "x": 420, "y": 200, "label": "TE", "assignment": "Block"}, {"position": "SL", "x": 180, "y": 210, "label": "SL", "assignment": "Block"}, {"position": "Z", "x": 550, "y": 210, "label": "Z", "assignment": "Block"}, {"position": "QB", "x": 300, "y": 260, "label": "QB", "assignment": "Screen Pass"}, {"position": "RB", "x": 340, "y": 260, "label": "RB", "assignment": "Screen Right", "isPrimary": true}], "routes": [], "formation": "Shotgun Spread", "odk": "offense"}'::jsonb, false, NOW())
  ON CONFLICT DO NOTHING;

  -- DEFENSIVE PLAYS (6 plays)
  INSERT INTO playbook_plays (id, team_id, play_code, play_name, attributes, diagram, is_archived, created_at)
  VALUES
    (gen_random_uuid(), v_team_id, 'D-001', '4-3 Cover 3',
     '{"odk": "defense", "formation": "4-3", "front": "4-3 Over", "coverage": "Cover 3", "blitzType": "None"}'::jsonb,
     '{"players": [{"position": "DE", "x": 180, "y": 185, "label": "SDE", "coverageRole": "Contain"}, {"position": "DT1", "x": 270, "y": 185, "label": "DT1", "coverageRole": "A-Gap"}, {"position": "DT2", "x": 330, "y": 185, "label": "DT2", "coverageRole": "A-Gap"}, {"position": "DE", "x": 420, "y": 185, "label": "WDE", "coverageRole": "Contain"}, {"position": "SAM", "x": 140, "y": 160, "label": "SAM", "coverageRole": "Hook-Curl"}, {"position": "MIKE", "x": 300, "y": 160, "label": "MIKE", "coverageRole": "Middle Hook"}, {"position": "WILL", "x": 360, "y": 160, "label": "WILL", "coverageRole": "Hook-Curl"}, {"position": "LCB", "x": 70, "y": 135, "label": "LCB", "coverageRole": "Deep Third"}, {"position": "RCB", "x": 530, "y": 135, "label": "RCB", "coverageRole": "Deep Third"}, {"position": "SS", "x": 200, "y": 130, "label": "SS", "coverageRole": "Flat"}, {"position": "FS", "x": 300, "y": 90, "label": "FS", "coverageRole": "Deep Third"}], "routes": [], "formation": "4-3", "odk": "defense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'D-002', '4-3 Cover 2',
     '{"odk": "defense", "formation": "4-3", "front": "4-3 Under", "coverage": "Cover 2", "blitzType": "None"}'::jsonb,
     '{"players": [{"position": "DE", "x": 180, "y": 185, "label": "SDE", "coverageRole": "Contain"}, {"position": "DT1", "x": 270, "y": 185, "label": "DT1", "coverageRole": "A-Gap"}, {"position": "DT2", "x": 330, "y": 185, "label": "DT2", "coverageRole": "A-Gap"}, {"position": "DE", "x": 420, "y": 185, "label": "WDE", "coverageRole": "Contain"}, {"position": "SAM", "x": 140, "y": 160, "label": "SAM", "coverageRole": "Flat"}, {"position": "MIKE", "x": 300, "y": 160, "label": "MIKE", "coverageRole": "Hook-Curl"}, {"position": "WILL", "x": 360, "y": 160, "label": "WILL", "coverageRole": "Hook-Curl"}, {"position": "LCB", "x": 70, "y": 165, "label": "LCB", "coverageRole": "Flat"}, {"position": "RCB", "x": 530, "y": 165, "label": "RCB", "coverageRole": "Flat"}, {"position": "SS", "x": 200, "y": 90, "label": "SS", "coverageRole": "Deep Half"}, {"position": "FS", "x": 400, "y": 90, "label": "FS", "coverageRole": "Deep Half"}], "routes": [], "formation": "4-3", "odk": "defense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'D-003', '3-4 Base',
     '{"odk": "defense", "formation": "3-4", "front": "3-4 Base", "coverage": "Cover 1 (Man Free)", "blitzType": "None"}'::jsonb,
     '{"players": [{"position": "DE", "x": 240, "y": 185, "label": "SDE"}, {"position": "NT", "x": 300, "y": 185, "label": "NT"}, {"position": "DE", "x": 360, "y": 185, "label": "WDE"}, {"position": "OLB", "x": 120, "y": 190, "label": "SOLB", "coverageRole": "Contain"}, {"position": "ILB", "x": 270, "y": 155, "label": "SILB", "coverageRole": "Hook-Curl"}, {"position": "ILB", "x": 330, "y": 155, "label": "WILB", "coverageRole": "Hook-Curl"}, {"position": "OLB", "x": 480, "y": 190, "label": "WOLB", "coverageRole": "Contain"}, {"position": "LCB", "x": 70, "y": 135, "label": "LCB", "coverageRole": "Man"}, {"position": "RCB", "x": 530, "y": 135, "label": "RCB", "coverageRole": "Man"}, {"position": "SS", "x": 200, "y": 130, "label": "SS", "coverageRole": "Man"}, {"position": "FS", "x": 300, "y": 90, "label": "FS", "coverageRole": "Deep"}], "routes": [], "formation": "3-4", "odk": "defense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'D-004', '4-4 Run Stop',
     '{"odk": "defense", "formation": "4-4", "front": "4-4", "coverage": "Cover 3", "blitzType": "None"}'::jsonb,
     '{"players": [{"position": "DE", "x": 180, "y": 185, "label": "SDE"}, {"position": "DT1", "x": 270, "y": 185, "label": "SDT"}, {"position": "DT2", "x": 330, "y": 185, "label": "WDT"}, {"position": "DE", "x": 420, "y": 185, "label": "WDE"}, {"position": "SAM", "x": 140, "y": 160, "label": "SAM"}, {"position": "MIKE", "x": 260, "y": 160, "label": "MIKE"}, {"position": "WILL", "x": 340, "y": 160, "label": "WILL"}, {"position": "JACK", "x": 460, "y": 160, "label": "JACK"}, {"position": "LCB", "x": 70, "y": 140, "label": "LCB", "coverageRole": "Deep Third"}, {"position": "RCB", "x": 530, "y": 140, "label": "RCB", "coverageRole": "Deep Third"}, {"position": "FS", "x": 300, "y": 90, "label": "FS", "coverageRole": "Deep Third"}], "routes": [], "formation": "4-4", "odk": "defense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'D-005', 'Nickel Cover 4',
     '{"odk": "defense", "formation": "4-2-5", "front": "4-2-5 Nickel", "coverage": "Cover 4 (Quarters)", "blitzType": "None"}'::jsonb,
     '{"players": [{"position": "DE", "x": 180, "y": 185, "label": "SDE"}, {"position": "DT1", "x": 270, "y": 185, "label": "DT1"}, {"position": "DT2", "x": 330, "y": 185, "label": "DT2"}, {"position": "DE", "x": 420, "y": 185, "label": "WDE"}, {"position": "MIKE", "x": 270, "y": 155, "label": "MIKE", "coverageRole": "Hook-Curl"}, {"position": "WILL", "x": 330, "y": 155, "label": "WILL", "coverageRole": "Hook-Curl"}, {"position": "LCB", "x": 70, "y": 145, "label": "LCB", "coverageRole": "Quarter"}, {"position": "RCB", "x": 530, "y": 145, "label": "RCB", "coverageRole": "Quarter"}, {"position": "NB", "x": 420, "y": 155, "label": "NB", "coverageRole": "Quarter"}, {"position": "SS", "x": 200, "y": 110, "label": "SS", "coverageRole": "Quarter"}, {"position": "FS", "x": 300, "y": 90, "label": "FS", "coverageRole": "Deep"}], "routes": [], "formation": "4-2-5", "odk": "defense"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'D-006', 'Zone Blitz',
     '{"odk": "defense", "formation": "4-3", "front": "4-3 Over", "coverage": "Cover 3", "blitzType": "Fire Zone"}'::jsonb,
     '{"players": [{"position": "DE", "x": 180, "y": 185, "label": "SDE"}, {"position": "DT1", "x": 270, "y": 185, "label": "DT1"}, {"position": "DT2", "x": 330, "y": 185, "label": "DT2"}, {"position": "DE", "x": 420, "y": 185, "label": "WDE", "coverageRole": "Flat Drop"}, {"position": "SAM", "x": 140, "y": 160, "label": "SAM", "blitzGap": "Strong C-gap"}, {"position": "MIKE", "x": 300, "y": 160, "label": "MIKE", "coverageRole": "Middle Hook"}, {"position": "WILL", "x": 360, "y": 160, "label": "WILL", "blitzGap": "Weak B-gap"}, {"position": "LCB", "x": 70, "y": 135, "label": "LCB", "coverageRole": "Deep Third"}, {"position": "RCB", "x": 530, "y": 135, "label": "RCB", "coverageRole": "Deep Third"}, {"position": "SS", "x": 200, "y": 130, "label": "SS", "coverageRole": "Flat"}, {"position": "FS", "x": 300, "y": 90, "label": "FS", "coverageRole": "Deep Third"}], "routes": [], "formation": "4-3", "odk": "defense"}'::jsonb, false, NOW())
  ON CONFLICT DO NOTHING;

  -- SPECIAL TEAMS PLAYS (6 plays)
  INSERT INTO playbook_plays (id, team_id, play_code, play_name, attributes, diagram, is_archived, created_at)
  VALUES
    (gen_random_uuid(), v_team_id, 'ST-001', 'Kickoff Deep Middle',
     '{"odk": "specialTeams", "unit": "Kickoff", "kickoffType": "Deep Middle"}'::jsonb,
     '{"players": [{"position": "K", "label": "K", "x": 350, "y": 50}, {"position": "KL1", "label": "L1", "x": 290, "y": 50}, {"position": "KL2", "label": "L2", "x": 240, "y": 50}, {"position": "KL3", "label": "L3", "x": 190, "y": 50}, {"position": "KL4", "label": "L4", "x": 140, "y": 50}, {"position": "KL5", "label": "L5", "x": 90, "y": 50}, {"position": "KR1", "label": "R1", "x": 410, "y": 50}, {"position": "KR2", "label": "R2", "x": 460, "y": 50}, {"position": "KR3", "label": "R3", "x": 510, "y": 50}, {"position": "KR4", "label": "R4", "x": 560, "y": 50}, {"position": "KR5", "label": "R5", "x": 610, "y": 50}], "routes": [], "formation": "Kickoff", "odk": "specialTeams"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'ST-002', 'Kick Return Middle',
     '{"odk": "specialTeams", "unit": "Kick Return", "returnScheme": "Middle Return"}'::jsonb,
     '{"players": [{"position": "FL1", "label": "L1", "x": 140, "y": 210}, {"position": "FL2", "label": "L2", "x": 245, "y": 210}, {"position": "FL3", "label": "L3", "x": 350, "y": 210}, {"position": "FL4", "label": "L4", "x": 455, "y": 210}, {"position": "FL5", "label": "L5", "x": 560, "y": 210}, {"position": "SL1", "label": "L6", "x": 280, "y": 290}, {"position": "SL2", "label": "L7", "x": 350, "y": 290}, {"position": "SL3", "label": "L8", "x": 420, "y": 290}, {"position": "R", "label": "R", "x": 320, "y": 370, "isPrimary": true}, {"position": "R2", "label": "R2", "x": 380, "y": 370}], "routes": [], "formation": "Kick Return", "odk": "specialTeams"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'ST-003', 'Punt Standard',
     '{"odk": "specialTeams", "unit": "Punt", "puntType": "Standard"}'::jsonb,
     '{"players": [{"position": "GunnerL", "label": "GL", "x": 120, "y": 200}, {"position": "GunnerR", "label": "GR", "x": 580, "y": 200}, {"position": "WingL", "label": "WL", "x": 240, "y": 230}, {"position": "WingR", "label": "WR", "x": 460, "y": 230}, {"position": "LT", "label": "LT", "x": 300, "y": 200}, {"position": "LG", "label": "LG", "x": 330, "y": 200}, {"position": "LS", "label": "LS", "x": 350, "y": 200}, {"position": "RG", "label": "RG", "x": 370, "y": 200}, {"position": "RT", "label": "RT", "x": 400, "y": 200}, {"position": "PP", "label": "PP", "x": 380, "y": 270}, {"position": "P", "label": "P", "x": 350, "y": 330, "isPrimary": true}], "routes": [], "formation": "Punt", "odk": "specialTeams"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'ST-004', 'Punt Return Right',
     '{"odk": "specialTeams", "unit": "Punt Return", "returnScheme": "Right Return"}'::jsonb,
     '{"players": [{"position": "R", "label": "R", "x": 350, "y": 60, "isPrimary": true}, {"position": "R2", "label": "R2", "x": 380, "y": 90}, {"position": "JamL", "label": "JL", "x": 150, "y": 195}, {"position": "JamR", "label": "JR", "x": 550, "y": 195}, {"position": "Box1", "label": "B1", "x": 250, "y": 195}, {"position": "Box2", "label": "B2", "x": 300, "y": 195}, {"position": "Box3", "label": "B3", "x": 350, "y": 195}, {"position": "Box4", "label": "B4", "x": 400, "y": 195}, {"position": "Box5", "label": "B5", "x": 450, "y": 195}, {"position": "Box6", "label": "B6", "x": 500, "y": 195}], "routes": [], "formation": "Punt Return", "odk": "specialTeams"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'ST-005', 'Field Goal',
     '{"odk": "specialTeams", "unit": "Field Goal"}'::jsonb,
     '{"players": [{"position": "LS", "label": "LS", "x": 350, "y": 210}, {"position": "LG", "label": "LG", "x": 325, "y": 210}, {"position": "RG", "label": "RG", "x": 375, "y": 210}, {"position": "LT", "label": "LT", "x": 300, "y": 210}, {"position": "RT", "label": "RT", "x": 400, "y": 210}, {"position": "TEL", "label": "TL", "x": 275, "y": 210}, {"position": "TER", "label": "TR", "x": 425, "y": 210}, {"position": "WL", "label": "WL", "x": 250, "y": 210}, {"position": "WR", "label": "WR", "x": 450, "y": 210}, {"position": "Holder", "label": "H", "x": 350, "y": 280}, {"position": "Kicker", "label": "K", "x": 310, "y": 310, "isPrimary": true}], "routes": [], "formation": "Field Goal", "odk": "specialTeams"}'::jsonb, false, NOW()),

    (gen_random_uuid(), v_team_id, 'ST-006', 'PAT',
     '{"odk": "specialTeams", "unit": "PAT"}'::jsonb,
     '{"players": [{"position": "LS", "label": "LS", "x": 350, "y": 210}, {"position": "LG", "label": "LG", "x": 325, "y": 210}, {"position": "RG", "label": "RG", "x": 375, "y": 210}, {"position": "LT", "label": "LT", "x": 300, "y": 210}, {"position": "RT", "label": "RT", "x": 400, "y": 210}, {"position": "TEL", "label": "TL", "x": 275, "y": 210}, {"position": "TER", "label": "TR", "x": 425, "y": 210}, {"position": "WL", "label": "WL", "x": 250, "y": 210}, {"position": "WR", "label": "WR", "x": 450, "y": 210}, {"position": "Holder", "label": "H", "x": 350, "y": 280}, {"position": "Kicker", "label": "K", "x": 310, "y": 310, "isPrimary": true}], "routes": [], "formation": "Field Goal", "odk": "specialTeams"}'::jsonb, false, NOW())
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- GAMES (8-game season: 5-3 record)
  -- ============================================================================

  INSERT INTO games (id, team_id, user_id, name, opponent, date, team_score, opponent_score, game_result, game_type, film_analysis_status, week_number, season_phase, created_at)
  VALUES
    (v_game1_id, v_team_id, v_user_id, 'Week 1 vs Lincoln', 'Lincoln Lions', '2024-09-06', 21, 14, 'win', 'team', 'complete', 1, 'regular', NOW() - INTERVAL '12 weeks'),
    (v_game2_id, v_team_id, v_user_id, 'Week 2 vs Roosevelt', 'Roosevelt Roughriders', '2024-09-13', 14, 28, 'loss', 'team', 'complete', 2, 'regular', NOW() - INTERVAL '11 weeks'),
    (v_game3_id, v_team_id, v_user_id, 'Week 3 vs Jefferson', 'Jefferson Jaguars', '2024-09-20', 28, 7, 'win', 'team', 'complete', 3, 'regular', NOW() - INTERVAL '10 weeks'),
    (v_game4_id, v_team_id, v_user_id, 'Week 4 vs Washington', 'Washington Wolves', '2024-09-27', 17, 21, 'loss', 'team', 'complete', 4, 'regular', NOW() - INTERVAL '9 weeks'),
    (v_game5_id, v_team_id, v_user_id, 'Week 5 vs Adams', 'Adams Arrows', '2024-10-04', 35, 14, 'win', 'team', 'complete', 5, 'regular', NOW() - INTERVAL '8 weeks'),
    (v_game6_id, v_team_id, v_user_id, 'Week 6 vs Madison', 'Madison Mustangs', '2024-10-11', 24, 21, 'win', 'team', 'complete', 6, 'regular', NOW() - INTERVAL '7 weeks'),
    (v_game7_id, v_team_id, v_user_id, 'Week 7 vs Monroe', 'Monroe Monarchs', '2024-10-18', 7, 14, 'loss', 'team', 'complete', 7, 'regular', NOW() - INTERVAL '6 weeks'),
    (v_game8_id, v_team_id, v_user_id, 'Week 8 vs Hamilton', 'Hamilton Hawks', '2024-10-25', 28, 21, 'win', 'team', 'complete', 8, 'regular', NOW() - INTERVAL '5 weeks')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, week_number = EXCLUDED.week_number, season_phase = EXCLUDED.season_phase;

  -- ============================================================================
  -- VIDEOS (one per game)
  -- ============================================================================

  INSERT INTO videos (id, game_id, name, camera_label, camera_order, duration_seconds, upload_status, created_at)
  VALUES
    (v_video1_id, v_game1_id, 'Game 1 - Sideline', 'Sideline', 1, 7200, 'ready', NOW() - INTERVAL '12 weeks'),
    (v_video2_id, v_game2_id, 'Game 2 - Sideline', 'Sideline', 1, 7200, 'ready', NOW() - INTERVAL '11 weeks'),
    (v_video3_id, v_game3_id, 'Game 3 - Sideline', 'Sideline', 1, 7200, 'ready', NOW() - INTERVAL '10 weeks'),
    (v_video4_id, v_game4_id, 'Game 4 - Sideline', 'Sideline', 1, 7200, 'ready', NOW() - INTERVAL '9 weeks'),
    (v_video5_id, v_game5_id, 'Game 5 - Sideline', 'Sideline', 1, 7200, 'ready', NOW() - INTERVAL '8 weeks'),
    (v_video6_id, v_game6_id, 'Game 6 - Sideline', 'Sideline', 1, 7200, 'ready', NOW() - INTERVAL '7 weeks'),
    (v_video7_id, v_game7_id, 'Game 7 - Sideline', 'Sideline', 1, 7200, 'ready', NOW() - INTERVAL '6 weeks'),
    (v_video8_id, v_game8_id, 'Game 8 - Sideline', 'Sideline', 1, 7200, 'ready', NOW() - INTERVAL '5 weeks')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

END $$;

-- ============================================================================
-- DRIVES (8-12 per game, ~80 total)
-- ============================================================================
-- Note: We create drives separately to be able to reference them in play_instances

-- Game 1 Drives (Win 21-14)
INSERT INTO drives (id, game_id, team_id, possession_type, drive_number, quarter, start_yard_line, end_yard_line, plays_count, yards_gained, first_downs, result, points, three_and_out, reached_red_zone, scoring_drive)
SELECT
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222201'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'offense',
  drive_num,
  CASE WHEN drive_num <= 3 THEN 1 WHEN drive_num <= 5 THEN 2 WHEN drive_num <= 7 THEN 3 ELSE 4 END,
  start_yl,
  end_yl,
  plays,
  yards,
  fds,
  result,
  pts,
  plays <= 3 AND fds = 0,
  end_yl >= 80,
  pts > 0
FROM (VALUES
  (1, 25, 100, 8, 75, 4, 'touchdown', 7),
  (2, 30, 45, 3, 15, 0, 'punt', 0),
  (3, 20, 100, 10, 80, 5, 'touchdown', 7),
  (4, 35, 50, 4, 15, 1, 'punt', 0),
  (5, 25, 38, 3, 13, 0, 'punt', 0),
  (6, 40, 55, 4, 15, 1, 'downs', 0),
  (7, 30, 100, 7, 70, 4, 'touchdown', 7),
  (8, 20, 35, 4, 15, 1, 'end_game', 0)
) AS d(drive_num, start_yl, end_yl, plays, yards, fds, result, pts)
ON CONFLICT DO NOTHING;

-- Game 2 Drives (Loss 14-28)
INSERT INTO drives (id, game_id, team_id, possession_type, drive_number, quarter, start_yard_line, end_yard_line, plays_count, yards_gained, first_downs, result, points, three_and_out, reached_red_zone, scoring_drive)
SELECT
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222202'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'offense',
  drive_num,
  CASE WHEN drive_num <= 2 THEN 1 WHEN drive_num <= 4 THEN 2 WHEN drive_num <= 6 THEN 3 ELSE 4 END,
  start_yl,
  end_yl,
  plays,
  yards,
  fds,
  result,
  pts,
  plays <= 3 AND fds = 0,
  end_yl >= 80,
  pts > 0
FROM (VALUES
  (1, 20, 35, 3, 15, 0, 'punt', 0),
  (2, 30, 100, 9, 70, 4, 'touchdown', 7),
  (3, 25, 40, 4, 15, 1, 'turnover', 0),
  (4, 35, 48, 3, 13, 0, 'punt', 0),
  (5, 20, 32, 3, 12, 0, 'punt', 0),
  (6, 40, 100, 8, 60, 3, 'touchdown', 7),
  (7, 25, 38, 4, 13, 1, 'turnover', 0),
  (8, 30, 42, 3, 12, 0, 'end_game', 0)
) AS d(drive_num, start_yl, end_yl, plays, yards, fds, result, pts)
ON CONFLICT DO NOTHING;

-- Game 3 Drives (Win 28-7)
INSERT INTO drives (id, game_id, team_id, possession_type, drive_number, quarter, start_yard_line, end_yard_line, plays_count, yards_gained, first_downs, result, points, three_and_out, reached_red_zone, scoring_drive)
SELECT
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222203'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'offense',
  drive_num,
  CASE WHEN drive_num <= 3 THEN 1 WHEN drive_num <= 5 THEN 2 WHEN drive_num <= 7 THEN 3 ELSE 4 END,
  start_yl,
  end_yl,
  plays,
  yards,
  fds,
  result,
  pts,
  plays <= 3 AND fds = 0,
  end_yl >= 80,
  pts > 0
FROM (VALUES
  (1, 30, 100, 7, 70, 4, 'touchdown', 7),
  (2, 25, 100, 9, 75, 5, 'touchdown', 7),
  (3, 20, 45, 4, 25, 1, 'punt', 0),
  (4, 35, 100, 8, 65, 4, 'touchdown', 7),
  (5, 40, 55, 3, 15, 0, 'punt', 0),
  (6, 30, 100, 6, 70, 4, 'touchdown', 7),
  (7, 25, 40, 4, 15, 1, 'punt', 0),
  (8, 45, 60, 5, 15, 1, 'end_game', 0)
) AS d(drive_num, start_yl, end_yl, plays, yards, fds, result, pts)
ON CONFLICT DO NOTHING;

-- Game 4 Drives (Loss 17-21)
INSERT INTO drives (id, game_id, team_id, possession_type, drive_number, quarter, start_yard_line, end_yard_line, plays_count, yards_gained, first_downs, result, points, three_and_out, reached_red_zone, scoring_drive)
SELECT
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222204'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'offense',
  drive_num,
  CASE WHEN drive_num <= 2 THEN 1 WHEN drive_num <= 4 THEN 2 WHEN drive_num <= 6 THEN 3 ELSE 4 END,
  start_yl,
  end_yl,
  plays,
  yards,
  fds,
  result,
  pts,
  plays <= 3 AND fds = 0,
  end_yl >= 80,
  pts > 0
FROM (VALUES
  (1, 25, 100, 9, 75, 4, 'touchdown', 7),
  (2, 30, 42, 3, 12, 0, 'punt', 0),
  (3, 20, 82, 7, 62, 3, 'field_goal', 3),
  (4, 35, 50, 4, 15, 1, 'turnover', 0),
  (5, 25, 38, 3, 13, 0, 'punt', 0),
  (6, 40, 100, 8, 60, 3, 'touchdown', 7),
  (7, 20, 35, 4, 15, 1, 'punt', 0),
  (8, 30, 55, 5, 25, 1, 'end_game', 0)
) AS d(drive_num, start_yl, end_yl, plays, yards, fds, result, pts)
ON CONFLICT DO NOTHING;

-- Game 5 Drives (Win 35-14)
INSERT INTO drives (id, game_id, team_id, possession_type, drive_number, quarter, start_yard_line, end_yard_line, plays_count, yards_gained, first_downs, result, points, three_and_out, reached_red_zone, scoring_drive)
SELECT
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222205'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'offense',
  drive_num,
  CASE WHEN drive_num <= 3 THEN 1 WHEN drive_num <= 5 THEN 2 WHEN drive_num <= 8 THEN 3 ELSE 4 END,
  start_yl,
  end_yl,
  plays,
  yards,
  fds,
  result,
  pts,
  plays <= 3 AND fds = 0,
  end_yl >= 80,
  pts > 0
FROM (VALUES
  (1, 35, 100, 6, 65, 4, 'touchdown', 7),
  (2, 25, 100, 8, 75, 4, 'touchdown', 7),
  (3, 30, 45, 3, 15, 0, 'punt', 0),
  (4, 40, 100, 7, 60, 3, 'touchdown', 7),
  (5, 20, 100, 10, 80, 5, 'touchdown', 7),
  (6, 35, 50, 4, 15, 1, 'punt', 0),
  (7, 25, 100, 9, 75, 4, 'touchdown', 7),
  (8, 30, 42, 3, 12, 0, 'punt', 0),
  (9, 45, 60, 5, 15, 1, 'end_game', 0)
) AS d(drive_num, start_yl, end_yl, plays, yards, fds, result, pts)
ON CONFLICT DO NOTHING;

-- Game 6 Drives (Win 24-21)
INSERT INTO drives (id, game_id, team_id, possession_type, drive_number, quarter, start_yard_line, end_yard_line, plays_count, yards_gained, first_downs, result, points, three_and_out, reached_red_zone, scoring_drive)
SELECT
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222206'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'offense',
  drive_num,
  CASE WHEN drive_num <= 2 THEN 1 WHEN drive_num <= 4 THEN 2 WHEN drive_num <= 6 THEN 3 ELSE 4 END,
  start_yl,
  end_yl,
  plays,
  yards,
  fds,
  result,
  pts,
  plays <= 3 AND fds = 0,
  end_yl >= 80,
  pts > 0
FROM (VALUES
  (1, 25, 100, 8, 75, 4, 'touchdown', 7),
  (2, 30, 42, 3, 12, 0, 'punt', 0),
  (3, 20, 85, 9, 65, 4, 'field_goal', 3),
  (4, 35, 100, 7, 65, 4, 'touchdown', 7),
  (5, 25, 38, 3, 13, 0, 'punt', 0),
  (6, 40, 100, 8, 60, 3, 'touchdown', 7),
  (7, 20, 35, 4, 15, 1, 'punt', 0),
  (8, 30, 48, 5, 18, 1, 'end_game', 0)
) AS d(drive_num, start_yl, end_yl, plays, yards, fds, result, pts)
ON CONFLICT DO NOTHING;

-- Game 7 Drives (Loss 7-14)
INSERT INTO drives (id, game_id, team_id, possession_type, drive_number, quarter, start_yard_line, end_yard_line, plays_count, yards_gained, first_downs, result, points, three_and_out, reached_red_zone, scoring_drive)
SELECT
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222207'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'offense',
  drive_num,
  CASE WHEN drive_num <= 2 THEN 1 WHEN drive_num <= 4 THEN 2 WHEN drive_num <= 6 THEN 3 ELSE 4 END,
  start_yl,
  end_yl,
  plays,
  yards,
  fds,
  result,
  pts,
  plays <= 3 AND fds = 0,
  end_yl >= 80,
  pts > 0
FROM (VALUES
  (1, 25, 38, 3, 13, 0, 'punt', 0),
  (2, 30, 45, 4, 15, 1, 'turnover', 0),
  (3, 20, 32, 3, 12, 0, 'punt', 0),
  (4, 35, 100, 9, 65, 4, 'touchdown', 7),
  (5, 25, 40, 4, 15, 1, 'punt', 0),
  (6, 40, 55, 3, 15, 0, 'punt', 0),
  (7, 20, 35, 4, 15, 1, 'downs', 0),
  (8, 30, 45, 4, 15, 1, 'end_game', 0)
) AS d(drive_num, start_yl, end_yl, plays, yards, fds, result, pts)
ON CONFLICT DO NOTHING;

-- Game 8 Drives (Win 28-21)
INSERT INTO drives (id, game_id, team_id, possession_type, drive_number, quarter, start_yard_line, end_yard_line, plays_count, yards_gained, first_downs, result, points, three_and_out, reached_red_zone, scoring_drive)
SELECT
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222208'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'offense',
  drive_num,
  CASE WHEN drive_num <= 2 THEN 1 WHEN drive_num <= 4 THEN 2 WHEN drive_num <= 6 THEN 3 ELSE 4 END,
  start_yl,
  end_yl,
  plays,
  yards,
  fds,
  result,
  pts,
  plays <= 3 AND fds = 0,
  end_yl >= 80,
  pts > 0
FROM (VALUES
  (1, 30, 100, 7, 70, 4, 'touchdown', 7),
  (2, 25, 40, 3, 15, 0, 'punt', 0),
  (3, 20, 100, 10, 80, 5, 'touchdown', 7),
  (4, 35, 50, 4, 15, 1, 'punt', 0),
  (5, 40, 100, 6, 60, 3, 'touchdown', 7),
  (6, 25, 38, 3, 13, 0, 'punt', 0),
  (7, 30, 100, 8, 70, 4, 'touchdown', 7),
  (8, 20, 40, 5, 20, 1, 'end_game', 0)
) AS d(drive_num, start_yl, end_yl, plays, yards, fds, result, pts)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PLAY INSTANCES (~55-65 per game, ~450 total)
-- ============================================================================
-- This creates realistic play-by-play data with proper distributions

-- Helper function to generate play instances for a game
CREATE OR REPLACE FUNCTION generate_game_plays(
  p_video_id UUID,
  p_team_id UUID,
  p_qb_id UUID,
  p_rb1_id UUID,
  p_rb2_id UUID,
  p_wr1_id UUID,
  p_wr2_id UUID,
  p_te_id UUID,
  p_total_plays INT DEFAULT 55
) RETURNS void AS $$
DECLARE
  v_timestamp INT := 0;
  v_play_num INT := 1;
  v_down INT;
  v_distance INT;
  v_yard_line INT;
  v_play_type TEXT;
  v_play_code TEXT;
  v_formation TEXT;
  v_direction TEXT;
  v_yards_gained INT;
  v_ball_carrier UUID;
  v_target UUID;
  v_success BOOLEAN;
  v_explosive BOOLEAN;
  v_resulted_in_first_down BOOLEAN;
  v_is_turnover BOOLEAN;
  v_random FLOAT;
  v_hash TEXT;
BEGIN
  WHILE v_play_num <= p_total_plays LOOP
    -- Randomize down (weighted toward 1st down)
    v_random := random();
    IF v_random < 0.4 THEN
      v_down := 1;
      v_distance := 10;
    ELSIF v_random < 0.7 THEN
      v_down := 2;
      v_distance := CASE WHEN random() < 0.5 THEN floor(random() * 5 + 1)::INT ELSE floor(random() * 8 + 5)::INT END;
    ELSIF v_random < 0.9 THEN
      v_down := 3;
      v_distance := CASE WHEN random() < 0.3 THEN floor(random() * 3 + 1)::INT
                         WHEN random() < 0.7 THEN floor(random() * 5 + 4)::INT
                         ELSE floor(random() * 10 + 8)::INT END;
    ELSE
      v_down := 4;
      v_distance := floor(random() * 3 + 1)::INT;
    END IF;

    -- Yard line (0-100 scale)
    v_yard_line := floor(random() * 60 + 20)::INT; -- Between 20 and 80

    -- Hash mark
    v_hash := CASE floor(random() * 3)::INT WHEN 0 THEN 'left' WHEN 1 THEN 'middle' ELSE 'right' END;

    -- Play type (65% run, 35% pass for youth)
    v_random := random();
    IF v_random < 0.65 THEN
      v_play_type := 'run';
      -- Run play selection (weighted)
      v_random := random();
      IF v_random < 0.3 THEN
        v_play_code := CASE WHEN random() < 0.5 THEN 'R-001' ELSE 'R-002' END; -- Inside Zone
        v_formation := 'I-Form Pro';
      ELSIF v_random < 0.5 THEN
        v_play_code := CASE WHEN random() < 0.5 THEN 'R-003' ELSE 'R-004' END; -- Power
        v_formation := 'I-Form Strong';
      ELSIF v_random < 0.65 THEN
        v_play_code := CASE WHEN random() < 0.5 THEN 'R-005' ELSE 'R-006' END; -- Counter
        v_formation := 'Shotgun';
      ELSIF v_random < 0.8 THEN
        v_play_code := CASE WHEN random() < 0.5 THEN 'R-007' ELSE 'R-008' END; -- Sweep
        v_formation := 'Wing-T';
      ELSE
        v_play_code := CASE floor(random() * 4)::INT WHEN 0 THEN 'R-009' WHEN 1 THEN 'R-010' WHEN 2 THEN 'R-011' ELSE 'R-012' END;
        v_formation := CASE WHEN v_play_code IN ('R-009', 'R-010') THEN 'I-Form Pro' WHEN v_play_code = 'R-011' THEN 'Trips Right' ELSE 'Shotgun' END;
      END IF;

      -- Direction for runs
      v_direction := CASE WHEN v_play_code IN ('R-001', 'R-003', 'R-005', 'R-007') THEN 'left'
                          WHEN v_play_code IN ('R-002', 'R-004', 'R-006', 'R-008') THEN 'right'
                          ELSE 'middle' END;

      -- Ball carrier (RB1 70%, RB2 25%, QB 5%)
      v_random := random();
      v_ball_carrier := CASE WHEN v_random < 0.70 THEN p_rb1_id
                             WHEN v_random < 0.95 THEN p_rb2_id
                             ELSE p_qb_id END;
      v_target := NULL;

      -- Yards gained (run: avg 3.5, range -3 to 15)
      v_random := random();
      IF v_random < 0.1 THEN
        v_yards_gained := floor(random() * 3 - 3)::INT; -- Loss
      ELSIF v_random < 0.3 THEN
        v_yards_gained := floor(random() * 2)::INT; -- 0-1 yards
      ELSIF v_random < 0.6 THEN
        v_yards_gained := floor(random() * 4 + 2)::INT; -- 2-5 yards
      ELSIF v_random < 0.85 THEN
        v_yards_gained := floor(random() * 5 + 5)::INT; -- 5-9 yards
      ELSE
        v_yards_gained := floor(random() * 10 + 10)::INT; -- 10+ explosive
      END IF;

    ELSE
      v_play_type := 'pass';
      -- Pass play selection
      v_random := random();
      IF v_random < 0.35 THEN
        v_play_code := CASE WHEN random() < 0.5 THEN 'P-001' ELSE 'P-002' END; -- Slant-Flat or Curl-Flat
        v_formation := CASE WHEN v_play_code = 'P-001' THEN 'Shotgun Spread' ELSE 'Trips Right' END;
      ELSIF v_random < 0.6 THEN
        v_play_code := CASE WHEN random() < 0.5 THEN 'P-003' ELSE 'P-004' END; -- Screen
        v_formation := 'Shotgun';
      ELSIF v_random < 0.8 THEN
        v_play_code := 'P-005'; -- Play Action
        v_formation := 'I-Form Pro';
      ELSE
        v_play_code := 'P-006'; -- Out Routes
        v_formation := 'Trips Right';
      END IF;

      -- Direction for passes
      v_random := random();
      v_direction := CASE WHEN v_random < 0.33 THEN 'left' WHEN v_random < 0.66 THEN 'middle' ELSE 'right' END;

      v_ball_carrier := NULL;
      -- Target (WR1 40%, WR2 30%, TE 20%, RB 10%)
      v_random := random();
      v_target := CASE WHEN v_random < 0.40 THEN p_wr1_id
                       WHEN v_random < 0.70 THEN p_wr2_id
                       WHEN v_random < 0.90 THEN p_te_id
                       ELSE p_rb1_id END;

      -- Yards gained (pass: 50% completion, avg 8 when complete)
      IF random() < 0.50 THEN
        -- Incomplete
        v_yards_gained := 0;
      ELSE
        -- Complete
        v_random := random();
        IF v_random < 0.3 THEN
          v_yards_gained := floor(random() * 5 + 1)::INT; -- Short 1-5
        ELSIF v_random < 0.7 THEN
          v_yards_gained := floor(random() * 8 + 5)::INT; -- Medium 5-12
        ELSIF v_random < 0.9 THEN
          v_yards_gained := floor(random() * 10 + 12)::INT; -- Long 12-21
        ELSE
          v_yards_gained := floor(random() * 20 + 20)::INT; -- Explosive 20+
        END IF;
      END IF;
    END IF;

    -- Calculate success (40%/60%/100% rule)
    IF v_down = 1 THEN
      v_success := v_yards_gained >= (v_distance * 0.4);
    ELSIF v_down = 2 THEN
      v_success := v_yards_gained >= (v_distance * 0.6);
    ELSE
      v_success := v_yards_gained >= v_distance;
    END IF;

    -- Explosive play
    IF v_play_type = 'run' THEN
      v_explosive := v_yards_gained >= 10;
    ELSE
      v_explosive := v_yards_gained >= 15;
    END IF;

    -- First down
    v_resulted_in_first_down := v_yards_gained >= v_distance;

    -- Turnover (3% chance)
    v_is_turnover := random() < 0.03;
    IF v_is_turnover THEN
      v_yards_gained := 0;
      v_success := false;
    END IF;

    -- Insert the play
    INSERT INTO play_instances (
      video_id, team_id, play_code, timestamp_start, timestamp_end,
      down, distance, yard_line, hash_mark, quarter,
      play_type, formation, direction,
      yards_gained, success, explosive, resulted_in_first_down, is_turnover,
      ball_carrier_id, qb_id, target_id,
      is_opponent_play, created_at
    ) VALUES (
      p_video_id, p_team_id, v_play_code, v_timestamp, v_timestamp + 30,
      v_down, v_distance, v_yard_line, v_hash,
      CASE WHEN v_play_num <= 15 THEN 1 WHEN v_play_num <= 30 THEN 2 WHEN v_play_num <= 45 THEN 3 ELSE 4 END,
      v_play_type, v_formation, v_direction,
      v_yards_gained, v_success, v_explosive, v_resulted_in_first_down, v_is_turnover,
      v_ball_carrier, p_qb_id, v_target,
      false, NOW()
    );

    v_timestamp := v_timestamp + floor(random() * 30 + 25)::INT;
    v_play_num := v_play_num + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Generate plays for each game
SELECT generate_game_plays(
  '33333333-3333-3333-3333-333333333301'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  '11111111-1111-1111-1111-111111111101'::uuid,
  '11111111-1111-1111-1111-111111111103'::uuid,
  '11111111-1111-1111-1111-111111111104'::uuid,
  '11111111-1111-1111-1111-111111111106'::uuid,
  '11111111-1111-1111-1111-111111111107'::uuid,
  '11111111-1111-1111-1111-111111111109'::uuid,
  55
);

SELECT generate_game_plays(
  '33333333-3333-3333-3333-333333333302'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  '11111111-1111-1111-1111-111111111101'::uuid,
  '11111111-1111-1111-1111-111111111103'::uuid,
  '11111111-1111-1111-1111-111111111104'::uuid,
  '11111111-1111-1111-1111-111111111106'::uuid,
  '11111111-1111-1111-1111-111111111107'::uuid,
  '11111111-1111-1111-1111-111111111109'::uuid,
  52
);

SELECT generate_game_plays(
  '33333333-3333-3333-3333-333333333303'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  '11111111-1111-1111-1111-111111111101'::uuid,
  '11111111-1111-1111-1111-111111111103'::uuid,
  '11111111-1111-1111-1111-111111111104'::uuid,
  '11111111-1111-1111-1111-111111111106'::uuid,
  '11111111-1111-1111-1111-111111111107'::uuid,
  '11111111-1111-1111-1111-111111111109'::uuid,
  58
);

SELECT generate_game_plays(
  '33333333-3333-3333-3333-333333333304'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  '11111111-1111-1111-1111-111111111101'::uuid,
  '11111111-1111-1111-1111-111111111103'::uuid,
  '11111111-1111-1111-1111-111111111104'::uuid,
  '11111111-1111-1111-1111-111111111106'::uuid,
  '11111111-1111-1111-1111-111111111107'::uuid,
  '11111111-1111-1111-1111-111111111109'::uuid,
  54
);

SELECT generate_game_plays(
  '33333333-3333-3333-3333-333333333305'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  '11111111-1111-1111-1111-111111111101'::uuid,
  '11111111-1111-1111-1111-111111111103'::uuid,
  '11111111-1111-1111-1111-111111111104'::uuid,
  '11111111-1111-1111-1111-111111111106'::uuid,
  '11111111-1111-1111-1111-111111111107'::uuid,
  '11111111-1111-1111-1111-111111111109'::uuid,
  62
);

SELECT generate_game_plays(
  '33333333-3333-3333-3333-333333333306'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  '11111111-1111-1111-1111-111111111101'::uuid,
  '11111111-1111-1111-1111-111111111103'::uuid,
  '11111111-1111-1111-1111-111111111104'::uuid,
  '11111111-1111-1111-1111-111111111106'::uuid,
  '11111111-1111-1111-1111-111111111107'::uuid,
  '11111111-1111-1111-1111-111111111109'::uuid,
  56
);

SELECT generate_game_plays(
  '33333333-3333-3333-3333-333333333307'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  '11111111-1111-1111-1111-111111111101'::uuid,
  '11111111-1111-1111-1111-111111111103'::uuid,
  '11111111-1111-1111-1111-111111111104'::uuid,
  '11111111-1111-1111-1111-111111111106'::uuid,
  '11111111-1111-1111-1111-111111111107'::uuid,
  '11111111-1111-1111-1111-111111111109'::uuid,
  48
);

SELECT generate_game_plays(
  '33333333-3333-3333-3333-333333333308'::uuid,
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  '11111111-1111-1111-1111-111111111101'::uuid,
  '11111111-1111-1111-1111-111111111103'::uuid,
  '11111111-1111-1111-1111-111111111104'::uuid,
  '11111111-1111-1111-1111-111111111106'::uuid,
  '11111111-1111-1111-1111-111111111107'::uuid,
  '11111111-1111-1111-1111-111111111109'::uuid,
  60
);

-- Clean up the helper function
DROP FUNCTION IF EXISTS generate_game_plays;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify data counts
DO $$
DECLARE
  v_team_count INT;
  v_player_count INT;
  v_game_count INT;
  v_play_count INT;
  v_drive_count INT;
  v_playbook_count INT;
BEGIN
  SELECT COUNT(*) INTO v_team_count FROM teams WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  SELECT COUNT(*) INTO v_player_count FROM players WHERE team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  SELECT COUNT(*) INTO v_game_count FROM games WHERE team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  SELECT COUNT(*) INTO v_play_count FROM play_instances WHERE team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  SELECT COUNT(*) INTO v_drive_count FROM drives WHERE team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  SELECT COUNT(*) INTO v_playbook_count FROM playbook_plays WHERE team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'AI Coaching Test Data Summary:';
  RAISE NOTICE '  Teams: %', v_team_count;
  RAISE NOTICE '  Players: %', v_player_count;
  RAISE NOTICE '  Games: %', v_game_count;
  RAISE NOTICE '  Playbook Plays: %', v_playbook_count;
  RAISE NOTICE '  Drives: %', v_drive_count;
  RAISE NOTICE '  Play Instances: %', v_play_count;
  RAISE NOTICE '========================================';
END $$;

-- Sample AI coaching queries to test:

-- 1. "How's my run game trending?"
-- SELECT
--   g.name as game,
--   g.date,
--   COUNT(*) FILTER (WHERE pi.play_type = 'run') as run_plays,
--   ROUND(AVG(pi.yards_gained) FILTER (WHERE pi.play_type = 'run'), 1) as avg_run_yards,
--   ROUND(AVG(CASE WHEN pi.success THEN 1.0 ELSE 0.0 END) FILTER (WHERE pi.play_type = 'run') * 100, 1) as run_success_rate
-- FROM play_instances pi
-- JOIN videos v ON pi.video_id = v.id
-- JOIN games g ON v.game_id = g.id
-- WHERE pi.team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
-- GROUP BY g.id, g.name, g.date
-- ORDER BY g.date;

-- 2. "What formations work best on 3rd down?"
-- SELECT
--   pi.formation,
--   COUNT(*) as plays,
--   ROUND(AVG(pi.yards_gained), 1) as avg_yards,
--   ROUND(AVG(CASE WHEN pi.success THEN 1.0 ELSE 0.0 END) * 100, 1) as success_rate,
--   SUM(CASE WHEN pi.resulted_in_first_down THEN 1 ELSE 0 END) as first_downs
-- FROM play_instances pi
-- WHERE pi.team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
--   AND pi.down = 3
-- GROUP BY pi.formation
-- HAVING COUNT(*) >= 5
-- ORDER BY success_rate DESC;

-- 3. "Who's my most efficient runner?"
-- SELECT
--   p.first_name || ' ' || p.last_name as player,
--   p.jersey_number,
--   COUNT(*) as carries,
--   SUM(pi.yards_gained) as total_yards,
--   ROUND(AVG(pi.yards_gained), 1) as avg_yards,
--   ROUND(AVG(CASE WHEN pi.success THEN 1.0 ELSE 0.0 END) * 100, 1) as success_rate,
--   SUM(CASE WHEN pi.explosive THEN 1 ELSE 0 END) as explosive_runs
-- FROM play_instances pi
-- JOIN players p ON pi.ball_carrier_id = p.id
-- WHERE pi.team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
--   AND pi.play_type = 'run'
-- GROUP BY p.id, p.first_name, p.last_name, p.jersey_number
-- ORDER BY avg_yards DESC;

-- 4. "Are we better passing left or right?"
-- SELECT
--   pi.direction,
--   COUNT(*) as attempts,
--   SUM(CASE WHEN pi.yards_gained > 0 THEN 1 ELSE 0 END) as completions,
--   ROUND(SUM(CASE WHEN pi.yards_gained > 0 THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100, 1) as completion_pct,
--   ROUND(AVG(pi.yards_gained), 1) as avg_yards,
--   ROUND(AVG(CASE WHEN pi.success THEN 1.0 ELSE 0.0 END) * 100, 1) as success_rate
-- FROM play_instances pi
-- WHERE pi.team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
--   AND pi.play_type = 'pass'
--   AND pi.direction IS NOT NULL
-- GROUP BY pi.direction
-- ORDER BY success_rate DESC;

-- 5. "How are we doing in the red zone?"
-- SELECT
--   COUNT(*) as red_zone_plays,
--   SUM(pi.yards_gained) as total_yards,
--   ROUND(AVG(pi.yards_gained), 1) as avg_yards,
--   ROUND(AVG(CASE WHEN pi.success THEN 1.0 ELSE 0.0 END) * 100, 1) as success_rate,
--   COUNT(*) FILTER (WHERE pi.play_type = 'run') as runs,
--   COUNT(*) FILTER (WHERE pi.play_type = 'pass') as passes
-- FROM play_instances pi
-- WHERE pi.team_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
--   AND pi.yard_line >= 80;
