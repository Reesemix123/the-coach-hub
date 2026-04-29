-- ============================================================================
-- Migration 192: Backfill team_schemes + scheme_positions for existing teams
-- ============================================================================
-- New teams created after migration 190 already get default schemes from the
-- team-creation hook (src/app/api/teams/create/route.ts). This migration
-- handles every team that existed BEFORE that hook landed.
--
-- Source of truth for slot data: src/config/footballPositions.ts. Only the
-- 5 default scheme templates referenced by defaultSchemeKey() are seeded
-- here (wing-t, i-formation, 5-3-defense, 4-3-base, kickoff-coverage).
-- Other templates (3-4, shotgun-spread, kickoff-return, punt, etc.) are
-- created on-demand in 5C scheme management.
--
-- Idempotent: WHERE NOT EXISTS guards prevent duplicates if re-run.
-- ============================================================================

DO $$
DECLARE
  team_rec RECORD;
  age_group TEXT;
  off_template TEXT;
  def_template TEXT;
  st_template TEXT;
  scheme_id UUID;
BEGIN
  FOR team_rec IN SELECT id, level FROM teams LOOP

    -- Map level → ageGroup (mirrors ageGroupFromLevel in footballPositions.ts)
    IF team_rec.level IS NULL THEN
      age_group := 'high_school';
    ELSIF lower(team_rec.level) LIKE '%youth%'
       OR lower(team_rec.level) LIKE '%middle%'
       OR lower(team_rec.level) LIKE '%elementary%' THEN
      age_group := 'youth';
    ELSE
      age_group := 'high_school';
    END IF;

    -- Pick default templates per defaultSchemeKey()
    off_template := CASE WHEN age_group = 'youth' THEN 'wing-t' ELSE 'i-formation' END;
    def_template := CASE WHEN age_group = 'youth' THEN '5-3-defense' ELSE '4-3-base' END;
    st_template  := 'kickoff-coverage';

    -- =========================================================================
    -- OFFENSE
    -- =========================================================================
    IF NOT EXISTS (
      SELECT 1 FROM team_schemes WHERE team_id = team_rec.id AND unit = 'offense' AND is_default = true
    ) THEN
      INSERT INTO team_schemes (team_id, sport, template_key, name, unit, is_default, is_active, sort_order)
      VALUES (
        team_rec.id, 'football', off_template,
        CASE off_template WHEN 'wing-t' THEN 'Wing-T' ELSE 'I-Formation' END,
        'offense', true, true, 0
      )
      RETURNING id INTO scheme_id;

      IF off_template = 'wing-t' THEN
        INSERT INTO scheme_positions (scheme_id, position_category_id, slot_code, display_label, sort_order, is_optional)
        SELECT scheme_id, pc.id, slot.slot_code, slot.display_label, slot.sort_order, false
        FROM (VALUES
          ('LT', 'Left Tackle',  'OL',  0),
          ('LG', 'Left Guard',   'OL',  1),
          ('C',  'Center',       'OL',  2),
          ('RG', 'Right Guard',  'OL',  3),
          ('RT', 'Right Tackle', 'OL',  4),
          ('TE', 'Tight End',    'TE',  5),
          ('QB', 'Quarterback',  'QB',  6),
          ('FB', 'Fullback',     'RB',  7),
          ('HB', 'Halfback',     'RB',  8),
          ('WB', 'Wingback',     'RB',  9),
          ('SE', 'Split End',    'WR', 10)
        ) AS slot(slot_code, display_label, category_code, sort_order)
        JOIN position_categories pc ON pc.code = slot.category_code AND pc.sport = 'football';
      ELSE -- i-formation
        INSERT INTO scheme_positions (scheme_id, position_category_id, slot_code, display_label, sort_order, is_optional)
        SELECT scheme_id, pc.id, slot.slot_code, slot.display_label, slot.sort_order, false
        FROM (VALUES
          ('LT', 'Left Tackle',   'OL',  0),
          ('LG', 'Left Guard',    'OL',  1),
          ('C',  'Center',        'OL',  2),
          ('RG', 'Right Guard',   'OL',  3),
          ('RT', 'Right Tackle',  'OL',  4),
          ('TE', 'Tight End',     'TE',  5),
          ('QB', 'Quarterback',   'QB',  6),
          ('FB', 'Fullback',      'RB',  7),
          ('RB', 'Running Back',  'RB',  8),
          ('X',  'Split End (X)', 'WR',  9),
          ('Z',  'Flanker (Z)',   'WR', 10)
        ) AS slot(slot_code, display_label, category_code, sort_order)
        JOIN position_categories pc ON pc.code = slot.category_code AND pc.sport = 'football';
      END IF;
    END IF;

    -- =========================================================================
    -- DEFENSE
    -- =========================================================================
    IF NOT EXISTS (
      SELECT 1 FROM team_schemes WHERE team_id = team_rec.id AND unit = 'defense' AND is_default = true
    ) THEN
      INSERT INTO team_schemes (team_id, sport, template_key, name, unit, is_default, is_active, sort_order)
      VALUES (
        team_rec.id, 'football', def_template,
        CASE def_template WHEN '5-3-defense' THEN '5-3 Defense' ELSE '4-3 Base' END,
        'defense', true, true, 0
      )
      RETURNING id INTO scheme_id;

      IF def_template = '5-3-defense' THEN
        INSERT INTO scheme_positions (scheme_id, position_category_id, slot_code, display_label, sort_order, is_optional)
        SELECT scheme_id, pc.id, slot.slot_code, slot.display_label, slot.sort_order, false
        FROM (VALUES
          ('LDE', 'Left Defensive End',   'DL',  0),
          ('LDT', 'Left Defensive Tackle','DL',  1),
          ('NG',  'Nose Guard',           'DL',  2),
          ('RDT', 'Right Defensive Tackle','DL', 3),
          ('RDE', 'Right Defensive End',  'DL',  4),
          ('SLB', 'Strong-Side LB',       'LB',  5),
          ('MLB', 'Middle LB',            'LB',  6),
          ('WLB', 'Weak-Side LB',         'LB',  7),
          ('LCB', 'Left Cornerback',      'DB',  8),
          ('RCB', 'Right Cornerback',     'DB',  9),
          ('FS',  'Free Safety',          'DB', 10)
        ) AS slot(slot_code, display_label, category_code, sort_order)
        JOIN position_categories pc ON pc.code = slot.category_code AND pc.sport = 'football';
      ELSE -- 4-3-base
        INSERT INTO scheme_positions (scheme_id, position_category_id, slot_code, display_label, sort_order, is_optional)
        SELECT scheme_id, pc.id, slot.slot_code, slot.display_label, slot.sort_order, false
        FROM (VALUES
          ('LDE',  'Left Defensive End',   'DL',  0),
          ('DT1',  '3-Technique Tackle',   'DL',  1),
          ('DT2',  '1-Technique Tackle',   'DL',  2),
          ('RDE',  'Right Defensive End',  'DL',  3),
          ('SAM',  'Strong-Side LB (Sam)', 'LB',  4),
          ('MIKE', 'Middle LB (Mike)',     'LB',  5),
          ('WILL', 'Weak-Side LB (Will)',  'LB',  6),
          ('LCB',  'Left Cornerback',      'DB',  7),
          ('RCB',  'Right Cornerback',     'DB',  8),
          ('FS',   'Free Safety',          'DB',  9),
          ('SS',   'Strong Safety',        'DB', 10)
        ) AS slot(slot_code, display_label, category_code, sort_order)
        JOIN position_categories pc ON pc.code = slot.category_code AND pc.sport = 'football';
      END IF;
    END IF;

    -- =========================================================================
    -- SPECIAL TEAMS
    -- =========================================================================
    IF NOT EXISTS (
      SELECT 1 FROM team_schemes WHERE team_id = team_rec.id AND unit = 'special_teams' AND is_default = true
    ) THEN
      INSERT INTO team_schemes (team_id, sport, template_key, name, unit, is_default, is_active, sort_order)
      VALUES (team_rec.id, 'football', st_template, 'Kickoff Coverage', 'special_teams', true, true, 0)
      RETURNING id INTO scheme_id;

      INSERT INTO scheme_positions (scheme_id, position_category_id, slot_code, display_label, sort_order, is_optional)
      SELECT scheme_id, pc.id, slot.slot_code, slot.display_label, slot.sort_order, false
      FROM (VALUES
        ('K',      'Kicker',       'K',    0),
        ('GUN-L',  'Left Gunner',  'ATH',  1),
        ('COV-L4', 'Cover L4',     'ATH',  2),
        ('COV-L3', 'Cover L3',     'ATH',  3),
        ('COV-L2', 'Cover L2',     'ATH',  4),
        ('COV-L1', 'Cover L1',     'ATH',  5),
        ('COV-R1', 'Cover R1',     'ATH',  6),
        ('COV-R2', 'Cover R2',     'ATH',  7),
        ('COV-R3', 'Cover R3',     'ATH',  8),
        ('COV-R4', 'Cover R4',     'ATH',  9),
        ('GUN-R',  'Right Gunner', 'ATH', 10)
      ) AS slot(slot_code, display_label, category_code, sort_order)
      JOIN position_categories pc ON pc.code = slot.category_code AND pc.sport = 'football';
    END IF;

  END LOOP;
END $$;
