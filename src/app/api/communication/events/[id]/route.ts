/**
 * API: /api/communication/events/[id]
 * GET - Get single event
 * PATCH - Update event
 * DELETE - Delete event (owner only via RLS)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params

    const { data: event, error } = await supabase
      .from('team_events')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return NextResponse.json({ event })
  } catch (err) {
    console.error('Error fetching event:', err)
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const body = await request.json()

    // Build update object — only include provided fields
    const updates: Record<string, unknown> = {}
    const allowedFields = [
      'title', 'description', 'date', 'start_time', 'end_time',
      'location', 'location_address', 'location_lat', 'location_lng',
      'location_notes', 'opponent', 'event_type', 'notification_channel',
      'is_recurring', 'recurrence_rule', 'rsvp_enabled',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    // Recompute datetimes if date or times changed
    if (body.date || body.start_time || body.end_time) {
      // Fetch current event to fill missing values
      const { data: current } = await supabase
        .from('team_events').select('date, start_time, end_time').eq('id', id).single()

      const date = body.date ?? current?.date
      const startTime = body.start_time ?? current?.start_time
      const endTime = body.end_time ?? current?.end_time

      if (date && startTime) updates.start_datetime = `${date}T${startTime}:00`
      if (date && endTime) updates.end_datetime = `${date}T${endTime}:00`
    }

    const { data: event, error } = await supabase
      .from('team_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update event:', error)
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
    }

    return NextResponse.json({ event })
  } catch (err) {
    console.error('Error updating event:', err)
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params

    // RLS enforces owner-only delete
    const { error } = await supabase
      .from('team_events')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete event:', error)
      return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error deleting event:', err)
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}
