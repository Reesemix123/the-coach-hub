/**
 * API: /api/communication/videos/[id]
 * GET    - Fetch video details with a signed Mux playback URL and thumbnail
 * DELETE - Remove a shared video (coach/owner only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  getVideoById,
  getSignedPlaybackUrl,
  getSignedThumbnailUrl,
  deleteSharedVideo,
  recordVideoView,
} from '@/lib/services/communication/video.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: videoId } = await context.params;

    const video = await getVideoById(videoId);

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Determine whether the caller is a parent or a coach/staff member
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (parentProfile) {
      // Parents may only view published videos they have been explicitly shared with
      if (!video.publish_confirmed) {
        return NextResponse.json({ error: 'Video not available' }, { status: 404 });
      }

      const { data: shareTarget } = await supabase
        .from('video_share_targets')
        .select('id')
        .eq('video_id', videoId)
        .eq('parent_id', parentProfile.id)
        .maybeSingle();

      // Team-wide published videos are visible to all active parents on the team
      if (!shareTarget) {
        const { data: parentAccess } = await supabase
          .from('team_parent_access')
          .select('id')
          .eq('team_id', video.team_id)
          .eq('parent_id', parentProfile.id)
          .eq('status', 'active')
          .maybeSingle();

        if (!parentAccess || video.share_type !== 'team') {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }

      // Record the view (non-blocking; errors are logged inside the service)
      await recordVideoView(videoId, parentProfile.id);
    } else {
      // Coach/staff: verify team membership
      const { data: team } = await supabase
        .from('teams')
        .select('user_id')
        .eq('id', video.team_id)
        .single();

      const { data: membership } = await supabase
        .from('team_memberships')
        .select('role')
        .eq('team_id', video.team_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      const isOwner = team?.user_id === user.id;
      if (!isOwner && !membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Generate signed Mux URLs (only possible once the asset is ready)
    let playback_url: string | null = null;
    let thumbnail_url: string | null = null;

    if (video.mux_playback_id && video.mux_asset_status === 'ready') {
      playback_url = await getSignedPlaybackUrl(
        video.mux_playback_id,
        video.signed_url_expires_hours ?? 4
      );
      thumbnail_url = await getSignedThumbnailUrl(video.mux_playback_id, {
        time: video.thumbnail_time || 0,
        width: 1280,
      });
    }

    return NextResponse.json({ video, playback_url, thumbnail_url });
  } catch (error) {
    console.error('Error fetching video:', error);
    return NextResponse.json({ error: 'Failed to fetch video' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: videoId } = await context.params;

    const video = await getVideoById(videoId);

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Only the team owner or the coach who uploaded the video may delete it
    const { data: team } = await supabase
      .from('teams')
      .select('user_id')
      .eq('id', video.team_id)
      .single();

    const isOwner = team?.user_id === user.id;
    const isUploader = video.coach_id === user.id;

    if (!isOwner && !isUploader) {
      return NextResponse.json({ error: 'Not authorized to delete this video' }, { status: 403 });
    }

    await deleteSharedVideo(videoId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting video:', error);
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
  }
}
