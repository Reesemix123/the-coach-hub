/**
 * API: /api/communication/parents/email-change
 * POST — Request an email address change for a parent (coach-initiated).
 *
 * Flow:
 *   1. Coach submits parentId + newEmail.
 *   2. Server validates the request and checks team access.
 *   3. A row is inserted into `parent_email_changes` with a 72-hour token.
 *   4. A confirmation email is sent to the NEW address. The parent must click
 *      the link before the change takes effect. The parent's current email is
 *      NOT changed until they confirm via /auth/confirm-email-change.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { sendEmail } from '@/lib/email';
import { getCommHubEmailTemplate } from '@/lib/services/communication/notification.service';
import crypto from 'crypto';

// ============================================================================
// Constants
// ============================================================================

const TOKEN_TTL_HOURS = 72;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================================
// Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // ── 1. Authenticate ───────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Validate input ────────────────────────────────────────────────
    const body = await request.json();
    const { parentId, newEmail, teamId } = body as {
      parentId?: string;
      newEmail?: string;
      teamId?: string;
    };

    if (!parentId || !newEmail || !teamId) {
      return NextResponse.json(
        { error: 'parentId, newEmail, and teamId are required' },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(newEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // ── 3. Authorize — verify coach has access to this team ───────────────
    const { data: team } = await supabase
      .from('teams')
      .select('user_id')
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
      .maybeSingle();

    const isOwner = team.user_id === user.id;
    const isTeamCoach =
      membership?.role === 'coach' ||
      membership?.role === 'team_admin' ||
      membership?.role === 'owner';

    if (!isOwner && !isTeamCoach) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // ── 4. Verify the parent belongs to this team ─────────────────────────
    // Use the service client so RLS doesn't block cross-table lookups.
    const serviceClient = createServiceClient();

    const { data: parentAccess } = await serviceClient
      .from('team_parent_access')
      .select('parent_id')
      .eq('team_id', teamId)
      .eq('parent_id', parentId)
      .eq('status', 'active')
      .maybeSingle();

    if (!parentAccess) {
      return NextResponse.json(
        { error: 'Parent not found on this team' },
        { status: 404 }
      );
    }

    const { data: parent } = await serviceClient
      .from('parent_profiles')
      .select('id, email, first_name')
      .eq('id', parentId)
      .single();

    if (!parent) {
      return NextResponse.json({ error: 'Parent profile not found' }, { status: 404 });
    }

    // Reject if the new address is the same as the current one.
    if (parent.email.toLowerCase() === newEmail.toLowerCase()) {
      return NextResponse.json(
        { error: 'New email is the same as the current email' },
        { status: 400 }
      );
    }

    // Reject if there is already a pending request for this parent.
    const { data: existing } = await serviceClient
      .from('parent_email_changes')
      .select('id')
      .eq('parent_id', parentId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error:
            'A pending email change already exists for this parent. Ask them to check their inbox or wait for it to expire.',
        },
        { status: 409 }
      );
    }

    // ── 5. Create the change request ──────────────────────────────────────
    const confirmationToken = crypto.randomBytes(32).toString('hex');

    const { error: insertError } = await serviceClient
      .from('parent_email_changes')
      .insert({
        parent_id: parentId,
        old_email: parent.email,
        new_email: newEmail,
        requested_by: user.id,
        confirmation_token: confirmationToken,
        status: 'pending',
      });

    if (insertError) {
      console.error('[EmailChange] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create email change request' },
        { status: 500 }
      );
    }

    // ── 6. Send confirmation email to the NEW address ─────────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const confirmUrl = `${appUrl}/auth/confirm-email-change?token=${confirmationToken}`;
    const firstName = parent.first_name || 'there';

    const emailHtml = getCommHubEmailTemplate({
      title: 'Confirm Your Email Change',
      body: `
        <p>Hi ${firstName},</p>
        <p>Your coaching staff submitted a request to update your Youth Coach Hub email address.</p>
        <p style="margin: 16px 0;">
          <strong>Current email:</strong> ${parent.email}<br>
          <strong>New email:</strong> ${newEmail}
        </p>
        <p>Click the button below to confirm this change. This link expires in ${TOKEN_TTL_HOURS} hours.</p>
        <p style="font-size: 14px; color: #666;">
          If you did not expect this request, you can safely ignore this email. Your current email will remain unchanged.
        </p>
      `,
      ctaText: 'Confirm Email Change',
      ctaUrl: confirmUrl,
    });

    const emailResult = await sendEmail({
      to: newEmail,
      subject: 'Confirm Your Email Change — Youth Coach Hub',
      html: emailHtml,
    });

    if (!emailResult.success) {
      // The request is already persisted — log the failure but don't roll back.
      // The coach can re-trigger or the parent can contact support.
      console.error('[EmailChange] Failed to send confirmation email:', emailResult.error);
      return NextResponse.json(
        {
          error:
            'Email change request was saved but the confirmation email could not be delivered. Please try again.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Confirmation email sent to ${newEmail}. The email will be updated once the parent confirms.`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[EmailChange] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to process email change request' },
      { status: 500 }
    );
  }
}
