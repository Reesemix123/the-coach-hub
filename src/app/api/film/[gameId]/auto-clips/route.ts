/**
 * API: POST /api/film/[gameId]/auto-clips
 *
 * Generates player_clips rows for every notable player in every tagged play
 * belonging to the specified game, then fires background clip extractions.
 *
 * Player association strategy (two tiers):
 *   Tier 1 — direct columns: ball_carrier_id, qb_id, target_id
 *   Tier 2 — notable participation types: primary_tackle, tackle_for_loss,
 *             interception, pass_breakup, forced_fumble, fumble_recovery,
 *             returner, and any 'pressure' row where result = 'sack'
 *
 * Only players that have an athlete_season record linked to a roster entry
 * for this team are included. Players without an athlete_profile are skipped.
 *
 * The response is returned BEFORE extractions start. Extractions are
 * fire-and-forget; failures are logged but do not affect the response.
 *
 * Authorization: team owner OR active team_memberships row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { extractAndUploadPlayerClip } from '@/lib/services/clip-extraction.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClipRow {
  athlete_profile_id: string;
  athlete_season_id: string;
  game_id: string;
  play_instance_id: string;
  sport: 'football';
  clip_start_seconds: number;
  clip_end_seconds: number;
  play_type: string | null;
  play_result: string | null;
  coach_approved: false;
  coach_suppressed: false;
  mux_clip_status: 'pending';
}

interface InsertedClip {
  id: string;
  play_instance_id: string;
}

interface RouteContext {
  params: Promise<{ gameId: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collects all non-null direct player IDs from a play instance row.
 */
