// /api/teams/:teamId/ai-credits/purchase - Purchase additional AI minutes
// Handles Stripe checkout for one-time AI minute purchases

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// AI minutes packages available for purchase
export const AI_MINUTES_PACKAGES = {
  '15': { minutes: 15, price_cents: 1500, price_per_minute: 1.00 },
  '30': { minutes: 30, price_cents: 2500, price_per_minute: 0.83 },
  '60': { minutes: 60, price_cents: 4500, price_per_minute: 0.75 },
  '120': { minutes: 120, price_cents: 7900, price_per_minute: 0.66 },
} as const;

export type PackageSize = keyof typeof AI_MINUTES_PACKAGES;

// Lazy initialization to avoid build-time errors
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia',
    });
  }
  return stripeInstance;
}

/**
 * POST /api/teams/:teamId/ai-credits/purchase
 * Create a Stripe checkout session for purchasing AI minutes
 *
 * Request body:
 * {
 *   package: '15' | '30' | '60' | '120'
 * }
 */
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

  // Parse request body
  let body: { package: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const packageSize = body.package as PackageSize;

  if (!packageSize || !AI_MINUTES_PACKAGES[packageSize]) {
    return NextResponse.json(
      {
        error: 'Invalid package size',
        valid_packages: Object.keys(AI_MINUTES_PACKAGES)
      },
      { status: 400 }
    );
  }

  // Verify user has access to this team (owner or coach can purchase)
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

  // Check if user is owner or coach
  let canPurchase = team.user_id === user.id;

  if (!canPurchase) {
    // Check if user is a coach on this team
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    canPurchase = membership?.role === 'owner' || membership?.role === 'coach';
  }

  if (!canPurchase) {
    return NextResponse.json(
      { error: 'Only team owners and coaches can purchase AI credits' },
      { status: 403 }
    );
  }

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single();

  let stripeCustomerId = profile?.stripe_customer_id;

  if (!stripeCustomerId) {
    // Create new Stripe customer
    const customer = await getStripe().customers.create({
      email: profile?.email || user.email,
      metadata: {
        supabase_user_id: user.id,
        team_id: teamId
      }
    });

    stripeCustomerId = customer.id;

    // Save customer ID to profile
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', user.id);
  }

  // Create Stripe checkout session
  const pkg = AI_MINUTES_PACKAGES[packageSize];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const session = await getStripe().checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${pkg.minutes} AI Film Minutes`,
              description: `Add ${pkg.minutes} AI film analysis minutes to your team. Valid for 90 days.`,
              metadata: {
                type: 'ai_minutes_purchase',
                minutes: pkg.minutes.toString(),
                team_id: teamId
              }
            },
            unit_amount: pkg.price_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'ai_minutes_purchase',
        team_id: teamId,
        user_id: user.id,
        minutes: pkg.minutes.toString(),
        price_cents: pkg.price_cents.toString()
      },
      success_url: `${baseUrl}/teams/${teamId}/settings/billing?purchase=success&minutes=${pkg.minutes}`,
      cancel_url: `${baseUrl}/teams/${teamId}/settings/billing?purchase=cancelled`,
    });

    return NextResponse.json({
      checkout_url: session.url,
      session_id: session.id,
      package: {
        minutes: pkg.minutes,
        price_cents: pkg.price_cents,
        price_per_minute: pkg.price_per_minute
      }
    });
  } catch (stripeError) {
    console.error('Stripe error:', stripeError);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/teams/:teamId/ai-credits/purchase
 * Get available AI minutes packages and purchase history
 */
export async function GET(
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

  // Verify user has access to this team
  const { data: team } = await supabase
    .from('teams')
    .select('id, user_id, organization_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Check access
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  const hasAccess =
    team.user_id === user.id ||
    (profile?.organization_id && profile.organization_id === team.organization_id);

  if (!hasAccess) {
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
  }

  // Check if user can purchase (owner or coach)
  let canPurchase = team.user_id === user.id;

  if (!canPurchase) {
    // Check if user is a coach on this team
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    canPurchase = membership?.role === 'owner' || membership?.role === 'coach';
  }

  // Get purchase history
  const { data: purchases } = await supabase
    .from('ai_credit_purchases')
    .select('*')
    .eq('team_id', teamId)
    .order('purchased_at', { ascending: false });

  // Calculate totals
  const now = new Date();
  const activePurchases = (purchases || []).filter(p =>
    new Date(p.expires_at) > now && p.minutes_remaining > 0
  );

  const totalActiveMinutes = activePurchases.reduce(
    (sum, p) => sum + p.minutes_remaining, 0
  );

  return NextResponse.json({
    packages: Object.entries(AI_MINUTES_PACKAGES).map(([size, pkg]) => ({
      id: size,
      minutes: pkg.minutes,
      price_cents: pkg.price_cents,
      price_display: `$${(pkg.price_cents / 100).toFixed(0)}`,
      price_per_minute: pkg.price_per_minute,
      is_best_value: size === '60'
    })),
    purchase_history: purchases || [],
    active_purchases: activePurchases,
    total_active_minutes: totalActiveMinutes,
    can_purchase: canPurchase
  });
}
