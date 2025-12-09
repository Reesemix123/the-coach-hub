// /api/tokens/purchase - Purchase additional upload tokens via Stripe
// Creates a Stripe Checkout session for token purchase

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';

/**
 * POST /api/tokens/purchase
 * Create a Stripe Checkout session to purchase additional upload tokens
 *
 * Request body:
 * - team_id: string (required) - Team ID to add tokens to
 * - quantity: number (optional, default 1) - Number of tokens to purchase
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Check Stripe configuration
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Payment system not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { team_id, quantity = 1 } = body;

    if (!team_id) {
      return NextResponse.json(
        { error: 'team_id is required' },
        { status: 400 }
      );
    }

    if (quantity < 1 || quantity > 20) {
      return NextResponse.json(
        { error: 'quantity must be between 1 and 20' },
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

    // Check if user owns the team or is a member with billing access
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('id, role')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isOwner = team.user_id === user.id;
    const hasAccess = isOwner || membership?.role === 'owner' || membership?.role === 'coach';

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied - billing requires owner or coach role' },
        { status: 403 }
      );
    }

    // Get the token price ID from config
    const { data: tokenPriceConfig } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'stripe_token_price_id')
      .single();

    // Fallback to environment variable if not in database
    const tokenPriceId = tokenPriceConfig?.value as string
      || process.env.STRIPE_TOKEN_PRICE_ID;

    if (!tokenPriceId) {
      return NextResponse.json(
        { error: 'Token pricing not configured' },
        { status: 503 }
      );
    }

    // Get or create Stripe customer
    let stripeCustomerId: string | null = null;

    // Check if org has a Stripe customer
    if (team.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('stripe_customer_id')
        .eq('id', team.organization_id)
        .single();

      stripeCustomerId = org?.stripe_customer_id || null;
    }

    // Create customer if needed
    const stripe = getStripeClient();

    if (!stripeCustomerId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      const customer = await stripe.customers.create({
        email: profile?.email || user.email || undefined,
        name: profile?.full_name || undefined,
        metadata: {
          user_id: user.id,
          team_id: team_id,
          organization_id: team.organization_id || ''
        }
      });

      stripeCustomerId = customer.id;

      // Update organization with customer ID if applicable
      if (team.organization_id) {
        await supabase
          .from('organizations')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', team.organization_id);
      }
    }

    // Create Checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || '';

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'payment',
      line_items: [
        {
          price: tokenPriceId,
          quantity: quantity
        }
      ],
      success_url: `${baseUrl}/film?token_purchase=success&quantity=${quantity}`,
      cancel_url: `${baseUrl}/film?token_purchase=cancelled`,
      metadata: {
        type: 'token_purchase',
        team_id: team_id,
        user_id: user.id,
        quantity: quantity.toString()
      }
    });

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id
    });

  } catch (error) {
    console.error('Error creating token purchase session:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase session' },
      { status: 500 }
    );
  }
}
