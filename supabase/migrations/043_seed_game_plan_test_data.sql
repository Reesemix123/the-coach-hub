-- Migration: Seed Game Plan Test Data
-- Creates test plays with setup/counter relationships for Game Plan testing

-- First, clean up existing plays for any team (we'll use a variable approach)
-- Note: This targets the specific team ID from the logs

-- Delete existing playbook plays
DELETE FROM playbook_plays WHERE team_id = '99ef9d88-454e-42bf-8f52-04d37b34a9d6' OR team_id IS NULL;

-- Delete existing play relationships
DELETE FROM play_relationships WHERE team_id = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

-- ========== INSERT TEST PLAYS ==========

-- Run Plays: Inside Zone
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('IZ-R', 'Inside Zone Right', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Run", "runConcept": "Inside Zone", "personnel": "11 (1RB-1TE-3WR)", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "rb-route", "playerId": "RB", "path": [{"x": 350, "y": 300}, {"x": 450, "y": 150}], "type": "run"}]}',
  false),

('IZ-L', 'Inside Zone Left', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Run", "runConcept": "Inside Zone", "personnel": "11 (1RB-1TE-3WR)", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "rb-route", "playerId": "RB", "path": [{"x": 350, "y": 300}, {"x": 250, "y": 150}], "type": "run"}]}',
  false);

-- Run Plays: Outside Zone
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('OZ-R', 'Outside Zone Right', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Run", "runConcept": "Outside Zone", "personnel": "11 (1RB-1TE-3WR)", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "rb-route", "playerId": "RB", "path": [{"x": 350, "y": 300}, {"x": 550, "y": 150}], "type": "run"}]}',
  false),

('OZ-L', 'Outside Zone Left', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Run", "runConcept": "Outside Zone", "personnel": "11 (1RB-1TE-3WR)", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "rb-route", "playerId": "RB", "path": [{"x": 350, "y": 300}, {"x": 150, "y": 150}], "type": "run"}]}',
  false);

-- Run Plays: Counter
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('CTR-R', 'Counter Trey Right', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "I-Form Pro", "playType": "Run", "runConcept": "Counter", "personnel": "21 (2RB-1TE-2WR)", "motion": "None"}',
  '{"odk": "offense", "formation": "I-Form Pro", "players": [{"position": "QB", "x": 350, "y": 280, "label": "QB"}, {"position": "FB", "x": 350, "y": 320, "label": "FB"}, {"position": "TB", "x": 350, "y": 360, "label": "TB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "Y", "x": 550, "y": 200, "label": "Y"}, {"position": "TE", "x": 520, "y": 200, "label": "TE"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "tb-route", "playerId": "TB", "path": [{"x": 350, "y": 360}, {"x": 250, "y": 300}, {"x": 500, "y": 150}], "type": "run"}]}',
  false),

('CTR-L', 'Counter Trey Left', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "I-Form Pro", "playType": "Run", "runConcept": "Counter", "personnel": "21 (2RB-1TE-2WR)", "motion": "None"}',
  '{"odk": "offense", "formation": "I-Form Pro", "players": [{"position": "QB", "x": 350, "y": 280, "label": "QB"}, {"position": "FB", "x": 350, "y": 320, "label": "FB"}, {"position": "TB", "x": 350, "y": 360, "label": "TB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "Y", "x": 550, "y": 200, "label": "Y"}, {"position": "TE", "x": 180, "y": 200, "label": "TE"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "tb-route", "playerId": "TB", "path": [{"x": 350, "y": 360}, {"x": 450, "y": 300}, {"x": 200, "y": 150}], "type": "run"}]}',
  false);

-- Run Plays: Power
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('PWR-R', 'Power Right', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "I-Form Pro", "playType": "Run", "runConcept": "Power", "personnel": "21 (2RB-1TE-2WR)", "motion": "None"}',
  '{"odk": "offense", "formation": "I-Form Pro", "players": [{"position": "QB", "x": 350, "y": 280, "label": "QB"}, {"position": "FB", "x": 350, "y": 320, "label": "FB"}, {"position": "TB", "x": 350, "y": 360, "label": "TB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "Y", "x": 650, "y": 200, "label": "Y"}, {"position": "TE", "x": 520, "y": 200, "label": "TE"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "tb-route", "playerId": "TB", "path": [{"x": 350, "y": 360}, {"x": 480, "y": 150}], "type": "run"}]}',
  false),

