// POST /api/console/people/:userId/deactivate
// Deactivates a user from all teams in the organization

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { logAdminAction } from '@/lib/admin/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: targetUserId } = await params;
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
    .select('id, email, organization_id')
    .eq('id', user.id)
    .single();

  // Get teams for this user
  let teamIds: string[] = [];

  if (profile?.organization_id) {
    const { data: orgTeams } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('organization_id', profile.organization_id);

    // Check if target user is an organization owner
    const { data: org } = await supabase
      .from('organizations')
      .select('owner_user_id')
      .eq('id', profile.organization_id)
      .single();

    if (org?.owner_user_id === targetUserId) {
      return NextResponse.json(
        { error: 'Cannot deactivate organization owner' },
        { status: 400 }
      );
    }

    teamIds = (orgTeams || []).map(t => t.id);
  } else {
    const { data: ownedTeams } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('user_id', user.id);
    teamIds = (ownedTeams || []).map(t => t.id);
  }

  if (teamIds.length === 0) {
    return NextResponse.json(
      { error: 'No teams found' },
      { status: 404 }
    );
  }

  // Check if target user is in any of these teams
  const { data: existingMemberships, error: checkError } = await supabase
    .from('team_memberships')
    .select('id, team_id')
    .eq('user_id', targetUserId)
    .in('team_id', teamIds)
    .eq('is_active', true);

  if (checkError || !existingMemberships || existingMemberships.length === 0) {
    return NextResponse.json(
      { error: 'User not found in organization' },
      { status: 404 }
    );
  }

  // Deactivate all memberships for this user
  const { error: updateError } = await supabase
    .from('team_memberships')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', targetUserId)
    .in('team_id', teamIds);

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to deactivate user' },
      { status: 500 }
    );
  }

  // Get target user's email for logging
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', targetUserId)
    .single();

  // Log the action
  await logAdminAction(
    user.id,
    profile?.email || null,
    'user.deactivated',
    'user',
    targetUserId,
    targetProfile?.email || undefined,
    { teams_affected: existingMemberships.length }
  );

  return NextResponse.json({
    success: true,
    message: `User deactivated from ${existingMemberships.length} team(s)`
  });
}
