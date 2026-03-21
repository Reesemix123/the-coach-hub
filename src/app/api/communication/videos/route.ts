/**
 * API: /api/communication/videos
 * POST - Create a Mux direct upload URL and a pending shared_videos record
 * GET  - List shared videos for a team (coaches see all; parents see published only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import {
  createVideoUpload,
  getTeamVideos,
  getVideosForParent,
  canShareTeamVideo,
  getRemainingCredits,
  getSignedThumbnailUrl,
} from '@/lib/services/communication/video.service';
import type { VideoShareType, NotificationChannel } from '@/types/communication';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, title, description, coachNotes, shareType, notificationChannel } = body;

    if (!teamId || !title || !shareType || !notificationChannel) {
      return NextResponse.json(
        { error: 'teamId, title, shareType, and notificationChannel are required' },
        { status: 400 }
      );
    }

    const validShareTypes: VideoShareType[] = ['team', 'individual'];
    const validChannels: NotificationChannel[] = ['sms', 'email', 'both'];

    if (!validShareTypes.includes(shareType)) {
      return NextResponse.json({ error: 'Invalid shareType' }, { status: 400 });
    }

    if (!validChannels.includes(notificationChannel)) {
      return NextResponse.json({ error: 'Invalid notificationChannel' }, { status: 400 });
    }

    // Verify team exists and user is coach/owner
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isOwner = team.user_id === user.id;
    const canShare = isOwner || ['owner', 'coach', 'team_admin'].includes(membership?.role || '');

    if (!canShare) {
      return NextResponse.json({ error: 'Not authorized to share videos' }, { status: 403 });
    }

    // For team-wide videos, verify the team has a credit before creating the Mux upload
    if (shareType === 'team') {
      const hasCredits = await canShareTeamVideo(teamId);
      if (!hasCredits) {
        const credits = await getRemainingCredits(teamId);
        return NextResponse.json(
          {
            error: 'No video credits remaining',
            credits,
            needsTopup: true,
          },
          { status: 402 }
        );
      }
    }

    const result = await createVideoUpload({
      teamId,
      coachId: user.id,
      title,
      description,
      coachNotes,
      shareType: shareType as VideoShareType,
      notificationChannel: notificationChannel as NotificationChannel,
    });

    return NextResponse.json(
      {
        videoId: result.sharedVideoId,
        uploadUrl: result.uploadUrl,
        uploadId: result.uploadId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating video upload:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create upload' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const shareTypeParam = searchParams.get('shareType') as VideoShareType | null;

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // Determine whether the caller is a parent or a coach/staff member
    const { data: parentProfile } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (parentProfile) {
      // Parent path: only published, ready videos they have been explicitly shared with
      // Use service client to avoid RLS recursion on team_parent_access
      const serviceClient = createServiceClient();
      const { data: parentAccess } = await serviceClient
        .from('team_parent_access')
        .select('id')
        .eq('team_id', teamId)
        .eq('parent_id', parentProfile.id)
        .eq('status', 'active')
        .single();

      if (!parentAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const videos = await getVideosForParent(teamId, parentProfile.id);

      const videosWithThumbnails = await Promise.all(
        videos.map(async (video) => {
          let thumbnail_url: string | null = null;
          if (video.mux_playback_id && video.mux_asset_status === 'ready') {
            try {
              thumbnail_url = await getSignedThumbnailUrl(video.mux_playback_id, {
                time: video.thumbnail_time || 0,
                width: 640,
              });
            } catch {
              // Silently skip thumbnail — non-fatal
            }
          }
          return { ...video, thumbnail_url };
        })
      );

      return NextResponse.json({ videos: videosWithThumbnails });
    }

    // Coach/staff path: all videos for the team
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
    if (!isOwner && !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const videos = await getTeamVideos(teamId, {
      shareType: shareTypeParam || undefined,
    });

    const credits = await getRemainingCredits(teamId);

    const videosWithThumbnails = await Promise.all(
      videos.map(async (video) => {
        let thumbnail_url: string | null = null;
        if (video.mux_playback_id && video.mux_asset_status === 'ready') {
          try {
            thumbnail_url = await getSignedThumbnailUrl(video.mux_playback_id, {
              time: video.thumbnail_time || 0,
              width: 640,
            });
          } catch {
            // Silently skip thumbnail — non-fatal
          }
        }
        return { ...video, thumbnail_url };
      })
    );

    return NextResponse.json({ videos: videosWithThumbnails, credits });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}
