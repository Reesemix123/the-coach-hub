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
  const purchaseType = session.metadata?.purchase_type;
  const teamId = session.metadata?.team_id;
  const userId = session.metadata?.user_id;
  const isSignupFlow = session.metadata?.signup_flow === 'true';

  // Handle signup flow (user pays before creating team)
  if (isSignupFlow && userId) {
    const tier = session.metadata?.tier;
    const billingCycle = session.metadata?.billing_cycle;
    console.log(`Signup checkout completed for user ${userId}, tier: ${tier}`);

    // Log audit event
    await supabase.from('audit_logs').insert({
      action: 'stripe.signup_checkout_completed',
      target_type: 'user',
      target_id: userId,
      metadata: {
        session_id: session.id,
        tier,
        billing_cycle: billingCycle,
        customer: session.customer
      }
    });

    // The subscription will be created via subscription.created webhook
    return;
  }

  if (!teamId) {
    console.error('Checkout completed without team_id in metadata');
    return;
  }

  // Handle AI/video minutes purchase (one-time payment)
  if (purchaseType === 'minutes' || session.mode === 'payment') {
    await handleAIMinutesPurchase(supabase, session);
    return;
  }

  // Handle regular subscription checkout
  const tier = session.metadata?.tier;
  const billingCycle = session.metadata?.billing_cycle;
  console.log(`Checkout completed for team ${teamId}, tier: ${tier}, billing: ${billingCycle}`);

  // The subscription will be created/updated via subscription.created webhook
  // Just log the checkout completion
  await supabase.from('audit_logs').insert({
    action: 'stripe.checkout_completed',
    target_type: 'team',
    target_id: teamId,
    metadata: {
      session_id: session.id,
      tier,
      billing_cycle: billingCycle,
      customer: session.customer
    }
  });
}

async function handleAIMinutesPurchase(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session
) {
  const teamId = session.metadata?.team_id;
  const organizationId = session.metadata?.organization_id;
  const minutes = parseInt(session.metadata?.minutes || '0');

  // Get price from session amount if not in metadata
  const priceCents = session.amount_total || 0;

  if (!teamId || !minutes) {
    console.error('AI minutes purchase missing required metadata:', session.id);
    return;
  }

  // Calculate expiration date (90 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  // Create purchase record
  const { error } = await supabase
    .from('ai_credit_purchases')
    .insert({
      team_id: teamId,
      minutes_purchased: minutes,
      minutes_remaining: minutes,
      price_cents: priceCents,
      purchased_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      stripe_payment_intent_id: session.payment_intent as string || null,
      stripe_checkout_session_id: session.id
    });

  if (error) {
    console.error('Failed to create AI minutes purchase record:', error);
    return;
  }

  // Log audit event
  await supabase.from('audit_logs').insert({
    action: 'ai_credits.purchase',
    target_type: 'team',
    target_id: teamId,
    metadata: {
      session_id: session.id,
      minutes_purchased: minutes,
      price_cents: priceCents,
      expires_at: expiresAt.toISOString(),
      organization_id: organizationId
    }
  });

  console.log(`Added ${minutes} AI video minutes purchase for team ${teamId}`);
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const teamId = subscription.metadata?.team_id;
  const userId = subscription.metadata?.user_id;
  const isSignupFlow = subscription.metadata?.signup_flow === 'true';

  // Get tier from metadata or from price ID
  let tier = subscription.metadata?.tier;
  if (!tier && subscription.items.data.length > 0) {
    const priceId = subscription.items.data[0].price.id;
    tier = getTierFromPriceId(priceId) || 'plus';
  }

  const status = mapStripeStatus(subscription.status);
  const stripePrice = subscription.items.data[0]?.price.id || null;

  // Handle signup flow (subscription linked to user, not team yet)
  if (isSignupFlow && userId && !teamId) {
    // Check if subscription already exists for this user
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .is('team_id', null)
      .single();

    if (existingSub) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          tier,
          status,
          stripe_subscription_id: subscription.id,
          stripe_price_id: stripePrice,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSub.id);

      if (updateError) {
        console.error('Failed to update signup subscription:', updateError);
      }
    } else {
      // Create new subscription for user
      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          team_id: null,
          tier,
          status,
          stripe_subscription_id: subscription.id,
          stripe_price_id: stripePrice,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Failed to create signup subscription:', insertError);
      }
    }

    // Log audit event
    await supabase.from('audit_logs').insert({
      action: 'subscription.signup_created',
      target_type: 'user',
      target_id: userId,
      metadata: {
        status,
        tier,
        stripe_subscription_id: subscription.id
      }
    });

    console.log(`Created signup subscription for user ${userId}: status=${status}, tier=${tier}`);
    return;
  }

  // Regular flow - subscription linked to team
  if (!teamId) {
    console.error('Subscription updated without team_id in metadata:', subscription.id);
    return;
  }

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
  const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  // Use database function to allocate credits based on tier
  // This handles all the tier-specific logic (video minutes, text actions, priority)
  const { error } = await supabase.rpc('allocate_subscription_credits', {
    p_team_id: teamId,
    p_tier: tier,
    p_period_start: periodStart,
    p_period_end: periodEnd
  });

  if (error) {
    console.error('Failed to allocate AI credits via RPC:', error);

    // Fallback: direct insert if RPC fails (e.g., function not yet deployed)
    // Tier-based allocations
    const tierAllocations: Record<string, { videoMinutes: number; textActions: number; priority: boolean }> = {
      basic: { videoMinutes: 0, textActions: 0, priority: false },
      plus: { videoMinutes: 30, textActions: 100, priority: false },
      premium: { videoMinutes: 120, textActions: -1, priority: false }, // -1 = unlimited
      ai_powered: { videoMinutes: 300, textActions: -1, priority: true }
    };

    const allocation = tierAllocations[tier] || tierAllocations.basic;

    const { error: fallbackError } = await supabase
      .from('ai_credits')
      .upsert({
        team_id: teamId,
        video_minutes_monthly: allocation.videoMinutes,
        text_actions_monthly: allocation.textActions,
        video_minutes_remaining: allocation.videoMinutes,
        text_actions_remaining: allocation.textActions,
        priority_processing: allocation.priority,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'team_id'
      });

    if (fallbackError) {
      console.error('Failed to allocate AI credits via fallback:', fallbackError);
      return;
    }

    console.log(`Allocated AI credits for team ${teamId} via fallback: ${allocation.videoMinutes} video minutes, ${allocation.textActions === -1 ? 'unlimited' : allocation.textActions} text actions`);
    return;
  }

  console.log(`Allocated AI credits for team ${teamId} via RPC`);
}
