-- Migration 165: Add 'sideline' plan tier, update plan_tier CHECK constraint
ALTER TABLE team_communication_plans
DROP CONSTRAINT IF EXISTS team_communication_plans_plan_tier_check;

ALTER TABLE team_communication_plans
ADD CONSTRAINT team_communication_plans_plan_tier_check
CHECK (plan_tier IN ('sideline', 'rookie', 'varsity', 'all_conference', 'all_state'));

COMMENT ON COLUMN team_communication_plans.max_parents IS
  'Maximum parents allowed on this plan. NULL = unlimited (all_state). 20 = rookie/sideline, 40 = varsity, 60 = all_conference.';

COMMENT ON COLUMN team_communication_plans.plan_tier IS
  'Plan tier: sideline (20 parents, free), rookie (20 parents), varsity (40), all_conference (60), all_state (unlimited)';
