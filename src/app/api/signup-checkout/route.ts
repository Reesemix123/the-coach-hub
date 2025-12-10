// /api/signup-checkout - Create Stripe checkout session for new user signup
// This differs from the console checkout by not requiring a team_id
// The subscription is created for the user and linked to their team after creation

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isStripeEnabled } from '@/lib/admin/config';
import {
  getStripeClient,
  getPriceIdForTier,
  isStripeConfigured,
  getAppUrl,
  BillingCycle
} from '@/lib/stripe/client';
import { SubscriptionTier } from '@/types/admin';

interface SignupCheckoutRequest {
  tier: SubscriptionTier;
  billing_cycle?: BillingCycle;
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
      { error: 'Not authenticated', message: 'Please sign in to continue.' },
      { status: 401 }
    );
  }

  // Parse request body
  let body: SignupCheckoutRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { tier, billing_cycle = 'monthly' } = body;

  // Validate tier
  const validTiers: SubscriptionTier[] = ['plus', 'premium'];
  if (!tier || !validTiers.includes(tier)) {
    return NextResponse.json(
      { error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` },
      { status: 400 }
    );
  }

  // Validate billing cycle
  if (billing_cycle !== 'monthly' && billing_cycle !== 'yearly') {
    return NextResponse.json(
      { error: 'billing_cycle must be "monthly" or "yearly"' },
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

  // Get price ID
  const priceId = getPriceIdForTier(tier, billing_cycle);
  if (!priceId) {
    return NextResponse.json(
      { error: `No ${billing_cycle} price configured for tier: ${tier}` },
      { status: 400 }
    );
  }

  // Get or create Stripe customer
  let customerId: string;

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (profile?.stripe_customer_id) {
    customerId = profile.stripe_customer_id;
  } else {
    // Create new Stripe customer
    try {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        metadata: {
          user_id: user.id,
          signup_flow: 'true'
        }
      });
      customerId = customer.id;

      // Save customer ID to profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customer.id })
        .eq('id', user.id);
    } catch (err) {
      console.error('Failed to create Stripe customer:', err);
      return NextResponse.json(
        { error: 'Failed to create billing account' },
        { status: 500 }
      );
    }
  }

  // Create Stripe checkout session
  const appUrl = getAppUrl();

  try {
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
        metadata: {
          user_id: user.id,
          tier: tier,
          billing_cycle: billing_cycle,
          signup_flow: 'true'
        }
      },
      success_url: `${appUrl}/signup-success?tier=${tier}`,
      cancel_url: `${appUrl}/checkout?tier=${tier}&canceled=true`,
      metadata: {
        user_id: user.id,
        tier: tier,
        billing_cycle: billing_cycle,
        signup_flow: 'true'
      }
    });

    // Log audit event
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_email: user.email,
      action: 'stripe.signup_checkout_created',
      target_type: 'user',
      target_id: user.id,
      metadata: {
        tier,
        billing_cycle,
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
