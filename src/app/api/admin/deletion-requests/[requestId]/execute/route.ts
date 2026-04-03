/**
 * API: POST /api/admin/deletion-requests/[requestId]/execute
 * Executes the 4-step athlete profile deletion sequence.
 * Only callable by platform admins. Request must be in 'approved' status.
 *
 * Sequence:
 * 1. Cancel active Stripe subscription (if exists)
 * 2. Delete Mux assets for all player_clips
 * 3. Delete profile photo from Storage
 * 4. Delete athlete_profiles row (CASCADE handles child tables)
 *
 * Captures deletion_summary BEFORE cascade for audit trail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { getStripeClient } from '@/lib/stripe/client';
import { deleteMuxAsset } from '@/lib/services/communication/video.service';

interface RouteContext {
  params: Promise<{ requestId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { requestId } = await context.params;

    // Admin auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_platform_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const serviceClient = createServiceClient();

    // Verify request exists and is approved (not pending, not already completed)
    const { data: req } = await serviceClient
      .from('deletion_requests')
      .select('id, athlete_profile_id, parent_id, status')
      .eq('id', requestId)
      .single();

    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (req.status !== 'approved') {
      return NextResponse.json(
        { error: `Request must be approved before execution. Current status: ${req.status}` },
        { status: 409 }
      );
    }

    const athleteId = req.athlete_profile_id;
    const errors: string[] = [];

    // =========================================================================
    // CAPTURE SUMMARY BEFORE DELETION (data is lost after cascade)
    // =========================================================================

    const { data: athlete } = await serviceClient
      .from('athlete_profiles')
      .select('athlete_first_name, athlete_last_name, profile_photo_url')
      .eq('id', athleteId)
      .maybeSingle();

    if (!athlete) {
      // Profile already deleted — mark as completed
      await serviceClient.from('deletion_requests').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        deletion_summary: { note: 'Athlete profile was already deleted' },
      }).eq('id', requestId);
      return NextResponse.json({ status: 'completed', note: 'Already deleted' });
    }

    const { data: clips } = await serviceClient
      .from('player_clips')
      .select('id, mux_asset_id')
      .eq('athlete_profile_id', athleteId);

    const { count: reportCount } = await serviceClient
      .from('player_reports')
      .select('id', { count: 'exact', head: true })
      .eq('athlete_profile_id', athleteId);

    const { data: subscription } = await serviceClient
      .from('parent_profile_subscriptions')
      .select('id, stripe_subscription_id, status')
      .eq('athlete_profile_id', athleteId)
      .in('status', ['active', 'past_due'])
      .maybeSingle();

    const muxAssetIds = (clips ?? [])
      .map((c) => c.mux_asset_id)
      .filter((id): id is string => !!id);

    const summary = {
      athleteName: `${athlete.athlete_first_name} ${athlete.athlete_last_name}`,
      clipCount: clips?.length ?? 0,
      reportCount: reportCount ?? 0,
      muxAssetsDeleted: 0,
      stripeSubscriptionCanceled: false,
      photoDeleted: false,
      profileDeleted: false,
    };

    // =========================================================================
    // STEP 1: Cancel Stripe subscription (if active)
    // =========================================================================

    if (subscription?.stripe_subscription_id) {
      try {
        const stripe = getStripeClient();
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        summary.stripeSubscriptionCanceled = true;
        console.log(`[deletion] Stripe subscription ${subscription.stripe_subscription_id} canceled`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown Stripe error';
        // If subscription is already canceled or doesn't exist, continue
        if (msg.includes('No such subscription') || msg.includes('already been canceled')) {
          console.log(`[deletion] Stripe subscription already canceled — continuing`);
          summary.stripeSubscriptionCanceled = true;
        } else {
          console.error(`[deletion] Stripe cancellation failed:`, msg);
          errors.push(`Stripe: ${msg}`);
        }
      }
    }

    // =========================================================================
    // STEP 2: Delete Mux assets for all player_clips
    // =========================================================================

    for (const assetId of muxAssetIds) {
      try {
        await deleteMuxAsset(assetId);
        summary.muxAssetsDeleted++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown Mux error';
        console.error(`[deletion] Mux asset ${assetId} deletion failed:`, msg);
        errors.push(`Mux ${assetId}: ${msg}`);
      }
    }

    // =========================================================================
    // STEP 3: Delete profile photo from Storage
    // =========================================================================

    if (athlete.profile_photo_url) {
      try {
        // Extract storage path from the public URL
        // Public URL format: https://{project}.supabase.co/storage/v1/object/public/profile-photos/{path}
        const url = athlete.profile_photo_url;
        const bucketPrefix = '/storage/v1/object/public/profile-photos/';
        const pathIndex = url.indexOf(bucketPrefix);

        if (pathIndex !== -1) {
          const storagePath = url.substring(pathIndex + bucketPrefix.length);
          const { error: storageError } = await serviceClient.storage
            .from('profile-photos')
            .remove([storagePath]);

          if (storageError) {
            console.error('[deletion] Storage deletion error:', storageError);
            errors.push(`Storage: ${storageError.message}`);
          } else {
            summary.photoDeleted = true;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown storage error';
        console.error('[deletion] Photo deletion failed:', msg);
        errors.push(`Photo: ${msg}`);
      }
    }

    // =========================================================================
    // STEP 4: Delete athlete_profiles row (CASCADE handles child tables)
    // =========================================================================

    const { error: deleteError } = await serviceClient
      .from('athlete_profiles')
      .delete()
      .eq('id', athleteId);

    if (deleteError) {
      console.error('[deletion] Profile deletion failed:', deleteError);
      errors.push(`Profile delete: ${deleteError.message}`);

      // Mark as failed — external cleanup may have partially succeeded
      await serviceClient.from('deletion_requests').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: errors.join('; '),
        deletion_summary: summary,
      }).eq('id', requestId);

      return NextResponse.json({ status: 'failed', errors }, { status: 500 });
    }

    summary.profileDeleted = true;

    // =========================================================================
    // Mark request as completed
    // =========================================================================

    await serviceClient.from('deletion_requests').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      error_message: errors.length > 0 ? errors.join('; ') : null,
      deletion_summary: summary,
    }).eq('id', requestId);

    console.log(`[deletion] Completed for ${summary.athleteName}:`, summary);

    return NextResponse.json({ status: 'completed', summary });
  } catch (error) {
    console.error('[deletion] Unexpected error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
