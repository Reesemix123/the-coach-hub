-- Migration: Add special teams tracking columns to play_instances
-- This enables comprehensive tracking of kickoffs, punts, field goals, and returns

-- Add special teams unit identification
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS special_teams_unit TEXT CHECK (special_teams_unit IN (
    'kickoff', 'kick_return', 'punt', 'punt_return', 'field_goal', 'pat'
  ));

-- Kicking plays (Kickoff, Punt, FG, PAT)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS kicker_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kick_result TEXT CHECK (kick_result IN (
    'made', 'missed', 'blocked', 'touchback', 'fair_catch',
    'returned', 'out_of_bounds', 'onside_recovered', 'onside_lost',
    'fake_success', 'fake_fail', 'muffed', 'downed'
  )),
  ADD COLUMN IF NOT EXISTS kick_distance INTEGER; -- For FG: distance of attempt; For Punt: net yards

-- Return plays (Kick Return, Punt Return)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS returner_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS return_yards INTEGER,
  ADD COLUMN IF NOT EXISTS is_fair_catch BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_touchback BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_muffed BOOLEAN DEFAULT FALSE;

-- Punt specific
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS punter_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS punt_type TEXT CHECK (punt_type IN (
    'standard', 'directional_left', 'directional_right', 'pooch', 'rugby', 'sky'
  )),
  ADD COLUMN IF NOT EXISTS gunner_tackle_id UUID REFERENCES players(id) ON DELETE SET NULL; -- Which gunner made the tackle on coverage

-- Kickoff specific
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS kickoff_type TEXT CHECK (kickoff_type IN (
    'deep_center', 'deep_left', 'deep_right',
    'squib_center', 'squib_left', 'squib_right',
    'onside_center', 'onside_left', 'onside_right'
  ));

-- Long snapper tracking (Punt, FG, PAT)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS long_snapper_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS snap_quality TEXT CHECK (snap_quality IN ('good', 'low', 'high', 'wide', 'fumbled'));

-- Holder tracking (FG/PAT)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS holder_id UUID REFERENCES players(id) ON DELETE SET NULL;

-- Coverage tracking - who made tackle on your coverage team
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS coverage_tackler_id UUID REFERENCES players(id) ON DELETE SET NULL;

-- Penalty tracking (useful for special teams)
ALTER TABLE play_instances
  ADD COLUMN IF NOT EXISTS penalty_on_play BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS penalty_type TEXT,
  ADD COLUMN IF NOT EXISTS penalty_yards INTEGER;

-- Create indexes for special teams queries
CREATE INDEX IF NOT EXISTS idx_play_instances_st_unit ON play_instances(special_teams_unit);
CREATE INDEX IF NOT EXISTS idx_play_instances_kicker ON play_instances(kicker_id);
CREATE INDEX IF NOT EXISTS idx_play_instances_returner ON play_instances(returner_id);
CREATE INDEX IF NOT EXISTS idx_play_instances_punter ON play_instances(punter_id);

-- Add comment for documentation
COMMENT ON COLUMN play_instances.special_teams_unit IS 'Type of special teams play: kickoff, kick_return, punt, punt_return, field_goal, pat';
COMMENT ON COLUMN play_instances.kick_result IS 'Outcome of kicking play: made, missed, blocked, touchback, fair_catch, returned, out_of_bounds, onside_recovered, onside_lost, fake_success, fake_fail, muffed, downed';
COMMENT ON COLUMN play_instances.kick_distance IS 'For FG: distance of attempt in yards. For Punt: gross punt distance';
COMMENT ON COLUMN play_instances.return_yards IS 'Yards gained on return (kick return or punt return)';
COMMENT ON COLUMN play_instances.gunner_tackle_id IS 'Player who made the tackle on punt coverage (typically a gunner)';
COMMENT ON COLUMN play_instances.coverage_tackler_id IS 'Player who made the tackle on kickoff coverage';
COMMENT ON COLUMN play_instances.snap_quality IS 'Quality of long snap: good, low, high, wide, or fumbled';
