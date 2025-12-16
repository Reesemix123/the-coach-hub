// /api/console/people - Organization-wide people management
// Returns all users aggregated across all teams in the organization

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

interface TeamInfo {
  id: string;
  name: string;
  role: string;
}

interface UserResponse {
  id: string;
  name: string | null;
  email: string;
  teams: TeamInfo[];
  primary_role: string;
  last_active_at: string | null;
  status: 'active' | 'pending' | 'deactivated';
  invited_at?: string;
}

interface PeopleResponse {
  users: UserResponse[];
  summary: {
    total: number;
    active: number;
    pending: number;
    deactivated: number;
  };
}

export async function GET() {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Get user's profile with organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id')
    .eq('id', user.id)
    .single();

  // Get teams for this user (org mode or legacy mode)
  let teams: { id: string; name: string; user_id: string }[] = [];

  if (profile?.organization_id) {
    // Organization mode - get all teams in the org
    const { data: orgTeams } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('organization_id', profile.organization_id);
    teams = orgTeams || [];
  } else {
    // Legacy mode - get teams user owns
    const { data: ownedTeams } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('user_id', user.id);
    teams = ownedTeams || [];
  }

  if (teams.length === 0) {
    return NextResponse.json({
      users: [],
      summary: { total: 0, active: 0, pending: 0, deactivated: 0 }
    });
  }

  const teamIds = teams.map(t => t.id);
  const teamMap = new Map(teams.map(t => [t.id, t.name]));
  const teamOwnerMap = new Map(teams.map(t => [t.id, t.user_id]));

  // Get all memberships for these teams
  const { data: memberships, error: membershipError } = await supabase
    .from('team_memberships')
    .select('id, team_id, user_id, role, is_active, invited_at, joined_at, invited_by')
    .in('team_id', teamIds);

  if (membershipError) {
    return NextResponse.json(
      { error: 'Failed to fetch memberships' },
      { status: 500 }
    );
  }

  // Get all unique user IDs (from memberships + team owners)
  const userIds = new Set<string>();
  memberships?.forEach(m => userIds.add(m.user_id));
  teams.forEach(t => userIds.add(t.user_id));

  // Fetch profiles for all users
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, last_active_at')
    .in('id', Array.from(userIds));

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

  // Role hierarchy for determining primary role
  const roleHierarchy: Record<string, number> = { owner: 2, coach: 1 };

  // Group by user
  const userMap = new Map<string, {
    id: string;
    email: string;
    last_active_at: string | null;
    teams: TeamInfo[];
    statuses: Set<string>;
    invited_at: string | null;
  }>();

  // Add team owners first (they may not be in team_memberships)
  for (const team of teams) {
    const ownerId = team.user_id;
    const ownerProfile = profileMap.get(ownerId);

    if (!userMap.has(ownerId)) {
      userMap.set(ownerId, {
        id: ownerId,
        email: ownerProfile?.email || 'unknown@example.com',
        last_active_at: ownerProfile?.last_active_at || null,
        teams: [],
        statuses: new Set(['active']),
        invited_at: null
      });
    }

    const userData = userMap.get(ownerId)!;
    // Check if we already added this team
    const alreadyHasTeam = userData.teams.some(t => t.id === team.id);
    if (!alreadyHasTeam) {
      userData.teams.push({
        id: team.id,
        name: team.name,
        role: 'owner'
      });
    }
    userData.statuses.add('active');
  }

  // Add memberships
  for (const m of (memberships || [])) {
    const userProfile = profileMap.get(m.user_id);

    if (!userMap.has(m.user_id)) {
      userMap.set(m.user_id, {
        id: m.user_id,
        email: userProfile?.email || 'unknown@example.com',
        last_active_at: userProfile?.last_active_at || null,
        teams: [],
        statuses: new Set(),
        invited_at: m.invited_at
      });
    }

    const userData = userMap.get(m.user_id)!;

    // Check if team owner already added this team with 'owner' role
    const existingTeamIndex = userData.teams.findIndex(t => t.id === m.team_id);
    if (existingTeamIndex >= 0) {
      // Already have this team (from owner check), check if we should use membership role
      if (userData.teams[existingTeamIndex].role !== 'owner') {
        userData.teams[existingTeamIndex].role = m.role;
      }
    } else {
      userData.teams.push({
        id: m.team_id,
        name: teamMap.get(m.team_id) || 'Unknown Team',
        role: m.role
      });
    }

    // Determine status
    if (m.is_active) {
      userData.statuses.add('active');
    } else {
      userData.statuses.add('deactivated');
    }

    // Track earliest invited_at
    if (m.invited_at && (!userData.invited_at || m.invited_at < userData.invited_at)) {
      userData.invited_at = m.invited_at;
    }
  }

  // Build final user list
  const users: UserResponse[] = Array.from(userMap.values()).map(u => {
    // Calculate primary role (highest across all teams)
    const primaryRole = u.teams.reduce((highest, t) => {
      return (roleHierarchy[t.role] || 0) > (roleHierarchy[highest] || 0) ? t.role : highest;
    }, 'coach');

    // Determine overall status
    // Active if any team membership is active, deactivated if all are deactivated
    let status: 'active' | 'pending' | 'deactivated' = 'deactivated';
    if (u.statuses.has('active')) {
      status = 'active';
    }
    // Note: We don't have true "pending" status in current schema
    // Could interpret as invited but not yet logged in (last_active_at = null)
    if (status === 'active' && !u.last_active_at && u.invited_at) {
      // User was invited but never logged in - could be "pending"
      // But since we don't have a proper invite system, leave as active
    }

    return {
      id: u.id,
      name: null, // Profiles table doesn't have name field
      email: u.email,
      teams: u.teams.sort((a, b) => a.name.localeCompare(b.name)),
      primary_role: primaryRole,
      last_active_at: u.last_active_at,
      status,
      invited_at: status === 'pending' ? u.invited_at || undefined : undefined
    };
  });

  // Sort users: active first, then by email
  users.sort((a, b) => {
    if (a.status !== b.status) {
      const statusOrder = { active: 0, pending: 1, deactivated: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return a.email.localeCompare(b.email);
  });

  // Calculate summary
  const summary = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    pending: users.filter(u => u.status === 'pending').length,
    deactivated: users.filter(u => u.status === 'deactivated').length
  };

  const response: PeopleResponse = { users, summary };

  return NextResponse.json(response);
}
