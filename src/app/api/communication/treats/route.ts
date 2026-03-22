/**
 * API: /api/communication/treats
 * GET  - List treat signups for a game or event
 * POST - Sign up to bring treats
 * DELETE - Cancel a treat signup
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParentProfileJoin {
  first_name: string;
  last_name: string;
}

interface TreatSignupRow {
  id: string;
  parent_id: string;
  description: string | null;
  signed_up_at: string;
  // Supabase returns joined relations as an array when selected without !inner
  parent_profiles: ParentProfileJoin[] | ParentProfileJoin | null;
}

interface CommSettingsRow {
  treats_enabled: boolean;
  max_treat_slots_per_event: number;
}

// ---------------------------------------------------------------------------
// GET — list signups + settings for a game or event
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate query params
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const gameId = searchParams.get('gameId');
    const eventId = searchParams.get('eventId');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    if (!gameId && !eventId) {
      return NextResponse.json(
        { error: 'gameId or eventId is required' },
        { status: 400 },
      );
    }

    // 3. All DB queries via service client to avoid RLS recursion
    const serviceClient = createServiceClient();

    // 4. Fetch communication settings for this team
    const { data: settings, error: settingsError } = await serviceClient
      .from('team_communication_settings')
      .select('treats_enabled, max_treat_slots_per_event')
      .eq('team_id', teamId)
      .maybeSingle();

    if (settingsError) {
      console.error('Failed to fetch treat settings:', settingsError);
      return NextResponse.json(
        { error: 'Failed to fetch treat settings' },
        { status: 500 },
      );
    }

    // Default values when no settings row exists yet
    const treatsEnabled = (settings as CommSettingsRow | null)?.treats_enabled ?? false;
    const maxSlots = (settings as CommSettingsRow | null)?.max_treat_slots_per_event ?? 2;

    // 5. Fetch signups with parent name
    let signupsQuery = serviceClient
      .from('treat_signups')
      .select(
        `
        id,
        parent_id,
        description,
        signed_up_at,
        parent_profiles (
          first_name,
          last_name
        )
      `,
      )
      .eq('team_id', teamId)
      .order('signed_up_at', { ascending: true });

    if (gameId) {
      signupsQuery = signupsQuery.eq('game_id', gameId);
    } else {
      signupsQuery = signupsQuery.eq('event_id', eventId!);
    }

    const { data: rawSignups, error: signupsError } = await signupsQuery;

    if (signupsError) {
      console.error('Failed to fetch treat signups:', signupsError);
      return NextResponse.json(
        { error: 'Failed to fetch treat signups' },
        { status: 500 },
      );
    }

    const signups = ((rawSignups ?? []) as unknown as TreatSignupRow[]).map((row) => {
      // parent_profiles may be an array (Supabase join) or a single object
      const profile = Array.isArray(row.parent_profiles)
        ? row.parent_profiles[0]
        : row.parent_profiles;
      const parentName = profile
        ? `${profile.first_name} ${profile.last_name}`.trim()
        : 'Unknown';
      return {
        id: row.id,
        parent_id: row.parent_id,
        parent_name: parentName,
        description: row.description,
        signed_up_at: row.signed_up_at,
      };
    });

    return NextResponse.json({
      treats_enabled: treatsEnabled,
      max_slots: maxSlots,
      signups,
    });
  } catch (error) {
    console.error('Error in GET /api/communication/treats:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — sign up to bring treats
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate body
    const body = await request.json();
    const { teamId, gameId, eventId, description } = body as {
      teamId?: string;
      gameId?: string;
      eventId?: string;
      description?: string;
    };

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    if (!gameId && !eventId) {
      return NextResponse.json(
        { error: 'gameId or eventId is required' },
        { status: 400 },
      );
    }

    // 3. All DB queries via service client
    const serviceClient = createServiceClient();

    // 4. Verify user is a parent
    const { data: parentProfile, error: parentError } = await serviceClient
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (parentError) {
      console.error('Failed to fetch parent profile:', parentError);
      return NextResponse.json({ error: 'Failed to verify parent profile' }, { status: 500 });
    }

    if (!parentProfile) {
      return NextResponse.json(
        { error: 'Only parents can sign up for treats' },
        { status: 403 },
      );
    }

    const parentId = parentProfile.id;

    // 5. Verify parent has active access to this team
    const { data: parentAccess } = await serviceClient
      .from('team_parent_access')
      .select('id')
      .eq('team_id', teamId)
      .eq('parent_id', parentId)
      .eq('status', 'active')
      .maybeSingle();

    if (!parentAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this team' },
        { status: 403 },
      );
    }

    // 6. Verify treats are enabled for this team
    const { data: settings } = await serviceClient
      .from('team_communication_settings')
      .select('treats_enabled, max_treat_slots_per_event')
      .eq('team_id', teamId)
      .maybeSingle();

    const treatsEnabled = (settings as CommSettingsRow | null)?.treats_enabled ?? false;
    const maxSlots = (settings as CommSettingsRow | null)?.max_treat_slots_per_event ?? 2;

    if (!treatsEnabled) {
      return NextResponse.json(
        { error: 'Treat signups are not enabled for this team' },
        { status: 403 },
      );
    }

    // 7. Build the filter for existing signups
    let existingQuery = serviceClient
      .from('treat_signups')
      .select('id, parent_id')
      .eq('team_id', teamId);

    if (gameId) {
      existingQuery = existingQuery.eq('game_id', gameId);
    } else {
      existingQuery = existingQuery.eq('event_id', eventId!);
    }

    const { data: existingSignups, error: existingError } = await existingQuery;

    if (existingError) {
      console.error('Failed to check existing signups:', existingError);
      return NextResponse.json(
        { error: 'Failed to verify slot availability' },
        { status: 500 },
      );
    }

    const signupList = existingSignups ?? [];

    // 8. Verify slot limit not exceeded
    if (signupList.length >= maxSlots) {
      return NextResponse.json(
        { error: 'All treat slots are already filled' },
        { status: 409 },
      );
    }

    // 9. Verify this parent hasn't already signed up
    const alreadySignedUp = signupList.some(
      (s: { id: string; parent_id: string }) => s.parent_id === parentId,
    );

    if (alreadySignedUp) {
      return NextResponse.json(
        { error: 'You have already signed up to bring treats for this event' },
        { status: 409 },
      );
    }

    // 10. Insert the signup
    const insertPayload: Record<string, unknown> = {
      team_id: teamId,
      parent_id: parentId,
      description: description?.trim() || null,
    };

    if (gameId) {
      insertPayload.game_id = gameId;
    } else {
      insertPayload.event_id = eventId;
    }

    const { data: signup, error: insertError } = await serviceClient
      .from('treat_signups')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert treat signup:', insertError);
      return NextResponse.json(
        { error: 'Failed to create treat signup' },
        { status: 500 },
      );
    }

    return NextResponse.json({ signup }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/communication/treats:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — cancel a signup
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate query params
    const { searchParams } = new URL(request.url);
    const signupId = searchParams.get('signupId');

    if (!signupId) {
      return NextResponse.json({ error: 'signupId is required' }, { status: 400 });
    }

    // 3. All DB queries via service client
    const serviceClient = createServiceClient();

    // 4. Verify user is a parent
    const { data: parentProfile, error: parentError } = await serviceClient
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (parentError) {
      console.error('Failed to fetch parent profile:', parentError);
      return NextResponse.json({ error: 'Failed to verify parent profile' }, { status: 500 });
    }

    if (!parentProfile) {
      return NextResponse.json(
        { error: 'Only parents can cancel treat signups' },
        { status: 403 },
      );
    }

    // 5. Fetch the signup and verify ownership
    const { data: existingSignup, error: fetchError } = await serviceClient
      .from('treat_signups')
      .select('id, parent_id')
      .eq('id', signupId)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to fetch treat signup:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch signup' }, { status: 500 });
    }

    if (!existingSignup) {
      return NextResponse.json({ error: 'Signup not found' }, { status: 404 });
    }

    if (existingSignup.parent_id !== parentProfile.id) {
      return NextResponse.json(
        { error: 'You can only cancel your own signup' },
        { status: 403 },
      );
    }

    // 6. Delete the signup
    const { error: deleteError } = await serviceClient
      .from('treat_signups')
      .delete()
      .eq('id', signupId);

    if (deleteError) {
      console.error('Failed to delete treat signup:', deleteError);
      return NextResponse.json(
        { error: 'Failed to cancel signup' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/communication/treats:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
