-- Migration 053: Backfill Profiles and Set Platform Admin
--
-- This migration ensures:
-- 1. All auth.users have a corresponding profiles row
-- 2. The first organization owner is marked as platform admin
--
-- Safe to run multiple times (idempotent)

-- ============================================================================
-- Step 1: Backfill missing profiles for existing auth users
-- ============================================================================

-- Insert profiles for any auth.users that don't have one
-- Note: profiles table may not have created_at/updated_at columns
INSERT INTO profiles (id, email)
SELECT
  au.id,
  au.email
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Step 2: Set the first organization owner as platform admin
-- (This is a reasonable default - you own the platform)
-- ============================================================================

-- Update the owner of the first organization to be a platform admin
UPDATE profiles p
SET is_platform_admin = true
WHERE p.id IN (
  SELECT owner_user_id
  FROM organizations
  ORDER BY created_at ASC
  LIMIT 1
)
AND (p.is_platform_admin IS NULL OR p.is_platform_admin = false);

-- ============================================================================
-- Step 3: Verify results (optional - comment out if not needed)
-- ============================================================================

-- Report how many profiles we have now
DO $$
DECLARE
  profile_count INT;
  admin_count INT;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM profiles;
  SELECT COUNT(*) INTO admin_count FROM profiles WHERE is_platform_admin = true;

  RAISE NOTICE 'Migration 053 complete: % profiles total, % platform admins', profile_count, admin_count;
END $$;
