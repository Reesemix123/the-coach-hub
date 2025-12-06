// /api/admin/teams/:teamId/revoke-access - Admin endpoint to immediately revoke access
// Used for TOS violations - cancels Stripe subscription AND revokes app access immediately

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';

interface RevokeRequest {
  reason: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Verify user is platform admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_platform_admin) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }

  // Parse request body
  let body: RevokeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Validate reason
  if (!body.reason || body.reason.trim().length < 10) {
    return NextResponse.json(
      { error: 'Reason is required and must be at least 10 characters' },
      { status: 400 }
    );
  }

  const reason = body.reason.trim();

  // Get team info
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, user_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Get subscription for this team
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('team_id', teamId)
    .single();

  if (!subscription) {
    return NextResponse.json(
      { error: 'No subscription found for this team' },
      { status: 404 }
    );
  }

  // Check if already revoked
  if (subscription.access_revoked_at) {
    return NextResponse.json(
      { error: 'Access has already been revoked for this team' },
      { status: 400 }
    );
  }

  // Cancel on Stripe IMMEDIATELY (not at period end)
  if (subscription.stripe_subscription_id && isStripeConfigured()) {
    try {
      const stripe = getStripeClient();

      // Cancel immediately (not cancel_at_period_end)
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id, {
        invoice_now: false, // Don't generate final invoice
        prorate: false // Don't prorate
      });
    } catch (stripeError) {
      console.error('Stripe cancellation error:', stripeError);
      return NextResponse.json(
        { error: 'Failed to cancel Stripe subscription. Please try again.' },
        { status: 500 }
      );
    }
  }

  // Update subscription with revocation info
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      access_revoked_at: now,
      access_revoked_by: user.id,
      access_revoked_reason: reason,
      canceled_at: now,
      updated_at: now
    })
    .eq('team_id', teamId);

  if (updateError) {
    console.error('Error updating subscription:', updateError);
    return NextResponse.json(
      { error: 'Failed to update subscription record' },
      { status: 500 }
    );
  }

  // Record cancellation in subscription_cancellations
  await supabase
    .from('subscription_cancellations')
    .insert({
      team_id: teamId,
      user_id: team.user_id,
      stripe_subscription_id: subscription.stripe_subscription_id,
      subscription_ends_at: now,
      reason: 'other',
      reason_details: `[ADMIN REVOKED] ${reason}`
    });

  // Log detailed audit event
  try {
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'subscription.access_revoked',
      target_type: 'team',
      target_id: teamId,
      target_name: team.name,
      metadata: {
        reason,
        stripe_subscription_id: subscription.stripe_subscription_id,
        team_owner_id: team.user_id,
        revoked_at: now,
        admin_action: true
      }
    });
  } catch (auditError) {
    console.error('Error logging audit event:', auditError);
    // Non-fatal
  }

  // Get team owner email for response
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', team.user_id)
    .single();

  return NextResponse.json({
    success: true,
    message: `Access revoked and subscription canceled immediately for team "${team.name}"`,
    details: {
      team_id: teamId,
      team_name: team.name,
      team_owner_email: ownerProfile?.email,
      revoked_at: now,
      reason: reason
    }
  });
}
