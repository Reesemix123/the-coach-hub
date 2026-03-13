/**
 * Notification Service
 * Handles email (Resend) and SMS (Twilio) notifications for the Communication Hub.
 * This is the shared utility that announcements, events, and RSVPs all use.
 */

import twilio from 'twilio';
import { sendEmail } from '@/lib/email';
import { createClient } from '@/utils/supabase/server';
import type {
  NotificationChannel,
  NotificationType,
  NotificationStatus,
} from '@/types/communication';

// ============================================================================
// Types
// ============================================================================

export interface SendNotificationInput {
  teamId: string;
  recipientId: string;
  recipientType: 'parent' | 'coach' | 'admin';
  channel: NotificationChannel;
  notificationType: NotificationType;
  subject: string;
  body: string; // HTML for email
  smsBody: string; // Plain text for SMS
  recipientEmail?: string;
  recipientPhone?: string;
}

export interface NotificationResult {
  channel: 'sms' | 'email';
  success: boolean;
  externalId?: string;
  error?: string;
}

export interface BulkRecipient {
  id: string;
  type: 'parent' | 'coach' | 'admin';
  email?: string;
  phone?: string;
  notificationPreference: NotificationChannel;
}

export interface SendBulkNotificationInput {
  teamId: string;
  recipients: BulkRecipient[];
  notificationType: NotificationType;
  subject: string;
  body: string;
  smsBody: string;
  channel: NotificationChannel; // Coach's chosen channel for this notification
  priority?: 'normal' | 'important' | 'urgent';
}

export interface BulkNotificationResult {
  sent: number;
  failed: number;
  results: Array<NotificationResult & { recipientId: string }>;
}

export interface GetNotificationLogOptions {
  notificationType?: NotificationType;
  channel?: 'sms' | 'email';
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface EmailTemplateOptions {
  title: string;
  body: string;
  teamName?: string;
  ctaText?: string;
  ctaUrl?: string;
}

// ============================================================================
// Twilio Client (Lazy Initialization)
// ============================================================================

let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient(): ReturnType<typeof twilio> {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)');
    }

    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

function getTwilioPhoneNumber(): string {
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!phoneNumber) {
    throw new Error('TWILIO_PHONE_NUMBER environment variable is not set');
  }
  return phoneNumber;
}

// ============================================================================
// Template Helpers
// ============================================================================

/**
 * Wraps content in the Communication Hub email template.
 * Matches existing Youth Coach Hub email styling (black header, white body).
 */
export function getCommHubEmailTemplate(options: EmailTemplateOptions): string {
  const { title, body, teamName, ctaText, ctaUrl } = options;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #000; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">Youth Coach Hub</h1>
        ${teamName ? `<p style="color: #B8CA6E; margin: 8px 0 0 0; font-size: 14px;">${teamName}</p>` : ''}
      </div>

      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e5e5; border-top: none;">
        <h2 style="margin-top: 0; color: #111;">${title}</h2>

        <div style="margin: 20px 0;">
          ${body}
        </div>

        ${ctaText && ctaUrl ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${ctaUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">${ctaText}</a>
          </div>
        ` : ''}

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="font-size: 12px; color: #666; margin-bottom: 0;">
          This email was sent by Youth Coach Hub. If you have any questions, please contact your coach.
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Formats SMS body with team name prefix.
 * Format: [TeamName] message
 */
export function formatSmsBody(teamName: string, message: string): string {
  const prefix = `[${teamName}] `;
  const maxLength = 1600; // Multi-segment SMS
  const availableLength = maxLength - prefix.length;

  if (message.length > availableLength) {
    return prefix + message.substring(0, availableLength - 3) + '...';
  }

  return prefix + message;
}

/**
 * Build email body for RSVP reminder notifications.
 * Shows event details and a CTA to respond.
 */
export function getRsvpReminderEmailBody(options: {
  teamName: string;
  eventTitle: string;
  eventDate: string;
  eventTime?: string;
  eventLocation?: string;
  ctaUrl?: string;
}): string {
  const { teamName, eventTitle, eventDate, eventTime, eventLocation, ctaUrl } = options;

  let details = `<p style="margin-bottom: 16px;">You haven't responded to this event yet. Please let the coaching staff know if your family can make it.</p>`;
  details += `<p style="margin-bottom: 8px;"><strong>Event:</strong> ${eventTitle}</p>`;
  details += `<p style="margin-bottom: 8px;"><strong>Date:</strong> ${eventDate}</p>`;
  if (eventTime) {
    details += `<p style="margin-bottom: 8px;"><strong>Time:</strong> ${eventTime}</p>`;
  }
  if (eventLocation) {
    details += `<p style="margin-bottom: 8px;"><strong>Location:</strong> ${eventLocation}</p>`;
  }

  return getCommHubEmailTemplate({
    title: `RSVP Reminder: ${eventTitle}`,
    body: details,
    teamName,
    ctaText: 'Respond Now',
    ctaUrl,
  });
}

// ============================================================================
// Core Service
// ============================================================================

/**
 * Sends a single notification via email, SMS, or both.
 * Logs every attempt to the notification_log table.
 */
export async function sendNotification(
  input: SendNotificationInput
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];

  if (input.channel === 'email' || input.channel === 'both') {
    if (!input.recipientEmail) {
      results.push({ channel: 'email', success: false, error: 'No email address provided' });
    } else {
      const emailResult = await sendEmailNotification(input);
      results.push(emailResult);
    }
  }

  if (input.channel === 'sms' || input.channel === 'both') {
    if (!input.recipientPhone) {
      results.push({ channel: 'sms', success: false, error: 'No phone number provided' });
    } else {
      const smsResult = await sendSmsNotification(input);
      results.push(smsResult);
    }
  }

  return results;
}

/**
 * Sends notifications to multiple recipients.
 *
 * Channel logic:
 * - If priority is 'urgent', force 'both' regardless of everything else
 * - Otherwise use the coach's chosen channel for this notification
 */
export async function sendBulkNotification(
  input: SendBulkNotificationInput
): Promise<BulkNotificationResult> {
  const results: Array<NotificationResult & { recipientId: string }> = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of input.recipients) {
    // Urgent overrides everything — always send both channels
    const effectiveChannel = input.priority === 'urgent' ? 'both' : input.channel;

    const recipientResults = await sendNotification({
      teamId: input.teamId,
      recipientId: recipient.id,
      recipientType: recipient.type,
      channel: effectiveChannel,
      notificationType: input.notificationType,
      subject: input.subject,
      body: input.body,
      smsBody: input.smsBody,
      recipientEmail: recipient.email,
      recipientPhone: recipient.phone,
    });

    for (const result of recipientResults) {
      results.push({ ...result, recipientId: recipient.id });
      if (result.success) sent++;
      else failed++;
    }
  }

  return { sent, failed, results };
}

