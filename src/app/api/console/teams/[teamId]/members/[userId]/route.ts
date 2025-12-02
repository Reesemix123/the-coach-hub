// DELETE /api/console/teams/:teamId/members/:userId
// Removes a user from a specific team (not org-wide)

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { logAdminAction } from '@/lib/admin/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string; userId: string }> }
) {
  const { teamId, userId: targetUserId } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Get user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, organization_id')
    .eq('id', user.id)
    .single();

  // Verify user has access to this team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, user_id, organization_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Check authorization: must be team owner or in same organization
  const isTeamOwner = team.user_id === user.id;
  const isSameOrg = profile?.organization_id && team.organization_id === profile.organization_id;

  if (!isTeamOwner && !isSameOrg) {
    return NextResponse.json(
      { error: 'Not authorized to manage this team' },
      { status: 403 }
    );
  }

  // Cannot remove team owner
  if (team.user_id === targetUserId) {
    return NextResponse.json(
      { error: 'Cannot remove team owner' },
      { status: 400 }
    );
  }

  // Check if target user has a membership in this team
  const { data: membership } = await supabase
    .from('team_memberships')
    .select('id, role')
    .eq('team_id', teamId)
    .eq('user_id', targetUserId)
    .eq('is_active', true)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: 'User is not a member of this team' },
      { status: 404 }
    );
  }

  // Deactivate the membership (soft delete)
  const { error: updateError } = await supabase
    .from('team_memberships')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', membership.id);

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to remove user from team' },
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
    'team_member.removed',
    'team_membership',
    membership.id,
    `${targetProfile?.email || 'Unknown'} from ${team.name}`,
    { team_id: teamId, team_name: team.name, role: membership.role }
  );

  return NextResponse.json({
    success: true,
    message: 'User removed from team'
  });
}
