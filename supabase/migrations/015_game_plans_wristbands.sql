-- Migration: Game Plans and Wristband System
-- Purpose: Allow coaches to create game-specific play call sheets for QB wristbands and clipboard reference

-- Game Plans table (collection of plays for a specific game or situation)
CREATE TABLE IF NOT EXISTS game_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL, -- optional: link to specific game
  name VARCHAR(255) NOT NULL, -- e.g., "Week 5 vs Eagles", "Base Offense"
  description TEXT,
  wristband_format VARCHAR(50) DEFAULT '3x5' CHECK (wristband_format IN ('3x5', '4x6', '2col')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Game Plan Plays (plays selected for a game plan with assigned call numbers)
CREATE TABLE IF NOT EXISTS game_plan_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_plan_id UUID NOT NULL REFERENCES game_plans(id) ON DELETE CASCADE,
  play_code VARCHAR(50) NOT NULL REFERENCES playbook_plays(play_code),
  call_number INTEGER NOT NULL, -- the number on the wristband (e.g., 1-50)
  sort_order INTEGER NOT NULL, -- ordering within the game plan
  notes TEXT, -- optional notes for the coach
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(game_plan_id, call_number), -- each call number unique within a game plan
  UNIQUE(game_plan_id, play_code) -- each play appears once per game plan
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_plans_team ON game_plans(team_id);
CREATE INDEX IF NOT EXISTS idx_game_plans_game ON game_plans(game_id);
CREATE INDEX IF NOT EXISTS idx_game_plan_plays_game_plan ON game_plan_plays(game_plan_id);
CREATE INDEX IF NOT EXISTS idx_game_plan_plays_sort ON game_plan_plays(game_plan_id, sort_order);

-- Updated at trigger for game_plans
CREATE OR REPLACE FUNCTION update_game_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_game_plans_updated_at
  BEFORE UPDATE ON game_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_game_plans_updated_at();

-- Row Level Security Policies
ALTER TABLE game_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_plan_plays ENABLE ROW LEVEL SECURITY;

-- Game Plans RLS Policies
-- SELECT: Users can view game plans for teams they're a member of
CREATE POLICY game_plans_select ON game_plans
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- INSERT: Users can create game plans for teams they're a member of
CREATE POLICY game_plans_insert ON game_plans
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- UPDATE: Users can update game plans for teams they're a member of
CREATE POLICY game_plans_update ON game_plans
  FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- DELETE: Users can delete game plans for teams they're a member of
CREATE POLICY game_plans_delete ON game_plans
  FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
      UNION
      SELECT id FROM teams WHERE user_id = auth.uid()
    )
  );

-- Game Plan Plays RLS Policies (inherit from game plan)
-- SELECT: Users can view game plan plays if they can view the parent game plan
CREATE POLICY game_plan_plays_select ON game_plan_plays
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

-- INSERT: Users can add plays to game plans they have access to
CREATE POLICY game_plan_plays_insert ON game_plan_plays
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

-- UPDATE: Users can update plays in game plans they have access to
CREATE POLICY game_plan_plays_update ON game_plan_plays
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

-- DELETE: Users can delete plays from game plans they have access to
CREATE POLICY game_plan_plays_delete ON game_plan_plays
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
