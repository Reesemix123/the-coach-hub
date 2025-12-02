// /api/admin/users/[id]/reset-password - Password Reset API
// Generates a temporary password and optionally emails it to the user
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';
import { sendEmail, getPasswordResetEmail } from '@/lib/email';
import { ResetPasswordResponse } from '@/types/admin';
import crypto from 'crypto';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Generates a secure random temporary password
 * Format: 4 letters + 4 digits (e.g., "abcd1234")
 */
function generateTemporaryPassword(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';

  let password = '';

  // Generate 4 random letters
  for (let i = 0; i < 4; i++) {
    password += letters.charAt(crypto.randomInt(letters.length));
  }

  // Generate 4 random digits
  for (let i = 0; i < 4; i++) {
    password += digits.charAt(crypto.randomInt(digits.length));
  }

  return password;
}

/**
 * POST /api/admin/users/[id]/reset-password
 * Generates a temporary password and optionally emails it to the user
 *
 * Body:
 * - send_email: boolean (default true) - Whether to send email with temp password
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
      .select('id, email, full_name, is_deactivated')
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
        { error: 'Cannot reset password for deactivated user' },
        { status: 400 }
      );
    }

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();

    // Use Supabase Admin API to update the user's password
    // We need to use the admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Update the user's password via admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: temporaryPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      );
    }

    // Store token record for audit trail (we hash the password for storage)
    const tokenHash = crypto
      .createHash('sha256')
      .update(temporaryPassword)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    try {
      await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: userId,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
          created_by: auth.admin.id,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent')
        });
    } catch {
      // Table may not exist yet - continue anyway
    }

    // Send email if requested
    let emailSent = false;
    if (sendEmailFlag && user.email) {
      const emailContent = getPasswordResetEmail({
        userName: user.full_name || user.email,
        temporaryPassword,
        adminName: auth.admin.email
      });

      const emailResult = await sendEmail({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        tags: [
          { name: 'category', value: 'password_reset' },
          { name: 'admin_initiated', value: 'true' }
        ]
      });

      emailSent = emailResult.success;

      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
      }
    }

    // Log the admin action
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'user.password_reset_initiated',
      'user',
      userId,
      user.email || 'Unknown',
      {
        email_sent: emailSent,
        expires_at: expiresAt.toISOString()
      }
    );

    const response: ResetPasswordResponse = {
      success: true,
      temporary_password: temporaryPassword,
      email_sent: emailSent,
      expires_at: expiresAt.toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
