// /api/webhooks/stripe - Stripe webhook handler
// Handles subscription events from Stripe to sync local database

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { getStripeClient, mapStripeStatus, getTierFromPriceId } from '@/lib/stripe/client';
import { getTierConfig } from '@/lib/admin/config';

// Use service role for webhook operations (no auth context)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase service role configuration missing');
  }

  return createClient(url, serviceKey);
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    );
  }

  const stripe = getStripeClient();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  // Get raw body for signature verification
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(supabase, event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoiceFailed(supabase, event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error processing webhook ${event.type}:`, err);
    // Return 200 to prevent Stripe from retrying
    // Log the error for debugging
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session
) {
  const teamId = session.metadata?.team_id;
  const tier = session.metadata?.tier;

  if (!teamId) {
    console.error('Checkout completed without team_id in metadata');
    return;
  }

  console.log(`Checkout completed for team ${teamId}, tier: ${tier}`);

  // The subscription will be created/updated via subscription.created webhook
  // Just log the checkout completion
  await supabase.from('audit_logs').insert({
    action: 'stripe.checkout_completed',
    target_type: 'team',
    target_id: teamId,
    metadata: {
      session_id: session.id,
      tier,
      customer: session.customer
    }
  });
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const teamId = subscription.metadata?.team_id;

  if (!teamId) {
    console.error('Subscription updated without team_id in metadata:', subscription.id);
    return;
  }

  // Get tier from metadata or from price ID
  let tier = subscription.metadata?.tier;
  if (!tier && subscription.items.data.length > 0) {
    const priceId = subscription.items.data[0].price.id;
    tier = getTierFromPriceId(priceId) || 'hs_basic';
  }

  const status = mapStripeStatus(subscription.status);
  const stripePrice = subscription.items.data[0]?.price.id || null;

  // Update or create local subscription record
  const { error: upsertError } = await supabase
    .from('subscriptions')
    .upsert({
      team_id: teamId,
      tier,
      status,
      stripe_subscription_id: subscription.id,
      stripe_price_id: stripePrice,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'team_id'
    });

  if (upsertError) {
    console.error('Failed to upsert subscription:', upsertError);
    return;
  }

  // Allocate AI credits for this billing period
  await allocateAICredits(supabase, teamId, tier, subscription);

  // Log audit event
  await supabase.from('audit_logs').insert({
    action: 'subscription.updated',
    target_type: 'team',
    target_id: teamId,
    metadata: {
      status,
      tier,
      stripe_subscription_id: subscription.id,
      period_end: new Date(subscription.current_period_end * 1000).toISOString()
    }
  });

  console.log(`Updated subscription for team ${teamId}: status=${status}, tier=${tier}`);
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const teamId = subscription.metadata?.team_id;

  if (!teamId) {
    console.error('Subscription deleted without team_id in metadata:', subscription.id);
    return;
  }

  // Update subscription status to canceled
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('team_id', teamId);

  if (error) {
    console.error('Failed to update subscription to canceled:', error);
    return;
  }

  // Log audit event
  await supabase.from('audit_logs').insert({
    action: 'subscription.canceled',
    target_type: 'team',
    target_id: teamId,
    metadata: {
      stripe_subscription_id: subscription.id
    }
  });

  console.log(`Subscription canceled for team ${teamId}`);
}

async function handleInvoicePaid(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;

  // Find organization by Stripe customer ID
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) {
    console.log(`No organization found for Stripe customer ${customerId}`);
    return;
  }

  // Store invoice record
  const { error } = await supabase
    .from('invoices')
    .upsert({
      organization_id: org.id,
      stripe_invoice_id: invoice.id,
      amount_cents: invoice.amount_paid,
      currency: invoice.currency,
      status: 'paid',
      invoice_date: new Date(invoice.created * 1000).toISOString(),
      paid_at: new Date().toISOString(),
      invoice_pdf_url: invoice.invoice_pdf || null
    }, {
      onConflict: 'stripe_invoice_id'
    });

  if (error) {
    console.error('Failed to store invoice:', error);
    return;
  }

  console.log(`Invoice ${invoice.id} paid for organization ${org.id}`);
}

async function handleInvoiceFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string;

  // Find organization by Stripe customer ID
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) {
    console.log(`No organization found for Stripe customer ${customerId}`);
    return;
  }

  // Log the failed payment
  await supabase.from('audit_logs').insert({
    action: 'stripe.invoice_failed',
    target_type: 'organization',
    target_id: org.id,
    metadata: {
      stripe_invoice_id: invoice.id,
      amount: invoice.amount_due,
      attempt_count: invoice.attempt_count
    }
  });

  console.log(`Invoice ${invoice.id} payment failed for organization ${org.id}`);
}

async function allocateAICredits(
  supabase: ReturnType<typeof createClient>,
  teamId: string,
  tier: string,
  subscription: Stripe.Subscription
) {
  // Get AI credits for this tier
  const tierConfig = await getTierConfig(tier as 'little_league' | 'hs_basic' | 'hs_advanced' | 'ai_powered');
  const creditsAllowed = tierConfig?.ai_credits || 0;

  const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  // Upsert AI credits record for this period
  const { error } = await supabase
    .from('ai_credits')
    .upsert({
      team_id: teamId,
      credits_allowed: creditsAllowed,
      credits_used: 0, // Reset for new period
      period_start: periodStart,
      period_end: periodEnd,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'team_id,period_start'
    });

  if (error) {
    console.error('Failed to allocate AI credits:', error);
    return;
  }

  console.log(`Allocated ${creditsAllowed} AI credits for team ${teamId}`);
}
