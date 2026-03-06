/**
 * API: /api/communication/parents/invite
 * POST - Send parent invitation
 * GET - List pending invitations for a team
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
// Note: services use browser client, so we query Supabase directly in API routes
import { sendEmail, getParentInvitationEmail } from '@/lib/email';

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

    // Insert invitation directly using the server client (service uses browser client which won't work here)
    const { data: invitation, error: insertError } = await supabase
      .from('parent_invitations')
      .insert({
        team_id: teamId,
        player_id: playerId,
        invited_by: user.id,
        parent_email: parentEmail.toLowerCase().trim(),
        parent_name: parentName || null,
        relationship: relationship || null,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'This email has already been invited to this team' },
          { status: 409 }
        );
      }
      throw insertError;
    }

    // Send invitation email — fire-and-forget, do not fail the request on email error
    try {
      const { data: teamData } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single();

      const { data: playerData } = await supabase
        .from('players')
        .select('first_name, last_name')
        .eq('id', playerId)
        .single();

      const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://youthcoachhub.com'}/auth/parent-invite?token=${invitation.invitation_token}`;

      const emailTemplate = getParentInvitationEmail({
        parentName: invitation.parent_name,
        parentEmail: invitation.parent_email,
        teamName: teamData?.name ?? teamId,
        playerName: playerData
          ? `${playerData.first_name} ${playerData.last_name}`
          : 'your player',
        inviteLink,
      });

      await sendEmail({
        to: invitation.parent_email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });
    } catch (emailError) {
      console.error('Failed to send parent invitation email:', emailError);
    }

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

    const { data: invitations, error: invError } = await supabase
      .from('parent_invitations')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (invError) {
      throw invError;
    }

    return NextResponse.json({ invitations: invitations || [] });
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
      // Reset token and expiry directly using server client
      const newToken = crypto.randomUUID();
      const newExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

      const { data: updated, error: updateError } = await supabase
        .from('parent_invitations')
        .update({
          invitation_token: newToken,
          token_expires_at: newExpiry,
          status: 'pending',
        })
        .eq('id', invitationId)
        .select()
        .single();

      if (updateError || !updated) {
        return NextResponse.json({ error: 'Failed to resend invitation' }, { status: 500 });
      }

      // Send invitation email — fire-and-forget
      try {
        const { data: teamData } = await supabase
          .from('teams')
          .select('name')
          .eq('id', updated.team_id)
          .single();

        const { data: playerData } = await supabase
          .from('players')
          .select('first_name, last_name')
          .eq('id', updated.player_id)
          .single();

        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://youthcoachhub.com'}/auth/parent-invite?token=${updated.invitation_token}`;

        const emailTemplate = getParentInvitationEmail({
          parentName: updated.parent_name,
          parentEmail: updated.parent_email,
          teamName: teamData?.name ?? updated.team_id,
          playerName: playerData
            ? `${playerData.first_name} ${playerData.last_name}`
            : 'your player',
          inviteLink,
        });

        await sendEmail({
          to: updated.parent_email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });
      } catch (emailError) {
        console.error('Failed to send parent invitation email on resend:', emailError);
      }

      return NextResponse.json({ invitation: updated });
    } else {
      // Revoke directly using server client
      const { error: revokeError } = await supabase
        .from('parent_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);

      if (revokeError) {
        return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 });
      }
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
