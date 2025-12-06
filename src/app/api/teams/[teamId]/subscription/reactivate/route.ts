// /api/teams/:teamId/subscription/reactivate - Reactivate a pending cancellation
// User can undo cancellation before billing period ends

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';

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

  // Only team owner can reactivate subscription
  if (team.user_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the team owner can reactivate the subscription' },
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

  // Check if subscription is scheduled for cancellation
  if (!subscription.cancel_at_period_end) {
    return NextResponse.json(
      { error: 'Subscription is not scheduled for cancellation' },
      { status: 400 }
    );
  }

  // Check if subscription is still active (can only reactivate before period ends)
  if (!['active', 'trialing'].includes(subscription.status)) {
    return NextResponse.json(
      { error: 'Subscription has already ended. Please resubscribe to restore access.' },
      { status: 400 }
    );
  }

  // Reactivate on Stripe if we have a Stripe subscription
  if (subscription.stripe_subscription_id && isStripeConfigured()) {
    try {
      const stripe = getStripeClient();

      // Remove cancel_at_period_end flag
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: false
      });
    } catch (stripeError) {
      console.error('Stripe reactivation error:', stripeError);
      return NextResponse.json(
        { error: 'Failed to reactivate subscription. Please try again or contact support.' },
        { status: 500 }
      );
    }
  }

  // Update local subscription record
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      cancel_at_period_end: false,
      data_access_expires_at: null,
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

  // Update cancellation record if exists (mark as resubscribed)
  await supabase
    .from('subscription_cancellations')
    .update({
      resubscribed_at: new Date().toISOString()
    })
    .eq('team_id', teamId)
    .is('resubscribed_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  // Log audit event
  try {
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'subscription.reactivated',
      target_type: 'team',
      target_id: teamId,
      target_name: team.name,
      metadata: {
        stripe_subscription_id: subscription.stripe_subscription_id
      }
    });
  } catch (auditError) {
    console.error('Error logging audit event:', auditError);
    // Non-fatal
  }

  return NextResponse.json({
    success: true,
    message: 'Your subscription has been reactivated. You will continue to have full access.'
  });
}
