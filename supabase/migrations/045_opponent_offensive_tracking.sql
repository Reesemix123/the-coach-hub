-- Migration 045: Opponent Offensive Tracking Fields
-- Purpose: Add fields to track opponent offensive tendencies for defensive game planning
-- These fields complement is_opponent_play to store opponent offensive data

-- Add formation field for tracking opponent's offensive formation
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS formation VARCHAR(100);

COMMENT ON COLUMN play_instances.formation IS 'Offensive formation name (e.g., I-Formation, Shotgun Spread, Pistol)';

-- Add personnel field for tracking opponent's personnel grouping
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS personnel VARCHAR(50);

COMMENT ON COLUMN play_instances.personnel IS 'Personnel grouping (e.g., 11, 12, 21, 22) with descriptive format';

-- Add run_concept field for specific run scheme identification
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS run_concept VARCHAR(100);

COMMENT ON COLUMN play_instances.run_concept IS 'Run concept/scheme (e.g., Inside Zone, Outside Zone, Power, Counter)';

-- Add pass_concept field for specific pass concept identification
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS pass_concept VARCHAR(100);

COMMENT ON COLUMN play_instances.pass_concept IS 'Pass concept (e.g., Slant, Curl/Flat, Screen, Post, Four Verticals)';

-- Create indexes for efficient opponent tendency queries
CREATE INDEX IF NOT EXISTS idx_play_instances_formation
  ON play_instances(formation)
  WHERE formation IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_play_instances_personnel
  ON play_instances(personnel)
  WHERE personnel IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_play_instances_run_concept
  ON play_instances(run_concept)
  WHERE run_concept IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_play_instances_pass_concept
  ON play_instances(pass_concept)
  WHERE pass_concept IS NOT NULL;

-- Composite index for opponent offensive analysis
CREATE INDEX IF NOT EXISTS idx_play_instances_opponent_offense
  ON play_instances(is_opponent_play, formation, play_type)
  WHERE is_opponent_play = TRUE;
