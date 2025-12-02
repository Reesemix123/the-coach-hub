-- Migration 057: Allow platform admins to view all profiles
-- This fixes the organizations browser which needs to query all profiles
--
-- NOTE: We use (SELECT is_platform_admin FROM profiles WHERE id = auth.uid())
-- with a direct column check to avoid circular reference issues.

-- First, drop the problematic policies if they exist
DROP POLICY IF EXISTS "Platform admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Platform admins can update all profiles" ON profiles;

-- Platform admins can view all profiles
-- Uses a subquery that checks the current user's admin status
CREATE POLICY "Platform admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    -- Either viewing own profile OR current user is platform admin
    id = auth.uid()
    OR
    (SELECT is_platform_admin FROM profiles WHERE id = auth.uid()) = true
  );

-- Platform admins can update any profile (for admin actions)
CREATE POLICY "Platform admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    -- Either updating own profile OR current user is platform admin
    id = auth.uid()
    OR
    (SELECT is_platform_admin FROM profiles WHERE id = auth.uid()) = true
  );
