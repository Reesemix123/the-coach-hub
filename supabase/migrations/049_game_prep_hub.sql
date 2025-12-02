-- Migration: Game Prep Hub
-- Creates tables for game preparation planning, insights, prompts, and tasks

-- ============================================
-- PREP_PLANS - Main prep plan per game
-- ============================================
CREATE TABLE prep_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,

  -- Overall status
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'ready')),

  -- Progress tracking (denormalized for quick access)
  overall_readiness INTEGER DEFAULT 0 CHECK (overall_readiness BETWEEN 0 AND 100),
  insights_reviewed INTEGER DEFAULT 0,
  insights_total INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_total INTEGER DEFAULT 0,
  prompts_answered INTEGER DEFAULT 0,
  prompts_total INTEGER DEFAULT 0,

  -- Coach notes (free-form by category)
  general_notes TEXT,
  offensive_notes TEXT,
  defensive_notes TEXT,
  special_teams_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, game_id)
);

-- ============================================
-- PREP_INSIGHTS - Auto-generated insights from film
-- ============================================
CREATE TABLE prep_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_plan_id UUID NOT NULL REFERENCES prep_plans(id) ON DELETE CASCADE,

  -- Categorization
  category TEXT NOT NULL CHECK (category IN (
    'opponent_tendency',
    'matchup_advantage',
    'matchup_concern',
    'own_strength',
    'own_weakness',
    'situational',
    'personnel'
  )),
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 3), -- 1=critical, 2=important, 3=info

  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data_json JSONB, -- Supporting stats (e.g., percentages, play counts)

  -- Coach interaction
  is_reviewed BOOLEAN DEFAULT false,
  coach_notes TEXT,

  -- Suggested action
  suggested_action TEXT,
  linked_station TEXT CHECK (linked_station IN (
    'film_review',
    'game_plan',
    'practice',
    'personnel',
    'playbook'
  )),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PREP_PROMPTS - Guided questions for coach
-- ============================================
CREATE TABLE prep_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_plan_id UUID NOT NULL REFERENCES prep_plans(id) ON DELETE CASCADE,

  -- Categorization
  category TEXT NOT NULL CHECK (category IN (
    'offensive_identity',
    'defensive_identity',
    'special_teams_identity',
    'situational',
    'personnel',
    'adjustments'
  )),
  question_text TEXT NOT NULL,
  help_text TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Response configuration
  response_type TEXT DEFAULT 'text' CHECK (response_type IN (
    'text',
    'single_choice',
    'multi_choice',
    'play_select'
  )),
  response_options JSONB, -- For choice types: ["Option 1", "Option 2", ...]

  -- Coach response
  response_text TEXT,
  response_plays JSONB, -- For play_select: ["P-001", "P-015", ...]
  responded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PREP_TASKS - Checklist items linked to stations