('PWR-L', 'Power Left', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "I-Form Pro", "playType": "Run", "runConcept": "Power", "personnel": "21 (2RB-1TE-2WR)", "motion": "None"}',
  '{"odk": "offense", "formation": "I-Form Pro", "players": [{"position": "QB", "x": 350, "y": 280, "label": "QB"}, {"position": "FB", "x": 350, "y": 320, "label": "FB"}, {"position": "TB", "x": 350, "y": 360, "label": "TB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "Y", "x": 650, "y": 200, "label": "Y"}, {"position": "TE", "x": 180, "y": 200, "label": "TE"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "tb-route", "playerId": "TB", "path": [{"x": 350, "y": 360}, {"x": 220, "y": 150}], "type": "run"}]}',
  false);

-- Quick Pass Plays
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('SLNT-R', 'Slant Right', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Slant", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man Slide", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "z-route", "playerId": "Z", "path": [{"x": 650, "y": 200}, {"x": 550, "y": 140}], "type": "pass", "routeType": "Slant", "isPrimary": true}]}',
  false),

('SLNT-L', 'Slant Left', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Slant", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man Slide", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "x-route", "playerId": "X", "path": [{"x": 50, "y": 200}, {"x": 150, "y": 140}], "type": "pass", "routeType": "Slant", "isPrimary": true}]}',
  false),

('HTCH-3', 'Triple Hitch', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Trips", "playType": "Pass", "passConcept": "Hitch", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man Slide", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Trips", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 550, "y": 220, "label": "H"}, {"position": "Y", "x": 600, "y": 210, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "z-route", "playerId": "Z", "path": [{"x": 650, "y": 200}, {"x": 650, "y": 160}], "type": "pass", "routeType": "Hitch", "isPrimary": true}]}',
  false),

('BUBL-R', 'Bubble Screen Right', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Screen", "passConcept": "Bubble Screen", "personnel": "10 (1RB-0TE-4WR)", "protection": "None", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 550, "y": 220, "label": "H"}, {"position": "Y", "x": 600, "y": 210, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "h-route", "playerId": "H", "path": [{"x": 550, "y": 220}, {"x": 620, "y": 220}], "type": "pass", "routeType": "Bubble", "isPrimary": true}]}',
  false);

-- Intermediate Pass Plays
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('CURL-FLT', 'Curl-Flat Combo', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Curl-Flat", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man Slide", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "x-route", "playerId": "X", "path": [{"x": 50, "y": 200}, {"x": 50, "y": 140}, {"x": 50, "y": 140}], "type": "pass", "routeType": "Curl", "isPrimary": true}, {"id": "h-route", "playerId": "H", "path": [{"x": 150, "y": 220}, {"x": 50, "y": 200}], "type": "pass", "routeType": "Flat"}]}',
  false),

('DIG-R', 'Dig Route Right', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Dig", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man Slide", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "z-route", "playerId": "Z", "path": [{"x": 650, "y": 200}, {"x": 650, "y": 130}, {"x": 400, "y": 130}], "type": "pass", "routeType": "Dig", "isPrimary": true}]}',
  false),

('OUT-R', 'Out Route Right', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Out", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man Slide", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "z-route", "playerId": "Z", "path": [{"x": 650, "y": 200}, {"x": 650, "y": 150}, {"x": 700, "y": 150}], "type": "pass", "routeType": "Out", "isPrimary": true}]}',
  false),

('MESH', 'Mesh Concept', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Mesh", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man Slide", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "h-route", "playerId": "H", "path": [{"x": 150, "y": 220}, {"x": 500, "y": 180}], "type": "pass", "routeType": "Mesh", "isPrimary": true}, {"id": "y-route", "playerId": "Y", "path": [{"x": 550, "y": 220}, {"x": 200, "y": 180}], "type": "pass", "routeType": "Mesh"}]}',
  false),

