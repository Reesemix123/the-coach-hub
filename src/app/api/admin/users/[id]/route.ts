// /api/admin/users/[id] - User detail API
// Returns detailed user information with organization, teams, activity
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';
import {
  UserDetail,
  UserDerivedStatus,
  UserRole,
  UserStatus,
  AuditLog
} from '@/types/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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
 * GET /api/admin/users/[id]
 * Returns detailed information about a specific user
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { id } = await params;
  const supabase = auth.serviceClient;

  try {
    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch organization if user belongs to one
    let organization = null;
    if (profile.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name, status')
        .eq('id', profile.organization_id)
        .single();
      organization = org;
    }

    // Fetch user's teams via team_memberships
    const { data: memberships } = await supabase
      .from('team_memberships')
      .select(`
        role,
        teams (
          id,
          name,
          organization_id
        )
      `)
      .eq('user_id', id);

    // Fetch teams owned by user (where they are the primary owner)
    const { data: ownedTeams } = await supabase
      .from('teams')
      .select('id, name, organization_id')
      .eq('user_id', id);

    // Build teams list (combining memberships and owned teams)
    const teamsMap = new Map<string, { id: string; name: string; role: string; organization_id: string | null }>();

    // Add owned teams first
    ownedTeams?.forEach(team => {
      teamsMap.set(team.id, {
        id: team.id,
        name: team.name,
        role: 'owner',
        organization_id: team.organization_id
      });
    });

    // Add membership teams (if not already owner)
    memberships?.forEach(m => {
      const team = m.teams as { id: string; name: string; organization_id: string | null } | null;
      if (team && !teamsMap.has(team.id)) {
        teamsMap.set(team.id, {
          id: team.id,
          name: team.name,
          role: m.role,
          organization_id: team.organization_id
        });
      }
    });

    const teams = Array.from(teamsMap.values());

    // Fetch user_status (may not exist if migration not applied)
    let userStatus: UserStatus | null = null;
    try {
      const { data: status } = await supabase
        .from('user_status')
        .select('*')
        .eq('user_id', id)
        .single();
      userStatus = status;
    } catch {
      // Table may not exist yet
    }

    // Fetch recent activity (audit logs for this user)
    const { data: activityData } = await supabase
      .from('audit_logs')
      .select('*')
      .or(`target_id.eq.${id},actor_id.eq.${id}`)
      .order('timestamp', { ascending: false })
      .limit(20);

    const recentActivity: AuditLog[] = activityData || [];

    // Build response
    const response: UserDetail = {
      id: profile.id,
      email: profile.email || 'Unknown',
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      role: (profile.role as UserRole) || 'coach',
      derived_status: deriveUserStatus(
        profile.is_deactivated || false,
        profile.last_active_at,
        userStatus?.first_login_at || null
      ),
      is_platform_admin: profile.is_platform_admin || false,
      is_deactivated: profile.is_deactivated || false,
      deactivated_at: profile.deactivated_at || null,
      deactivated_by: profile.deactivated_by || null,
      deactivation_reason: profile.deactivation_reason || null,
      organization,
      teams,
      user_status: userStatus,
      recent_activity: recentActivity,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Updates user details (role, full_name)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { id } = await params;
  const supabase = auth.serviceClient;

  try {
    const body = await request.json();
    const { role, full_name, is_platform_admin } = body;

    // Validate role if provided
    const validRoles = ['platform_admin', 'owner', 'coach', 'analyst', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role value' },
        { status: 400 }
      );
    }

    // Get current user for audit logging
    const { data: currentUser, error: fetchError } = await supabase
      .from('profiles')
      .select('email, role, full_name, is_platform_admin')
      .eq('id', id)
      .single();

    if (fetchError || !currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (role !== undefined && role !== currentUser.role) {
      updates.role = role;
      changes.role = { from: currentUser.role, to: role };

      // If setting role to platform_admin, also set is_platform_admin flag
      if (role === 'platform_admin') {
        updates.is_platform_admin = true;
        if (!currentUser.is_platform_admin) {
          changes.is_platform_admin = { from: false, to: true };
        }
      }
    }

    if (full_name !== undefined && full_name !== currentUser.full_name) {
      updates.full_name = full_name;
      changes.full_name = { from: currentUser.full_name, to: full_name };
    }

    if (is_platform_admin !== undefined && is_platform_admin !== currentUser.is_platform_admin) {
      updates.is_platform_admin = is_platform_admin;
      changes.is_platform_admin = { from: currentUser.is_platform_admin, to: is_platform_admin };

      // If promoting to platform admin, also update role
      if (is_platform_admin && currentUser.role !== 'platform_admin') {
        updates.role = 'platform_admin';
        changes.role = { from: currentUser.role, to: 'platform_admin' };
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No changes to apply' });
    }

    // Apply update
    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log the admin action
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'user.updated',
      'user',
      id,
      currentUser.email || 'Unknown',
      { changes }
    );

    return NextResponse.json(updatedUser);

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
