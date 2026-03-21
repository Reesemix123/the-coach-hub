/**
 * API: /api/communication/videos/[id]/publish
 * POST - Coach confirms and publishes a video, then notifies parents
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import {
  publishVideo,
  shareWithTeam,
  shareWithPlayer,
  getVideoById,
} from '@/lib/services/communication/video.service';
import {
  sendBulkNotification,
  getCommHubEmailTemplate,
  formatSmsBody,
  type BulkRecipient,
} from '@/lib/services/communication/notification.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: videoId } = await context.params;

    const body = await request.json();
    const { confirmationText, playerId } = body;

    if (!confirmationText || typeof confirmationText !== 'string' || !confirmationText.trim()) {
      return NextResponse.json(
        { error: 'confirmationText is required' },
        { status: 400 }
      );
    }

    // Fetch the video first so we can authorize before mutating
    const video = await getVideoById(videoId);

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Only the team owner or the coach who created the video may publish it
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('id', video.team_id)
      .single();

    const isOwner = team?.user_id === user.id;
    const isUploader = video.coach_id === user.id;

    if (!isOwner && !isUploader) {
      return NextResponse.json({ error: 'Not authorized to publish this video' }, { status: 403 });
    }

    // Validate that the asset is ready before publishing
    if (video.mux_asset_status !== 'ready') {
      return NextResponse.json(
        { error: 'Video is still processing. Wait until encoding is complete before publishing.' },
        { status: 409 }
      );
    }

    // Consume credit (for team videos) and flip publish_confirmed to true
    await publishVideo({
      videoId,
      coachId: user.id,
      confirmationText: confirmationText.trim(),
    });

    // Create share targets and track how many parents received access
    let sharedCount = 0;

    if (video.share_type === 'team') {
      sharedCount = await shareWithTeam(videoId, video.team_id);
    } else if (video.share_type === 'individual') {
      if (!playerId || typeof playerId !== 'string') {
        return NextResponse.json(
          { error: 'playerId is required for individual share type' },
          { status: 400 }
        );
      }
      sharedCount = await shareWithPlayer({
        videoId,
        playerId,
        teamId: video.team_id,
      });
    }

    // Send notifications to targeted parents (best-effort; failure does not roll back the publish)
    // Use service client to avoid RLS recursion on video_share_targets + parent_profiles join
    if (sharedCount > 0) {
      const serviceClient = createServiceClient();
      const { data: targets } = await serviceClient
        .from('video_share_targets')
        .select(`
          parent_id,
          parent_profiles!inner (
            id,
            email,
            phone,
            notification_preference
          )
        `)
        .eq('video_id', videoId);

      if (targets && targets.length > 0) {
        const teamName = team?.name || 'Your team';

        const recipients: BulkRecipient[] = (targets as unknown as Array<{
          parent_id: string;
          parent_profiles: {
            id: string;
            email: string;
            phone: string | null;
            notification_preference: string;
          };
        }>).map((t) => ({
            id: t.parent_profiles.id,
            type: 'parent' as const,
            email: t.parent_profiles.email,
            phone: t.parent_profiles.phone ?? undefined,
            notificationPreference: t.parent_profiles.notification_preference as 'sms' | 'email' | 'both',
          }));

        if (recipients.length > 0) {
          const coachNotesHtml = video.coach_notes
            ? `<p style="margin-bottom: 16px;"><strong>Coach's Notes:</strong> ${video.coach_notes}</p>`
            : '';

          const emailBody = getCommHubEmailTemplate({
            title: `New Video: ${video.title}`,
            body: `
              <p style="margin-bottom: 16px;">A new video has been shared with you.</p>
              ${coachNotesHtml}
              <p>Open the app to watch.</p>
            `,
            teamName,
          });

          const smsBody = formatSmsBody(
            teamName,
            `New video shared: "${video.title}". Open the app to watch.`
          );

          await sendBulkNotification({
            teamId: video.team_id,
            recipients,
            notificationType: 'video_shared',
            subject: `${teamName}: New Video - ${video.title}`,
            body: emailBody,
            smsBody,
            channel: video.notification_channel,
          });
        }
      }
    }

    return NextResponse.json({ success: true, shared_count: sharedCount });
  } catch (error) {
    console.error('Error publishing video:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish video' },
      { status: 500 }
    );
  }
}