('LVLS', 'Levels Concept', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Trips", "playType": "Pass", "passConcept": "Levels", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man Slide", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Trips", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 550, "y": 220, "label": "H"}, {"position": "Y", "x": 600, "y": 210, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "h-route", "playerId": "H", "path": [{"x": 550, "y": 220}, {"x": 400, "y": 180}], "type": "pass", "routeType": "In"}, {"id": "y-route", "playerId": "Y", "path": [{"x": 600, "y": 210}, {"x": 400, "y": 130}], "type": "pass", "routeType": "Dig", "isPrimary": true}]}',
  false);

-- Deep Pass Plays
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('4VERTS', 'Four Verticals', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Four Verts", "personnel": "10 (1RB-0TE-4WR)", "protection": "5-Man Max", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "x-route", "playerId": "X", "path": [{"x": 50, "y": 200}, {"x": 50, "y": 50}], "type": "pass", "routeType": "Go"}, {"id": "h-route", "playerId": "H", "path": [{"x": 150, "y": 220}, {"x": 200, "y": 50}], "type": "pass", "routeType": "Seam"}, {"id": "y-route", "playerId": "Y", "path": [{"x": 550, "y": 220}, {"x": 500, "y": 50}], "type": "pass", "routeType": "Seam"}, {"id": "z-route", "playerId": "Z", "path": [{"x": 650, "y": 200}, {"x": 650, "y": 50}], "type": "pass", "routeType": "Go", "isPrimary": true}]}',
  false),

('POST-R', 'Post Right', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Post", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man Max", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "z-route", "playerId": "Z", "path": [{"x": 650, "y": 200}, {"x": 650, "y": 130}, {"x": 400, "y": 50}], "type": "pass", "routeType": "Post", "isPrimary": true}]}',
  false),

('CRNR-R', 'Corner Route Right', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Corner", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man Max", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "z-route", "playerId": "Z", "path": [{"x": 650, "y": 200}, {"x": 650, "y": 130}, {"x": 700, "y": 50}], "type": "pass", "routeType": "Corner", "isPrimary": true}]}',
  false),

('SEAM-R', 'Seam Route Right', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Trips", "playType": "Pass", "passConcept": "Seam", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man Max", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Trips", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 550, "y": 220, "label": "H"}, {"position": "Y", "x": 600, "y": 210, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "h-route", "playerId": "H", "path": [{"x": 550, "y": 220}, {"x": 550, "y": 50}], "type": "pass", "routeType": "Seam", "isPrimary": true}]}',
  false);

-- Play Action
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('PA-IZ-POST', 'Play Action IZ Post', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Play Action", "passConcept": "Post", "runConcept": "Inside Zone", "personnel": "11 (1RB-1TE-3WR)", "protection": "Play Action", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "z-route", "playerId": "Z", "path": [{"x": 650, "y": 200}, {"x": 650, "y": 130}, {"x": 400, "y": 50}], "type": "pass", "routeType": "Post", "isPrimary": true}]}',
  false),

('PA-PWR-BOOT', 'Power Boot Right', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "I-Form Pro", "playType": "Play Action", "passConcept": "Bootleg", "runConcept": "Power", "personnel": "21 (2RB-1TE-2WR)", "protection": "Bootleg", "motion": "None"}',
  '{"odk": "offense", "formation": "I-Form Pro", "players": [{"position": "QB", "x": 350, "y": 280, "label": "QB"}, {"position": "FB", "x": 350, "y": 320, "label": "FB"}, {"position": "TB", "x": 350, "y": 360, "label": "TB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "Y", "x": 650, "y": 200, "label": "Y"}, {"position": "TE", "x": 520, "y": 200, "label": "TE"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "qb-route", "playerId": "QB", "path": [{"x": 350, "y": 280}, {"x": 550, "y": 260}], "type": "run"}, {"id": "te-route", "playerId": "TE", "path": [{"x": 520, "y": 200}, {"x": 650, "y": 160}], "type": "pass", "routeType": "Flat", "isPrimary": true}]}',
  false),

('PA-OZ-WHEEL', 'Outside Zone Wheel', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Play Action", "passConcept": "Wheel", "runConcept": "Outside Zone", "personnel": "11 (1RB-1TE-3WR)", "protection": "Play Action", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "rb-route", "playerId": "RB", "path": [{"x": 350, "y": 300}, {"x": 200, "y": 200}, {"x": 50, "y": 50}], "type": "pass", "routeType": "Wheel", "isPrimary": true}]}',
  false);

