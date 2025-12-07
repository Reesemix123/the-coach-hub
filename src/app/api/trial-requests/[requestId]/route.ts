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
    return null; // Return null instead of throwing so we can handle gracefully
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
      : null;

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

    // Determine the final tier to grant
    const finalGrantedTier = tierToGrant || trialRequest.requested_tier || 'plus';
    const trialDays = trial_days || 14;

    // ===========================================
    // DENY - Simple case, just update status
    // ===========================================
    if (action === 'deny') {
      const { error: updateError } = await supabase
        .from('trial_requests')
        .update({
          status: 'denied',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: admin_notes || null
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Error updating trial request:', updateError);
        return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: 'deny',
        message: 'Trial request denied'
      });
    }

    // ===========================================
    // APPROVE - Handle guest vs existing user
    // ===========================================

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    // Check if this is a GUEST request (no user_id, has guest_email)
    const isGuestRequest = !trialRequest.user_id && trialRequest.guest_email;

    if (isGuestRequest) {
      // -----------------------------------------
      // GUEST APPROVAL: Create user FIRST, then update status
      // -----------------------------------------
      const guestEmail = trialRequest.guest_email;
      const guestName = trialRequest.guest_name || 'Coach';

      // Get service client - required for admin.inviteUserByEmail
      const serviceClient = getServiceClient();
      if (!serviceClient) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is not configured');
        return NextResponse.json({
          error: 'Server configuration error: Service role key not configured. Please contact support.'
        }, { status: 500 });
      }

      // Create the user account via invite (sends email with magic link)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://youthcoachhub.com';
      console.log(`Inviting user ${guestEmail} with redirect to ${appUrl}`);

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
          error: `Failed to send invite email: ${inviteError.message}`
        }, { status: 500 });
      }

      const newUserId = inviteData?.user?.id;

      if (!newUserId) {
        console.error('Invite succeeded but no user ID returned:', inviteData);
        return NextResponse.json({
          error: 'Failed to create user account. No user ID returned from invite.'
        }, { status: 500 });
      }

      console.log(`User created with ID: ${newUserId}`);

      // Create subscription linked to user (team_id = null)
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
        // Continue anyway - user was created, subscription can be fixed manually
      }

      // NOW update the trial request with status AND user_id
      const { error: updateError } = await serviceClient
        .from('trial_requests')
        .update({
          status: 'approved',
          user_id: newUserId,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_notes: admin_notes || null,
          granted_trial_days: trialDays,
          granted_tier: finalGrantedTier
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Error updating trial request:', updateError);
        // User was created, so return partial success
        return NextResponse.json({
          success: true,
          warning: 'User created but failed to update trial request status',
          action: 'approve',
          message: `Invite sent to ${guestEmail}. Trial request status may need manual update.`
        });
      }

      return NextResponse.json({
        success: true,
        action: 'approve',
        message: `Trial approved! Invite email sent to ${guestEmail} for ${trialDays} days on ${finalGrantedTier} tier.`,
        user_id: newUserId
      });
    }

    // -----------------------------------------
    // EXISTING USER APPROVAL: Update status, create subscription
    // -----------------------------------------

    // Update the request status first
    const { error: updateError } = await supabase
      .from('trial_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: admin_notes || null,
        granted_trial_days: trialDays,
        granted_tier: finalGrantedTier
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error updating trial request:', updateError);
      return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
    }

    // If team exists, create/update subscription
    if (trialRequest.team_id) {
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
      }

      // Mark team as having had a trial
      await supabase
        .from('teams')
        .update({ has_had_trial: true })
        .eq('id', trialRequest.team_id);
    }

    return NextResponse.json({
      success: true,
      action: 'approve',
      message: `Trial approved for ${trialDays} days on ${finalGrantedTier} tier`
    });

  } catch (error) {
    console.error('Error processing trial request action:', error);
    return NextResponse.json({
      error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}
