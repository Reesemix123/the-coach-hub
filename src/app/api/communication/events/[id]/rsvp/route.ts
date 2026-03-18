/**
 * API: /api/communication/events/[id]/rsvp
 * POST - Submit/update RSVP (parents only)
 * GET - Get RSVP status (parents: their RSVP, coaches: all RSVPs + summary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

type FamilyStatus = 'attending' | 'not_attending' | 'maybe';

interface ChildException {
  player_id: string;
  status: 'attending' | 'not_attending' | 'maybe';
  note?: string;
}

interface PostRequestBody {
  familyStatus: FamilyStatus;
  childExceptions?: ChildException[];
  note?: string;
}

/**
 * POST - Submit or update RSVP
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get event ID from route params
    const params = await context.params;
    const eventId = params.id;

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Parse request body
    const body: PostRequestBody = await request.json();
    const { familyStatus, childExceptions, note } = body;

    // Validate familyStatus
    if (!familyStatus || !['attending', 'not_attending', 'maybe'].includes(familyStatus)) {
      return NextResponse.json(
        { error: 'familyStatus must be one of: attending, not_attending, maybe' },
        { status: 400 }
      );
    }

    // Get parent profile for current user
    const { data: parentProfile, error: parentError } = await supabase
      .from('parent_profiles')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single();

    if (parentError || !parentProfile) {
      return NextResponse.json(
        { error: 'Only parents can submit RSVPs' },
        { status: 403 }
      );
    }

    // Verify event exists and get team_id
    const { data: event, error: eventError } = await supabase
      .from('team_events')
      .select('id, team_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Verify parent has access to this team
    const { data: parentAccess } = await supabase
      .from('team_parent_access')
      .select('id')
      .eq('team_id', event.team_id)
      .eq('parent_id', parentProfile.id)
      .eq('status', 'active')
      .single();

    if (!parentAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this event' },
        { status: 403 }
      );
    }

    // Upsert RSVP
    const { data: rsvp, error: rsvpError } = await supabase
      .from('event_rsvps')
      .upsert(
        {
          event_id: eventId,
          parent_id: parentProfile.id,
          family_status: familyStatus,
          child_exceptions: childExceptions || [],
          note: note || null,
          responded_at: new Date().toISOString(),
        },
        {
          onConflict: 'event_id,parent_id',
        }
      )
      .select()
      .single();

    if (rsvpError) {
      console.error('Failed to submit RSVP:', rsvpError);
      return NextResponse.json(
        { error: 'Failed to submit RSVP' },
        { status: 500 }
      );
    }

    return NextResponse.json({ rsvp }, { status: 200 });
  } catch (error) {
    console.error('Error submitting RSVP:', error);
    return NextResponse.json(
      { error: 'Failed to submit RSVP' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get RSVP status for an event
 * Parents: their RSVP + their children
 * Coaches: all RSVPs with summary
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get event ID from route params
    const params = await context.params;
    const eventId = params.id;

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Verify event exists and get team_id
    const { data: event, error: eventError } = await supabase
      .from('team_events')
      .select('id, team_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Determine if user is a parent or coach (maybeSingle since coaches won't have a parent profile)
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    // Check if user is a coach for this team
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', event.team_id)
      .single();

    const isOwner = team?.user_id === user.id;

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', event.team_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isCoach = isOwner || !!membership;

    if (parentProfile) {
      // Parent response: their RSVP + their children

      // Verify parent has access to this team
      const { data: parentAccess } = await supabase
        .from('team_parent_access')
        .select('id')
        .eq('team_id', event.team_id)
        .eq('parent_id', parentProfile.id)
        .eq('status', 'active')
        .single();

      if (!parentAccess) {
        return NextResponse.json(
          { error: 'You do not have access to this event' },
          { status: 403 }
        );
      }

      // Get their RSVP
      const { data: rsvp } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', eventId)
        .eq('parent_id', parentProfile.id)
        .single();

      // Get their children on this team
      const { data: children } = await supabase
        .from('player_parent_links')
        .select(`
          player_id,
          players (
            id,
            first_name,
            last_name,
            jersey_number,
            team_id
          )
        `)
        .eq('parent_id', parentProfile.id);

      // Filter children by team_id
      const teamChildren = children
        ?.filter((link: any) => link.players?.team_id === event.team_id)
        .map((link: any) => link.players) || [];

      return NextResponse.json({
        rsvp: rsvp || null,
        children: teamChildren,
      });
    } else if (isCoach) {
      // Coach response: all RSVPs with summary

      // Get all RSVPs for this event with parent info
      const { data: rsvps } = await supabase
        .from('event_rsvps')
        .select(`
          *,
          parent_profiles (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('event_id', eventId)
        .order('responded_at', { ascending: false });

      // Get total parent count for this team
      const { data: allParents } = await supabase
        .from('team_parent_access')
        .select('parent_id')
        .eq('team_id', event.team_id)
        .eq('status', 'active');

      const totalParents = allParents?.length || 0;

      // Compute summary
      const attending = rsvps?.filter((r: any) => r.family_status === 'attending').length || 0;
      const notAttending = rsvps?.filter((r: any) => r.family_status === 'not_attending').length || 0;
      const maybe = rsvps?.filter((r: any) => r.family_status === 'maybe').length || 0;
      const noResponse = totalParents - (rsvps?.length || 0);

      return NextResponse.json({
        rsvps: rsvps || [],
        summary: {
          attending,
          not_attending: notAttending,
          maybe,
          no_response: noResponse,
          total_parents: totalParents,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'You do not have access to this event' },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('Error fetching RSVP status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSVP status' },
      { status: 500 }
    );
  }
}
