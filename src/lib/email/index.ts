// src/lib/email/index.ts
// Email service abstraction layer - currently using Resend
// Easy to swap out for another provider if needed

import { Resend } from 'resend';

// Initialize Resend client lazily to avoid build-time errors
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Email configuration
const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'Youth Coach Hub <noreply@youthcoachhub.com>',
  replyTo: process.env.EMAIL_REPLY_TO || 'support@youthcoachhub.com',
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
  try {
    const { data, error } = await getResendClient().emails.send({
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

  const subject = 'Your Youth Coach Hub Password Has Been Reset';

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
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Youth Coach Hub</h1>
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
          <li>Go to <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://youthcoachhub.com'}/auth/login" style="color: #000;">Youth Coach Hub</a></li>
          <li>Enter your email and the temporary password above</li>
          <li>Go to your account settings and change your password</li>
        </ol>

        <p>If you did not expect this password reset or have concerns, please contact our support team.</p>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="font-size: 12px; color: #666; margin-bottom: 0;">
          This email was sent by Youth Coach Hub. If you have any questions, please contact support.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
Password Reset - Youth Coach Hub

Hello ${userName || 'Coach'},

Your password has been reset by a platform administrator (${adminName}).

Temporary Password: ${temporaryPassword}

IMPORTANT: Please change your password immediately after logging in.

To log in:
1. Go to ${process.env.NEXT_PUBLIC_APP_URL || 'https://youthcoachhub.com'}/auth/login
2. Enter your email and the temporary password above
3. Go to your account settings and change your password

If you did not expect this password reset or have concerns, please contact our support team.

---
This email was sent by Youth Coach Hub.
  `.trim();

  return { subject, html, text };
}

export function getUserDeactivatedEmail(options: {
  userName: string;
  adminName: string;
  reason?: string;
}): { subject: string; html: string; text: string } {
  const { userName, adminName, reason } = options;

  const subject = 'Your Youth Coach Hub Account Has Been Deactivated';

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
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Youth Coach Hub</h1>
      </div>

      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
        <h2 style="margin-top: 0; color: #111;">Account Deactivated</h2>

        <p>Hello ${userName || 'User'},</p>

        <p>Your Youth Coach Hub account has been deactivated by a platform administrator (${adminName}).</p>

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
          This email was sent by Youth Coach Hub. If you have any questions, please contact support.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
Account Deactivated - Youth Coach Hub

Hello ${userName || 'User'},

Your Youth Coach Hub account has been deactivated by a platform administrator (${adminName}).

${reason ? `Reason: ${reason}` : ''}

While your account is deactivated:
- You cannot log in to the platform
- Your data remains intact and can be restored
- Your team memberships are preserved

If you believe this was done in error or have questions, please contact our support team.

---
This email was sent by Youth Coach Hub.
  `.trim();

  return { subject, html, text };
}

export function getNewFeedbackEmail(options: {
  feedbackType: string;
  description: string;
  pageUrl?: string;
  feedbackId: string;
}): { subject: string; html: string; text: string } {
  const { feedbackType, description, pageUrl, feedbackId } = options;

  const typeLabels: Record<string, string> = {
    bug: "Bug Report",
    confusing: "Something Confusing",
    missing: "Something Missing",
    suggestion: "Suggestion",
    feature_request: "Feature Request",
    praise: "Positive Feedback",
  };

  const typeLabel = typeLabels[feedbackType] || feedbackType;
  const shortId = feedbackId.substring(0, 8).toUpperCase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://youthcoachhub.com';

  const subject = `New Feedback: ${typeLabel} (#${shortId})`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Feedback</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #000; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Youth Coach Hub</h1>
      </div>

      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
        <h2 style="margin-top: 0; color: #111;">New Feedback Received</h2>

        <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Type:</strong> ${typeLabel}</p>
          <p style="margin: 0 0 10px 0;"><strong>ID:</strong> #${shortId}</p>
          ${pageUrl ? `<p style="margin: 0 0 10px 0;"><strong>Page:</strong> <a href="${pageUrl}" style="color: #000;">${pageUrl}</a></p>` : ''}
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 15px 0;">
          <p style="margin: 0; white-space: pre-wrap;">${description}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${appUrl}/admin/feedback" style="display: inline-block; background: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">View in Admin Panel</a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="font-size: 12px; color: #666; margin-bottom: 0;">
          This is an automated notification from Youth Coach Hub.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
New Feedback Received - Youth Coach Hub

Type: ${typeLabel}
ID: #${shortId}
${pageUrl ? `Page: ${pageUrl}` : ''}

---
${description}
---

View in Admin Panel: ${appUrl}/admin/feedback

This is an automated notification from Youth Coach Hub.
  `.trim();

  return { subject, html, text };
}

export function getTeamInviteEmail(options: {
  inviteeEmail: string;
  teamName: string;
  inviterName: string;
  inviteLink: string;
  role: string;
}): { subject: string; html: string; text: string } {
  const { teamName, inviterName, inviteLink, role } = options;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://youthcoachhub.com';

  const subject = `You've been invited to join ${teamName} on Youth Coach Hub`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Team Invitation</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #000; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Youth Coach Hub</h1>
      </div>

      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
        <h2 style="margin-top: 0; color: #111;">You're Invited!</h2>

        <p><strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> as a <strong>${role}</strong> on Youth Coach Hub.</p>

        <p>Youth Coach Hub is a comprehensive platform for football coaches to:</p>
        <ul style="padding-left: 20px;">
          <li>Build and organize your digital playbook</li>
          <li>Upload and analyze game film</li>
          <li>Track player performance and statistics</li>
          <li>Collaborate with your coaching staff</li>
        </ul>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="display: inline-block; background: #000; color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
        </div>

        <p style="color: #666; font-size: 14px;">This invitation will expire in 7 days. Click the button above to create your account and join the team.</p>

        <p style="color: #666; font-size: 14px;">If you're having trouble with the button, copy and paste this link into your browser:</p>
        <p style="color: #000; font-size: 12px; word-break: break-all; background: #fff; padding: 10px; border-radius: 4px;">${inviteLink}</p>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="font-size: 12px; color: #666; margin-bottom: 0;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
You're Invited to Youth Coach Hub!

${inviterName} has invited you to join ${teamName} as a ${role} on Youth Coach Hub.

Youth Coach Hub is a comprehensive platform for football coaches to:
- Build and organize your digital playbook
- Upload and analyze game film
- Track player performance and statistics
- Collaborate with your coaching staff

Accept your invitation: ${inviteLink}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

---
Youth Coach Hub
${appUrl}
  `.trim();

  return { subject, html, text };
}

export function getUserReactivatedEmail(options: {
  userName: string;
  adminName: string;
}): { subject: string; html: string; text: string } {
  const { userName, adminName } = options;

  const subject = 'Your Youth Coach Hub Account Has Been Reactivated';

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
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Youth Coach Hub</h1>
      </div>

      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
        <h2 style="margin-top: 0; color: #111;">Welcome Back!</h2>

        <p>Hello ${userName || 'User'},</p>

        <p>Great news! Your Youth Coach Hub account has been reactivated by a platform administrator (${adminName}).</p>

        <p>You can now log in and access all your data and team memberships as before.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://youthcoachhub.com'}/auth/login" style="display: inline-block; background: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">Log In Now</a>
        </div>

        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="font-size: 12px; color: #666; margin-bottom: 0;">
          This email was sent by Youth Coach Hub. If you have any questions, please contact support.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome Back! - Youth Coach Hub

Hello ${userName || 'User'},

Great news! Your Youth Coach Hub account has been reactivated by a platform administrator (${adminName}).

You can now log in and access all your data and team memberships as before.

Log in at: ${process.env.NEXT_PUBLIC_APP_URL || 'https://youthcoachhub.com'}/auth/login

If you have any questions or need assistance, please don't hesitate to contact our support team.

---
This email was sent by Youth Coach Hub.
  `.trim();

  return { subject, html, text };
}