function collectTier1PlayerIds(play: {
  ball_carrier_id: string | null;
  qb_id: string | null;
  target_id: string | null;
}): string[] {
  return [play.ball_carrier_id, play.qb_id, play.target_id].filter(
    (id): id is string => id !== null && id !== undefined
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { gameId } = await context.params;

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
    // 2. Fetch game to resolve team_id
    // -------------------------------------------------------------------------

    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, team_id')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const teamId = game.team_id;

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
    // 3b. Gate — auto-clips require a paid communication plan
    // -------------------------------------------------------------------------

    const { data: commPlan } = await supabase
      .from('team_communication_plans')
      .select('plan_tier')
      .eq('team_id', teamId)
      .eq('status', 'active')
      .single();

    const freeTiers = ['sideline', 'rookie'];
    if (!commPlan || freeTiers.includes(commPlan.plan_tier)) {
      return NextResponse.json(
        {
          error: 'Auto-clip generation requires a paid Communication Hub plan',
          code: 'PAID_PLAN_REQUIRED',
          current_tier: commPlan?.plan_tier || null,
          upgrade_tier: 'varsity',
        },
        { status: 403 }
      );
    }

    // All further DB work uses the service client to bypass RLS for inserts.
    const serviceClient = createServiceClient();

    // -------------------------------------------------------------------------
    // 4. Resolve video IDs for this game
    // -------------------------------------------------------------------------

    const { data: videos, error: videosError } = await serviceClient
      .from('videos')
      .select('id')
      .eq('game_id', gameId);

    if (videosError) {
      console.error('[auto-clips] Failed to fetch videos:', videosError);
      return NextResponse.json(
        { error: 'Failed to fetch game videos' },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json({ clipsQueued: 0 });
    }

    const videoIds = videos.map((v) => v.id);

    // -------------------------------------------------------------------------
    // 5. Fetch play instances for those videos
    // -------------------------------------------------------------------------

    const { data: plays, error: playsError } = await serviceClient
      .from('play_instances')
      .select(
        'id, video_id, timestamp_start, timestamp_end, play_code, result, ball_carrier_id, qb_id, target_id'
      )
      .in('video_id', videoIds);

    if (playsError) {
      console.error('[auto-clips] Failed to fetch play instances:', playsError);
      return NextResponse.json(
        { error: 'Failed to fetch play instances' },
        { status: 500 }
      );
    }

    if (!plays || plays.length === 0) {
      return NextResponse.json({ clipsQueued: 0 });
    }

    const playIds = plays.map((p) => p.id);

    // -------------------------------------------------------------------------
    // 6. Fetch notable participations (Tier 2) — two queries run in parallel
    // -------------------------------------------------------------------------

    const [
      { data: notableParticipations },
      { data: sackParticipations },
    ] = await Promise.all([
      serviceClient
        .from('player_participation')
        .select('play_instance_id, player_id, participation_type, result')
        .in('play_instance_id', playIds)
        .in('participation_type', [
          'primary_tackle',
          'tackle_for_loss',
          'interception',
          'pass_breakup',
          'forced_fumble',
          'fumble_recovery',
          'returner',
        ]),
      serviceClient
        .from('player_participation')
        .select('play_instance_id, player_id')
        .in('play_instance_id', playIds)
        .eq('participation_type', 'pressure')
        .eq('result', 'sack'),
    ]);

    // Build a map: play_instance_id → Set<player_id> (Tier 2)
    const tier2Map = new Map<string, Set<string>>();

    for (const row of notableParticipations ?? []) {
      if (!row.player_id) continue;
      const set = tier2Map.get(row.play_instance_id) ?? new Set<string>();
      set.add(row.player_id);
      tier2Map.set(row.play_instance_id, set);
    }
    for (const row of sackParticipations ?? []) {
      if (!row.player_id) continue;
      const set = tier2Map.get(row.play_instance_id) ?? new Set<string>();
      set.add(row.player_id);
      tier2Map.set(row.play_instance_id, set);
    }

    // -------------------------------------------------------------------------
    // 7. Collect all unique player IDs across both tiers
    // -------------------------------------------------------------------------

    const allPlayerIdSet = new Set<string>();

    for (const play of plays) {
      for (const id of collectTier1PlayerIds(play)) {
        allPlayerIdSet.add(id);
      }
      const t2 = tier2Map.get(play.id);
      if (t2) {
        for (const id of t2) {
          allPlayerIdSet.add(id);
        }
      }
    }

    const allPlayerIds = [...allPlayerIdSet];

    if (allPlayerIds.length === 0) {
      return NextResponse.json({ clipsQueued: 0 });
    }

    // -------------------------------------------------------------------------
    // 8. Resolve athlete_seasons for the collected player IDs
    // -------------------------------------------------------------------------

    const { data: seasons, error: seasonsError } = await serviceClient
      .from('athlete_seasons')
      .select('id, athlete_profile_id, roster_id, team_id')
      .in('roster_id', allPlayerIds)
      .eq('team_id', teamId);

    if (seasonsError) {
      console.error('[auto-clips] Failed to fetch athlete seasons:', seasonsError);
      return NextResponse.json(
        { error: 'Failed to fetch athlete seasons' },
        { status: 500 }
      );
    }

    // Build a map: roster_id (player_id) → { athleteProfileId, athleteSeasonId }
    const playerSeasonMap = new Map<
      string,
      { athleteProfileId: string; athleteSeasonId: string }
    >();

    for (const season of seasons ?? []) {
      // Skip rows that don't have an athlete_profile yet
      if (!season.athlete_profile_id || !season.roster_id) continue;
      playerSeasonMap.set(season.roster_id, {
        athleteProfileId: season.athlete_profile_id,
        athleteSeasonId: season.id,
      });
    }

    // -------------------------------------------------------------------------
    // 9. Build deduplicated clip rows
    // -------------------------------------------------------------------------

    const clipRows: ClipRow[] = [];

    for (const play of plays) {
      const tier1Ids = collectTier1PlayerIds(play);
      const tier2Ids = [...(tier2Map.get(play.id) ?? new Set<string>())];

      // Deduplicate: union of both tiers, one clip per (play, player)
      const playPlayerIds = new Set<string>([...tier1Ids, ...tier2Ids]);

      const clipStart = play.timestamp_start ?? 0;
      const clipEnd = play.timestamp_end ?? clipStart + 15;

      for (const playerId of playPlayerIds) {
        const seasonInfo = playerSeasonMap.get(playerId);
        if (!seasonInfo) {
          // Player has no athlete_season / athlete_profile — skip
          continue;
        }

        clipRows.push({
          athlete_profile_id: seasonInfo.athleteProfileId,
          athlete_season_id: seasonInfo.athleteSeasonId,
          game_id: gameId,
          play_instance_id: play.id,
          sport: 'football',
          clip_start_seconds: clipStart,
          clip_end_seconds: clipEnd,
          play_type: play.play_code ?? null,
          play_result: play.result ?? null,
          coach_approved: false,
          coach_suppressed: false,
          mux_clip_status: 'pending',
        });
      }
    }

    if (clipRows.length === 0) {
      return NextResponse.json({ clipsQueued: 0 });
    }

    // -------------------------------------------------------------------------
    // 10. Insert player_clips rows
    // -------------------------------------------------------------------------

    const { data: insertedClips, error: insertError } = await serviceClient
      .from('player_clips')
      .insert(clipRows)
      .select('id, play_instance_id');

    if (insertError) {
      console.error('[auto-clips] Failed to insert player_clips:', insertError);
      return NextResponse.json(
        { error: 'Failed to create clip records' },
        { status: 500 }
      );
    }

    const clipsToExtract = (insertedClips ?? []) as InsertedClip[];

    // -------------------------------------------------------------------------
    // 11. Return immediately, then fire extractions in the background
    // -------------------------------------------------------------------------

    // Fire extractions after response — do not await
    for (const clip of clipsToExtract) {
      extractAndUploadPlayerClip(clip.id, clip.play_instance_id).catch((err: unknown) => {
        console.error(
          `[auto-clips] Failed to extract clip ${clip.id} for play ${clip.play_instance_id}:`,
          err
        );
      });
    }

    // Fire report generation after clips are queued — do not await
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    fetch(`${appUrl}/api/player-profiles/generate-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
      body: JSON.stringify({ gameId, teamId }),
    }).catch((err: unknown) => {
      console.error('[auto-clips] Failed to trigger report generation:', err);
    });

    return NextResponse.json({ clipsQueued: clipsToExtract.length });
  } catch (error) {
    console.error('[auto-clips] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
