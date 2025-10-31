-- Migration 009: Play Instances - Tier 1 & 2 Fields
-- Adds essential analytics fields for Little League and HS Basic tiers
-- All columns are nullable for backward compatibility

-- Context fields (All tiers)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS quarter INTEGER CHECK (quarter BETWEEN 1 AND 5), -- 1-4, 5 = OT
  ADD COLUMN IF NOT EXISTS time_remaining INTEGER, -- Seconds remaining in quarter
  ADD COLUMN IF NOT EXISTS score_differential INTEGER; -- Our score - Their score

-- Drive linkage (Tier 2+)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS drive_id UUID REFERENCES drives(id) ON DELETE SET NULL;

-- Player attribution (Tier 1: ball_carrier only; Tier 2: adds QB and target)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS ball_carrier_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qb_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_id UUID REFERENCES players(id) ON DELETE SET NULL;

-- Play classification (Tier 2+, can be derived from playbook attributes)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS play_type TEXT CHECK (play_type IN ('run', 'pass', 'screen', 'rpo', 'trick', 'kick', 'pat', 'two_point'));

-- Direction (Tier 2+)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('left', 'middle', 'right'));

-- Derived metrics (computed on write)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS success BOOLEAN, -- On-schedule: 40%/60%/100% rule
  ADD COLUMN IF NOT EXISTS explosive BOOLEAN; -- 10+ yards (run), 15+ yards (pass)

-- Multi-coach attribution (All tiers)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS tagged_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS idx_play_instances_quarter ON play_instances(quarter);
CREATE INDEX IF NOT EXISTS idx_play_instances_drive ON play_instances(drive_id);
CREATE INDEX IF NOT EXISTS idx_play_instances_ball_carrier ON play_instances(ball_carrier_id);
CREATE INDEX IF NOT EXISTS idx_play_instances_qb ON play_instances(qb_id);
CREATE INDEX IF NOT EXISTS idx_play_instances_target ON play_instances(target_id);
CREATE INDEX IF NOT EXISTS idx_play_instances_success ON play_instances(success) WHERE success = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_explosive ON play_instances(explosive) WHERE explosive = true;
CREATE INDEX IF NOT EXISTS idx_play_instances_tagged_by ON play_instances(tagged_by_user_id);

-- Function to compute success (on-schedule rule)
CREATE OR REPLACE FUNCTION compute_play_success(
  p_down INTEGER,
  p_distance INTEGER,
  p_yards_gained INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Handle null inputs
  IF p_down IS NULL OR p_distance IS NULL OR p_yards_gained IS NULL THEN
    RETURN NULL;
  END IF;

  -- On-schedule rule
  IF p_down = 1 THEN
    RETURN p_yards_gained >= (p_distance * 0.40);
  ELSIF p_down = 2 THEN
    RETURN p_yards_gained >= (p_distance * 0.60);
  ELSE
    -- 3rd/4th down: need 100% (first down)
    RETURN p_yards_gained >= p_distance;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to compute explosive play
CREATE OR REPLACE FUNCTION compute_play_explosive(
  p_play_type TEXT,
  p_yards_gained INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Handle null inputs
  IF p_play_type IS NULL OR p_yards_gained IS NULL THEN
    RETURN NULL;
  END IF;

  -- Explosive: 10+ yards (run), 15+ yards (pass/screen)
  IF p_play_type = 'run' THEN
    RETURN p_yards_gained >= 10;
  ELSIF p_play_type IN ('pass', 'screen', 'rpo') THEN
    RETURN p_yards_gained >= 15;
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-compute derived fields
CREATE OR REPLACE FUNCTION auto_compute_play_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Compute success
  NEW.success := compute_play_success(NEW.down, NEW.distance, NEW.yards_gained);

  -- Compute explosive
  NEW.explosive := compute_play_explosive(NEW.play_type, NEW.yards_gained);

  -- Set tagged_by if not already set
  IF NEW.tagged_by_user_id IS NULL THEN
    NEW.tagged_by_user_id := auth.uid();
  END IF;

  -- Track last edit
  NEW.last_edited_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_compute_play_metrics_trigger
  BEFORE INSERT OR UPDATE ON play_instances
  FOR EACH ROW
  EXECUTE FUNCTION auto_compute_play_metrics();

-- Update existing play instances with computed success
-- (Uses existing down, distance, yards_gained)
UPDATE play_instances
SET success = compute_play_success(down, distance, yards_gained)
WHERE success IS NULL
  AND down IS NOT NULL
  AND distance IS NOT NULL
  AND yards_gained IS NOT NULL;

-- Note: explosive cannot be computed for existing plays without play_type
-- Users will need to set play_type to get explosive computed