-- ============================================
CREATE TABLE prep_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_plan_id UUID NOT NULL REFERENCES prep_plans(id) ON DELETE CASCADE,

  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 2 CHECK (priority BETWEEN 1 AND 3), -- 1=must, 2=should, 3=nice
  sort_order INTEGER DEFAULT 0,

  -- Station linkage
  linked_station TEXT NOT NULL CHECK (linked_station IN (
    'film_review',
    'game_plan',
    'practice',
    'personnel',
    'playbook'
  )),
  link_href TEXT, -- Deep link path (e.g., /teams/{teamId}/film?game={gameId})

  -- Completion
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,

  -- Source tracking
  source_type TEXT DEFAULT 'template' CHECK (source_type IN ('template', 'auto', 'manual')),
  source_insight_id UUID REFERENCES prep_insights(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PREP_PROMPT_TEMPLATES - Reusable question templates
-- ============================================
CREATE TABLE prep_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  category TEXT NOT NULL CHECK (category IN (
    'offensive_identity',
    'defensive_identity',
    'special_teams_identity',
    'situational',
    'personnel',
    'adjustments'
  )),
  question_text TEXT NOT NULL,
  help_text TEXT,
  response_type TEXT DEFAULT 'text' CHECK (response_type IN (
    'text',
    'single_choice',
    'multi_choice',
    'play_select'
  )),
  response_options JSONB,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- ============================================
-- PREP_TASK_TEMPLATES - Default checklist items
-- ============================================
CREATE TABLE prep_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  sort_order INTEGER DEFAULT 0,
  linked_station TEXT NOT NULL CHECK (linked_station IN (
    'film_review',
    'game_plan',
    'practice',
    'personnel',
    'playbook'
  )),
  is_active BOOLEAN DEFAULT true
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_prep_plans_team_game ON prep_plans(team_id, game_id);
CREATE INDEX idx_prep_insights_plan ON prep_insights(prep_plan_id);
CREATE INDEX idx_prep_insights_priority ON prep_insights(prep_plan_id, priority);
CREATE INDEX idx_prep_prompts_plan ON prep_prompts(prep_plan_id);
CREATE INDEX idx_prep_tasks_plan ON prep_tasks(prep_plan_id);
CREATE INDEX idx_prep_tasks_station ON prep_tasks(prep_plan_id, linked_station);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_prep_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prep_plans_updated_at
  BEFORE UPDATE ON prep_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_prep_plan_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE prep_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_task_templates ENABLE ROW LEVEL SECURITY;

-- Prep Plans: Users can access plans for their teams
CREATE POLICY "Users can view prep plans for their teams"
  ON prep_plans FOR SELECT
  USING (team_id IN (
    SELECT id FROM teams WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert prep plans for their teams"
  ON prep_plans FOR INSERT
  WITH CHECK (team_id IN (
    SELECT id FROM teams WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update prep plans for their teams"
  ON prep_plans FOR UPDATE
  USING (team_id IN (
    SELECT id FROM teams WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete prep plans for their teams"
  ON prep_plans FOR DELETE
  USING (team_id IN (
    SELECT id FROM teams WHERE user_id = auth.uid()
  ));

-- Prep Insights: Access through prep_plan ownership
CREATE POLICY "Users can view insights for their prep plans"
  ON prep_insights FOR SELECT
  USING (prep_plan_id IN (
    SELECT pp.id FROM prep_plans pp
    JOIN teams t ON pp.team_id = t.id
    WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert insights for their prep plans"
  ON prep_insights FOR INSERT
  WITH CHECK (prep_plan_id IN (
    SELECT pp.id FROM prep_plans pp
    JOIN teams t ON pp.team_id = t.id
    WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can update insights for their prep plans"
  ON prep_insights FOR UPDATE
  USING (prep_plan_id IN (
    SELECT pp.id FROM prep_plans pp
    JOIN teams t ON pp.team_id = t.id
    WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete insights for their prep plans"
  ON prep_insights FOR DELETE
  USING (prep_plan_id IN (
    SELECT pp.id FROM prep_plans pp
    JOIN teams t ON pp.team_id = t.id
    WHERE t.user_id = auth.uid()
  ));

-- Prep Prompts: Access through prep_plan ownership
CREATE POLICY "Users can view prompts for their prep plans"
  ON prep_prompts FOR SELECT
  USING (prep_plan_id IN (
    SELECT pp.id FROM prep_plans pp
    JOIN teams t ON pp.team_id = t.id
    WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert prompts for their prep plans"
  ON prep_prompts FOR INSERT
  WITH CHECK (prep_plan_id IN (
    SELECT pp.id FROM prep_plans pp
    JOIN teams t ON pp.team_id = t.id
    WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can update prompts for their prep plans"
  ON prep_prompts FOR UPDATE
  USING (prep_plan_id IN (
    SELECT pp.id FROM prep_plans pp
    JOIN teams t ON pp.team_id = t.id
    WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete prompts for their prep plans"
  ON prep_prompts FOR DELETE
  USING (prep_plan_id IN (
    SELECT pp.id FROM prep_plans pp
    JOIN teams t ON pp.team_id = t.id
    WHERE t.user_id = auth.uid()
  ));

-- Prep Tasks: Access through prep_plan ownership
CREATE POLICY "Users can view tasks for their prep plans"
  ON prep_tasks FOR SELECT
  USING (prep_plan_id IN (
    SELECT pp.id FROM prep_plans pp
    JOIN teams t ON pp.team_id = t.id
    WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert tasks for their prep plans"
  ON prep_tasks FOR INSERT
  WITH CHECK (prep_plan_id IN (
    SELECT pp.id FROM prep_plans pp
    JOIN teams t ON pp.team_id = t.id
    WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can update tasks for their prep plans"
  ON prep_tasks FOR UPDATE
  USING (prep_plan_id IN (
    SELECT pp.id FROM prep_plans pp
    JOIN teams t ON pp.team_id = t.id
    WHERE t.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete tasks for their prep plans"
  ON prep_tasks FOR DELETE
  USING (prep_plan_id IN (
    SELECT pp.id FROM prep_plans pp
    JOIN teams t ON pp.team_id = t.id
    WHERE t.user_id = auth.uid()
  ));

-- Templates: All authenticated users can read
CREATE POLICY "Authenticated users can view prompt templates"
  ON prep_prompt_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view task templates"
  ON prep_task_templates FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- SEED DATA: Prompt Templates
-- ============================================
INSERT INTO prep_prompt_templates (category, question_text, help_text, response_type, response_options, sort_order) VALUES
-- Offensive Identity
('offensive_identity', 'What is our primary offensive identity this week?',
 'Consider what style of play best matches our strengths against this opponent.',
 'single_choice',
 '["Power Run Game", "Zone Run Scheme", "Balanced Attack", "Pass-First Spread", "Play Action Heavy", "Option/RPO Based"]'::jsonb,
 1),
('offensive_identity', 'What are our 3 must-execute plays?',
 'Select the plays that are critical to our game plan success.',
 'play_select', NULL, 2),
('offensive_identity', 'What tempo do we want to play at?',
 'Consider conditioning, opponent style, and game situation needs.',
 'single_choice',
 '["Huddle (Control Pace)", "No Huddle (Fast)", "Situational (Mix)", "Sugar Huddle (Quick)"]'::jsonb,
 3),

-- Defensive Identity
('defensive_identity', 'What is our primary defensive priority?',
 'What is the #1 thing we need to stop to win this game?',
 'single_choice',
 '["Stop the Run", "Limit Big Plays", "Force Turnovers", "Control Clock", "Pressure QB"]'::jsonb,
 1),
('defensive_identity', 'What base coverage will we play most?',
 'Consider opponent passing tendencies and our personnel.',
 'single_choice',
 '["Cover 3", "Cover 2", "Cover 4/Quarters", "Man Free", "Cover 1 Robber", "Pattern Match"]'::jsonb,
 2),
('defensive_identity', 'When will we bring pressure?',
 'Define our blitz philosophy for this game.',
 'multi_choice',
 '["3rd & Long", "Red Zone", "2-Minute Situations", "Early Downs", "Based on Formation", "Rarely"]'::jsonb,
 3),

-- Special Teams Identity
('special_teams_identity', 'What is our kickoff strategy?',
 'Consider field position goals and opponent return threats.',
 'single_choice',
 '["Kick Deep", "Directional Kicks", "Pooch/Sky Kicks", "Onside Situations Only", "Vary by Situation"]'::jsonb,
 1),
('special_teams_identity', 'What is our punt philosophy?',
 'Balance between hangtime, distance, and directional punts.',
 'single_choice',
 '["Maximum Distance", "Hangtime Focus", "Directional/Coffin Corner", "Rugby Style", "Situational Mix"]'::jsonb,
 2),

-- Situational
('situational', 'What is our red zone offensive plan?',
 'How will we score when we get inside the 20?',
 'text', NULL, 1),
('situational', 'How do we handle 3rd & long?',
 'What is our approach when facing 3rd & 7+?',
 'text', NULL, 2),
('situational', 'What is our 2-minute drill philosophy?',
 'End of half and end of game situations.',
 'text', NULL, 3),
('situational', 'What are our goal line plays?',
 'Inside the 3 yard line.',
 'play_select', NULL, 4),

-- Personnel
('personnel', 'Who are our X-factor players to feature?',
 'Which 2-3 players can we build plays around this week?',
 'text', NULL, 1),
('personnel', 'What matchups do we want to exploit?',
 'Identify specific player-vs-player advantages.',
 'text', NULL, 2),
('personnel', 'Any injury/availability concerns affecting game plan?',
 'Note players who are limited or out.',
 'text', NULL, 3),

-- Adjustments
('adjustments', 'What halftime adjustments might we make?',
 'Anticipate potential counters if our initial plan struggles.',
 'text', NULL, 1),
('adjustments', 'What are our constraint plays?',
 'Plays to run when defense overplays our base concepts.',
 'play_select', NULL, 2);

-- ============================================
-- SEED DATA: Task Templates
-- ============================================
INSERT INTO prep_task_templates (title, description, priority, linked_station, sort_order) VALUES
-- Must-do tasks (Priority 1)
('Scout opponent film', 'Review available game film on upcoming opponent', 1, 'film_review', 1),
('Build game plan', 'Select plays for each situation category', 1, 'game_plan', 2),
('Script first 15 plays', 'Plan your opening offensive series', 1, 'game_plan', 3),
('Review own recent film', 'Analyze your team''s performance in recent games', 1, 'film_review', 4),

-- Should-do tasks (Priority 2)
('Check opponent tendencies', 'Note down/distance and formation tendencies', 2, 'film_review', 5),
('Practice red zone plays', 'Ensure red zone plays are repped in practice', 2, 'practice', 6),
('Verify depth chart', 'Confirm starters and backup plan', 2, 'personnel', 7),
('Review special teams assignments', 'Confirm ST personnel and responsibilities', 2, 'game_plan', 8),
('Prepare wristband/call sheet', 'Print and organize play calling aids', 2, 'game_plan', 9),

-- Nice-to-do tasks (Priority 3)
('Watch additional opponent games', 'Get more data points on opponent', 3, 'film_review', 10),
('Update playbook with new wrinkles', 'Add any new plays or variations', 3, 'playbook', 11),
('Review weather forecast', 'Adjust game plan for conditions if needed', 3, 'game_plan', 12);

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE prep_plans IS 'Main game preparation plan - one per game per team';
COMMENT ON TABLE prep_insights IS 'Auto-generated or manual insights from film analysis';
COMMENT ON TABLE prep_prompts IS 'Guided questions for coaches to think through strategy';
COMMENT ON TABLE prep_tasks IS 'Checklist items linked to specific preparation stations';
COMMENT ON TABLE prep_prompt_templates IS 'Reusable question templates for new prep plans';
COMMENT ON TABLE prep_task_templates IS 'Default checklist items for new prep plans';