-- RPO Plays
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('RPO-IZ-SLNT', 'RPO Inside Zone Slant', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "RPO", "passConcept": "Slant", "runConcept": "Inside Zone", "personnel": "11 (1RB-1TE-3WR)", "protection": "RPO", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "rb-route", "playerId": "RB", "path": [{"x": 350, "y": 300}, {"x": 450, "y": 150}], "type": "run"}, {"id": "z-route", "playerId": "Z", "path": [{"x": 650, "y": 200}, {"x": 550, "y": 140}], "type": "pass", "routeType": "Slant"}]}',
  false),

('RPO-IZ-BUBL', 'RPO Inside Zone Bubble', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "RPO", "passConcept": "Bubble Screen", "runConcept": "Inside Zone", "personnel": "10 (1RB-0TE-4WR)", "protection": "RPO", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 550, "y": 220, "label": "H"}, {"position": "Y", "x": 600, "y": 210, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "rb-route", "playerId": "RB", "path": [{"x": 350, "y": 300}, {"x": 450, "y": 150}], "type": "run"}, {"id": "h-route", "playerId": "H", "path": [{"x": 550, "y": 220}, {"x": 620, "y": 220}], "type": "pass", "routeType": "Bubble"}]}',
  false),

('RPO-PWR-POP', 'RPO Power Pop Pass', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Trips", "playType": "RPO", "passConcept": "Pop Pass", "runConcept": "Power", "personnel": "11 (1RB-1TE-3WR)", "protection": "RPO", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Trips", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 550, "y": 220, "label": "H"}, {"position": "Y", "x": 600, "y": 210, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "rb-route", "playerId": "RB", "path": [{"x": 350, "y": 300}, {"x": 480, "y": 150}], "type": "run"}, {"id": "y-route", "playerId": "Y", "path": [{"x": 600, "y": 210}, {"x": 600, "y": 180}], "type": "pass", "routeType": "Pop"}]}',
  false);

-- Screen Plays
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('SCRN-RB', 'RB Screen', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Screen", "passConcept": "RB Screen", "personnel": "11 (1RB-1TE-3WR)", "protection": "Screen", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "rb-route", "playerId": "RB", "path": [{"x": 350, "y": 300}, {"x": 200, "y": 250}], "type": "pass", "routeType": "Screen", "isPrimary": true}]}',
  false),

('SCRN-WR-R', 'WR Screen Right', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Screen", "passConcept": "WR Screen", "personnel": "10 (1RB-0TE-4WR)", "protection": "Screen", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "z-route", "playerId": "Z", "path": [{"x": 650, "y": 200}, {"x": 620, "y": 220}], "type": "pass", "routeType": "Screen", "isPrimary": true}]}',
  false),

('SCRN-TUNL', 'Tunnel Screen', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Trips", "playType": "Screen", "passConcept": "Tunnel Screen", "personnel": "11 (1RB-1TE-3WR)", "protection": "Screen", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Trips", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 550, "y": 220, "label": "H"}, {"position": "Y", "x": 600, "y": 210, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "h-route", "playerId": "H", "path": [{"x": 550, "y": 220}, {"x": 450, "y": 200}], "type": "pass", "routeType": "Tunnel", "isPrimary": true}]}',
  false);

-- Draw Plays
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('DRAW-DLY', 'Delay Draw', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Run", "runConcept": "Draw", "personnel": "11 (1RB-1TE-3WR)", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "rb-route", "playerId": "RB", "path": [{"x": 350, "y": 300}, {"x": 350, "y": 150}], "type": "run"}]}',
  false),

('DRAW-QB', 'QB Draw', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Empty", "playType": "Run", "runConcept": "QB Draw", "personnel": "10 (1RB-0TE-4WR)", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Empty", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "A", "x": 100, "y": 200, "label": "A"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "qb-route", "playerId": "QB", "path": [{"x": 350, "y": 260}, {"x": 350, "y": 150}], "type": "run"}]}',
  false);

