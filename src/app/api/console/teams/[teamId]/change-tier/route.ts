// /api/console/teams/:teamId/change-tier - Change subscription tier
// Updates Stripe subscription with new price, creating prorations

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isStripeEnabled } from '@/lib/admin/config';
import { getStripeClient, getPriceIdForTier, isStripeConfigured } from '@/lib/stripe/client';
import { SubscriptionTier } from '@/types/admin';

interface ChangeTierRequest {
  new_tier: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;

  // Check Stripe configuration
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe is not configured' },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const stripe = getStripeClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Parse request body
  let body: ChangeTierRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { new_tier } = body;

  // Validate tier
  const validTiers: SubscriptionTier[] = ['little_league', 'hs_basic', 'hs_advanced', 'ai_powered'];
  if (!new_tier || !validTiers.includes(new_tier as SubscriptionTier)) {
    return NextResponse.json(
      { error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` },
      { status: 400 }
    );
  }

  // Check if Stripe is enabled
  const stripeEnabled = await isStripeEnabled();
  if (!stripeEnabled) {
    return NextResponse.json(
      { error: 'Billing is not enabled' },
      { status: 503 }
    );
  }

  // Verify user has access to this team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, user_id, organization_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Get user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  const hasAccess =
    team.user_id === user.id ||
    (profile?.organization_id && profile.organization_id === team.organization_id);

  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  // Get existing subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('team_id', teamId)
    .single();

  if (!subscription?.stripe_subscription_id) {
    return NextResponse.json(
      { error: 'No active subscription found. Create a new subscription instead.' },
      { status: 400 }
    );
  }

  // Check if already on this tier
  if (subscription.tier === new_tier) {
    return NextResponse.json(
      { error: 'Team is already on this tier' },
      { status: 400 }
    );
  }

  // Get new price ID
  const newPriceId = getPriceIdForTier(new_tier as SubscriptionTier);
  if (!newPriceId) {
    return NextResponse.json(
      { error: `No price configured for tier: ${new_tier}` },
      { status: 400 }
    );
  }

  try {
    // Get Stripe subscription to find item ID
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

    if (stripeSubscription.items.data.length === 0) {
      return NextResponse.json(
        { error: 'Invalid Stripe subscription' },
        { status: 500 }
      );
    }

    const itemId = stripeSubscription.items.data[0].id;
    const oldTier = subscription.tier;

    // Update subscription with new price
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [
        {
          id: itemId,
          price: newPriceId
        }
      ],
      proration_behavior: 'create_prorations',
      metadata: {
        tier: new_tier,
        team_id: teamId
      }
    });

    // Update local subscription record
    // Note: The webhook will also update this, but we update immediately for responsiveness
    await supabase
      .from('subscriptions')
      .update({
        tier: new_tier,
        stripe_price_id: newPriceId,
        updated_at: new Date().toISOString()
      })
      .eq('team_id', teamId);

    // Log audit event
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_email: user.email,
      action: 'subscription.tier_changed',
      target_type: 'team',
      target_id: teamId,
      target_name: team.name,
      metadata: {
        old_tier: oldTier,
        new_tier,
        stripe_subscription_id: subscription.stripe_subscription_id
      }
    });

    return NextResponse.json({
      success: true,
      old_tier: oldTier,
      new_tier,
      message: `Subscription updated from ${oldTier} to ${new_tier}. Prorations will be applied.`
    });
  } catch (err) {
    console.error('Failed to change subscription tier:', err);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}
