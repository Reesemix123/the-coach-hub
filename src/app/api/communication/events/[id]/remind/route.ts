/**
 * API: /api/communication/events/[id]/remind
 * POST - Send RSVP reminder to non-responding parents
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  sendBulkNotification,
  getRsvpReminderEmailBody,
  formatSmsBody,
  type BulkRecipient,
} from '@/lib/services/communication/notification.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ParentProfile {
  id: string;
  email: string;
  phone: string | null;
  notification_preference: 'sms' | 'email' | 'both';
}

interface ParentAccessRecord {
  parent_id: string;
  parent_profiles: ParentProfile;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const eventId = params.id;

    // Parse request body early (before it's consumed)
    const body = await request.json().catch(() => ({}));

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('team_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Verify user is a coach/owner
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('id', event.team_id)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', event.team_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isOwner = team.user_id === user.id;
    const canRemind = isOwner || ['owner', 'coach', 'team_admin'].includes(membership?.role ?? '');

    if (!canRemind) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get all active parents for the team
    const { data: allParents, error: parentsError } = await supabase
      .from('team_parent_access')
      .select(`
        parent_id,
        parent_profiles!inner (
          id,
          email,
          phone,
          notification_preference
        )
      `)
      .eq('team_id', event.team_id)
      .eq('status', 'active');

    if (parentsError) {
      return NextResponse.json({ error: 'Failed to fetch parents' }, { status: 500 });
    }

    // Get parents who already responded
    const { data: existingRsvps } = await supabase
      .from('event_rsvps')
      .select('parent_id')
      .eq('event_id', eventId);

    const respondedParentIds = new Set((existingRsvps ?? []).map(r => r.parent_id));

    // Filter to only non-responding parents
    const typedParents = (allParents ?? []) as unknown as ParentAccessRecord[];
    const nonRespondingParents = typedParents.filter(
      record => !respondedParentIds.has(record.parent_profiles.id)
    );

    if (nonRespondingParents.length === 0) {
      return NextResponse.json({
        message: 'All parents have already responded',
        sent: 0,
        failed: 0,
      });
    }

    // Build recipient list
    const recipients: BulkRecipient[] = nonRespondingParents.map(record => ({
      id: record.parent_profiles.id,
      type: 'parent' as const,
      email: record.parent_profiles.email,
      phone: record.parent_profiles.phone ?? undefined,
      notificationPreference: record.parent_profiles.notification_preference,
    }));

    // Format event date
    const eventDate = new Date(event.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Build time display
    let timeDisplay: string | undefined;
    if (event.start_time && event.end_time) {
      timeDisplay = `${event.start_time} - ${event.end_time}`;
    } else if (event.start_time) {
      timeDisplay = event.start_time;
    }

    // Build email body
    const emailBody = getRsvpReminderEmailBody({
      teamName: team.name,
      eventTitle: event.title,
      eventDate,
      eventTime: timeDisplay,
      eventLocation: event.location ?? undefined,
    });

    // Build SMS body
    const smsMessage = `Reminder: Please RSVP for "${event.title}" on ${eventDate}. Open the app to respond.`;
    const smsBody = formatSmsBody(team.name, smsMessage);

    // Determine channel from request body or fall back to the event's default
    const channel = body.channel ?? event.notification_channel ?? 'email';

    const result = await sendBulkNotification({
      teamId: event.team_id,
      recipients,
      notificationType: 'rsvp_reminder',
      subject: `${team.name}: RSVP Reminder - ${event.title}`,
      body: emailBody,
      smsBody,
      channel,
    });

    return NextResponse.json({
      message: `Reminder sent to ${result.sent} parents`,
      sent: result.sent,
      failed: result.failed,
      total_non_responding: nonRespondingParents.length,
    });
  } catch (error) {
    console.error('Error sending RSVP reminder:', error);
    return NextResponse.json(
      { error: 'Failed to send reminders' },
      { status: 500 }
    );
  }
}
