import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { sendEmail, getTeamInviteEmail } from '@/lib/email';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, role = 'coach' } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Verify user has access to this team
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const isTeamOwner = team.user_id === user.id;

    // Check membership
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const canInvite = isTeamOwner || ['owner', 'coach'].includes(membership?.role || '');
    if (!canInvite) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Check if user already exists
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      // Check if already a member
      const { data: existingMembership } = await serviceClient
        .from('team_memberships')
        .select('id, is_active')
        .eq('team_id', teamId)
        .eq('user_id', existingProfile.id)
        .maybeSingle();

      if (existingMembership?.is_active) {
        return NextResponse.json({
          success: false,
          message: 'User is already a member of this team'
        });
      }

      // Add existing user directly
      if (existingMembership) {
        await serviceClient
          .from('team_memberships')
          .update({
            is_active: true,
            role,
            invited_by: user.id,
            joined_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMembership.id);
      } else {
        await serviceClient
          .from('team_memberships')
          .insert({
            team_id: teamId,
            user_id: existingProfile.id,
            role,
            invited_by: user.id,
            joined_at: new Date().toISOString(),
            is_active: true
          });
      }

      return NextResponse.json({
        success: true,
        message: 'Coach added to team successfully',
        addedImmediately: true
      });
    }

    // Check for existing pending invite
    const { data: existingInvite } = await serviceClient
      .from('team_invites')
      .select('id, token, expires_at')
      .eq('team_id', teamId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    let inviteToken: string;

    if (existingInvite) {
      // Check if expired
      if (new Date(existingInvite.expires_at) < new Date()) {
        // Mark as expired and create new
        await serviceClient
          .from('team_invites')
          .update({ status: 'expired' })
          .eq('id', existingInvite.id);
      } else {
        // Use existing token
        inviteToken = existingInvite.token;
      }
    }

    // Create new invite if needed
    if (!inviteToken!) {
      const { data: newInvite, error: inviteError } = await serviceClient
        .from('team_invites')
        .insert({
          team_id: teamId,
          email,
          role,
          invited_by: user.id,
        })
        .select('token')
        .single();

      if (inviteError) {
        console.error('Failed to create invite:', inviteError);
        return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
      }

      inviteToken = newInvite.token;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://youthcoachhub.com';
    const inviteLink = `${appUrl}/auth/signup?invite=${inviteToken}`;

    // Get inviter's name
    const { data: inviterProfile } = await serviceClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'A coach';

    // Send email
    const emailContent = getTeamInviteEmail({
      inviteeEmail: email,
      teamName: team.name,
      inviterName,
      inviteLink,
      role: role.charAt(0).toUpperCase() + role.slice(1),
    });

    const emailResult = await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      tags: [
        { name: 'type', value: 'team_invite' },
        { name: 'team_id', value: teamId },
      ],
    });

    if (!emailResult.success) {
      console.error('Failed to send invite email:', emailResult.error);
      // Don't fail - the invite was created, just couldn't send email
      return NextResponse.json({
        success: true,
        message: `Invitation created for ${email}. Email delivery failed - share the link manually.`,
        inviteLink,
        inviteToken,
        emailSent: false,
        emailError: emailResult.error
      });
    }

    return NextResponse.json({
      success: true,
      message: `Invitation email sent to ${email}`,
      inviteLink,
      inviteToken,
      emailSent: true
    });
  } catch (error) {
    console.error('Error creating invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
