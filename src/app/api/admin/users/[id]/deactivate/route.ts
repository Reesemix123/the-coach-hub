// /api/admin/users/[id]/deactivate - Deactivate User API
// Deactivates a user account (prevents login)
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';
import { sendEmail, getUserDeactivatedEmail } from '@/lib/email';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/users/[id]/deactivate
 * Deactivates a user account
 *
 * Body:
 * - reason: string (optional) - Reason for deactivation
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
    const reason = body.reason || null;
    const sendEmailFlag = body.send_email !== false; // Default to true

    // Fetch user profile
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_deactivated, is_platform_admin')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.is_deactivated) {
      return NextResponse.json(
        { error: 'User is already deactivated' },
        { status: 400 }
      );
    }

    // Prevent deactivating yourself
    if (userId === auth.admin.id) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 }
      );
    }

    // Prevent deactivating other platform admins (safety measure)
    if (user.is_platform_admin) {
      return NextResponse.json(
        { error: 'Cannot deactivate platform administrators. Remove admin privileges first.' },
        { status: 400 }
      );
    }

    // Update user profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_deactivated: true,
        deactivated_at: new Date().toISOString(),
        deactivated_by: auth.admin.id,
        deactivation_reason: reason
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Send email notification if requested
    let emailSent = false;
    if (sendEmailFlag && user.email) {
      const emailContent = getUserDeactivatedEmail({
        userName: user.full_name || user.email,
        adminName: auth.admin.email,
        reason: reason || undefined
      });

      const emailResult = await sendEmail({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        tags: [
          { name: 'category', value: 'account_deactivated' },
          { name: 'admin_initiated', value: 'true' }
        ]
      });

      emailSent = emailResult.success;

      if (!emailResult.success) {
        console.error('Failed to send deactivation email:', emailResult.error);
      }
    }

    // Log the admin action
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'user.deactivated',
      'user',
      userId,
      user.email || 'Unknown',
      {
        reason,
        email_sent: emailSent
      }
    );

    return NextResponse.json({
      success: true,
      message: 'User deactivated successfully',
      email_sent: emailSent
    });

  } catch (error) {
    console.error('Error deactivating user:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate user' },
      { status: 500 }
    );
  }
}
