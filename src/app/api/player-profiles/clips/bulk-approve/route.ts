/**
 * API: POST /api/player-profiles/clips/bulk-approve
 *
 * Bulk-approves all pending (not yet approved or suppressed) player clips
 * for a given team. An optional gameId scopes the operation to a single game.
 *
 * Authorization: team owner OR active team_memberships row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BulkApproveBody {
  teamId: string;
  gameId?: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
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

    let body: BulkApproveBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    const { teamId, gameId } = body;

    // -------------------------------------------------------------------------
    // 3. Authorize — team owner OR active team member
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

    const serviceClient = createServiceClient();

    // -------------------------------------------------------------------------
    // 4. Resolve all athlete_season IDs for this team
    // -------------------------------------------------------------------------

    const { data: seasons, error: seasonsError } = await serviceClient
      .from('athlete_seasons')
      .select('id')
      .eq('team_id', teamId);

    if (seasonsError) {
      console.error('[bulk-approve] Failed to fetch athlete seasons:', seasonsError);
      return NextResponse.json(
        { error: 'Failed to fetch team athletes' },
        { status: 500 }
      );
    }

    if (!seasons || seasons.length === 0) {
      return NextResponse.json({ approved: 0 });
    }

    const seasonIds = seasons.map((s) => s.id);

    // -------------------------------------------------------------------------
    // 5. Bulk-approve all pending clips scoped to those seasons
    // -------------------------------------------------------------------------

    let updateQuery = serviceClient
      .from('player_clips')
      .update({ coach_approved: true })
      .eq('coach_approved', false)
      .eq('coach_suppressed', false)
      .in('athlete_season_id', seasonIds);

    if (gameId) {
      updateQuery = updateQuery.eq('game_id', gameId);
    }

    const { data: updatedRows, error: updateError } = await updateQuery.select('id');

    if (updateError) {
      console.error('[bulk-approve] Failed to bulk-approve clips:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve clips' },
        { status: 500 }
      );
    }

    return NextResponse.json({ approved: (updatedRows ?? []).length });
  } catch (error) {
    console.error('[bulk-approve] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
