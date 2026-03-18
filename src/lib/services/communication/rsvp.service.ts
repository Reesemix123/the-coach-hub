/**
 * RSVP Service
 * Handles event RSVP submission, retrieval, and summary statistics
 * Family-based RSVPs with per-child exceptions
 */

import { createClient } from '@/utils/supabase/server';
import type {
  EventRSVP,
  RSVPStatus,
  ChildException,
} from '@/types/communication';

// ======================
// RSVP SUBMISSION
// ======================

export interface SubmitRSVPInput {
  eventId: string;
  parentId: string;
  familyStatus: RSVPStatus; // 'attending' | 'not_attending' | 'maybe'
  childExceptions?: ChildException[]; // [{ player_id, status, note? }]
  note?: string;
}

/**
 * Submit or update a parent's RSVP for an event
 * Uses upsert so calling again updates the existing RSVP
 * Sets responded_at timestamp on each submission
 */
export async function submitRSVP(input: SubmitRSVPInput): Promise<EventRSVP> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('event_rsvps')
    .upsert(
      {
        event_id: input.eventId,
        parent_id: input.parentId,
        family_status: input.familyStatus,
        child_exceptions: input.childExceptions || [],
        note: input.note?.trim() || null,
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'event_id,parent_id',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to submit RSVP: ${error.message}`);
  }

  return data;
}

// ======================
// RSVP RETRIEVAL
// ======================

/**
 * Get a specific parent's RSVP for an event
 * Returns null if parent has not yet responded
 */
export async function getRSVPForParent(
  eventId: string,
  parentId: string
): Promise<EventRSVP | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('event_rsvps')
    .select('*')
    .eq('event_id', eventId)
    .eq('parent_id', parentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch RSVP: ${error.message}`);
  }

  return data;
}

// ======================
// COACH VIEW (with parent/children info)
// ======================

export interface RSVPWithParentInfo {
  id: string;
  eventId: string;
  parentId: string;
  parentName: string;
  familyStatus: RSVPStatus;
  childExceptions: ChildException[];
  note: string | null;
  respondedAt: string;
  children: Array<{
    playerId: string;
    playerName: string;
    jerseyNumber: number | null;
    effectiveStatus: RSVPStatus; // Family status unless overridden by exception
  }>;
}

/**
 * Get all RSVPs for an event, with parent names and children info
 * For coach view to see who's attending/not attending
 * Computes effective status for each child (exception takes precedence over family status)
 */
export async function getEventRSVPs(eventId: string): Promise<RSVPWithParentInfo[]> {
  const supabase = await createClient();

  // Get all RSVPs with parent info
  const { data: rsvps, error: rsvpError } = await supabase
    .from('event_rsvps')
    .select(`
      id,
      event_id,
      parent_id,
      family_status,
      child_exceptions,
      note,
      responded_at,
      parent_profiles!inner (
        first_name,
        last_name
      )
    `)
    .eq('event_id', eventId)
    .order('responded_at', { ascending: false });

  if (rsvpError) {
    throw new Error(`Failed to fetch RSVPs: ${rsvpError.message}`);
  }

  if (!rsvps || rsvps.length === 0) {
    return [];
  }

  // Get parent IDs to fetch their children
  const parentIds = rsvps.map(r => r.parent_id);

  // Get team_id from the event
  const { data: event, error: eventError } = await supabase
    .from('team_events')
    .select('team_id')
    .eq('id', eventId)
    .single();

  if (eventError) {
    throw new Error(`Failed to fetch event: ${eventError.message}`);
  }

  // Get all children for these parents on this team
  const { data: playerLinks, error: linksError } = await supabase
    .from('player_parent_links')
    .select(`
      parent_id,
      player_id,
      players!inner (
        id,
        first_name,
        last_name,
        jersey_number,
        team_id
      )
    `)
    .in('parent_id', parentIds)
    .eq('players.team_id', event.team_id);

  if (linksError) {
    throw new Error(`Failed to fetch player links: ${linksError.message}`);
  }

  // Build a map of parent_id -> children[]
  const childrenByParent = new Map<string, Array<{
    playerId: string;
    playerName: string;
    jerseyNumber: number | null;
  }>>();

  (playerLinks || []).forEach(link => {
    const player = link.players as unknown as {
      id: string;
      first_name: string;
      last_name: string;
      jersey_number: number | null;
    };

    if (!childrenByParent.has(link.parent_id)) {
      childrenByParent.set(link.parent_id, []);
    }

    childrenByParent.get(link.parent_id)!.push({
      playerId: player.id,
      playerName: `${player.first_name} ${player.last_name}`,
      jerseyNumber: player.jersey_number,
    });
  });

  // Map RSVPs to response format
  return rsvps.map(rsvp => {
    const parent = rsvp.parent_profiles as unknown as { first_name: string; last_name: string };
    const children = childrenByParent.get(rsvp.parent_id) || [];

    // Build exception lookup map
    const exceptionMap = new Map<string, RSVPStatus>();
    (rsvp.child_exceptions as ChildException[]).forEach(exc => {
      exceptionMap.set(exc.player_id, exc.status);
    });

    // Compute effective status for each child
    const childrenWithStatus = children.map(child => ({
      ...child,
      effectiveStatus: exceptionMap.get(child.playerId) || rsvp.family_status as RSVPStatus,
    }));

    return {
      id: rsvp.id,
      eventId: rsvp.event_id,
      parentId: rsvp.parent_id,
      parentName: `${parent.first_name} ${parent.last_name}`,
      familyStatus: rsvp.family_status as RSVPStatus,
      childExceptions: rsvp.child_exceptions as ChildException[],
      note: rsvp.note,
      respondedAt: rsvp.responded_at,
      children: childrenWithStatus,
    };
  });
}

