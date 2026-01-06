-- Migration 131: Grant Execute Permissions on Player Stats Functions
-- ============================================================================
-- PURPOSE:
--   The functions created in migration 130 have SECURITY DEFINER but need
--   explicit GRANT EXECUTE permissions for the authenticated role to call them.
--   Without these grants, the RPC calls return permission errors.
-- ============================================================================

-- Grant execute on all player stats functions to authenticated users
GRANT EXECUTE ON FUNCTION get_qb_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rb_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_wrte_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dl_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_lb_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_db_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_kicker_stats(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_returner_stats(UUID, UUID) TO authenticated;

-- Also grant to anon role in case any public dashboards need them
GRANT EXECUTE ON FUNCTION get_qb_stats(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_rb_stats(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_wrte_stats(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_dl_stats(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_lb_stats(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_db_stats(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_kicker_stats(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_returner_stats(UUID, UUID) TO anon;

-- Verify functions exist (will fail if any function doesn't exist)
DO $$
BEGIN
  RAISE NOTICE 'Verifying function permissions...';

  -- Test that functions can be called (just checking they exist)
  PERFORM has_function_privilege('authenticated', 'get_qb_stats(uuid,uuid)', 'execute');
  PERFORM has_function_privilege('authenticated', 'get_rb_stats(uuid,uuid)', 'execute');
  PERFORM has_function_privilege('authenticated', 'get_wrte_stats(uuid,uuid)', 'execute');
  PERFORM has_function_privilege('authenticated', 'get_dl_stats(uuid,uuid)', 'execute');
  PERFORM has_function_privilege('authenticated', 'get_lb_stats(uuid,uuid)', 'execute');
  PERFORM has_function_privilege('authenticated', 'get_db_stats(uuid,uuid)', 'execute');
  PERFORM has_function_privilege('authenticated', 'get_kicker_stats(uuid,uuid)', 'execute');
  PERFORM has_function_privilege('authenticated', 'get_returner_stats(uuid,uuid)', 'execute');

  RAISE NOTICE 'All function permissions granted successfully';
END $$;
