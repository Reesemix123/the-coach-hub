// /api/console/billing/stripe/checkout - Create Stripe checkout session for subscriptions
// Creates checkout sessions for new subscriptions and upgrades

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isStripeEnabled, getTrialConfig } from '@/lib/admin/config';
import {
  getStripeClient,
  getPriceIdForTier,
  isStripeConfigured,
  getAppUrl,
  BillingCycle
} from '@/lib/stripe/client';
import { SubscriptionTier } from '@/types/admin';

interface SubscriptionCheckoutRequest {
  type?: 'subscription';
  team_id: string;
  tier: string;
  billing_cycle?: 'monthly' | 'yearly';
  return_url?: string;
}

export async function POST(request: NextRequest) {
  // Check Stripe configuration
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe is not configured', message: 'Billing integration is not set up.' },
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
  let body: SubscriptionCheckoutRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { team_id, tier, billing_cycle = 'monthly' } = body;

  if (!team_id) {
    return NextResponse.json(
      { error: 'team_id is required' },
      { status: 400 }
    );
  }

  if (!tier) {
    return NextResponse.json(
      { error: 'tier is required for subscription checkout' },
      { status: 400 }
    );
  }

  // Check if Stripe is enabled in platform config
  const stripeEnabled = await isStripeEnabled();
  if (!stripeEnabled) {
    return NextResponse.json(
      {
        error: 'Billing is not enabled',
        message: 'Stripe billing is disabled in platform settings.'
      },
      { status: 503 }
    );
  }

  // Validate tier
  const validTiers: SubscriptionTier[] = ['basic', 'plus', 'premium'];
  if (!validTiers.includes(tier as SubscriptionTier)) {
    return NextResponse.json(
      { error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` },
      { status: 400 }
    );
  }

  // Basic tier is free - no checkout needed
  if (tier === 'basic') {
    return NextResponse.json(
      { error: 'Basic tier is free - no checkout needed' },
      { status: 400 }
    );
  }

  // Validate billing cycle
  const billingCycleValue: BillingCycle = billing_cycle === 'yearly' ? 'yearly' : 'monthly';

  const priceId = getPriceIdForTier(tier as SubscriptionTier, billingCycleValue);

  if (!priceId) {
    return NextResponse.json(
      { error: `No ${billingCycleValue} price configured for tier: ${tier}` },
      { status: 400 }
    );
  }

  // Verify user has access to this team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, user_id, organization_id')
    .eq('id', team_id)
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
    .select('organization_id, email')
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

  // Get or create Stripe customer
  let customerId: string | null = null;

  if (profile?.organization_id) {
    // Organization mode - get customer from org
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, stripe_customer_id, billing_email')
      .eq('id', profile.organization_id)
      .single();

    if (org?.stripe_customer_id) {
      customerId = org.stripe_customer_id;
    } else if (org) {
      // Create new Stripe customer for organization
      try {
        const customer = await stripe.customers.create({
          email: org.billing_email || profile.email || user.email,
          name: org.name,
          metadata: {
            organization_id: org.id
          }
        });
        customerId = customer.id;

        // Update organization with customer ID
        await supabase
          .from('organizations')
          .update({ stripe_customer_id: customer.id })
          .eq('id', org.id);
      } catch (err) {
        console.error('Failed to create Stripe customer:', err);
        return NextResponse.json(
          { error: 'Failed to create billing account' },
          { status: 500 }
        );
      }
    }
  } else {
    // Legacy mode - create customer for user
    try {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        metadata: {
          user_id: user.id,
          legacy_mode: 'true'
        }
      });
      customerId = customer.id;
    } catch (err) {
      console.error('Failed to create Stripe customer:', err);
      return NextResponse.json(
        { error: 'Failed to create billing account' },
        { status: 500 }
      );
    }
  }

  if (!customerId) {
    return NextResponse.json(
      { error: 'Unable to create billing account' },
      { status: 500 }
    );
  }

  // Create Stripe checkout session
  const appUrl = getAppUrl();

  try {
    // Check if trial is available
    const trialConfig = await getTrialConfig();
    let trialDays: number | undefined;

    if (trialConfig?.trial_enabled) {
      const allowedTiers = trialConfig.trial_allowed_tiers || [];
      if (allowedTiers.includes(tier as SubscriptionTier)) {
        // Check if team already had a trial
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('trial_ends_at')
          .eq('team_id', team_id)
          .single();

        if (!existingSub?.trial_ends_at) {
          trialDays = trialConfig.trial_duration_days;
        }
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          team_id: team_id,
          organization_id: profile?.organization_id || '',
          tier: tier,
          billing_cycle: billingCycleValue
        }
      },
      success_url: `${appUrl}/billing/success?team=${team_id}&tier=${tier}`,
      cancel_url: `${appUrl}/pricing?tier=${tier}&billing=${billingCycleValue}&canceled=true`,
      metadata: {
        team_id: team_id,
        organization_id: profile?.organization_id || '',
        tier: tier,
        billing_cycle: billingCycleValue
      }
    });

    // Log audit event
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_email: user.email,
      action: 'stripe.checkout_created',
      target_type: 'team',
      target_id: team_id,
      target_name: team.name,
      metadata: {
        tier,
        billing_cycle: billingCycleValue,
        trial_days: trialDays || 0,
        checkout_session_id: session.id
      }
    });

    return NextResponse.json({
      url: session.url,
      session_id: session.id
    });
  } catch (err) {
    console.error('Failed to create checkout session:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
