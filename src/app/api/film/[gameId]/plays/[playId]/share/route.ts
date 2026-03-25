/**
 * API: /api/film/[gameId]/plays/[playId]/share
 * POST - Coach shares a tagged play as a clip with parents
 *
 * This route orchestrates the full clip-sharing pipeline:
 *   1. Authorize the coach
 *   2. Create a shared_videos record (plugs into existing credit/notification pipeline)
 *   3. Consume a video credit (team shares only)
 *   4. Trigger FFmpeg clip extraction + Mux upload
 *   5. Update the play record with share metadata
 *
 * Parent notification fires asynchronously when the Mux webhook reports the
 * clip asset is ready — not in this request.
 *
 * Timeout: maxDuration = 300 to accommodate FFmpeg extraction of large source files.
 * TODO: Move extraction to a background worker when user volume grows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { extractAndUploadClip } from '@/lib/services/clip-extraction.service';
import {
  shareWithTeam,
  shareWithPlayer,
  canShareTeamVideo,
  getRemainingCredits,
} from '@/lib/services/communication/video.service';
import type { NotificationChannel, VideoShareType } from '@/types/communication';

// Vercel Pro: up to 300 seconds for FFmpeg extraction
export const maxDuration = 300;

interface RouteContext {
  params: Promise<{ gameId: string; playId: string }>;
}

interface ShareRequestBody {
  shareType: 'team' | 'individual';
  playerId?: string;
  coachNote?: string;
  confirmationText: string;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // -------------------------------------------------------------------
    // 1. Auth
    // -------------------------------------------------------------------
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId, playId } = await context.params;

    const body: ShareRequestBody = await request.json();
    const { shareType, playerId, coachNote, confirmationText } = body;

    if (!confirmationText?.trim()) {
      return NextResponse.json(
        { error: 'confirmationText is required' },
        { status: 400 },
      );
    }

    if (!shareType || !['team', 'individual'].includes(shareType)) {
      return NextResponse.json(
        { error: 'shareType must be "team" or "individual"' },
        { status: 400 },
      );
    }

    if (shareType === 'individual' && !playerId) {
      return NextResponse.json(
        { error: 'playerId is required for individual shares' },
        { status: 400 },
      );
    }

    // -------------------------------------------------------------------
    // 2. Fetch play and verify ownership
    // -------------------------------------------------------------------
    const serviceClient = createServiceClient();

    const { data: play, error: playError } = await serviceClient
      .from('play_instances')
      .select(`
        id, video_id, team_id, timestamp_start, timestamp_end,
        quarter, down, distance, yard_line, result, yards_gained,
        team_score_at_snap, opponent_score_at_snap, clock_start,
        mux_clip_status, clip_shared_at
      `)
      .eq('id', playId)
      .single();

    if (playError || !play) {
      return NextResponse.json({ error: 'Play not found' }, { status: 404 });
    }

    // Verify the play belongs to the specified game
    const { data: video } = await serviceClient
      .from('videos')
      .select('id, game_id')
      .eq('id', play.video_id)
      .single();

    if (!video || video.game_id !== gameId) {
      return NextResponse.json({ error: 'Play not found' }, { status: 404 });
    }

    // Verify coach owns the team or is active staff
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('id', play.team_id)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const isOwner = team.user_id === user.id;

    if (!isOwner) {
      const { data: membership } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', play.team_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!membership || !['owner', 'coach', 'team_admin'].includes(membership.role)) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    // -------------------------------------------------------------------
    // 3. Handle already-shared and errored clips
    // -------------------------------------------------------------------

    // Successfully shared — return existing clip info, don't re-share
    if (play.clip_shared_at && play.mux_clip_status !== 'errored') {
      return NextResponse.json(
        {
          error: 'This play has already been shared',
          status: play.mux_clip_status,
          sharedAt: play.clip_shared_at,
        },
        { status: 409 },
      );
    }

    // Errored clip — allow retry by clearing old state
    if (play.mux_clip_status === 'errored') {
      await serviceClient
        .from('play_instances')
        .update({
          mux_clip_asset_id: null,
          mux_clip_playback_id: null,
          mux_clip_status: null,
          mux_clip_error: null,
          clip_shared_at: null,
          clip_share_type: null,
          clip_coach_note: null,
          clip_shared_video_id: null,
        })
        .eq('id', playId);
    }

    // -------------------------------------------------------------------
    // 4. Credit check (team shares only)
    // -------------------------------------------------------------------

    if (shareType === 'team') {
      const canShare = await canShareTeamVideo(play.team_id);
      if (!canShare) {
        const credits = await getRemainingCredits(play.team_id);
        return NextResponse.json(
          {
            error: 'No video credits remaining',
            credits,
          },
          { status: 402 },
        );
      }
    }

    // -------------------------------------------------------------------
    // 5. Fetch game record for title generation
    // -------------------------------------------------------------------

    const { data: game } = await serviceClient
      .from('games')
      .select('opponent')
      .eq('id', gameId)
      .single();

    const opponent = game?.opponent ?? 'Opponent';

    // Build a descriptive title from play metadata
    const quarterLabel = play.quarter ? `Q${play.quarter}` : '';
    const downLabel = play.down && play.distance
      ? `${play.down}${ordinalSuffix(play.down)} & ${play.distance}`
      : '';
    const resultLabel = play.result
      ? `${play.result}${play.yards_gained != null ? ` ${play.yards_gained} yds` : ''}`
      : '';
    const titleParts = [quarterLabel, downLabel, resultLabel].filter(Boolean);
    const clipTitle = titleParts.length > 0
      ? `vs ${opponent} — ${titleParts.join(', ')}`
      : `vs ${opponent} — Play Clip`;

    // -------------------------------------------------------------------
    // 6. Create shared_videos record
    // -------------------------------------------------------------------

    const { data: sharedVideo, error: svError } = await serviceClient
      .from('shared_videos')
      .insert({
        team_id: play.team_id,
        coach_id: user.id,
        title: clipTitle,
        description: null,
        coach_notes: coachNote?.trim() || null,
        mux_asset_id: null,       // Will be set after extraction
        mux_playback_id: '',
        mux_asset_status: 'preparing',
        share_type: shareType as VideoShareType,
        notification_channel: 'both' as NotificationChannel,
        source_film_id: gameId,
        source_tag_id: playId,
        publish_confirmed: false,
      })
      .select('id')
      .single();

    if (svError || !sharedVideo) {
      throw new Error(`Failed to create shared video record: ${svError?.message}`);
    }

    const sharedVideoId = sharedVideo.id;

    // -------------------------------------------------------------------
    // 7. Create share targets (credit consumption DEFERRED to webhook)
    // -------------------------------------------------------------------
    // Credit is NOT consumed here. It is consumed in the Mux webhook handler
    // when the clip asset is confirmed ready. This ensures coaches are never
    // charged for a clip that failed to extract or encode.
    //
    // The shared_videos record has publish_confirmed = false at this point.
    // The webhook will:
    //   1. Consume the credit (team shares only)
    //   2. Set publish_confirmed = true
    //   3. Trigger parent notification
    //
    // We store the confirmationText on the play record so the webhook can
    // use it when calling publishVideo().

    // Create share targets (parents who will see the clip once it's ready)
    let sharedCount = 0;

    if (shareType === 'team') {
      sharedCount = await shareWithTeam(sharedVideoId, play.team_id);
    } else if (shareType === 'individual' && playerId) {
      sharedCount = await shareWithPlayer({
        videoId: sharedVideoId,
        playerId,
        teamId: play.team_id,
      });
    }

    // -------------------------------------------------------------------
    // 8. Update play record with share metadata
    // -------------------------------------------------------------------

    await serviceClient
      .from('play_instances')
      .update({
        clip_shared_at: new Date().toISOString(),
        clip_share_type: shareType,
        clip_coach_note: coachNote?.trim() || null,
        clip_shared_video_id: sharedVideoId,
      })
      .eq('id', playId);

    // -------------------------------------------------------------------
    // 9. Trigger clip extraction (inline, within maxDuration timeout)
    // -------------------------------------------------------------------

    try {
      const { assetId } = await extractAndUploadClip(playId);

      // Link the Mux upload ID to the shared_videos row so the webhook
      // can find it when the asset is ready
      await serviceClient
        .from('shared_videos')
        .update({ mux_asset_id: assetId })
        .eq('id', sharedVideoId);

    } catch (extractionError) {
      // Extraction failed — play record already updated with errored status
      // by extractAndUploadClip. Log but don't fail the entire request.
      console.error(
        `[share-play] Clip extraction failed for play ${playId}:`,
        extractionError,
      );

      return NextResponse.json({
        status: 'errored',
        sharedVideoId,
        sharedCount,
        error: extractionError instanceof Error
          ? extractionError.message
          : 'Clip extraction failed',
      }, { status: 202 }); // 202: accepted but processing failed
    }

    // -------------------------------------------------------------------
    // 10. Return pending status
    // -------------------------------------------------------------------

    return NextResponse.json({
      status: 'pending',
      sharedVideoId,
      sharedCount,
    });

  } catch (error) {
    console.error('[share-play] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to share play' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