/**
 * Retrieves notification log for a team.
 */
export async function getNotificationLog(
  teamId: string,
  options: GetNotificationLogOptions = {}
) {
  const supabase = await createClient();

  let query = supabase
    .from('notification_log')
    .select('*')
    .eq('team_id', teamId)
    .order('sent_at', { ascending: false });

  if (options.notificationType) {
    query = query.eq('notification_type', options.notificationType);
  }
  if (options.channel) {
    query = query.eq('channel', options.channel);
  }
  if (options.startDate) {
    query = query.gte('sent_at', options.startDate);
  }
  if (options.endDate) {
    query = query.lte('sent_at', options.endDate);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch notification log: ${error.message}`);
  return data || [];
}

// ============================================================================
// Private Helpers
// ============================================================================

async function sendEmailNotification(
  input: SendNotificationInput
): Promise<NotificationResult> {
  try {
    const result = await sendEmail({
      to: input.recipientEmail!,
      subject: input.subject,
      html: input.body,
      tags: [
        { name: 'team_id', value: input.teamId },
        { name: 'notification_type', value: input.notificationType },
      ],
    });

    await logNotification({
      teamId: input.teamId,
      recipientId: input.recipientId,
      recipientType: input.recipientType,
      channel: 'email',
      notificationType: input.notificationType,
      subject: input.subject,
      bodyPreview: extractPreview(input.body),
      externalId: result.messageId ?? null,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error ?? null,
    });

    return {
      channel: 'email',
      success: result.success,
      externalId: result.messageId,
      error: result.error,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown email error';
    console.error('[NotificationService] Email error:', errorMessage);

    await logNotification({
      teamId: input.teamId,
      recipientId: input.recipientId,
      recipientType: input.recipientType,
      channel: 'email',
      notificationType: input.notificationType,
      subject: input.subject,
      bodyPreview: extractPreview(input.body),
      externalId: null,
      status: 'failed',
      errorMessage,
    });

    return { channel: 'email', success: false, error: errorMessage };
  }
}

async function sendSmsNotification(
  input: SendNotificationInput
): Promise<NotificationResult> {
  try {
    const client = getTwilioClient();
    const fromNumber = getTwilioPhoneNumber();

    const message = await client.messages.create({
      body: input.smsBody,
      from: fromNumber,
      to: input.recipientPhone!,
    });

    await logNotification({
      teamId: input.teamId,
      recipientId: input.recipientId,
      recipientType: input.recipientType,
      channel: 'sms',
      notificationType: input.notificationType,
      subject: null,
      bodyPreview: extractPreview(input.smsBody),
      externalId: message.sid,
      status: message.status === 'failed' ? 'failed' : 'sent',
      errorMessage: message.errorMessage ?? null,
    });

    return {
      channel: 'sms',
      success: message.status !== 'failed',
      externalId: message.sid,
      error: message.errorMessage ?? undefined,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown SMS error';
    console.error('[NotificationService] SMS error:', errorMessage);

    await logNotification({
      teamId: input.teamId,
      recipientId: input.recipientId,
      recipientType: input.recipientType,
      channel: 'sms',
      notificationType: input.notificationType,
      subject: null,
      bodyPreview: extractPreview(input.smsBody),
      externalId: null,
      status: 'failed',
      errorMessage,
    });

    return { channel: 'sms', success: false, error: errorMessage };
  }
}

async function logNotification(params: {
  teamId: string;
  recipientId: string;
  recipientType: 'parent' | 'coach' | 'admin';
  channel: 'sms' | 'email';
  notificationType: NotificationType;
  subject: string | null;
  bodyPreview: string | null;
  externalId: string | null;
  status: NotificationStatus;
  errorMessage: string | null;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('notification_log').insert({
      team_id: params.teamId,
      recipient_id: params.recipientId,
      recipient_type: params.recipientType,
      channel: params.channel,
      notification_type: params.notificationType,
      subject: params.subject,
      body_preview: params.bodyPreview,
      external_id: params.externalId,
      status: params.status,
      error_message: params.errorMessage,
    });

    if (error) {
      console.error('[NotificationService] Failed to log notification:', error);
    }
  } catch (err) {
    // Logging failure should never block notification delivery
    console.error('[NotificationService] Exception logging notification:', err);
  }
}

function extractPreview(content: string): string {
  const text = content.replace(/<[^>]*>/g, '').trim();
  return text.length > 200 ? text.substring(0, 200) + '...' : text;
}
