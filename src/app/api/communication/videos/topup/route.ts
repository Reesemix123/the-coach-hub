/**
 * API: /api/communication/videos/topup
 * POST - Create a Stripe checkout session for a 5-video top-up pack ($39)
 *
 * Requires an active communication plan. On checkout.session.completed,
 * the Stripe webhook handler records the purchase in video_topup_purchases.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getStripeClient, getAppUrl } from '@/lib/stripe/client';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // Verify team exists and user is the owner or a team admin
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isOwner = team.user_id === user.id;
    const canPurchase = isOwner || ['owner', 'team_admin'].includes(membership?.role || '');

    if (!canPurchase) {
      return NextResponse.json(
        { error: 'Only team owners and admins can purchase video top-ups' },
        { status: 403 }
      );
    }

    // Top-ups require an active communication plan
    const { data: plan } = await supabase
      .from('team_communication_plans')
      .select('id')
      .eq('team_id', teamId)
      .eq('status', 'active')
      .single();

    if (!plan) {
      return NextResponse.json(
        { error: 'Team must have an active communication plan to purchase video top-ups' },
        { status: 400 }
      );
    }

    const priceId = process.env.STRIPE_PRICE_COMM_VIDEO_TOPUP;
    if (!priceId) {
      return NextResponse.json(
        { error: 'Video top-up pricing is not configured' },
        { status: 503 }
      );
    }

    const stripe = getStripeClient();
    const appUrl = getAppUrl();

    // Reuse the same customer-lookup pattern as the plan checkout route
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, email')
      .eq('id', user.id)
      .single();

    let customerId: string;

    if (profile?.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('stripe_customer_id, billing_email, name')
        .eq('id', profile.organization_id)
        .single();

      if (org?.stripe_customer_id) {
        customerId = org.stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({
          email: org?.billing_email || profile.email || user.email,
          name: org?.name || team.name,
          metadata: {
            organization_id: profile.organization_id,
            team_id: teamId,
          },
        });
        customerId = customer.id;

        if (org) {
          await supabase
            .from('organizations')
            .update({ stripe_customer_id: customer.id })
            .eq('id', profile.organization_id);
        }
      }
    } else {
      const customer = await stripe.customers.create({
        email: profile?.email || user.email,
        metadata: {
          user_id: user.id,
          team_id: teamId,
        },
      });
      customerId = customer.id;
    }

    // One-time payment checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      automatic_tax: { enabled: true },
      customer_update: { address: 'auto' },
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        team_id: teamId,
        communication_plan_id: plan.id,
        purchase_type: 'video_topup',
        user_id: user.id,
      },
      success_url: `${appUrl}/football/teams/${teamId}/communication/videos?topup=success`,
      cancel_url: `${appUrl}/football/teams/${teamId}/communication/videos?topup=canceled`,
    });

    return NextResponse.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error('Error creating video top-up checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
