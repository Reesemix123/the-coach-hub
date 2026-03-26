/**
 * API: /api/film/clips/[playId]
 * GET - Fetch a shared play clip with signed Mux playback URL
 *
 * Returns the play metadata and a signed playback URL for parents.
 * The Mux playback ID is never exposed — only the signed URL string.
 *
 * Authorization: Parent must belong to the team. Returns 404 (not 403)
 * for unauthorized users to avoid confirming the play exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { getSignedPlaybackUrl } from '@/lib/services/communication/video.service';

interface RouteContext {
  params: Promise<{ playId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { playId } = await context.params;
    const serviceClient = createServiceClient();

    // Fetch the play with clip data
    const { data: play, error: playError } = await serviceClient
      .from('play_instances')
      .select(`
        id, video_id, team_id, timestamp_start, timestamp_end,
        quarter, down, distance, yard_line, result, yards_gained,
        team_score_at_snap, opponent_score_at_snap, clock_start,
        mux_clip_playback_id, mux_clip_status, mux_clip_error,
        clip_shared_at, clip_share_type, clip_coach_note
      `)
      .eq('id', playId)
      .single();

    // Return 404 for any failure — do not confirm existence to unauthorized users
    if (playError || !play || !play.clip_shared_at) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Verify parent belongs to the team
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!parentProfile) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data: parentAccess } = await serviceClient
      .from('team_parent_access')
      .select('id')
      .eq('team_id', play.team_id)
      .eq('parent_id', parentProfile.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!parentAccess) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Fetch game record for team/opponent names
    const { data: video } = await serviceClient
      .from('videos')
      .select('game_id')
      .eq('id', play.video_id)
      .single();

    let gameName = 'Team';
    let opponentName = 'Opponent';
    let gameDate: string | null = null;

    if (video?.game_id) {
      const { data: game } = await serviceClient
        .from('games')
        .select('name, opponent, date')
        .eq('id', video.game_id)
        .single();

      if (game) {
        gameName = game.name || 'Team';
        opponentName = game.opponent || 'Opponent';
        gameDate = game.date;
      }
    }

    // Fetch team name
    const { data: team } = await serviceClient
      .from('teams')
      .select('name')
      .eq('id', play.team_id)
      .single();

    // Generate signed playback URL if clip is ready
    let playbackUrl: string | null = null;

    if (play.mux_clip_status === 'ready' && play.mux_clip_playback_id) {
      playbackUrl = await getSignedPlaybackUrl(play.mux_clip_playback_id, 24);
    }

    // Return play metadata + signed URL — never expose Mux IDs
    return NextResponse.json({
      play: {
        id: play.id,
        quarter: play.quarter,
        down: play.down,
        distance: play.distance,
        yardLine: play.yard_line,
        result: play.result,
        yardsGained: play.yards_gained,
        teamScoreAtSnap: play.team_score_at_snap,
        opponentScoreAtSnap: play.opponent_score_at_snap,
        clockStart: play.clock_start,
        clipStatus: play.mux_clip_status,
        coachNote: play.clip_coach_note,
        sharedAt: play.clip_shared_at,
      },
      teamName: team?.name || gameName,
      opponentName,
      gameDate,
      playbackUrl,
    });
  } catch (error) {
    console.error('[clip-api] Error:', error);
    return NextResponse.json({ error: 'Failed to load clip' }, { status: 500 });
  }
}
