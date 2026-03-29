/**
 * API: POST /api/player-profiles/generate-report
 *
 * Generates a player performance report for every athlete_season linked to the
 * given team, scoped to a specific game.
 *
 * Authorization: team owner OR active team_memberships row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { generatePlayerReport } from '@/lib/services/player-report.service';

export async function POST(request: NextRequest) {
  try {
    // -------------------------------------------------------------------------
    // 1. Parse and validate body
    // -------------------------------------------------------------------------

    const body = await request.json() as { gameId?: unknown; teamId?: unknown };
    const { gameId, teamId } = body;

    if (!gameId || typeof gameId !== 'string') {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }
    if (!teamId || typeof teamId !== 'string') {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // -------------------------------------------------------------------------
    // 2. Auth — verify requesting user is authenticated
    // -------------------------------------------------------------------------

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // -------------------------------------------------------------------------
    // 4. Fetch all athlete_seasons for this team
    // -------------------------------------------------------------------------

    const serviceClient = createServiceClient();
    const { data: seasons, error: seasonsError } = await serviceClient
      .from('athlete_seasons')
      .select('id, athlete_profile_id, roster_id, team_id')
      .eq('team_id', teamId);

    if (seasonsError) {
      console.error('[generate-report] Failed to fetch athlete seasons:', seasonsError);
      return NextResponse.json({ error: 'Failed to fetch athlete seasons' }, { status: 500 });
    }

    if (!seasons || seasons.length === 0) {
      console.log('[generate-report] No athlete seasons found for team:', teamId);
      return NextResponse.json({ success: 0, failed: 0 });
    }

    // -------------------------------------------------------------------------
    // 5. Generate reports concurrently
    // -------------------------------------------------------------------------

    console.log(
      `[generate-report] Generating reports for ${seasons.length} athletes — game: ${gameId}, team: ${teamId}`
    );

    const results = await Promise.allSettled(
      seasons.map((season) =>
        generatePlayerReport(season.athlete_profile_id, gameId, teamId)
      )
    );

    const success = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(
          `[generate-report] Failed for athlete ${seasons[i].athlete_profile_id}:`,
          r.reason
        );
      }
    });

    console.log(`[generate-report] Complete — success: ${success}, failed: ${failed}`);

    return NextResponse.json({ success, failed });
  } catch (error) {
    console.error('[generate-report] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
