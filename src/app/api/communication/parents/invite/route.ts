/**
 * API: /api/communication/parents/invite
 * POST - Send parent invitation
 * GET - List pending invitations for a team
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  inviteParent,
  getPendingInvitations,
  resendInvitation,
  revokeInvitation,
} from '@/lib/services/communication';
import type { ParentRelationship } from '@/types/communication';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, playerId, parentEmail, parentName, relationship } = body;

    if (!teamId || !playerId || !parentEmail) {
      return NextResponse.json(
        { error: 'teamId, playerId, and parentEmail are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parentEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Verify user has permission to invite (owner, coach, or team_admin)
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isOwner = team.user_id === user.id;
    const canInvite = isOwner || ['owner', 'coach', 'team_admin'].includes(membership?.role || '');

    if (!canInvite) {
      return NextResponse.json({ error: 'Not authorized to invite parents' }, { status: 403 });
    }

    // Verify player belongs to team
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('id', playerId)
      .eq('team_id', teamId)
      .single();

    if (!player) {
      return NextResponse.json({ error: 'Player not found on this team' }, { status: 404 });
    }

    const invitation = await inviteParent({
      teamId,
      playerId,
      parentEmail,
      parentName,
      relationship: relationship as ParentRelationship,
    });

    // TODO: Send invitation email via Resend
    // await sendParentInvitationEmail(invitation);

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    console.error('Error inviting parent:', error);

    if (error instanceof Error && error.message.includes('already been invited')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // Verify user has access
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    // Check if user is a Parent Champion
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('is_champion')
      .eq('user_id', user.id)
      .single();

    const isOwner = team.user_id === user.id;
    const isStaff = ['owner', 'coach', 'team_admin'].includes(membership?.role || '');
    const isChampion = parentProfile?.is_champion === true;

    if (!isOwner && !isStaff && !isChampion) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const invitations = await getPendingInvitations(teamId);

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { invitationId, action } = body;

    if (!invitationId || !action) {
      return NextResponse.json(
        { error: 'invitationId and action are required' },
        { status: 400 }
      );
    }

    if (!['resend', 'revoke'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "resend" or "revoke"' },
        { status: 400 }
      );
    }

    // Get invitation to verify team access
    const { data: invitation } = await supabase
      .from('parent_invitations')
      .select('team_id')
      .eq('id', invitationId)
      .single();

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verify user has permission
    const { data: team } = await supabase
      .from('teams')
      .select('user_id')
      .eq('id', invitation.team_id)
      .single();

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', invitation.team_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    // Check if Parent Champion (can resend but not revoke)
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('is_champion')
      .eq('user_id', user.id)
      .single();

    const isOwner = team?.user_id === user.id;
    const isStaff = ['owner', 'coach', 'team_admin'].includes(membership?.role || '');
    const isChampion = parentProfile?.is_champion === true;

    if (action === 'revoke' && !isOwner && !isStaff) {
      return NextResponse.json({ error: 'Only staff can revoke invitations' }, { status: 403 });
    }

    if (action === 'resend' && !isOwner && !isStaff && !isChampion) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (action === 'resend') {
      const updated = await resendInvitation(invitationId);
      // TODO: Send invitation email via Resend
      return NextResponse.json({ invitation: updated });
    } else {
      await revokeInvitation(invitationId);
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('Error updating invitation:', error);
    return NextResponse.json(
      { error: 'Failed to update invitation' },
      { status: 500 }
    );
  }
}
