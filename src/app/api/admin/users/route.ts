// /api/admin/users - Users list API
// Returns paginated, searchable list of all platform users
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import {
  UserListItem,
  UserListResponse,
  UserDerivedStatus,
  UserRole
} from '@/types/admin';

/**
 * Derives user status from login data and deactivation status
 */
function deriveUserStatus(
  isDeactivated: boolean,
  lastActiveAt: string | null,
  firstLoginAt: string | null
): UserDerivedStatus {
  if (isDeactivated) return 'deactivated';
  if (!firstLoginAt) return 'never_logged_in';

  // Check if active in last 30 days
  if (lastActiveAt) {
    const lastActive = new Date(lastActiveAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (lastActive >= thirtyDaysAgo) {
      return 'active';
    }
  }

  return 'inactive';
}

/**
 * GET /api/admin/users
 * Returns paginated list of users with filters
 *
 * Query params:
 * - search: Search by email or name
 * - status: Filter by derived status (active, inactive, deactivated, never_logged_in)
 * - role: Filter by role (platform_admin, owner, coach)
 * - organization_id: Filter by organization
 * - is_platform_admin: Filter to only show platform admins
 * - is_deactivated: Filter to only show deactivated users
 * - sort_by: Sort field (email, full_name, created_at, last_active_at, teams_count)
 * - sort_order: asc or desc
 * - page: Page number (1-indexed)
 * - page_size: Items per page (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  // Verify admin access
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  // Use the service client to bypass RLS for admin queries
  const supabase = auth.serviceClient;
  const searchParams = request.nextUrl.searchParams;

  // Parse query parameters
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') as UserDerivedStatus | null;
  const roleFilter = searchParams.get('role') as UserRole | null;
  const organizationIdFilter = searchParams.get('organization_id');
  const isPlatformAdminFilter = searchParams.get('is_platform_admin');
  const isDeactivatedFilter = searchParams.get('is_deactivated');
  const sortBy = searchParams.get('sort_by') || 'created_at';
  const sortOrder = searchParams.get('sort_order') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20')));

  try {
    // Fetch all profiles with organization info
    // Note: profiles table may not have all columns - only select what exists
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        role,
        organization_id,
        is_platform_admin,
        is_deactivated,
        last_active_at,
        updated_at
      `);

    if (profilesError) throw profilesError;

    // Fetch organizations for name lookup
    const { data: orgsData, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name');

    if (orgsError) throw orgsError;

    // Fetch team memberships
    const { data: membershipsData, error: membershipsError } = await supabase
      .from('team_memberships')
      .select('user_id, team_id');

    if (membershipsError) throw membershipsError;

    // Fetch team ownerships (teams table user_id)
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('id, user_id');

    if (teamsError) throw teamsError;

    // Fetch user_status for login info (may not exist yet if migration not applied)
    let userStatusData: { user_id: string; first_login_at: string | null; last_login_at: string | null }[] = [];
    try {
      const { data, error } = await supabase
        .from('user_status')
        .select('user_id, first_login_at, last_login_at');
      if (!error && data) {
        userStatusData = data;
      }
    } catch {
      // Table may not exist yet
    }

    // Build lookup maps
    const orgsById = new Map(orgsData?.map(o => [o.id, o.name]) || []);
    const userStatusByUser = new Map(userStatusData?.map(s => [s.user_id, s]) || []);

    // Count teams per user (memberships + owned teams)
    const teamCountByUser = new Map<string, number>();

    membershipsData?.forEach(m => {
      teamCountByUser.set(m.user_id, (teamCountByUser.get(m.user_id) || 0) + 1);
    });

    teamsData?.forEach(t => {
      // Only count if not already counted via membership
      const currentCount = teamCountByUser.get(t.user_id) || 0;
      // Check if this team is in their memberships
      const hasMembership = membershipsData?.some(
        m => m.user_id === t.user_id && m.team_id === t.id
      );
      if (!hasMembership) {
        teamCountByUser.set(t.user_id, currentCount + 1);
      }
    });

    // Transform profiles to list items
    let users: UserListItem[] = (profilesData || []).map(profile => {
      const userStatus = userStatusByUser.get(profile.id);
      // Use user_status.first_login_at if available, otherwise fallback to last_active_at
      // If user has last_active_at, they've clearly logged in before
      const firstLoginAt = userStatus?.first_login_at || profile.last_active_at || null;

      return {
        id: profile.id,
        email: profile.email || 'Unknown',
        full_name: null, // Column doesn't exist in profiles table yet
        role: (profile.role as UserRole) || 'coach',
        derived_status: deriveUserStatus(
          profile.is_deactivated || false,
          profile.last_active_at,
          firstLoginAt
        ),
        organization_id: profile.organization_id,
        organization_name: profile.organization_id
          ? orgsById.get(profile.organization_id) || null
          : null,
        teams_count: teamCountByUser.get(profile.id) || 0,
        is_platform_admin: profile.is_platform_admin || false,
        is_deactivated: profile.is_deactivated || false,
        last_active_at: profile.last_active_at,
        created_at: profile.updated_at // Use updated_at as fallback since created_at doesn't exist
      };
    });

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(user =>
        user.email.toLowerCase().includes(searchLower)
      );
    }

    if (statusFilter) {
      users = users.filter(user => user.derived_status === statusFilter);
    }

    if (roleFilter) {
      users = users.filter(user => user.role === roleFilter);
    }

    if (organizationIdFilter) {
      users = users.filter(user => user.organization_id === organizationIdFilter);
    }

    if (isPlatformAdminFilter === 'true') {
      users = users.filter(user => user.is_platform_admin);
    } else if (isPlatformAdminFilter === 'false') {
      users = users.filter(user => !user.is_platform_admin);
    }

    if (isDeactivatedFilter === 'true') {
      users = users.filter(user => user.is_deactivated);
    } else if (isDeactivatedFilter === 'false') {
      users = users.filter(user => !user.is_deactivated);
    }

    // Apply sorting
    users.sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      switch (sortBy) {
        case 'email':
        case 'full_name': // full_name doesn't exist, fall back to email
          aVal = a.email.toLowerCase();
          bVal = b.email.toLowerCase();
          break;
        case 'last_active_at':
          aVal = a.last_active_at || '';
          bVal = b.last_active_at || '';
          break;
        case 'teams_count':
          aVal = a.teams_count;
          bVal = b.teams_count;
          break;
        case 'created_at':
        default:
          aVal = a.created_at;
          bVal = b.created_at;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Calculate pagination
    const total = users.length;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    // Slice for pagination
    const paginatedUsers = users.slice(offset, offset + pageSize);

    const response: UserListResponse = {
      users: paginatedUsers,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
