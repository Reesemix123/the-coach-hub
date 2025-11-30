-- Migration: Setup/Counter Play Relationship System
-- Purpose: Track relationships between "setup" plays and their "counter" plays
-- Helps coaches know when a counter play is "ripe" based on defender behavior

-- Play relationships table - links setup plays to counter plays
CREATE TABLE IF NOT EXISTS play_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  setup_play_code TEXT NOT NULL,       -- References playbook_plays.play_code
  counter_play_code TEXT NOT NULL,     -- References playbook_plays.play_code
  key_position TEXT,                   -- 'MLB', 'SS', 'WILL', etc. - the defender to watch
  key_indicator TEXT,                  -- 'cheating_inside', 'biting_on_motion', etc.
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_setup_play FOREIGN KEY (setup_play_code) REFERENCES playbook_plays(play_code) ON DELETE CASCADE,
  CONSTRAINT fk_counter_play FOREIGN KEY (counter_play_code) REFERENCES playbook_plays(play_code) ON DELETE CASCADE,
  UNIQUE(team_id, setup_play_code, counter_play_code)
);

-- Check constraint for valid key positions
ALTER TABLE play_relationships
  ADD CONSTRAINT play_relationships_key_position_check
  CHECK (key_position IS NULL OR key_position IN (
    'MLB', 'WILL', 'SAM', 'ILB',
    'SS', 'FS', 'CB1', 'CB2', 'NB',
    'NT', '3-tech', '5-tech', 'DE', 'EDGE',
    'OLB'
  ));

-- Check constraint for valid key indicators
ALTER TABLE play_relationships
  ADD CONSTRAINT play_relationships_key_indicator_check
  CHECK (key_indicator IS NULL OR key_indicator IN (
    'cheating_inside',
    'cheating_outside',
    'biting_motion',
    'jumping_routes',
    'run_fit_aggressive',
    'deep_alignment',
    'soft_coverage',
    'press_alignment',
    'spy_qb',
    'robber_technique'
  ));

-- Track counter readiness status per game plan
CREATE TABLE IF NOT EXISTS game_plan_counter_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_plan_id UUID NOT NULL REFERENCES game_plans(id) ON DELETE CASCADE,
  relationship_id UUID NOT NULL REFERENCES play_relationships(id) ON DELETE CASCADE,
  is_ready BOOLEAN DEFAULT false,      -- Has coach marked counter as "ripe"?
  marked_at TIMESTAMPTZ,               -- When was it marked ready
  marked_by UUID REFERENCES auth.users(id),
  notes TEXT,
  UNIQUE(game_plan_id, relationship_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_play_relationships_team ON play_relationships(team_id);
CREATE INDEX IF NOT EXISTS idx_play_relationships_setup ON play_relationships(setup_play_code);
CREATE INDEX IF NOT EXISTS idx_play_relationships_counter ON play_relationships(counter_play_code);
CREATE INDEX IF NOT EXISTS idx_game_plan_counter_status_plan ON game_plan_counter_status(game_plan_id);
CREATE INDEX IF NOT EXISTS idx_game_plan_counter_status_ready ON game_plan_counter_status(game_plan_id, is_ready);

-- Updated at trigger for play_relationships
CREATE OR REPLACE FUNCTION update_play_relationships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_play_relationships_updated_at
  BEFORE UPDATE ON play_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_play_relationships_updated_at();

-- Row Level Security Policies
ALTER TABLE play_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_plan_counter_status ENABLE ROW LEVEL SECURITY;

-- Play Relationships RLS Policies
-- SELECT: Users can view relationships for teams they're a member of
CREATE POLICY play_relationships_select ON play_relationships
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- INSERT: Users can create relationships for teams they're a member of
CREATE POLICY play_relationships_insert ON play_relationships
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- UPDATE: Users can update relationships for teams they're a member of
CREATE POLICY play_relationships_update ON play_relationships
  FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- DELETE: Users can delete relationships for teams they're a member of
CREATE POLICY play_relationships_delete ON play_relationships
  FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- Game Plan Counter Status RLS Policies (inherit from game plan)
-- SELECT: Users can view counter status if they can view the parent game plan
CREATE POLICY game_plan_counter_status_select ON game_plan_counter_status
  FOR SELECT
  USING (
    game_plan_id IN (
      SELECT id FROM game_plans WHERE team_id IN (
        SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
        UNION
        SELECT id FROM teams WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT: Users can add counter status to game plans they have access to
CREATE POLICY game_plan_counter_status_insert ON game_plan_counter_status
  FOR INSERT
  WITH CHECK (
    game_plan_id IN (
      SELECT id FROM game_plans WHERE team_id IN (
        SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
        UNION
        SELECT id FROM teams WHERE user_id = auth.uid()
      )
    )
  );

-- UPDATE: Users can update counter status in game plans they have access to
CREATE POLICY game_plan_counter_status_update ON game_plan_counter_status
  FOR UPDATE
  USING (
    game_plan_id IN (
      SELECT id FROM game_plans WHERE team_id IN (
        SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
        UNION
        SELECT id FROM teams WHERE user_id = auth.uid()
      )
    )
  );

-- DELETE: Users can delete counter status from game plans they have access to
CREATE POLICY game_plan_counter_status_delete ON game_plan_counter_status
  FOR DELETE
  USING (
    game_plan_id IN (
      SELECT id FROM game_plans WHERE team_id IN (
        SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
        UNION
        SELECT id FROM teams WHERE user_id = auth.uid()
      )
    )
  );

-- Comments
COMMENT ON TABLE play_relationships IS 'Links setup plays to counter plays with key position/indicator to watch';
COMMENT ON TABLE game_plan_counter_status IS 'Tracks when a counter play is marked as "ready" for a specific game plan';
COMMENT ON COLUMN play_relationships.key_position IS 'Defensive position to watch for the setup tell';
COMMENT ON COLUMN play_relationships.key_indicator IS 'What behavior indicates the counter is ripe (e.g., cheating_inside)';
