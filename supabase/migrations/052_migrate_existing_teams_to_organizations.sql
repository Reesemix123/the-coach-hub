-- Migration 052: Migrate Existing Teams to Organizations
-- Creates organizations for existing team owners and links teams
--
-- This migration is IDEMPOTENT - safe to run multiple times
-- It only affects teams that don't already have an organization_id

-- ============================================================================
-- Step 1: Create organizations for existing team owners
-- Each unique team owner gets one organization
-- ============================================================================

-- Create organizations for users who own teams but don't have an organization yet
INSERT INTO organizations (id, name, owner_user_id, status, created_at)
SELECT
  gen_random_uuid() AS id,
  COALESCE(
    -- Try to build org name from team names
    (SELECT name FROM teams t2 WHERE t2.user_id = t.user_id LIMIT 1) || ' Organization',
    -- Fallback to profile name
    (SELECT email FROM profiles p WHERE p.id = t.user_id) || '''s Organization',
    -- Final fallback
    'My Organization'
  ) AS name,
  t.user_id AS owner_user_id,
  'active' AS status,
  MIN(t.created_at) AS created_at  -- Use earliest team creation date
FROM teams t
WHERE t.user_id IS NOT NULL
  AND t.organization_id IS NULL  -- Only teams without an org
  AND NOT EXISTS (
    -- Don't create if user already owns an organization
    SELECT 1 FROM organizations o WHERE o.owner_user_id = t.user_id
  )
GROUP BY t.user_id;

-- ============================================================================
-- Step 2: Link teams to their owner's organization
-- ============================================================================

UPDATE teams t
SET organization_id = (
  SELECT o.id
  FROM organizations o
  WHERE o.owner_user_id = t.user_id
  LIMIT 1
)
WHERE t.organization_id IS NULL
  AND t.user_id IS NOT NULL;

-- ============================================================================
-- Step 3: Link profiles to their organization
-- (For team owners)
-- ============================================================================

UPDATE profiles p
SET organization_id = (
  SELECT o.id
  FROM organizations o
  WHERE o.owner_user_id = p.id
  LIMIT 1
)
WHERE p.organization_id IS NULL
  AND EXISTS (
    SELECT 1 FROM organizations o WHERE o.owner_user_id = p.id
  );

-- ============================================================================
-- Step 4: Link team members' profiles to the team's organization
-- (For non-owners who are members of teams)
-- ============================================================================

UPDATE profiles p
SET organization_id = (
  SELECT t.organization_id
  FROM team_memberships tm
  JOIN teams t ON t.id = tm.team_id
  WHERE tm.user_id = p.id
    AND tm.is_active = true
    AND t.organization_id IS NOT NULL
  LIMIT 1
)
WHERE p.organization_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM team_memberships tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.user_id = p.id
      AND tm.is_active = true
      AND t.organization_id IS NOT NULL
  );

-- ============================================================================
-- Step 5: Create default subscriptions for existing teams
-- Status = 'waived' for grandfathered teams
-- ============================================================================

INSERT INTO subscriptions (
  id,
  team_id,
  tier,
  status,
  billing_waived,
  billing_waived_reason,
  created_at
)
SELECT
  gen_random_uuid() AS id,
  t.id AS team_id,
  COALESCE(tac.tier, 'hs_basic') AS tier,  -- Use existing tier config or default
  'waived' AS status,  -- Grandfathered teams don't pay
  true AS billing_waived,
  'Grandfathered - existing team before billing system' AS billing_waived_reason,
  t.created_at AS created_at
FROM teams t
LEFT JOIN team_analytics_config tac ON tac.team_id = t.id
WHERE NOT EXISTS (
  -- Don't create if subscription already exists
  SELECT 1 FROM subscriptions s WHERE s.team_id = t.id
);

-- ============================================================================
-- Step 6: Create initial AI credits period for existing teams
-- (Only for teams with AI-enabled tiers)
-- ============================================================================

INSERT INTO ai_credits (
  id,
  team_id,
  credits_allowed,
  credits_used,
  period_start,
  period_end,
  created_at
)
SELECT
  gen_random_uuid() AS id,
  t.id AS team_id,
  -- Credits based on tier
  CASE
    WHEN COALESCE(tac.tier, 'hs_basic') = 'ai_powered' THEN 2000
    WHEN COALESCE(tac.tier, 'hs_basic') = 'hs_advanced' THEN 500
    WHEN COALESCE(tac.tier, 'hs_basic') = 'hs_basic' THEN 100
    ELSE 0
  END AS credits_allowed,
  0 AS credits_used,
  DATE_TRUNC('month', NOW()) AS period_start,  -- Start of current month
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month' AS period_end,  -- End of current month
  NOW() AS created_at
FROM teams t
LEFT JOIN team_analytics_config tac ON tac.team_id = t.id
WHERE NOT EXISTS (
  -- Don't create if AI credits record already exists for this period
  SELECT 1 FROM ai_credits ac
  WHERE ac.team_id = t.id
    AND ac.period_start = DATE_TRUNC('month', NOW())
);

-- ============================================================================
-- Step 7: Log the migration as an audit event
-- ============================================================================

INSERT INTO audit_logs (
  action,
  target_type,
  metadata
)
SELECT
  'system.migration.teams_to_organizations',
  'system',
  jsonb_build_object(
    'migration', '052_migrate_existing_teams_to_organizations',
    'organizations_created', (SELECT COUNT(*) FROM organizations),
    'teams_linked', (SELECT COUNT(*) FROM teams WHERE organization_id IS NOT NULL),
    'subscriptions_created', (SELECT COUNT(*) FROM subscriptions WHERE status = 'waived'),
    'ai_credits_created', (SELECT COUNT(*) FROM ai_credits),
    'executed_at', NOW()
  )
WHERE NOT EXISTS (
  -- Only log once
  SELECT 1 FROM audit_logs
  WHERE action = 'system.migration.teams_to_organizations'
);

-- ============================================================================
-- Verification queries (run these to check results)
-- ============================================================================

-- Check for orphaned teams (teams without organization)
-- SELECT id, name, user_id FROM teams WHERE organization_id IS NULL;

-- Check organizations created
-- SELECT * FROM organizations ORDER BY created_at DESC;

-- Check subscriptions
-- SELECT s.*, t.name as team_name FROM subscriptions s JOIN teams t ON t.id = s.team_id;

-- Check AI credits
-- SELECT ac.*, t.name as team_name FROM ai_credits ac JOIN teams t ON t.id = ac.team_id;
