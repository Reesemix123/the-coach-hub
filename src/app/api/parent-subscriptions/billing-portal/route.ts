/**
 * API: /api/parent-subscriptions/billing-portal
 *
 * POST - Create a Stripe Billing Portal session so the parent can manage or
 *        cancel their subscription directly in Stripe's hosted UI.
 *
 * Returns { url: string } on success.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getStripeClient, getAppUrl } from '@/lib/stripe/client';

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the user has a parent profile
    const { data: parentProfile, error: parentError } = await supabase
      .from('parent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (parentError || !parentProfile) {
      return NextResponse.json(
        { error: 'Parent profile not found. Only parents can access billing.' },
        { status: 403 }
      );
    }

    // Find the Stripe customer ID from any of this parent's subscriptions.
    // The customer ID is consistent across all of their athlete profile subscriptions.
    const { data: subRow, error: subError } = await supabase
      .from('parent_profile_subscriptions')
      .select('stripe_customer_id')
      .eq('parent_id', parentProfile.id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (subError || !subRow?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this parent. Subscribe first.' },
        { status: 404 }
      );
    }

    const stripe = getStripeClient();
    const appUrl = getAppUrl();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subRow.stripe_customer_id,
      return_url: `${appUrl}/parent/athletes`,
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_email: user.email,
      action: 'stripe.parent_billing_portal_accessed',
      target_type: 'parent_profile',
      target_id: parentProfile.id,
      metadata: {
        stripe_customer_id: subRow.stripe_customer_id,
      },
    });

    return NextResponse.json({ url: portalSession.url }, { status: 200 });
  } catch (error) {
    console.error('Error creating parent billing portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
}
