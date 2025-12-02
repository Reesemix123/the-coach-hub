// POST /api/console/people/:userId/reactivate
// Reactivates a user across all teams in the organization

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
      .select('id')
      .eq('organization_id', profile.organization_id);
    teamIds = (orgTeams || []).map(t => t.id);
  } else {
    const { data: ownedTeams } = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', user.id);
    teamIds = (ownedTeams || []).map(t => t.id);
  }

  if (teamIds.length === 0) {
    return NextResponse.json(
      { error: 'No teams found' },
      { status: 404 }
    );
  }

  // Check if target user has any deactivated memberships in these teams
  const { data: deactivatedMemberships, error: checkError } = await supabase
    .from('team_memberships')
    .select('id, team_id')
    .eq('user_id', targetUserId)
    .in('team_id', teamIds)
    .eq('is_active', false);

  if (checkError || !deactivatedMemberships || deactivatedMemberships.length === 0) {
    return NextResponse.json(
      { error: 'User not found or already active' },
      { status: 404 }
    );
  }

  // Reactivate all memberships for this user
  const { error: updateError } = await supabase
    .from('team_memberships')
    .update({
      is_active: true,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', targetUserId)
    .in('team_id', teamIds);

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to reactivate user' },
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
    'user.reactivated',
    'user',
    targetUserId,
    targetProfile?.email || undefined,
    { teams_affected: deactivatedMemberships.length }
  );

  return NextResponse.json({
    success: true,
    message: 'User reactivated'
  });
}
