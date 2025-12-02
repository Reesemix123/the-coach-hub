-- Seed Special Teams Playbook Plays for Test Team #1
-- Creates plays for each special teams unit

-- Use Test Team #1 ID
DO $$
DECLARE
  team_uuid UUID := '99ef9d88-454e-42bf-8f52-04d37b34a9d6';
BEGIN

-- KICKOFF PLAYS (4)
INSERT INTO playbook_plays (team_id, play_code, play_name, attributes, diagram, is_archived)
VALUES
  (team_uuid, 'ST-KO-001', 'Deep Middle Kickoff',
   '{"odk": "specialTeams", "unit": "Kickoff", "formation": "Kickoff", "kickoffType": "Deep Middle"}',
   '{"odk": "specialTeams", "formation": "Kickoff", "players": [], "routes": []}', false),
  (team_uuid, 'ST-KO-002', 'Deep Left Kickoff',
   '{"odk": "specialTeams", "unit": "Kickoff", "formation": "Kickoff", "kickoffType": "Deep Left"}',
   '{"odk": "specialTeams", "formation": "Kickoff", "players": [], "routes": []}', false),
  (team_uuid, 'ST-KO-003', 'Squib Right',
   '{"odk": "specialTeams", "unit": "Kickoff", "formation": "Kickoff", "kickoffType": "Squib"}',
   '{"odk": "specialTeams", "formation": "Kickoff", "players": [], "routes": []}', false),
  (team_uuid, 'ST-KO-004', 'Onside Left',
   '{"odk": "specialTeams", "unit": "Kickoff", "formation": "Kickoff", "kickoffType": "Onside"}',
   '{"odk": "specialTeams", "formation": "Kickoff", "players": [], "routes": []}', false)
ON CONFLICT (play_code) DO NOTHING;

-- KICK RETURN PLAYS (4)
INSERT INTO playbook_plays (team_id, play_code, play_name, attributes, diagram, is_archived)
VALUES
  (team_uuid, 'ST-KR-001', 'Middle Return',
   '{"odk": "specialTeams", "unit": "Kick Return", "formation": "Kick Return", "returnScheme": "Middle"}',
   '{"odk": "specialTeams", "formation": "Kick Return", "players": [], "routes": []}', false),
  (team_uuid, 'ST-KR-002', 'Left Wall Return',
   '{"odk": "specialTeams", "unit": "Kick Return", "formation": "Kick Return", "returnScheme": "Wall Left"}',
   '{"odk": "specialTeams", "formation": "Kick Return", "players": [], "routes": []}', false),
  (team_uuid, 'ST-KR-003', 'Right Wall Return',
   '{"odk": "specialTeams", "unit": "Kick Return", "formation": "Kick Return", "returnScheme": "Wall Right"}',
   '{"odk": "specialTeams", "formation": "Kick Return", "players": [], "routes": []}', false),
  (team_uuid, 'ST-KR-004', 'Onside Recovery',
   '{"odk": "specialTeams", "unit": "Kick Return", "formation": "Kick Return", "returnScheme": "Onside Hands"}',
   '{"odk": "specialTeams", "formation": "Kick Return", "players": [], "routes": []}', false)
ON CONFLICT (play_code) DO NOTHING;

-- PUNT PLAYS (4)
INSERT INTO playbook_plays (team_id, play_code, play_name, attributes, diagram, is_archived)
VALUES
  (team_uuid, 'ST-P-001', 'Standard Punt',
   '{"odk": "specialTeams", "unit": "Punt", "formation": "Punt", "puntType": "Standard"}',
   '{"odk": "specialTeams", "formation": "Punt", "players": [], "routes": []}', false),
  (team_uuid, 'ST-P-002', 'Directional Left',
   '{"odk": "specialTeams", "unit": "Punt", "formation": "Punt", "puntType": "Directional Left"}',
   '{"odk": "specialTeams", "formation": "Punt", "players": [], "routes": []}', false),
  (team_uuid, 'ST-P-003', 'Rugby Punt',
   '{"odk": "specialTeams", "unit": "Punt", "formation": "Punt", "puntType": "Rugby"}',
   '{"odk": "specialTeams", "formation": "Punt", "players": [], "routes": []}', false),
  (team_uuid, 'ST-P-004', 'Fake Punt Run',
   '{"odk": "specialTeams", "unit": "Punt", "formation": "Punt", "puntType": "Fake"}',
   '{"odk": "specialTeams", "formation": "Punt", "players": [], "routes": []}', false)
