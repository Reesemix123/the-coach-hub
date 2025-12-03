// src/lib/email/index.ts
// Email service abstraction layer - currently using Resend
// Easy to swap out for another provider if needed

import { Resend } from 'resend';

// Initialize Resend client only if API key is available
// This allows builds to pass without the key, but emails won't send
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Email configuration
const EMAIL_CONFIG = {
  // Use Resend's test email for development, swap to custom domain in production
  from: process.env.EMAIL_FROM || 'The Coach Hub <onboarding@resend.dev>',
  replyTo: process.env.EMAIL_REPLY_TO || 'support@thecoachhub.com',
};

// ============================================================================
// Types
// ============================================================================

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// Email Service
// ============================================================================

export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  // If Resend is not configured, log and return success (for development/build)
  if (!resend) {
    console.warn('[Email] Resend not configured - email not sent:', options.subject);
    return {
      success: true,
      messageId: 'not-configured',
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo || EMAIL_CONFIG.replyTo,
      tags: options.tags,
    });

    if (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (err) {
    console.error('Email service error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown email error',
    };
  }
}

// ============================================================================
// Email Templates
// ============================================================================

export function getPasswordResetEmail(options: {
  userName: string;
  temporaryPassword: string;
  adminName: string;
}): { subject: string; html: string; text: string } {
  const { userName, temporaryPassword, adminName } = options;

  const subject = 'Your The Coach Hub Password Has Been Reset';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #000; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">The Coach Hub</h1>
      </div>

      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
        <h2 style="margin-top: 0; color: #111;">Password Reset</h2>

        <p>Hello ${userName || 'Coach'},</p>

        <p>Your password has been reset by a platform administrator (${adminName}). Please use the temporary password below to log in:</p>

        <div style="background: #fff; border: 2px solid #000; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Temporary Password</p>
          <p style="margin: 0; font-size: 24px; font-family: monospace; font-weight: bold; letter-spacing: 2px; color: #000;">${temporaryPassword}</p>
        </div>

        <p style="color: #c00; font-weight: 500;">Important: Please change your password immediately after logging in.</p>

        <p>To log in:</p>
        <ol style="padding-left: 20px;">
          <li>Go to <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.thecoachhub.com'}/auth/login" style="color: #000;">The Coach Hub</a></li>
          <li>Enter your email and the temporary password above</li>
          <li>Go to your account settings and change your password</li>
        </ol>

        <p>If you did not expect this password reset or have concerns, please contact our support team.</p>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="font-size: 12px; color: #666; margin-bottom: 0;">
          This email was sent by The Coach Hub. If you have any questions, please contact support.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
Password Reset - The Coach Hub

Hello ${userName || 'Coach'},

Your password has been reset by a platform administrator (${adminName}).

Temporary Password: ${temporaryPassword}

IMPORTANT: Please change your password immediately after logging in.

To log in:
1. Go to ${process.env.NEXT_PUBLIC_APP_URL || 'https://app.thecoachhub.com'}/auth/login
2. Enter your email and the temporary password above
3. Go to your account settings and change your password

If you did not expect this password reset or have concerns, please contact our support team.

---
This email was sent by The Coach Hub.
  `.trim();

  return { subject, html, text };
}

export function getUserDeactivatedEmail(options: {
  userName: string;
  adminName: string;
  reason?: string;
}): { subject: string; html: string; text: string } {
  const { userName, adminName, reason } = options;

  const subject = 'Your The Coach Hub Account Has Been Deactivated';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Deactivated</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #000; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">The Coach Hub</h1>
      </div>

      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
        <h2 style="margin-top: 0; color: #111;">Account Deactivated</h2>

        <p>Hello ${userName || 'User'},</p>

        <p>Your The Coach Hub account has been deactivated by a platform administrator (${adminName}).</p>

        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}

        <p>While your account is deactivated:</p>
        <ul style="padding-left: 20px;">
          <li>You cannot log in to the platform</li>
          <li>Your data remains intact and can be restored</li>
          <li>Your team memberships are preserved</li>
        </ul>

        <p>If you believe this was done in error or have questions, please contact our support team.</p>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="font-size: 12px; color: #666; margin-bottom: 0;">
          This email was sent by The Coach Hub. If you have any questions, please contact support.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
Account Deactivated - The Coach Hub

Hello ${userName || 'User'},

Your The Coach Hub account has been deactivated by a platform administrator (${adminName}).

${reason ? `Reason: ${reason}` : ''}

While your account is deactivated:
- You cannot log in to the platform
- Your data remains intact and can be restored
- Your team memberships are preserved

If you believe this was done in error or have questions, please contact our support team.

---
This email was sent by The Coach Hub.
  `.trim();

  return { subject, html, text };
}

export function getUserReactivatedEmail(options: {
  userName: string;
  adminName: string;
}): { subject: string; html: string; text: string } {
  const { userName, adminName } = options;

  const subject = 'Your The Coach Hub Account Has Been Reactivated';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Reactivated</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #000; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">The Coach Hub</h1>
      </div>

      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
        <h2 style="margin-top: 0; color: #111;">Welcome Back!</h2>

        <p>Hello ${userName || 'User'},</p>

        <p>Great news! Your The Coach Hub account has been reactivated by a platform administrator (${adminName}).</p>

        <p>You can now log in and access all your data and team memberships as before.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.thecoachhub.com'}/auth/login" style="display: inline-block; background: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">Log In Now</a>
        </div>

        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="font-size: 12px; color: #666; margin-bottom: 0;">
          This email was sent by The Coach Hub. If you have any questions, please contact support.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome Back! - The Coach Hub

Hello ${userName || 'User'},

Great news! Your The Coach Hub account has been reactivated by a platform administrator (${adminName}).

You can now log in and access all your data and team memberships as before.

Log in at: ${process.env.NEXT_PUBLIC_APP_URL || 'https://app.thecoachhub.com'}/auth/login

If you have any questions or need assistance, please don't hesitate to contact our support team.

---
This email was sent by The Coach Hub.
  `.trim();

  return { subject, html, text };
}
