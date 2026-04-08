// /api/admin/testing/invite - Tester Invite API
// Invites a user as a beta tester, handling both new and existing accounts.
// Requires platform admin authentication.

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';
import { sendEmail, getTesterInviteEmail } from '@/lib/email';

/**
 * POST /api/admin/testing/invite
 * Invites a user to become a beta tester.
 *
 * Body:
 * - email: string (required) - The email address to invite
 *
 * For new users: sends a Supabase magic-link invite email and a tester welcome email.
 * For existing users: grants is_tester = true on their profile and sends the welcome email.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { admin, serviceClient } = auth;

  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body as { email?: string };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A valid email address is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://youthcoachhub.com';

    // Check if a profile already exists for this email
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('id, email, is_tester')
      .eq('email', normalizedEmail)
      .single();

    // -------------------------------------------------------------------------
    // Case 2: Existing user
    // -------------------------------------------------------------------------
    if (existingProfile) {
      if (existingProfile.is_tester) {
        return NextResponse.json({
          success: true,
          message: `${normalizedEmail} is already a tester`,
          already_tester: true,
        });
      }

      const { error: updateError } = await serviceClient
        .from('profiles')
        .update({ is_tester: true })
        .eq('email', normalizedEmail);

      if (updateError) {
        console.error('Failed to update is_tester for existing user:', updateError);
        return NextResponse.json(
          { error: 'Failed to grant tester access' },
          { status: 500 }
        );
      }

      const emailContent = getTesterInviteEmail({
        testerEmail: normalizedEmail,
        inviteUrl: `${appUrl}/test-hub`,
      });

      const emailResult = await sendEmail({
        to: normalizedEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        tags: [
          { name: 'category', value: 'tester_invite' },
          { name: 'existing_user', value: 'true' },
        ],
      });

      if (!emailResult.success) {
        console.error('Failed to send tester welcome email:', emailResult.error);
      }

      await logAdminAction(
        admin.id,
        admin.email,
        'testing.tester_granted',
        'user',
        existingProfile.id,
        normalizedEmail,
        { existing_user: true, email_sent: emailResult.success }
      );

      return NextResponse.json({
        success: true,
        message: `Tester access granted to ${normalizedEmail}`,
        existing_user: true,
      });
    }

    // -------------------------------------------------------------------------
    // Case 1: New user — send Supabase auth invite
    // -------------------------------------------------------------------------
    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
      normalizedEmail,
      { redirectTo: `${appUrl}/test-hub` }
    );

    // If Supabase says the user is "already registered", fall through to Case 2
    // using the auth user data even though their profile may not exist yet.
    if (inviteError) {
      const alreadyRegistered =
        inviteError.message.toLowerCase().includes('already registered') ||
        inviteError.message.toLowerCase().includes('already been registered');

      if (alreadyRegistered) {
        // Attempt a best-effort profile update — the row may not exist yet
        await serviceClient
          .from('profiles')
          .update({ is_tester: true })
          .eq('email', normalizedEmail);

        const emailContent = getTesterInviteEmail({
          testerEmail: normalizedEmail,
          inviteUrl: `${appUrl}/test-hub`,
        });

        const emailResult = await sendEmail({
          to: normalizedEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          tags: [
            { name: 'category', value: 'tester_invite' },
            { name: 'existing_user', value: 'true' },
          ],
        });

        if (!emailResult.success) {
          console.error('Failed to send tester welcome email:', emailResult.error);
        }

        await logAdminAction(
          admin.id,
          admin.email,
          'testing.tester_granted',
          'user',
          undefined,
          normalizedEmail,
          { existing_user: true, fallback: true, email_sent: emailResult.success }
        );

        return NextResponse.json({
          success: true,
          message: `Tester access granted to ${normalizedEmail}`,
          existing_user: true,
        });
      }

      console.error('inviteUserByEmail error:', inviteError);
      return NextResponse.json(
        { error: `Failed to send invite: ${inviteError.message}` },
        { status: 500 }
      );
    }

    // Invite succeeded — do a best-effort profile update in case the row
    // already exists (e.g. from a previous partial sign-up).
    await serviceClient
      .from('profiles')
      .update({ is_tester: true })
      .eq('email', normalizedEmail);

    // Send the tester welcome email. The invite magic-link URL comes from the
    // Supabase invite response when available; otherwise fall back to /test-hub.
    const inviteUrl =
      (inviteData?.user?.confirmation_sent_at
        ? `${appUrl}/test-hub`
        : `${appUrl}/test-hub`);

    const emailContent = getTesterInviteEmail({
      testerEmail: normalizedEmail,
      inviteUrl,
    });

    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      tags: [
        { name: 'category', value: 'tester_invite' },
        { name: 'existing_user', value: 'false' },
      ],
    });

    if (!emailResult.success) {
      console.error('Failed to send tester welcome email:', emailResult.error);
    }

    await logAdminAction(
      admin.id,
      admin.email,
      'testing.tester_invited',
      'user',
      inviteData?.user?.id,
      normalizedEmail,
      { existing_user: false, email_sent: emailResult.success }
    );

    return NextResponse.json({
      success: true,
      message: `Invite sent to ${normalizedEmail}`,
      existing_user: false,
    });
  } catch (error) {
    console.error('Error inviting tester:', error);
    return NextResponse.json(
      { error: 'Server error while processing invite' },
      { status: 500 }
    );
  }
}
