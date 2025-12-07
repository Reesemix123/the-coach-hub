// /api/trial-requests/[requestId] - Approve or deny a trial request
// Admin-only endpoint

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// Get service role client for admin operations
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase service role configuration missing');
  }

  return createServiceClient(url, serviceKey);
}

interface RouteParams {
  params: Promise<{ requestId: string }>;
}

/**
 * PATCH /api/trial-requests/:requestId
 * Approve or deny a trial request (admin only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const { requestId } = await params;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is platform admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_platform_admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, admin_notes, trial_days, granted_tier } = body;

    if (!['approve', 'deny'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Validate granted tier if provided
    const validTiers = ['basic', 'plus', 'premium', 'ai_powered'];
    const tierToGrant = granted_tier && validTiers.includes(granted_tier)
      ? granted_tier
      : null; // Will use request's tier if not overridden

    // Get the request
    const { data: trialRequest, error: fetchError } = await supabase
      .from('trial_requests')
      .select('*, teams:team_id (id, name)')
      .eq('id', requestId)
      .single();

    if (fetchError || !trialRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (trialRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'This request has already been processed' },
        { status: 400 }
      );
    }

    // Determine the final tier to grant (admin override or requested tier)
    const finalGrantedTier = tierToGrant || trialRequest.requested_tier || 'plus';

    // Update the request status
    const { error: updateError } = await supabase
      .from('trial_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'denied',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: admin_notes || null,
        granted_trial_days: action === 'approve' ? (trial_days || 14) : null,
        granted_tier: action === 'approve' ? finalGrantedTier : null
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error updating trial request:', updateError);
      return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
    }

    // If approved, start the trial
    if (action === 'approve') {
      const trialDays = trial_days || 14;
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

      // Get service client for admin operations
      const serviceClient = getServiceClient();

      // Check if this is a guest request (no user_id, has guest_email)
      if (!trialRequest.user_id && trialRequest.guest_email) {
        // Guest trial request - need to create user, team, and subscription
        const guestEmail = trialRequest.guest_email;
        const guestName = trialRequest.guest_name || 'Coach';

        // Create the user account via invite (sends email with magic link)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://youthcoachhub.com';
        const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
          guestEmail,
          {
            data: {
              full_name: guestName,
              selected_tier: finalGrantedTier,
              from_trial_request: true
            },
            redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent('/setup?tier=' + finalGrantedTier)}`
          }
        );

        if (inviteError) {
          console.error('Error inviting user:', inviteError);
          return NextResponse.json({
            success: false,
            error: 'Failed to send invite email: ' + inviteError.message
          }, { status: 500 });
        }

        const newUserId = inviteData.user?.id;

        if (newUserId) {
          // Create subscription linked to user (team_id = null)
          // The setup page will link this to a team when user creates one
          const { error: subError } = await serviceClient
            .from('subscriptions')
            .insert({
              team_id: null,
              user_id: newUserId,
              tier: finalGrantedTier,
              status: 'trialing',
              trial_ends_at: trialEndsAt.toISOString(),
              billing_waived: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (subError) {
            console.error('Error creating subscription:', subError);
          }

          // Update the trial request with the new user ID
          await serviceClient
            .from('trial_requests')
            .update({
              user_id: newUserId
            })
            .eq('id', requestId);
        }

        return NextResponse.json({
          success: true,
          action,
          message: `Trial approved! Invite email sent to ${guestEmail} for ${trialDays} days on ${finalGrantedTier} tier.`
        });
      }

      // Existing user with team - just create/update subscription
      if (trialRequest.team_id) {
        // Upsert subscription with the granted tier
        const { error: subError } = await supabase
          .from('subscriptions')
          .upsert({
            team_id: trialRequest.team_id,
            tier: finalGrantedTier,
            status: 'trialing',
            trial_ends_at: trialEndsAt.toISOString(),
            billing_waived: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'team_id'
          });

        if (subError) {
          console.error('Error creating subscription:', subError);
          // Don't fail the request, just log the error
        }

        // Mark team as having had a trial
        await supabase
          .from('teams')
          .update({ has_had_trial: true })
          .eq('id', trialRequest.team_id);
      }
    }

    return NextResponse.json({
      success: true,
      action,
      message: action === 'approve'
        ? `Trial approved for ${trial_days || 14} days`
        : 'Trial request denied'
    });

  } catch (error) {
    console.error('Error processing trial request action:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
