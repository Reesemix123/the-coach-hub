/**
 * API: /api/communication/plan/checkout
 * POST - Create Stripe checkout session for communication plan purchase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getStripeClient, getAppUrl } from '@/lib/stripe/client';
import type { PlanTier } from '@/types/communication';

// Communication plan price IDs from environment
const COMM_PLAN_PRICES: Record<PlanTier, string | undefined> = {
  rookie: process.env.STRIPE_PRICE_COMM_ROOKIE,
  varsity: process.env.STRIPE_PRICE_COMM_VARSITY,
  all_conference: process.env.STRIPE_PRICE_COMM_ALL_CONFERENCE,
  all_state: process.env.STRIPE_PRICE_COMM_ALL_STATE,
};

const PLAN_MAX_PARENTS: Record<PlanTier, number | null> = {
  rookie: 20,
  varsity: 40,
  all_conference: 60,
  all_state: null, // unlimited
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, planTier } = body;

    if (!teamId || !planTier) {
      return NextResponse.json(
        { error: 'teamId and planTier are required' },
        { status: 400 }
      );
    }

    // Validate plan tier
    if (!['rookie', 'varsity', 'all_conference', 'all_state'].includes(planTier)) {
      return NextResponse.json(
        { error: 'Invalid plan tier' },
        { status: 400 }
      );
    }

    // Verify user has permission (owner or team_admin)
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
        { error: 'Only team owners and admins can purchase communication plans' },
        { status: 403 }
      );
    }

    // Check for existing active plan
    const { data: existingPlan } = await supabase
      .from('team_communication_plans')
      .select('id, plan_tier, expires_at, status')
      .eq('team_id', teamId)
      .eq('status', 'active')
      .single();

    if (existingPlan) {
      return NextResponse.json(
        { error: 'Team already has an active communication plan', plan: existingPlan },
        { status: 409 }
      );
    }

    // Get price ID for the selected tier
    const priceId = COMM_PLAN_PRICES[planTier as PlanTier];
    if (!priceId) {
      return NextResponse.json(
        { error: 'Communication plan pricing not configured for this tier' },
        { status: 503 }
      );
    }

    const stripe = getStripeClient();
    const appUrl = getAppUrl();

    // Get or create Stripe customer
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

    // Create Stripe checkout session (one-time payment)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        team_id: teamId,
        plan_tier: planTier,
        purchase_type: 'communication_plan',
        user_id: user.id,
        max_parents: (PLAN_MAX_PARENTS[planTier as PlanTier] ?? 'unlimited').toString(),
      },
      success_url: `${appUrl}/teams/${teamId}/communication/plan?purchase=success`,
      cancel_url: `${appUrl}/teams/${teamId}/communication/plan?purchase=canceled`,
    });

    // Log audit event
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_email: user.email,
      action: 'stripe.comm_plan_checkout_created',
      target_type: 'team',
      target_id: teamId,
      target_name: team.name,
      metadata: {
        plan_tier: planTier,
        checkout_session_id: session.id,
      },
    });

    return NextResponse.json({
      url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    console.error('Error creating communication plan checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
