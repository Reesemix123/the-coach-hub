// /api/console/billing/create-customer - Create Stripe customer for organization
// Creates a Stripe customer if one doesn't exist for the user's organization

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';

export async function POST() {
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

  // Get user's profile and organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, organization_id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json(
      { error: 'Profile not found' },
      { status: 404 }
    );
  }

  // If user has an organization, get or create customer for the org
  if (profile.organization_id) {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, stripe_customer_id, billing_email, owner_user_id')
      .eq('id', profile.organization_id)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Return existing customer if exists
    if (org.stripe_customer_id) {
      return NextResponse.json({
        customer_id: org.stripe_customer_id,
        already_existed: true
      });
    }

    // Create new Stripe customer for organization
    try {
      const customer = await stripe.customers.create({
        email: org.billing_email || profile.email || user.email,
        name: org.name,
        metadata: {
          organization_id: org.id,
          owner_user_id: org.owner_user_id
        }
      });

      // Update organization with Stripe customer ID
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ stripe_customer_id: customer.id })
        .eq('id', org.id);

      if (updateError) {
        console.error('Failed to update organization with Stripe customer ID:', updateError);
        // Don't fail - customer was created in Stripe
      }

      // Log audit event
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        actor_email: user.email,
        action: 'stripe.customer_created',
        target_type: 'organization',
        target_id: org.id,
        target_name: org.name,
        metadata: { stripe_customer_id: customer.id }
      });

      return NextResponse.json({
        customer_id: customer.id,
        already_existed: false
      });
    } catch (err) {
      console.error('Stripe customer creation failed:', err);
      return NextResponse.json(
        { error: 'Failed to create Stripe customer' },
        { status: 500 }
      );
    }
  }

  // Legacy mode: User without organization
  // For legacy users, we'll create a customer based on user email
  // This is for backward compatibility

  // Check if there's already a customer for this user's teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);

  if (!teams || teams.length === 0) {
    return NextResponse.json(
      { error: 'No teams found. Create a team first.' },
      { status: 400 }
    );
  }

  try {
    const customer = await stripe.customers.create({
      email: profile.email || user.email,
      name: profile.full_name || user.email,
      metadata: {
        user_id: user.id,
        legacy_mode: 'true'
      }
    });

    // Log audit event
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_email: user.email,
      action: 'stripe.customer_created',
      target_type: 'user',
      target_id: user.id,
      metadata: { stripe_customer_id: customer.id, legacy_mode: true }
    });

    return NextResponse.json({
      customer_id: customer.id,
      already_existed: false,
      legacy_mode: true
    });
  } catch (err) {
    console.error('Stripe customer creation failed:', err);
    return NextResponse.json(
      { error: 'Failed to create Stripe customer' },
      { status: 500 }
    );
  }
}
