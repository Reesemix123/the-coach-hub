// /api/admin/users/[id]/reactivate - Reactivate User API
// Reactivates a previously deactivated user account
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';
import { sendEmail, getUserReactivatedEmail } from '@/lib/email';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/users/[id]/reactivate
 * Reactivates a user account
 *
 * Body:
 * - send_email: boolean (default true) - Whether to send notification email
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { id: userId } = await params;
  const supabase = auth.serviceClient;

  try {
    const body = await request.json().catch(() => ({}));
    const sendEmailFlag = body.send_email !== false; // Default to true

    // Fetch user profile
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_deactivated, deactivation_reason')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.is_deactivated) {
      return NextResponse.json(
        { error: 'User is not deactivated' },
        { status: 400 }
      );
    }

    // Store previous deactivation reason for audit log
    const previousReason = user.deactivation_reason;

    // Update user profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_deactivated: false,
        deactivated_at: null,
        deactivated_by: null,
        deactivation_reason: null
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Send email notification if requested
    let emailSent = false;
    if (sendEmailFlag && user.email) {
      const emailContent = getUserReactivatedEmail({
        userName: user.full_name || user.email,
        adminName: auth.admin.email
      });

      const emailResult = await sendEmail({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        tags: [
          { name: 'category', value: 'account_reactivated' },
          { name: 'admin_initiated', value: 'true' }
        ]
      });

      emailSent = emailResult.success;

      if (!emailResult.success) {
        console.error('Failed to send reactivation email:', emailResult.error);
      }
    }

    // Log the admin action
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'user.reactivated',
      'user',
      userId,
      user.email || 'Unknown',
      {
        previous_deactivation_reason: previousReason,
        email_sent: emailSent
      }
    );

    return NextResponse.json({
      success: true,
      message: 'User reactivated successfully',
      email_sent: emailSent
    });

  } catch (error) {
    console.error('Error reactivating user:', error);
    return NextResponse.json(
      { error: 'Failed to reactivate user' },
      { status: 500 }
    );
  }
}
