-- ============================================================================
-- Quick Fix: Player Participation RLS Policy
-- ============================================================================
-- This fixes the RLS policy error you're seeing when saving tagged plays
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their team's player participations" ON player_participation;
DROP POLICY IF EXISTS "Users can create player participations for their teams" ON player_participation;
DROP POLICY IF EXISTS "Users can update their team's player participations" ON player_participation;
DROP POLICY IF EXISTS "Users can delete their team's player participations" ON player_participation;

-- Recreate with proper policies
-- Policy: Users can see participations for their own teams
CREATE POLICY "Users can view their team's player participations"
  ON player_participation FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = player_participation.team_id
        AND teams.user_id = auth.uid()
    )
  );

-- Policy: Users can insert participations for their own teams
CREATE POLICY "Users can create player participations for their teams"
  ON player_participation FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_id
        AND teams.user_id = auth.uid()
    )
  );

-- Policy: Users can update participations for their own teams
CREATE POLICY "Users can update their team's player participations"
  ON player_participation FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = player_participation.team_id
        AND teams.user_id = auth.uid()
    )
  );

-- Policy: Users can delete participations for their own teams
CREATE POLICY "Users can delete their team's player participations"
  ON player_participation FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = player_participation.team_id
        AND teams.user_id = auth.uid()
    )
  );

-- Verify the policies were created
SELECT
  policyname,
  cmd,
  CASE
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END as using_clause,
  CASE
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'player_participation';