-- Goal Line Plays
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('GL-DIVE', 'Goal Line Dive', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Goal Line", "playType": "Run", "runConcept": "Dive", "personnel": "23 (2RB-3TE-0WR)", "motion": "None"}',
  '{"odk": "offense", "formation": "Goal Line", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "FB", "x": 350, "y": 300, "label": "FB"}, {"position": "TB", "x": 350, "y": 340, "label": "TB"}, {"position": "TE1", "x": 180, "y": 200, "label": "TE"}, {"position": "TE2", "x": 520, "y": 200, "label": "TE"}, {"position": "TE3", "x": 560, "y": 200, "label": "TE"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "tb-route", "playerId": "TB", "path": [{"x": 350, "y": 340}, {"x": 350, "y": 150}], "type": "run"}]}',
  false),

('GL-SNEAK', 'QB Sneak', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Goal Line", "playType": "Run", "runConcept": "QB Sneak", "personnel": "23 (2RB-3TE-0WR)", "motion": "None"}',
  '{"odk": "offense", "formation": "Goal Line", "players": [{"position": "QB", "x": 350, "y": 230, "label": "QB"}, {"position": "FB", "x": 350, "y": 270, "label": "FB"}, {"position": "TB", "x": 350, "y": 310, "label": "TB"}, {"position": "TE1", "x": 180, "y": 200, "label": "TE"}, {"position": "TE2", "x": 520, "y": 200, "label": "TE"}, {"position": "TE3", "x": 560, "y": 200, "label": "TE"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "qb-route", "playerId": "QB", "path": [{"x": 350, "y": 230}, {"x": 350, "y": 180}], "type": "run"}]}',
  false),

('GL-FADE', 'Goal Line Fade', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Fade", "personnel": "11 (1RB-1TE-3WR)", "protection": "Quick", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "z-route", "playerId": "Z", "path": [{"x": 650, "y": 200}, {"x": 680, "y": 100}], "type": "pass", "routeType": "Fade", "isPrimary": true}]}',
  false),

('GL-SLNT', 'Goal Line Slant', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Slant", "personnel": "11 (1RB-1TE-3WR)", "protection": "Quick", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "z-route", "playerId": "Z", "path": [{"x": 650, "y": 200}, {"x": 550, "y": 170}], "type": "pass", "routeType": "Slant", "isPrimary": true}]}',
  false);

-- 2-Minute Drill Plays
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('2M-SPIKE', 'Clock Spike', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Spike", "personnel": "11 (1RB-1TE-3WR)", "protection": "Quick", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": []}',
  false),

('2M-OUTS', '2-Minute Outs', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Out", "personnel": "10 (1RB-0TE-4WR)", "protection": "5-Man Quick", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "x-route", "playerId": "X", "path": [{"x": 50, "y": 200}, {"x": 50, "y": 150}, {"x": 0, "y": 150}], "type": "pass", "routeType": "Out"}, {"id": "z-route", "playerId": "Z", "path": [{"x": 650, "y": 200}, {"x": 650, "y": 150}, {"x": 700, "y": 150}], "type": "pass", "routeType": "Out", "isPrimary": true}]}',
  false),

('2M-DRVR', '2-Minute Drive', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Pass", "passConcept": "Drive", "personnel": "11 (1RB-1TE-3WR)", "protection": "5-Man Quick", "motion": "None"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "y-route", "playerId": "Y", "path": [{"x": 550, "y": 220}, {"x": 550, "y": 150}, {"x": 400, "y": 150}], "type": "pass", "routeType": "Dig", "isPrimary": true}]}',
  false);

-- Motion Plays
INSERT INTO playbook_plays (play_code, play_name, team_id, attributes, diagram, is_archived) VALUES
('JET-SWEP', 'Jet Sweep', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Run", "runConcept": "Jet Sweep", "personnel": "11 (1RB-1TE-3WR)", "motion": "Jet"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "h-route", "playerId": "H", "path": [{"x": 150, "y": 220}, {"x": 350, "y": 230}, {"x": 550, "y": 150}], "type": "run", "routeType": "Jet"}]}',
  false),

('JET-FAKE-IZ', 'Jet Fake Inside Zone', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Run", "runConcept": "Inside Zone", "personnel": "11 (1RB-1TE-3WR)", "motion": "Jet"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "rb-route", "playerId": "RB", "path": [{"x": 350, "y": 300}, {"x": 450, "y": 150}], "type": "run"}]}',
  false),

