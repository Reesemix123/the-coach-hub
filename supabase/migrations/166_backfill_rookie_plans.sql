-- Migration 166: Backfill rookie communication plans for teams without one
-- Run AFTER deployment of the new plan-helpers code
-- This is a one-time backfill — new teams get rookie plans automatically via activate-rookie API

-- Insert a rookie plan for every team that doesn't already have an active communication plan
INSERT INTO team_communication_plans (
  team_id,
  purchased_by,
  purchaser_role,
  stripe_payment_id,
  plan_tier,
  max_parents,
  max_team_videos,
  team_videos_used,
  includes_reports,
  activated_at,
  expires_at,
  status
)
SELECT
  t.id,
  t.user_id,
  'owner',
  'free_tier',
  'rookie',
  20,
  0,    -- free tier: no video sharing
  0,
  false, -- free tier: no reports
  NOW(),
  '2099-12-31T23:59:59.000Z',
  'active'
FROM teams t
WHERE NOT EXISTS (
  SELECT 1
  FROM team_communication_plans tcp
  WHERE tcp.team_id = t.id
    AND tcp.status = 'active'
);
