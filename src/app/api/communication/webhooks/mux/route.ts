/**
 * API: /api/communication/webhooks/mux
 * POST - Mux webhook for video asset status updates
 *
 * Handles:
 * - video.asset.ready: Asset encoded successfully
 * - video.asset.errored: Asset encoding failed
 * - video.upload.asset_created: Links upload ID to asset ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Mux webhook signature verification
const MUX_WEBHOOK_SECRET = process.env.MUX_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const payload = JSON.parse(body);

    // Verify webhook signature if secret is configured
    if (MUX_WEBHOOK_SECRET) {
      const signature = request.headers.get('mux-signature');
      if (!signature) {
        console.error('Mux webhook: Missing signature header');
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }

      // Mux uses HMAC-SHA256 for webhook signatures
      const crypto = await import('crypto');
      const [, signatureHash] = signature.split(',').map(part => {
        const [, value] = part.split('=');
        return value;
      });

      const timestampPart = signature.split(',')[0];
      const timestamp = timestampPart?.split('=')?.[1];

      if (timestamp && signatureHash) {
        const signedPayload = `${timestamp}.${body}`;
        const expectedSignature = crypto
          .createHmac('sha256', MUX_WEBHOOK_SECRET)
          .update(signedPayload)
          .digest('hex');

        if (signatureHash !== expectedSignature) {
          console.error('Mux webhook: Invalid signature');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      }
    } else {
      console.warn('MUX_WEBHOOK_SECRET not configured — skipping signature validation');
    }

    const eventType = payload.type;
    const eventData = payload.data;

    console.log(`[Mux Webhook] Received event: ${eventType}`);

    const supabase = await createClient();

    switch (eventType) {
      case 'video.upload.asset_created': {
        // Link the upload ID to the newly created asset
        const uploadId = payload.object?.id || eventData?.id;
        const assetId = eventData?.asset_id;

        if (uploadId && assetId) {
          // Update shared_videos where mux_asset_id matches the upload ID
          const { error } = await supabase
            .from('shared_videos')
            .update({ mux_asset_id: assetId })
            .eq('mux_asset_id', uploadId);

          if (error) {
            console.error('[Mux Webhook] Failed to link upload to asset:', error);
          } else {
            console.log(`[Mux Webhook] Linked upload ${uploadId} to asset ${assetId}`);
          }
        }
        break;
      }

      case 'video.asset.ready': {
        const assetId = eventData?.id;
        const playbackIds = eventData?.playback_ids;
        const duration = eventData?.duration;
        const signedPlaybackId = playbackIds?.find(
          (p: { policy: string; id: string }) => p.policy === 'signed'
        )?.id || playbackIds?.[0]?.id;

        if (assetId) {
          const { error } = await supabase
            .from('shared_videos')
            .update({
              mux_asset_status: 'ready',
              mux_playback_id: signedPlaybackId || '',
              duration_seconds: duration ? Math.round(duration) : null,
            })
            .eq('mux_asset_id', assetId);

          if (error) {
            console.error('[Mux Webhook] Failed to update asset ready status:', error);
          } else {
            console.log(`[Mux Webhook] Asset ${assetId} is ready`);
          }
        }
        break;
      }

      case 'video.asset.errored': {
        const assetId = eventData?.id;
        const errorMessages = eventData?.errors;

        if (assetId) {
          const { error } = await supabase
            .from('shared_videos')
            .update({ mux_asset_status: 'errored' })
            .eq('mux_asset_id', assetId);

          if (error) {
            console.error('[Mux Webhook] Failed to update asset errored status:', error);
          }
          console.error(`[Mux Webhook] Asset ${assetId} errored:`, errorMessages);
        }
        break;
      }

      default:
        console.log(`[Mux Webhook] Ignoring event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Mux webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
