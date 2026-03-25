/**
 * API: /api/communication/webhooks/mux
 * POST - Mux webhook for video asset status updates
 *
 * Handles two categories of Mux assets:
 *   1. Communication Hub videos (shared_videos table) — full video uploads
 *   2. Film clip shares (play_instances table) — clips extracted from game film
 *
 * Events handled:
 * - video.upload.asset_created: Links upload ID to asset ID
 * - video.asset.ready: Asset encoded — update status, consume credit (clips), notify parents
 * - video.asset.errored: Encoding failed — update status, do not notify
 *
 * Webhook signature is verified using MUX_WEBHOOK_SECRET. If the secret is
 * not configured, the handler rejects the request with a clear error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/server';
import {
  publishVideo,
  getVideoById,
} from '@/lib/services/communication/video.service';
import {
  sendBulkNotification,
  getCommHubEmailTemplate,
  formatSmsBody,
  type BulkRecipient,
} from '@/lib/services/communication/notification.service';

// ---------------------------------------------------------------------------
// Signature Verification
// ---------------------------------------------------------------------------

const MUX_WEBHOOK_SECRET = process.env.MUX_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // -----------------------------------------------------------------
    // Verify webhook signature — REQUIRED, never skip
    // -----------------------------------------------------------------
    if (!MUX_WEBHOOK_SECRET) {
      console.error(
        '[Mux Webhook] MUX_WEBHOOK_SECRET is not configured. ' +
        'Webhook requests cannot be verified. Set this environment variable in Vercel and .env.local.',
      );
      return NextResponse.json(
        { error: 'Webhook secret not configured — cannot verify request' },
        { status: 500 },
      );
    }

    const signature = request.headers.get('mux-signature');
    if (!signature) {
      console.error('[Mux Webhook] Missing mux-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const crypto = await import('crypto');
    const parts = signature.split(',');
    const timestampPart = parts[0]?.split('=')?.[1];
    const signatureHash = parts[1]?.split('=')?.[1];

    if (!timestampPart || !signatureHash) {
      console.error('[Mux Webhook] Malformed mux-signature header');
      return NextResponse.json({ error: 'Malformed signature' }, { status: 401 });
    }

    const signedPayload = `${timestampPart}.${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', MUX_WEBHOOK_SECRET)
      .update(signedPayload)
      .digest('hex');

    if (signatureHash !== expectedSignature) {
      console.error('[Mux Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // -----------------------------------------------------------------
    // Parse event
    // -----------------------------------------------------------------
    const payload = JSON.parse(body);
    const eventType = payload.type;
    const eventData = payload.data;

    console.log(`[Mux Webhook] Received event: ${eventType}`);

    const supabase = createServiceClient();

    switch (eventType) {
      // ===============================================================
      // UPLOAD → ASSET LINK
      // ===============================================================
      case 'video.upload.asset_created': {
        const uploadId = payload.object?.id || eventData?.id;
        const assetId = eventData?.asset_id;

        if (uploadId && assetId) {
          // Update shared_videos (comm hub uploads + clip shares)
          const { error: svError } = await supabase
            .from('shared_videos')
            .update({ mux_asset_id: assetId })
            .eq('mux_asset_id', uploadId);

          if (svError) {
            console.error('[Mux Webhook] Failed to link upload→asset on shared_videos:', svError);
          }

          // Update play_instances (film clip shares)
          const { error: piError } = await supabase
            .from('play_instances')
            .update({ mux_clip_asset_id: assetId })
            .eq('mux_clip_asset_id', uploadId);

          if (piError) {
            console.error('[Mux Webhook] Failed to link upload→asset on play_instances:', piError);
          }

          console.log(`[Mux Webhook] Linked upload ${uploadId} → asset ${assetId}`);
        }
        break;
      }

      // ===============================================================
      // ASSET READY
      // ===============================================================
      case 'video.asset.ready': {
        const assetId = eventData?.id;
        const playbackIds = eventData?.playback_ids;
        const duration = eventData?.duration;
        const signedPlaybackId = playbackIds?.find(
          (p: { policy: string; id: string }) => p.policy === 'signed',
        )?.id || playbackIds?.[0]?.id;

        if (!assetId) break;

        // --- Try shared_videos first (comm hub uploads) ---
        const { data: sharedVideo } = await supabase
          .from('shared_videos')
          .select('id, team_id, title, coach_notes, share_type, notification_channel, source_tag_id, publish_confirmed, coach_id')
          .eq('mux_asset_id', assetId)
          .maybeSingle();

        if (sharedVideo) {
          // Update shared_videos status
          await supabase
            .from('shared_videos')
            .update({
              mux_asset_status: 'ready',
              mux_playback_id: signedPlaybackId || '',
              duration_seconds: duration ? Math.round(duration) : null,
            })
            .eq('id', sharedVideo.id);

          console.log(`[Mux Webhook] shared_videos ${sharedVideo.id} → ready`);

          // --- If this is a film clip (source_tag_id is set) ---
          if (sharedVideo.source_tag_id) {
            // Update the play_instances clip status
            await supabase
              .from('play_instances')
              .update({
                mux_clip_status: 'ready',
                mux_clip_playback_id: signedPlaybackId || '',
                mux_clip_error: null,
              })
              .eq('id', sharedVideo.source_tag_id);

            console.log(`[Mux Webhook] play_instances ${sharedVideo.source_tag_id} clip → ready`);

            // Consume deferred credit (team shares only) and confirm publish
            if (!sharedVideo.publish_confirmed) {
              try {
                await publishVideo({
                  videoId: sharedVideo.id,
                  coachId: sharedVideo.coach_id,
                  confirmationText: 'Coach confirmed content appropriate for sharing (deferred from clip extraction)',
                });
                console.log(`[Mux Webhook] Deferred credit consumed for clip ${sharedVideo.id}`);
              } catch (creditError) {
                console.error(
                  `[Mux Webhook] Failed to consume deferred credit for clip ${sharedVideo.id}:`,
                  creditError,
                );
                // Credit failure should not block notification — clip is ready
              }
            }
          }

          // --- Notify parents (both regular uploads and clips) ---
          if (sharedVideo.publish_confirmed || sharedVideo.source_tag_id) {
            await notifyParents(supabase, sharedVideo);
          }
        }

        // --- Also check play_instances directly (fallback for edge cases) ---
        const { data: clipPlay } = await supabase
          .from('play_instances')
          .select('id, mux_clip_status')
          .eq('mux_clip_asset_id', assetId)
          .eq('mux_clip_status', 'pending')
          .maybeSingle();

        if (clipPlay) {
          await supabase
            .from('play_instances')
            .update({
              mux_clip_status: 'ready',
              mux_clip_playback_id: signedPlaybackId || '',
              mux_clip_error: null,
            })
            .eq('id', clipPlay.id);

          console.log(`[Mux Webhook] play_instances ${clipPlay.id} clip → ready (fallback path)`);
        }

        break;
      }

      // ===============================================================
      // ASSET ERRORED
      // ===============================================================
      case 'video.asset.errored': {
        const assetId = eventData?.id;
        const errorMessages = eventData?.errors;
        const errorText = Array.isArray(errorMessages)
          ? errorMessages.map((e: { message?: string }) => e.message).join('; ')
          : 'Unknown encoding error';

        if (!assetId) break;

        // Update shared_videos
        await supabase
          .from('shared_videos')
          .update({ mux_asset_status: 'errored' })
          .eq('mux_asset_id', assetId);

        // Update play_instances clip status
        await supabase
          .from('play_instances')
          .update({
            mux_clip_status: 'errored',
            mux_clip_error: errorText,
          })
          .eq('mux_clip_asset_id', assetId);

        console.error(`[Mux Webhook] Asset ${assetId} errored: ${errorText}`);

        // Do NOT notify parents for encoding failures
        break;
      }

      default:
        console.log(`[Mux Webhook] Ignoring event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Mux Webhook] Processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Parent Notification Helper
// ---------------------------------------------------------------------------

async function notifyParents(
  supabase: ReturnType<typeof createServiceClient>,
  sharedVideo: {
    id: string;
    team_id: string;
    title: string;
    coach_notes: string | null;
    share_type: string;
    notification_channel: string;
    source_tag_id: string | null;
  },
): Promise<void> {
  try {
    // Fetch share targets with parent profiles
    const { data: targets } = await supabase
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
      .eq('video_id', sharedVideo.id);

    if (!targets || targets.length === 0) return;

    // Get team name
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', sharedVideo.team_id)
      .single();

    const teamName = team?.name || 'Your team';
    const isClip = !!sharedVideo.source_tag_id;

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

    if (recipients.length === 0) return;

    const coachNotesHtml = sharedVideo.coach_notes
      ? `<p style="margin-bottom: 16px;"><strong>Coach's Notes:</strong> ${sharedVideo.coach_notes}</p>`
      : '';

    const contentType = isClip ? 'play clip' : 'video';

    const emailBody = getCommHubEmailTemplate({
      title: `New ${isClip ? 'Play Clip' : 'Video'}: ${sharedVideo.title}`,
      body: `
        <p style="margin-bottom: 16px;">A new ${contentType} has been shared with you.</p>
        ${coachNotesHtml}
        <p>Open the app to watch.</p>
      `,
      teamName,
    });

    const smsBody = formatSmsBody(
      teamName,
      `New ${contentType} shared: "${sharedVideo.title}". Open the app to watch.`,
    );

    await sendBulkNotification({
      teamId: sharedVideo.team_id,
      recipients,
      notificationType: 'video_shared',
      subject: `${teamName}: New ${isClip ? 'Play Clip' : 'Video'} - ${sharedVideo.title}`,
      body: emailBody,
      smsBody,
      channel: sharedVideo.notification_channel as 'sms' | 'email' | 'both',
    });

    console.log(
      `[Mux Webhook] Notified ${recipients.length} parents for ${contentType} "${sharedVideo.title}"`,
    );
  } catch (notifyError) {
    // Notification failure should not cause webhook to fail
    console.error('[Mux Webhook] Failed to notify parents:', notifyError);
  }
}
