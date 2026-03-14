/**
 * API: /api/communication/external-shares
 *
 * POST - Share a ready Mux video to the coach's connected Vimeo account.
 *        Requires an active Vimeo connection and a confirmed/ready shared_videos record.
 *        Returns the external_video_shares row ID for downstream status polling.
 *
 * GET  - List all external video shares for a team (coach-only).
 *        Returns rows ordered newest-first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  uploadToVimeo,
  getExternalShares,
  getVimeoAccount,
} from '@/lib/services/communication/vimeo.service';
import { getSignedPlaybackUrl } from '@/lib/services/communication/video.service';
import type { PrivacySetting } from '@/types/communication';

const VALID_PRIVACY_SETTINGS: PrivacySetting[] = ['public', 'unlisted', 'private'];

// ============================================================================
// POST — Initiate a Vimeo share
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, videoId, title, description, privacySetting, confirmationText } = body;

    if (!teamId || !videoId || !title || !confirmationText) {
      return NextResponse.json(
        { error: 'teamId, videoId, title, and confirmationText are required' },
        { status: 400 },
      );
    }

    const resolvedPrivacy: PrivacySetting =
      VALID_PRIVACY_SETTINGS.includes(privacySetting) ? privacySetting : 'unlisted';

    // Verify the coach is a member or owner of the team
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
    const isMember = !!membership;

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify the coach has an active Vimeo connection
    const account = await getVimeoAccount(user.id);
    if (!account || account.status !== 'active') {
      return NextResponse.json(
        { error: 'Vimeo account not connected. Connect your account in settings.' },
        { status: 400 },
      );
    }

    // Fetch the video and confirm it is ready for playback
    const { data: video } = await supabase
      .from('shared_videos')
      .select('mux_playback_id, mux_asset_status, team_id')
      .eq('id', videoId)
      .single();

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (video.team_id !== teamId) {
      return NextResponse.json({ error: 'Video does not belong to this team' }, { status: 403 });
    }

    if (video.mux_asset_status !== 'ready') {
      return NextResponse.json(
        { error: 'Video is not ready for sharing. Please wait for processing to complete.' },
        { status: 400 },
      );
    }

    // Generate a long-lived signed URL so Vimeo has enough time to pull the file
    const videoUrl = await getSignedPlaybackUrl(video.mux_playback_id, 4);

    const shareId = await uploadToVimeo({
      coachId: user.id,
      teamId,
      sourceType: 'shared_video',
      sourceId: videoId,
      title: title as string,
      description: description as string | undefined,
      privacySetting: resolvedPrivacy,
      confirmationText: confirmationText as string,
      videoUrl,
    });

    return NextResponse.json({ shareId }, { status: 201 });
  } catch (error) {
    console.error('Error creating external share:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to share video' },
      { status: 500 },
    );
  }
}

// ============================================================================
// GET — List external shares for a team
// ============================================================================

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

    // Coaches and team owners may list shares; parents cannot
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
    const isMember = !!membership;

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const shares = await getExternalShares(teamId);

    return NextResponse.json({ shares });
  } catch (error) {
    console.error('Error fetching external shares:', error);
    return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 500 });
  }
}