ON CONFLICT (play_code) DO NOTHING;

-- PUNT RETURN PLAYS (4)
INSERT INTO playbook_plays (team_id, play_code, play_name, attributes, diagram, is_archived)
VALUES
  (team_uuid, 'ST-PR-001', 'Return Middle',
   '{"odk": "specialTeams", "unit": "Punt Return", "formation": "Punt Return", "returnScheme": "Middle"}',
   '{"odk": "specialTeams", "formation": "Punt Return", "players": [], "routes": []}', false),
  (team_uuid, 'ST-PR-002', 'Return Left',
   '{"odk": "specialTeams", "unit": "Punt Return", "formation": "Punt Return", "returnScheme": "Left"}',
   '{"odk": "specialTeams", "formation": "Punt Return", "players": [], "routes": []}', false),
  (team_uuid, 'ST-PR-003', 'Block Rush',
   '{"odk": "specialTeams", "unit": "Punt Return", "formation": "Punt Return", "returnScheme": "Block"}',
   '{"odk": "specialTeams", "formation": "Punt Return", "players": [], "routes": []}', false),
  (team_uuid, 'ST-PR-004', 'Safe Fair Catch',
   '{"odk": "specialTeams", "unit": "Punt Return", "formation": "Punt Return", "returnScheme": "Safe"}',
   '{"odk": "specialTeams", "formation": "Punt Return", "players": [], "routes": []}', false)
ON CONFLICT (play_code) DO NOTHING;

-- FIELD GOAL PLAYS (4)
INSERT INTO playbook_plays (team_id, play_code, play_name, attributes, diagram, is_archived)
VALUES
  (team_uuid, 'ST-FG-001', 'Standard FG',
   '{"odk": "specialTeams", "unit": "Field Goal", "formation": "Field Goal", "playType": "Field Goal"}',
   '{"odk": "specialTeams", "formation": "Field Goal", "players": [], "routes": []}', false),
  (team_uuid, 'ST-FG-002', 'Fake FG Pass',
   '{"odk": "specialTeams", "unit": "Field Goal", "formation": "Field Goal", "playType": "Fake Pass"}',
   '{"odk": "specialTeams", "formation": "Field Goal", "players": [], "routes": []}', false),
  (team_uuid, 'ST-FG-003', 'Fake FG Run',
   '{"odk": "specialTeams", "unit": "Field Goal", "formation": "Field Goal", "playType": "Fake Run"}',
   '{"odk": "specialTeams", "formation": "Field Goal", "players": [], "routes": []}', false),
  (team_uuid, 'ST-FGB-001', 'FG Block Rush',
   '{"odk": "specialTeams", "unit": "FG Block", "formation": "FG Block", "playType": "Block"}',
   '{"odk": "specialTeams", "formation": "FG Block", "players": [], "routes": []}', false)
ON CONFLICT (play_code) DO NOTHING;

-- PAT PLAYS (3)
INSERT INTO playbook_plays (team_id, play_code, play_name, attributes, diagram, is_archived)
VALUES
  (team_uuid, 'ST-PAT-001', 'Standard PAT',
   '{"odk": "specialTeams", "unit": "PAT", "formation": "Field Goal", "playType": "PAT"}',
   '{"odk": "specialTeams", "formation": "Field Goal", "players": [], "routes": []}', false),
  (team_uuid, 'ST-PAT-002', '2-Point Run',
   '{"odk": "specialTeams", "unit": "PAT", "formation": "Goal Line", "playType": "2-Point Run"}',
   '{"odk": "specialTeams", "formation": "Goal Line", "players": [], "routes": []}', false),
  (team_uuid, 'ST-PAT-003', '2-Point Pass',
   '{"odk": "specialTeams", "unit": "PAT", "formation": "Goal Line", "playType": "2-Point Pass"}',
   '{"odk": "specialTeams", "formation": "Goal Line", "players": [], "routes": []}', false)
ON CONFLICT (play_code) DO NOTHING;

END $$;
