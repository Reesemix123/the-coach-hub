-- ============================================================================
-- Diagnostic Script: Check player_participation Table and RLS Policies
-- ============================================================================

-- 1. Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'player_participation'
) as table_exists;

-- 2. Check if RLS is enabled
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'player_participation';

-- 3. List all RLS policies on the table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'player_participation';

-- 4. Check current user authentication
SELECT
  auth.uid() as current_user_id,
  auth.jwt() as current_jwt;

-- 5. Test query: Can you see your teams?
SELECT
  id,
  name,
  user_id
FROM teams
WHERE user_id = auth.uid()
LIMIT 5;

-- 6. Count existing player_participation records
SELECT COUNT(*) as total_participations
FROM player_participation;
