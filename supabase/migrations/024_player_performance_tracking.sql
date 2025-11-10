-- Migration 024: Player Performance Tracking System
-- Comprehensive position-specific performance data collection
-- Enables PFF-style player grading and advanced analytics

-- ============================================
-- OFFENSIVE POSITION PERFORMANCE
-- ============================================

-- Quarterback (enhanced - add to existing qb_id and qb_decision_grade)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS qb_read_progression INTEGER CHECK (qb_read_progression BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS qb_scramble BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS qb_throw_accuracy TEXT CHECK (qb_throw_accuracy IN ('on_target', 'catchable', 'uncatchable')),
  ADD COLUMN IF NOT EXISTS qb_under_pressure BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS qb_decision_time TEXT CHECK (qb_decision_time IN ('quick', 'normal', 'late'));

-- Running Backs / Backs (add to existing ball_carrier_id)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS rb_broken_tackles INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rb_yards_after_contact INTEGER,
  ADD COLUMN IF NOT EXISTS rb_contact_at_los BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rb_fumbled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rb_pass_pro_grade TEXT CHECK (rb_pass_pro_grade IN ('win', 'loss', 'neutral'));

-- Receivers / Pass Catchers (add to existing target_id)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS wr_separation TEXT CHECK (wr_separation IN ('wide_open', 'open', 'tight', 'blanketed')),
  ADD COLUMN IF NOT EXISTS wr_contested_catch BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS wr_drop BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS wr_route_depth INTEGER,
  ADD COLUMN IF NOT EXISTS wr_yac INTEGER,
  ADD COLUMN IF NOT EXISTS wr_broken_tackles INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wr_block_grade TEXT CHECK (wr_block_grade IN ('win', 'loss', 'neutral'));

-- Offensive Line (add to existing OL fields)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS ol_pancake_player_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS sack_allowed_player_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS pressure_allowed_player_id UUID REFERENCES players(id);

-- ============================================
-- DEFENSIVE POSITION PERFORMANCE
-- ============================================

-- Defensive Line (add to existing pressure_player_ids, sack_player_id)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS dl_tfl_player_ids UUID[],
  ADD COLUMN IF NOT EXISTS dl_qb_hit_player_ids UUID[],
  ADD COLUMN IF NOT EXISTS dl_batted_pass_player_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS dl_contain_player_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS dl_blown_gap_player_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS dl_double_team_player_id UUID REFERENCES players(id);

-- Linebackers (add to existing tackler_ids, missed_tackle_ids)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS lb_coverage_player_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS lb_zone_responsibility TEXT CHECK (lb_zone_responsibility IN ('flat', 'hook', 'curl', 'seam', 'man')),
  ADD COLUMN IF NOT EXISTS lb_coverage_grade TEXT CHECK (lb_coverage_grade IN ('win', 'loss', 'neutral')),
  ADD COLUMN IF NOT EXISTS lb_blown_assignment_player_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS lb_run_fill_grade TEXT CHECK (lb_run_fill_grade IN ('fast', 'on_time', 'late'));

-- Defensive Backs (add to existing coverage_player_id, coverage_result, is_pbu, is_interception)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS db_target_separation TEXT CHECK (db_target_separation IN ('step_for_step', 'close', 'beaten')),
  ADD COLUMN IF NOT EXISTS db_closest_defender_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS db_missed_assignment_player_id UUID REFERENCES players(id),
  ADD COLUMN IF NOT EXISTS db_pi_penalty BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS db_allowed_catch_yards INTEGER,
  ADD COLUMN IF NOT EXISTS db_run_support_tackle BOOLEAN DEFAULT false;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Offensive player indexes
CREATE INDEX IF NOT EXISTS idx_play_instances_qb_performance
  ON play_instances(qb_id, qb_decision_grade)
  WHERE qb_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_play_instances_rb_performance
  ON play_instances(ball_carrier_id, rb_broken_tackles)
  WHERE ball_carrier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_play_instances_wr_performance
  ON play_instances(target_id, wr_drop, wr_contested_catch)
  WHERE target_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_play_instances_ol_pancakes
  ON play_instances(ol_pancake_player_id)
  WHERE ol_pancake_player_id IS NOT NULL;

-- Defensive player indexes
CREATE INDEX IF NOT EXISTS idx_play_instances_dl_performance
  ON play_instances USING GIN(dl_tfl_player_ids);

CREATE INDEX IF NOT EXISTS idx_play_instances_lb_coverage
  ON play_instances(lb_coverage_player_id, lb_coverage_grade)
  WHERE lb_coverage_player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_play_instances_db_coverage
  ON play_instances(db_closest_defender_id, db_target_separation)
  WHERE db_closest_defender_id IS NOT NULL;
