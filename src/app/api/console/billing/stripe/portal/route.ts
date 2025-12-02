// /api/console/billing/stripe/portal - Create Stripe billing portal session
// Redirects users to Stripe's customer portal for payment method management

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { isStripeEnabled } from '@/lib/admin/config';
import { getStripeClient, isStripeConfigured, getAppUrl } from '@/lib/stripe/client';

export async function POST() {
  // Check Stripe configuration
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: 'Stripe is not configured',
        message: 'Billing integration is not set up. Contact support for billing inquiries.'
      },
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

  // Check if Stripe is enabled in platform config
  const stripeEnabled = await isStripeEnabled();
  if (!stripeEnabled) {
    return NextResponse.json(
      {
        error: 'Billing is not enabled',
        message: 'Stripe billing is disabled. Contact support for billing inquiries.'
      },
      { status: 503 }
    );
  }

  // Get user's profile and organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  let customerId: string | null = null;

  if (profile?.organization_id) {
    // Organization mode - get customer from org
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', profile.organization_id)
      .single();

    customerId = org?.stripe_customer_id || null;
  } else {
    // Legacy mode - try to find customer by looking at team subscriptions
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', user.id);

    if (teams && teams.length > 0) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('stripe_subscription_id')
        .in('team_id', teams.map(t => t.id))
        .not('stripe_subscription_id', 'is', null)
        .limit(1)
        .single();

      if (subscription?.stripe_subscription_id) {
        // Get customer from Stripe subscription
        try {
          const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
          customerId = stripeSub.customer as string;
        } catch (err) {
          console.error('Failed to retrieve Stripe subscription:', err);
        }
      }
    }
  }

  if (!customerId) {
    return NextResponse.json(
      {
        error: 'No billing account',
        message: 'You don\'t have an active billing account. Subscribe to a plan first.'
      },
      { status: 400 }
    );
  }

  // Create billing portal session
  const appUrl = getAppUrl();

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/console/billing`
    });

    // Log audit event
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_email: user.email,
      action: 'stripe.portal_opened',
      target_type: 'user',
      target_id: user.id,
      metadata: {
        customer_id: customerId
      }
    });

    return NextResponse.json({
      url: session.url
    });
  } catch (err) {
    console.error('Failed to create billing portal session:', err);
    return NextResponse.json(
      { error: 'Failed to open billing portal' },
      { status: 500 }
    );
  }
}
