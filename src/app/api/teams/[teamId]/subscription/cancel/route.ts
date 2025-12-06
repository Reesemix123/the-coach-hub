// /api/teams/:teamId/subscription/cancel - Cancel subscription at period end
// User-initiated cancellation - subscription continues until billing period ends

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';

interface CancelRequest {
  reason?: string;
  reason_details?: string;
}

const VALID_REASONS = [
  'too_expensive',
  'not_using',
  'missing_features',
  'seasonal',
  'switching_provider',
  'team_disbanded',
  'other'
];

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

  // Verify user owns this team
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

  // Only team owner can cancel subscription
  if (team.user_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the team owner can cancel the subscription' },
      { status: 403 }
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

  // Check if subscription is active or trialing
  if (!['active', 'trialing'].includes(subscription.status)) {
    return NextResponse.json(
      { error: 'Subscription is not active' },
      { status: 400 }
    );
  }

  // Check if already scheduled for cancellation
  if (subscription.cancel_at_period_end) {
    return NextResponse.json(
      { error: 'Subscription is already scheduled for cancellation' },
      { status: 400 }
    );
  }

  // Parse request body for cancellation reason
  let body: CancelRequest = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  const reason = body.reason && VALID_REASONS.includes(body.reason) ? body.reason : null;
  const reasonDetails = body.reason_details?.trim() || null;

  // Cancel on Stripe if we have a Stripe subscription
  if (subscription.stripe_subscription_id && isStripeConfigured()) {
    try {
      const stripe = getStripeClient();

      // Update subscription to cancel at period end (not immediate)
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true
      });
    } catch (stripeError) {
      console.error('Stripe cancellation error:', stripeError);
      return NextResponse.json(
        { error: 'Failed to cancel subscription. Please try again or contact support.' },
        { status: 500 }
      );
    }
  }

  // Update local subscription record
  const subscriptionEndsAt = subscription.current_period_end || new Date().toISOString();
  const dataAccessExpiresAt = new Date(new Date(subscriptionEndsAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      data_access_expires_at: dataAccessExpiresAt,
      updated_at: new Date().toISOString()
    })
    .eq('team_id', teamId);

  if (updateError) {
    console.error('Error updating subscription:', updateError);
    return NextResponse.json(
      { error: 'Failed to update subscription record' },
      { status: 500 }
    );
  }

  // Record cancellation reason
  const { error: cancellationError } = await supabase
    .from('subscription_cancellations')
    .insert({
      team_id: teamId,
      user_id: user.id,
      stripe_subscription_id: subscription.stripe_subscription_id,
      subscription_ends_at: subscriptionEndsAt,
      reason,
      reason_details: reasonDetails
    });

  if (cancellationError) {
    console.error('Error recording cancellation:', cancellationError);
    // Non-fatal - continue even if recording fails
  }

  // Log audit event
  try {
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'subscription.cancel_requested',
      target_type: 'team',
      target_id: teamId,
      target_name: team.name,
      metadata: {
        reason,
        reason_details: reasonDetails,
        subscription_ends_at: subscriptionEndsAt,
        stripe_subscription_id: subscription.stripe_subscription_id
      }
    });
  } catch (auditError) {
    console.error('Error logging audit event:', auditError);
    // Non-fatal
  }

  // Format the end date for display
  const endDate = new Date(subscriptionEndsAt);
  const formattedEndDate = endDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return NextResponse.json({
    success: true,
    subscription_ends_at: subscriptionEndsAt,
    data_access_expires_at: dataAccessExpiresAt,
    message: `Your subscription will end on ${formattedEndDate}. You'll have full access until then, and 30 days after to resubscribe and keep your data.`
  });
}