// ======================
// RSVP SUMMARY STATISTICS
// ======================

export interface RSVPSummary {
  attending: number;
  notAttending: number;
  maybe: number;
  noResponse: number;
  totalParents: number;
}

/**
 * Get aggregate RSVP counts for an event
 * Counts: attending, not_attending, maybe, and no_response (total - responded)
 * For coach dashboard to see overall event attendance
 */
export async function getRSVPSummary(eventId: string, teamId: string): Promise<RSVPSummary> {
  const supabase = await createClient();

  // Get total active parents for the team
  const { count: totalParents, error: countError } = await supabase
    .from('team_parent_access')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('status', 'active');

  if (countError) {
    throw new Error(`Failed to count parents: ${countError.message}`);
  }

  // Get all RSVPs for this event
  const { data: rsvps, error: rsvpError } = await supabase
    .from('event_rsvps')
    .select('family_status')
    .eq('event_id', eventId);

  if (rsvpError) {
    throw new Error(`Failed to fetch RSVPs: ${rsvpError.message}`);
  }

  // Count by status
  const counts = {
    attending: 0,
    notAttending: 0,
    maybe: 0,
  };

  (rsvps || []).forEach(rsvp => {
    if (rsvp.family_status === 'attending') {
      counts.attending += 1;
    } else if (rsvp.family_status === 'not_attending') {
      counts.notAttending += 1;
    } else if (rsvp.family_status === 'maybe') {
      counts.maybe += 1;
    }
  });

  const totalResponded = counts.attending + counts.notAttending + counts.maybe;
  const noResponse = (totalParents || 0) - totalResponded;

  return {
    attending: counts.attending,
    notAttending: counts.notAttending,
    maybe: counts.maybe,
    noResponse,
    totalParents: totalParents || 0,
  };
}

// ======================
// PARENT CHILDREN LOOKUP
// ======================

export interface ParentChild {
  playerId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  positionGroup: string | null;
}

/**
 * Get list of a parent's children on a specific team
 * Used for RSVP modal to show which children can have exceptions
 */
export async function getParentChildrenForTeam(
  parentId: string,
  teamId: string
): Promise<ParentChild[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('player_parent_links')
    .select(`
      player_id,
      players!inner (
        id,
        first_name,
        last_name,
        jersey_number,
        position_group,
        team_id
      )
    `)
    .eq('parent_id', parentId)
    .eq('players.team_id', teamId);

  if (error) {
    throw new Error(`Failed to fetch parent's children: ${error.message}`);
  }

  return (data || []).map(link => {
    const player = link.players as unknown as {
      id: string;
      first_name: string;
      last_name: string;
      jersey_number: number | null;
      position_group: string | null;
    };

    return {
      playerId: player.id,
      firstName: player.first_name,
      lastName: player.last_name,
      jerseyNumber: player.jersey_number,
      positionGroup: player.position_group,
    };
  });
}
