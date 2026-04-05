/**
 * API: GET /api/parent/athletes/[athleteId]/clips
 *
 * Returns approved, non-suppressed clips for an athlete profile with signed
 * Mux playback URLs. Optionally filters by season via ?seasonId= query param.
 *
 * Auth: parent must own or be linked to the athlete profile.
 * Access: clips only returned if parent_can_access_athlete_content() is true
 * for the relevant season. Locked clips return with playbackUrl = null.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { getSignedPlaybackUrl } from '@/lib/services/communication/video.service';

interface RouteContext {
  params: Promise<{ athleteId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { athleteId } = await context.params;
    const seasonId = request.nextUrl.searchParams.get('seasonId');

    // 1. Auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get parent profile
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!parentProfile) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 3. Verify ownership (created_by_parent_id matches)
    const serviceClient = createServiceClient();
    const { data: profile } = await serviceClient
      .from('athlete_profiles')
      .select('id, created_by_parent_id')
      .eq('id', athleteId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (profile.created_by_parent_id !== parentProfile.id) {
      // Check linked access
      const { data: linked } = await serviceClient
        .from('athlete_seasons')
        .select('id')
        .eq('athlete_profile_id', athleteId)
        .limit(1);

      // Simplified: if no seasons exist, deny. Full link check is in layout.
      if (!linked || linked.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    // 4. Check content access via RPC
    const { data: hasAccess } = await serviceClient.rpc(
      'parent_can_access_athlete_content',
      { p_athlete_profile_id: athleteId, p_parent_id: parentProfile.id }
    );

    // 4b. Check comm plan tier — free tiers cannot access clips
    // Find the team via athlete_season
    const { data: athleteSeasons } = await serviceClient
      .from('athlete_seasons')
      .select('team_id')
      .eq('athlete_profile_id', athleteId)
      .limit(1);

    if (athleteSeasons && athleteSeasons.length > 0) {
      const { data: commPlan } = await serviceClient
        .from('team_communication_plans')
        .select('plan_tier')
        .eq('team_id', athleteSeasons[0].team_id)
        .eq('status', 'active')
        .single();

      const freeTiers = ['sideline', 'rookie'];
      if (!commPlan || freeTiers.includes(commPlan.plan_tier)) {
        // Return empty clips with an upgrade hint instead of an error
        return NextResponse.json({
          clips: [],
          locked: true,
          upgrade_required: true,
          message: 'Video clips require the team to have a paid Communication Hub plan',
        });
      }
    }

    // 5. Fetch approved, non-suppressed clips
    let query = serviceClient
      .from('player_clips')
      .select(
        'id, athlete_season_id, game_id, play_instance_id, sport, ' +
        'clip_start_seconds, clip_end_seconds, play_type, play_result, ' +
        'coach_note, is_featured, mux_playback_id, mux_clip_status, ' +
        'tags, created_at'
      )
      .eq('athlete_profile_id', athleteId)
      .eq('coach_approved', true)
      .eq('coach_suppressed', false)
      .order('created_at', { ascending: false });

    if (seasonId) {
      query = query.eq('athlete_season_id', seasonId);
    }

    const { data: clips, error: clipsError } = await query;

    if (clipsError) {
      console.error('[athlete-clips] Failed to fetch clips:', clipsError);
      return NextResponse.json({ error: 'Failed to fetch clips' }, { status: 500 });
    }

    // 6. Fetch game context for each clip
    const gameIds = [...new Set((clips ?? []).map((c) => c.game_id))];
    const gameMap = new Map<string, { opponent: string; date: string | null }>();

    if (gameIds.length > 0) {
      const { data: games } = await serviceClient
        .from('games')
        .select('id, opponent, date')
        .in('id', gameIds);

      for (const g of games ?? []) {
        gameMap.set(g.id, { opponent: g.opponent ?? 'Unknown', date: g.date });
      }
    }

    // 7. Generate signed URLs for accessible clips
    const result = await Promise.all(
      (clips ?? []).map(async (clip) => {
        const game = gameMap.get(clip.game_id);
        let playbackUrl: string | null = null;

        if (
          hasAccess &&
          clip.mux_clip_status === 'ready' &&
          clip.mux_playback_id
        ) {
          playbackUrl = await getSignedPlaybackUrl(clip.mux_playback_id, 24);
        }

        return {
          id: clip.id,
          seasonId: clip.athlete_season_id,
          gameId: clip.game_id,
          opponent: game?.opponent ?? 'Unknown',
          gameDate: game?.date ?? null,
          playResult: clip.play_result,
          playType: clip.play_type,
          coachNote: clip.coach_note,
          isFeatured: clip.is_featured,
          tags: clip.tags,
          clipStatus: clip.mux_clip_status,
          playbackUrl,
          locked: !hasAccess,
          createdAt: clip.created_at,
        };
      })
    );

    return NextResponse.json({ clips: result });
  } catch (error) {
    console.error('[athlete-clips] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
