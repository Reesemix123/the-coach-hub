// POST /api/console/people/:userId/resend-invite
// Resends an invitation to a pending user
// Note: Currently a stub since there's no email invitation system

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

  // Check if target user is in any of these teams
  const { data: memberships } = await supabase
    .from('team_memberships')
    .select('id, team_id, is_active')
    .eq('user_id', targetUserId)
    .in('team_id', teamIds);

  if (!memberships || memberships.length === 0) {
    return NextResponse.json(
      { error: 'User not found in organization' },
      { status: 404 }
    );
  }

  // Get target user's profile
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('email, last_active_at')
    .eq('id', targetUserId)
    .single();

  if (!targetProfile) {
    return NextResponse.json(
      { error: 'User profile not found' },
      { status: 404 }
    );
  }

  // Check if user has never logged in (could be considered "pending")
  // In current system, all users are "active" once added since they must exist in auth.users
  // This is a placeholder for when a proper invite system is implemented

  // Update the invited_at timestamp to track the resend
  const { error: updateError } = await supabase
    .from('team_memberships')
    .update({
      invited_at: new Date().toISOString(),
      invited_by: user.id,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', targetUserId)
    .in('team_id', teamIds);

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update invitation' },
      { status: 500 }
    );
  }

  // Log the action
  await logAdminAction(
    user.id,
    profile?.email || null,
    'user.invite_resent',
    'user',
    targetUserId,
    targetProfile.email || undefined
  );

  // TODO: When email system is implemented, send actual invitation email here

  return NextResponse.json({
    success: true,
    message: `Invitation resent to ${targetProfile.email}`
  });
}
