-- Migration: Update Prep Task Templates
-- Align tasks with Quick Actions and game preparation workflow

-- Clear existing task templates
DELETE FROM prep_task_templates;

-- Insert new task templates aligned with game prep workflow
INSERT INTO prep_task_templates (title, description, priority, linked_station, sort_order) VALUES
-- Must Do (Priority 1)
('Analyze opponent film', 'Watch and tag opponent game film to identify tendencies', 1, 'film_review', 1),
('Review your last game film', 'Analyze your team''s performance from the previous game', 1, 'film_review', 2),
('Create game plan', 'Select plays for offense, defense, and special teams', 1, 'game_plan', 3),

-- Should Do (Priority 2)
('Plan practices', 'Script practice schedules for the week', 2, 'practice', 4),
('Evaluate roster', 'Check player availability, injuries, and depth chart', 2, 'personnel', 5),
('Answer strategic questions', 'Complete the strategic questions for this game', 2, 'game_plan', 6),
('Print QB wristband', 'Generate and print the play call wristband', 2, 'game_plan', 7),
('Review playbook plays', 'Ensure game plan plays have complete diagrams', 2, 'playbook', 8),

-- Nice to Have (Priority 3)
('Add coach notes', 'Document any additional notes for this game', 3, 'game_plan', 9);
