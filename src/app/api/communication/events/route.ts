/**
 * API: /api/communication/events
 * POST - Create event and send notifications
 * GET - List team events
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import {
  sendBulkNotification,
  getCommHubEmailTemplate,
  formatSmsBody,
  type BulkRecipient,
} from '@/lib/services/communication/notification.service';
import type { NotificationChannel, EventType } from '@/types/communication';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      teamId,
      eventType,
      title,
      description,
      date,
      startTime,
      endTime,
      location,
      locationAddress,
      locationLat,
      locationLng,
      locationNotes,
      opponent,
      notificationChannel,
      isRecurring,
      recurrenceRule,
    } = body;

    // Validate required fields
    if (!teamId || !eventType || !title || !date || !notificationChannel) {
      return NextResponse.json(
        { error: 'teamId, eventType, title, date, and notificationChannel are required' },
        { status: 400 }
      );
    }

    // Verify user has permission (owner, coach, or team_admin)
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, user_id')
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
      .single();

    const isOwner = team.user_id === user.id;
    const canCreateEvent = isOwner || ['owner', 'coach', 'team_admin'].includes(membership?.role || '');

    if (!canCreateEvent) {
      return NextResponse.json(
        { error: 'Not authorized to create events' },
        { status: 403 }
      );
    }

    // Compute start_datetime and end_datetime
    const startDatetime = `${date}T${startTime || '00:00'}:00`;
    const endDatetime = `${date}T${endTime || '23:59'}:00`;

    // Create the event
    const { data: event, error: insertError } = await supabase
      .from('team_events')
      .insert({
        team_id: teamId,
        created_by: user.id,
        event_type: eventType as EventType,
        title,
        description: description || null,
        date,
        start_time: startTime || null,
        end_time: endTime || null,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        location: location || null,
        location_address: locationAddress || null,
        location_lat: locationLat || null,
        location_lng: locationLng || null,
        location_notes: locationNotes || null,
        opponent: opponent || null,
        is_recurring: isRecurring || false,
        recurrence_rule: recurrenceRule || null,
        notification_channel: notificationChannel as NotificationChannel,
      })
      .select()
      .single();

    if (insertError || !event) {
      console.error('Failed to create event:', insertError);
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      );
    }

    // Get all active parents for the team
    const { data: parentAccessRecords, error: parentsError } = await supabase
      .from('team_parent_access')
      .select(`
        parent_id,
        parent_profiles!inner (
          id,
          user_id,
          first_name,
          last_name,
          email,
          phone,
          notification_preference
        )
      `)
      .eq('team_id', teamId)
      .eq('status', 'active');

    if (parentsError) {
      console.error('Failed to fetch parents:', parentsError);
      return NextResponse.json(
        { error: 'Failed to fetch parent recipients' },
        { status: 500 }
      );
    }

    // Build recipient list
    const recipients: BulkRecipient[] = (parentAccessRecords || []).map((record: any) => ({
      id: record.parent_profiles.id,
      type: 'parent' as const,
      email: record.parent_profiles.email,
      phone: record.parent_profiles.phone || undefined,
      notificationPreference: record.parent_profiles.notification_preference,
    }));

    // Send notifications if there are recipients
    let notificationSummary = { sent: 0, failed: 0 };

    if (recipients.length > 0) {
      // Format event date for display
      const eventDate = new Date(date);
      const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Build email body with event details
      let eventDetails = `<p style="margin-bottom: 16px;"><strong>Date:</strong> ${formattedDate}</p>`;

      if (startTime && endTime) {
        eventDetails += `<p style="margin-bottom: 16px;"><strong>Time:</strong> ${startTime} - ${endTime}</p>`;
      } else if (startTime) {
        eventDetails += `<p style="margin-bottom: 16px;"><strong>Time:</strong> ${startTime}</p>`;
      }

      if (location) {
        eventDetails += `<p style="margin-bottom: 16px;"><strong>Location:</strong> ${location}</p>`;
      }

      if (locationAddress) {
        eventDetails += `<p style="margin-bottom: 8px;"><strong>Address:</strong> ${locationAddress}</p>`;
      }

      if (opponent) {
        eventDetails += `<p style="margin-bottom: 16px;"><strong>Opponent:</strong> ${opponent}</p>`;
      }

      if (description) {
        eventDetails += `<p style="margin-top: 24px; white-space: pre-wrap;">${description}</p>`;
      }

      const emailBody = getCommHubEmailTemplate({
        title: `New Event: ${title}`,
        body: eventDetails,
        teamName: team.name,
        ctaText: 'View Calendar',
        ctaUrl: undefined, // Will be set to parent calendar URL when implemented
      });

      // Build SMS body
      let smsMessage = `${title} on ${formattedDate}`;
      if (location) {
        smsMessage += ` at ${location}`;
      }
      smsMessage += '. Open the app for details.';

      const smsBody = formatSmsBody(team.name, smsMessage);

      const result = await sendBulkNotification({
        teamId,
        recipients,
        notificationType: 'event',
        subject: `${team.name}: ${title}`,
        body: emailBody,
        smsBody,
        channel: notificationChannel as NotificationChannel,
      });

      notificationSummary = { sent: result.sent, failed: result.failed };
    }

    return NextResponse.json(
      {
        event,
        notification_summary: notificationSummary,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const eventType = searchParams.get('eventType');
    const upcoming = searchParams.get('upcoming') === 'true';
    const limitParam = searchParams.get('limit');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // Check if user is a parent (maybeSingle since coaches won't have a parent profile)
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const isParent = !!parentProfile;

    // Verify user has access to this team
    const serviceClient = createServiceClient();

    if (isParent) {
      // Verify parent has access to this team (use service client to avoid RLS recursion)
      const { data: parentAccess } = await serviceClient
        .from('team_parent_access')
        .select('id')
        .eq('team_id', teamId)
        .eq('parent_id', parentProfile.id)
        .eq('status', 'active')
        .single();

      if (!parentAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else {
      // Verify coach/staff has access
      const { data: team } = await supabase
        .from('teams')
        .select('user_id')
        .eq('id', teamId)
        .single();

      const { data: membership } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      const isOwner = team?.user_id === user.id;
      const hasAccess = isOwner || !!membership;

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Build the query (use service client for parents to avoid RLS issues)
    const queryClient = isParent ? serviceClient : supabase;
    let query = queryClient
      .from('team_events')
      .select('*')
      .eq('team_id', teamId)
      .order('start_datetime', { ascending: true }); // Chronological order for events

    if (upcoming) {
      query = query.gte('start_datetime', new Date().toISOString());
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (limitParam) {
      query = query.limit(parseInt(limitParam, 10));
    }

    const { data: events, error: eventsError } = await query;

    if (eventsError) {
      console.error('Failed to fetch events:', eventsError);
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    // For parents, include RSVPs
    if (isParent && events && events.length > 0) {
      const eventIds = events.map(e => e.id);
      const { data: rsvps } = await serviceClient
        .from('event_rsvps')
        .select('*')
        .eq('parent_id', parentProfile.id)
        .in('event_id', eventIds);

      const rsvpMap = new Map(
        (rsvps || []).map(r => [r.event_id, r])
      );

      const eventsWithRSVPs = events.map(event => ({
        ...event,
        rsvp: rsvpMap.get(event.id) || null,
      }));

      return NextResponse.json({ events: eventsWithRSVPs, rsvps: rsvps || [] });
    }

    // For coaches, return events as-is
    return NextResponse.json({ events: events || [] });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
