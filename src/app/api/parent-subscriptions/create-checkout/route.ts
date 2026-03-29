/**
 * API: /api/parent-subscriptions/create-checkout
 *
 * GET  - Redirect to Stripe Checkout (used by plain <a href> links from the profile page)
 * POST - Return { url } JSON (used by fetch() calls)
 *
 * Creates a Stripe Checkout session for the $19.99/year parent profile subscription.
 * The subscription is anchored to a specific athlete profile, not a team or season.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getStripeClient, getAppUrl } from '@/lib/stripe/client';

/**
 * Shared business logic: resolve the parent profile, verify ownership of the
 * athlete profile, and create a Stripe Checkout session.
 *
 * @returns The Stripe session URL, or a NextResponse error if something fails.
 */
async function buildCheckoutSession(
  athleteId: string | null
): Promise<{ url: string } | NextResponse> {
  if (!athleteId) {
    return NextResponse.json(
      { error: 'athleteId is required' },
      { status: 400 }
    );
  }

  const priceId = process.env.STRIPE_PARENT_PROFILE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json(
      { error: 'Parent profile subscription pricing is not configured' },
      { status: 503 }
    );
  }

  // Authenticate
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the user has a parent profile
  const { data: parentProfile, error: parentError } = await supabase
    .from('parent_profiles')
    .select('id, email, first_name, last_name')
    .eq('user_id', user.id)
    .single();

  if (parentError || !parentProfile) {
    return NextResponse.json(
      { error: 'Parent profile not found. Only parents can subscribe.' },
      { status: 403 }
    );
  }

  // Verify the parent owns (or created) this athlete profile
  const { data: athleteProfile, error: athleteError } = await supabase
    .from('athlete_profiles')
    .select('id, athlete_first_name, athlete_last_name')
    .eq('id', athleteId)
    .eq('created_by_parent_id', parentProfile.id)
    .single();

  if (athleteError || !athleteProfile) {
    return NextResponse.json(
      { error: 'Athlete profile not found or not owned by this parent' },
      { status: 404 }
    );
  }

  // Check for an already-active subscription on this parent + athlete combination
  const { data: existingSub } = await supabase
    .from('parent_profile_subscriptions')
    .select('id, status')
    .eq('parent_id', parentProfile.id)
    .eq('athlete_profile_id', athleteId)
    .in('status', ['active', 'past_due'])
    .maybeSingle();

  if (existingSub) {
    return NextResponse.json(
      {
        error: 'An active subscription already exists for this athlete profile',
        subscription: existingSub,
      },
      { status: 409 }
    );
  }

  // Get or create a Stripe customer for this parent.
  // We check parent_profile_subscriptions for an existing stripe_customer_id so we
  // reuse the same Stripe customer across multiple athlete subscriptions.
  const stripe = getStripeClient();
  const appUrl = getAppUrl();

  let stripeCustomerId: string;

  const { data: existingCustomerRow } = await supabase
    .from('parent_profile_subscriptions')
    .select('stripe_customer_id')
    .eq('parent_id', parentProfile.id)
    .not('stripe_customer_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (existingCustomerRow?.stripe_customer_id) {
    stripeCustomerId = existingCustomerRow.stripe_customer_id;
  } else {
    const customer = await stripe.customers.create({
      email: parentProfile.email,
      name: `${parentProfile.first_name} ${parentProfile.last_name}`,
      metadata: {
        parent_id: parentProfile.id,
        user_id: user.id,
      },
    });
    stripeCustomerId = customer.id;
  }

  // Create Stripe Checkout session (recurring subscription)
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      subscription_type: 'parent_profile',
      parent_id: parentProfile.id,
      athlete_profile_id: athleteId,
    },
    success_url: `${appUrl}/parent/athletes/${athleteId}?subscription=success`,
    cancel_url: `${appUrl}/parent/athletes/${athleteId}?subscription=canceled`,
  });

  // Audit log
  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    actor_email: user.email,
    action: 'stripe.parent_profile_checkout_created',
    target_type: 'athlete_profile',
    target_id: athleteId,
    target_name: `${athleteProfile.athlete_first_name} ${athleteProfile.athlete_last_name}`,
    metadata: {
      checkout_session_id: session.id,
      parent_id: parentProfile.id,
    },
  });

  return { url: session.url! };
}

// ---------------------------------------------------------------------------
// GET — plain anchor link redirect (/api/parent-subscriptions/create-checkout?athleteId=...)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const athleteId = request.nextUrl.searchParams.get('athleteId');
    const result = await buildCheckoutSession(athleteId);

    // If buildCheckoutSession returned a NextResponse it is an error
    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.redirect(result.url);
  } catch (error) {
    console.error('Error creating parent profile checkout (GET):', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — fetch()-based call, returns { url } JSON
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const athleteId: string | null = body.athleteId ?? null;

    const result = await buildCheckoutSession(athleteId);

    if (result instanceof NextResponse) {
      return result;
    }

    return NextResponse.json({ url: result.url }, { status: 200 });
  } catch (error) {
    console.error('Error creating parent profile checkout (POST):', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
