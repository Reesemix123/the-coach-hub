/**
 * API: /api/communication/settings
 * GET  - Get team communication settings
 * PATCH - Update team communication settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    const { data: settings } = await serviceClient
      .from('team_communication_settings')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle();

    // Return defaults if no settings row exists
    return NextResponse.json({
      settings: settings || {
        team_id: teamId,
        allow_parent_to_parent_messaging: true,
        treats_enabled: false,
        max_treat_slots_per_event: 2,
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, ...updates } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // Verify coach/owner access
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
    const isStaff = ['owner', 'coach', 'team_admin'].includes(membership?.role || '');

    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Only allow known fields
    const allowedFields: Record<string, unknown> = {};
    if ('treats_enabled' in updates) allowedFields.treats_enabled = updates.treats_enabled;
    if ('max_treat_slots_per_event' in updates) allowedFields.max_treat_slots_per_event = updates.max_treat_slots_per_event;
    if ('allow_parent_to_parent_messaging' in updates) allowedFields.allow_parent_to_parent_messaging = updates.allow_parent_to_parent_messaging;

    const serviceClient = createServiceClient();

    const { data: settings, error: upsertError } = await serviceClient
      .from('team_communication_settings')
      .upsert(
        {
          team_id: teamId,
          ...allowedFields,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'team_id' }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('Failed to update settings:', upsertError);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
