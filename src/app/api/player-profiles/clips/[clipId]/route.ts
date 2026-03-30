/**
 * API: PATCH /api/player-profiles/clips/[clipId]
 *
 * Allows a coach to approve, suppress, or annotate an individual player clip.
 *
 * Actions:
 *   approve    — marks the clip as coach-approved and clears suppression
 *   suppress   — marks the clip as suppressed and clears approval
 *   add_note   — attaches a coach note without changing approval state
 *
 * If action is 'approve' AND a note is provided in the same request, both
 * fields are written in a single update.
 *
 * Authorization: team owner OR active team_memberships row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClipAction = 'approve' | 'suppress' | 'add_note';

interface PatchBody {
  action: ClipAction;
  note?: string;
}

interface RouteContext {
  params: Promise<{ clipId: string }>;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { clipId } = await context.params;

    // -------------------------------------------------------------------------
    // 1. Auth — verify requesting user is authenticated
    // -------------------------------------------------------------------------

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // -------------------------------------------------------------------------
    // 2. Parse and validate request body
    // -------------------------------------------------------------------------

    let body: PatchBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validActions: ClipAction[] = ['approve', 'suppress', 'add_note'];
    if (!body.action || !validActions.includes(body.action)) {
      return NextResponse.json(
        { error: 'action must be one of: approve, suppress, add_note' },
        { status: 400 }
      );
    }

    if (body.action === 'add_note' && !body.note) {
      return NextResponse.json(
        { error: 'note is required when action is add_note' },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // 3. Fetch the clip and resolve team_id via service client
    // -------------------------------------------------------------------------

    const serviceClient = createServiceClient();

    const { data: clip, error: clipError } = await serviceClient
      .from('player_clips')
      .select('id, athlete_season_id, athlete_seasons!inner(team_id)')
      .eq('id', clipId)
      .single();

    if (clipError || !clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    // The join returns athlete_seasons as an object (single row via !inner).
    // Cast through unknown to satisfy strict type checking on the Supabase-inferred shape.
    const athleteSeason = clip.athlete_seasons as unknown as { team_id: string };
    const teamId = athleteSeason.team_id;

    // -------------------------------------------------------------------------
    // 4. Authorize — team owner OR active team member
    // -------------------------------------------------------------------------

    const [{ data: team }, { data: membership }] = await Promise.all([
      supabase.from('teams').select('user_id').eq('id', teamId).single(),
      supabase
        .from('team_memberships')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single(),
    ]);

    const isOwner = team?.user_id === user.id;
    const isMember = !!membership;

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // -------------------------------------------------------------------------
    // 5. Build update object based on action
    // -------------------------------------------------------------------------

    let updatePayload: Record<string, boolean | string | null> = {};

    if (body.action === 'approve') {
      updatePayload = {
        coach_approved: true,
        coach_suppressed: false,
      };
      // Also write note if provided alongside approve
      if (body.note !== undefined) {
        updatePayload.coach_note = body.note;
      }
    } else if (body.action === 'suppress') {
      updatePayload = {
        coach_suppressed: true,
        coach_approved: false,
      };
    } else {
      // add_note — note presence validated above
      updatePayload = {
        coach_note: body.note ?? null,
      };
    }

    // -------------------------------------------------------------------------
    // 6. Persist update and return updated row
    // -------------------------------------------------------------------------

    const { data: updated, error: updateError } = await serviceClient
      .from('player_clips')
      .update(updatePayload)
      .eq('id', clipId)
      .select()
      .single();

    if (updateError) {
      console.error('[player-clips] Failed to update clip:', updateError);
      return NextResponse.json(
        { error: 'Failed to update clip' },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[player-clips] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
