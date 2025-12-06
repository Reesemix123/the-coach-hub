// /api/trial-requests/[requestId] - Approve or deny a trial request
// Admin-only endpoint

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

    // If approved and team exists, start the trial
    if (action === 'approve' && trialRequest.team_id) {
      const trialDays = trial_days || 14;
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

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