('ORBIT-SCRN', 'Orbit Screen', '99ef9d88-454e-42bf-8f52-04d37b34a9d6',
  '{"odk": "offense", "formation": "Shotgun Spread", "playType": "Screen", "passConcept": "Orbit Screen", "personnel": "11 (1RB-1TE-3WR)", "motion": "Orbit"}',
  '{"odk": "offense", "formation": "Shotgun Spread", "players": [{"position": "QB", "x": 350, "y": 260, "label": "QB"}, {"position": "RB", "x": 350, "y": 300, "label": "RB"}, {"position": "X", "x": 50, "y": 200, "label": "X"}, {"position": "H", "x": 150, "y": 220, "label": "H"}, {"position": "Y", "x": 550, "y": 220, "label": "Y"}, {"position": "Z", "x": 650, "y": 200, "label": "Z"}, {"position": "LT", "x": 220, "y": 200, "label": "LT"}, {"position": "LG", "x": 270, "y": 200, "label": "LG"}, {"position": "C", "x": 350, "y": 200, "label": "C"}, {"position": "RG", "x": 430, "y": 200, "label": "RG"}, {"position": "RT", "x": 480, "y": 200, "label": "RT"}], "routes": [{"id": "h-route", "playerId": "H", "path": [{"x": 150, "y": 220}, {"x": 300, "y": 280}, {"x": 200, "y": 220}], "type": "pass", "routeType": "Orbit", "isPrimary": true}]}',
  false);


-- ========== INSERT SETUP/COUNTER RELATIONSHIPS ==========

INSERT INTO play_relationships (team_id, setup_play_code, counter_play_code, key_position, key_indicator, notes) VALUES
-- Inside Zone setups Counter plays
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'IZ-R', 'CTR-L', 'MLB', 'cheating_inside', 'Counter when MLB is crashing A-gap'),
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'IZ-L', 'CTR-R', 'MLB', 'cheating_inside', 'Counter when MLB is crashing A-gap'),
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'IZ-R', 'PA-IZ-POST', 'SS', 'run_fit_aggressive', 'Play action when SS is filling run'),

-- Outside Zone setups Boot/Counter
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'OZ-R', 'PA-PWR-BOOT', 'WILL', 'run_fit_aggressive', 'Boot when LBs are flowing hard'),
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'OZ-L', 'PA-OZ-WHEEL', 'SS', 'run_fit_aggressive', 'Wheel when SS is crashing'),

-- Power setups Counter
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'PWR-R', 'CTR-L', 'WILL', 'cheating_inside', 'Counter when WILL cheats to strong side'),
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'PWR-L', 'CTR-R', 'SAM', 'cheating_inside', 'Counter when SAM cheats to strong side'),

-- Slant setups Out routes
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'SLNT-R', 'OUT-R', 'CB1', 'jumping_routes', 'Out route when CB is jumping inside'),
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'SLNT-L', 'CRNR-R', 'CB2', 'soft_coverage', 'Corner when CB is playing soft'),

-- Quick game setups deep shots
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'HTCH-3', '4VERTS', 'FS', 'robber_technique', 'Verticals when FS is robbing underneath'),
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'CURL-FLT', 'POST-R', 'FS', 'robber_technique', 'Post when FS is jumping curl'),

-- Bubble setups inside runs
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'BUBL-R', 'IZ-L', 'CB1', 'biting_motion', 'Inside Zone when CB is chasing bubble'),

-- Jet motion setups
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'JET-SWEP', 'JET-FAKE-IZ', 'WILL', 'biting_motion', 'Inside Zone when LB is chasing jet'),
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'JET-SWEP', 'PA-IZ-POST', 'SS', 'biting_motion', 'Play action when SS is biting on jet'),

-- Draw setups
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'DRAW-DLY', 'POST-R', 'MLB', 'spy_qb', 'Post when MLB is spying QB'),

-- RPO setups
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'RPO-IZ-SLNT', 'RPO-IZ-BUBL', 'NB', 'jumping_routes', 'Bubble when slot is jumping slant'),
('99ef9d88-454e-42bf-8f52-04d37b34a9d6', 'RPO-IZ-BUBL', 'IZ-R', 'CB1', 'biting_motion', 'Commit to run when CB is chasing bubble');

-- Add comment for this migration
COMMENT ON SCHEMA public IS 'Game Plan test data seeded with 43 plays and 16 setup/counter relationships';
