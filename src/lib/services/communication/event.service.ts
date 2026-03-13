/**
 * Event Service
 * Handles team event creation, retrieval, updates, and scheduling
 */

import { createClient } from '@/utils/supabase/server';
import type {
  TeamEventExtended,
  EventType,
  NotificationChannel,
  RecurrenceRule,
} from '@/types/communication';

// ======================
// EVENT CREATION
// ======================

export interface CreateEventInput {
  teamId: string;
  createdBy: string;
  eventType: EventType;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  location?: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
  locationNotes?: string;
  opponent?: string;
  notificationChannel: NotificationChannel;
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
}

/**
 * Create a new team event
 * Computes start_datetime and end_datetime from date + time fields
 */
export async function createEvent(input: CreateEventInput): Promise<TeamEventExtended> {
  const supabase = await createClient();

  // Compute ISO 8601 datetime strings
  const startDatetime = input.startTime
    ? `${input.date}T${input.startTime}:00`
    : null;
  const endDatetime = input.endTime
    ? `${input.date}T${input.endTime}:00`
    : null;

  const { data, error } = await supabase
    .from('team_events')
    .insert({
      team_id: input.teamId,
      created_by: input.createdBy,
      event_type: input.eventType,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      date: input.date,
      start_time: input.startTime || null,
      end_time: input.endTime || null,
      location: input.location?.trim() || null,
      location_address: input.locationAddress?.trim() || null,
      location_lat: input.locationLat || null,
      location_lng: input.locationLng || null,
      location_notes: input.locationNotes?.trim() || null,
      opponent: input.opponent?.trim() || null,
      is_recurring: input.isRecurring || false,
      recurrence_rule: input.recurrenceRule || null,
      notification_channel: input.notificationChannel,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create event: ${error.message}`);
  }

  return data;
}

// ======================
// EVENT UPDATE
// ======================

export interface UpdateEventInput {
  eventType?: EventType;
  title?: string;
  description?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
  locationNotes?: string;
  opponent?: string;
  notificationChannel?: NotificationChannel;
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
}

/**
 * Update an existing event
 * Recomputes start_datetime and end_datetime if date or time fields change
 */
export async function updateEvent(
  eventId: string,
  input: UpdateEventInput
): Promise<TeamEventExtended> {
  const supabase = await createClient();

  // Get existing event to compute new datetimes
  const { data: existing, error: fetchError } = await supabase
    .from('team_events')
    .select('date, start_time, end_time')
    .eq('id', eventId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch event: ${fetchError.message}`);
  }

  // Merge existing + new values
  const finalDate = input.date ?? existing.date;
  const finalStartTime = input.startTime !== undefined ? input.startTime : existing.start_time;
  const finalEndTime = input.endTime !== undefined ? input.endTime : existing.end_time;

  // Recompute datetimes
  const startDatetime = finalStartTime
    ? `${finalDate}T${finalStartTime}:00`
    : null;
  const endDatetime = finalEndTime
    ? `${finalDate}T${finalEndTime}:00`
    : null;

  // Build update object
  const updates: Record<string, unknown> = {};

  if (input.eventType !== undefined) updates.event_type = input.eventType;
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.date !== undefined) updates.date = input.date;
  if (input.startTime !== undefined) updates.start_time = input.startTime || null;
  if (input.endTime !== undefined) updates.end_time = input.endTime || null;
  if (input.location !== undefined) updates.location = input.location?.trim() || null;
  if (input.locationAddress !== undefined) updates.location_address = input.locationAddress?.trim() || null;
  if (input.locationLat !== undefined) updates.location_lat = input.locationLat || null;
  if (input.locationLng !== undefined) updates.location_lng = input.locationLng || null;
  if (input.locationNotes !== undefined) updates.location_notes = input.locationNotes?.trim() || null;
  if (input.opponent !== undefined) updates.opponent = input.opponent?.trim() || null;
  if (input.notificationChannel !== undefined) updates.notification_channel = input.notificationChannel;
  if (input.isRecurring !== undefined) updates.is_recurring = input.isRecurring;
  if (input.recurrenceRule !== undefined) updates.recurrence_rule = input.recurrenceRule || null;

  // Always recompute datetimes if any date/time field changed
  if (input.date !== undefined || input.startTime !== undefined || input.endTime !== undefined) {
    updates.start_datetime = startDatetime;
    updates.end_datetime = endDatetime;
  }

  const { data, error } = await supabase
    .from('team_events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update event: ${error.message}`);
  }

  return data;
}

// ======================
// EVENT DELETION
// ======================

/**
 * Delete an event by ID
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('team_events')
    .delete()
    .eq('id', eventId);

  if (error) {
    throw new Error(`Failed to delete event: ${error.message}`);
  }
}

// ======================
// EVENT RETRIEVAL
// ======================

export interface GetEventsOptions {
  startDate?: string;
  endDate?: string;
  eventType?: EventType;
  upcoming?: boolean; // Only future events
  limit?: number;
}

/**
 * Get all events for a team with optional filters
 * Orders by start_datetime ascending (earliest first)
 */
export async function getTeamEvents(
  teamId: string,
  options: GetEventsOptions = {}
): Promise<TeamEventExtended[]> {
  const supabase = await createClient();

  let query = supabase
    .from('team_events')
    .select('*')
    .eq('team_id', teamId);

  // Filter by date range
  if (options.startDate) {
    query = query.gte('date', options.startDate);
  }

  if (options.endDate) {
    query = query.lte('date', options.endDate);
  }

  // Filter by event type
  if (options.eventType) {
    query = query.eq('event_type', options.eventType);
  }

  // Filter by upcoming (start_datetime >= now)
  if (options.upcoming) {
    const now = new Date().toISOString();
    query = query.gte('start_datetime', now);
  }

  // Apply limit
  if (options.limit) {
    query = query.limit(options.limit);
  }

  // Order by start_datetime (earliest first), fallback to date if no time
  query = query.order('start_datetime', { ascending: true, nullsFirst: false });
  query = query.order('date', { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single event by ID
 */
export async function getEventById(eventId: string): Promise<TeamEventExtended | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('team_events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch event: ${error.message}`);
  }

  return data;
}

/**
 * Get upcoming events for a team
 * Returns next N events where start_datetime >= now
 */
export async function getUpcomingEvents(
  teamId: string,
  limit: number = 5
): Promise<TeamEventExtended[]> {
  return getTeamEvents(teamId, { upcoming: true, limit });
}

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Generate a universal map link that works on all platforms
 * iOS will prompt to open in Apple Maps
 * Format: https://www.google.com/maps/search/?api=1&query=lat,lng
 */
export function generateMapLink(lat: number, lng: number, locationName: string): string {
  const query = `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Format event date/time range as human-readable string
 * Examples:
 * - "March 15, 2026 at 3:00 PM - 5:00 PM"
 * - "March 15, 2026 at 3:00 PM"
 * - "March 15, 2026"
 */
export function formatEventDateRange(
  startDatetime: string,
  endDatetime: string | null
): string {
  const start = new Date(startDatetime);

  // Format date part
  const datePart = start.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Format time part
  const timePart = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // If no end time, return date + start time
  if (!endDatetime) {
    return `${datePart} at ${timePart}`;
  }

  const end = new Date(endDatetime);
  const endTimePart = end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${datePart} at ${timePart} - ${endTimePart}`;
}
