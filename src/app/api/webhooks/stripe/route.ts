// /api/webhooks/stripe - Stripe webhook handler
// Handles subscription events from Stripe to sync local database
// Updated for new tier system with upload tokens

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { getStripeClient, mapStripeStatus, getTierFromPriceId } from '@/lib/stripe/client';
import { getTierConfig } from '@/lib/admin/config';
import { getVideoLimitForTier, getIncludesReportsForTier } from '@/lib/services/communication/plan-helpers';
import type { PlanTier } from '@/types/communication';

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
  const userId = session.metadata?.user_id;
  const isSignupFlow = session.metadata?.signup_flow === 'true';
  const purchaseType = session.metadata?.purchase_type;

  // Handle parent profile subscription checkout
  if (purchaseType === 'parent_profile') {
    const parentId = session.metadata?.parent_id;
    const athleteProfileId = session.metadata?.athlete_profile_id;

    if (!parentId || !athleteProfileId) {
      console.error('Parent profile checkout missing parent_id or athlete_profile_id in metadata');
      return;
    }

    // Retrieve the subscription to get the price ID
    const stripe = getStripeClient();
    const stripeSubscriptionId = session.subscription as string;

    let stripePriceId: string | null = null;
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['items.data.price'],
      });
      stripePriceId = stripeSubscription.items.data[0]?.price.id ?? null;
    } catch (err) {
      console.error('Failed to retrieve Stripe subscription for price ID:', err);
    }

    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const { error: insertError } = await supabase
      .from('parent_profile_subscriptions')
      .insert({
        parent_id: parentId,
        athlete_profile_id: athleteProfileId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: session.customer as string,
        stripe_price_id: stripePriceId,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: oneYearFromNow.toISOString(),
        is_gifted: false,
      });

    if (insertError) {
      console.error('Failed to create parent_profile_subscription:', insertError);
    }

    await supabase.from('audit_logs').insert({
      action: 'parent_profile_subscription.created',
      target_type: 'parent_profile',
      target_id: parentId,
      metadata: {
        athlete_profile_id: athleteProfileId,
        session_id: session.id,
        stripe_subscription_id: stripeSubscriptionId,
      },
    });

    console.log(`Parent profile subscription created for parent ${parentId}, athlete ${athleteProfileId}`);
    return;
  }

  // Handle token purchase checkout
  if (purchaseType === 'token' && teamId) {
    const tokenType = session.metadata?.token_type as 'team' | 'opponent';
    const quantity = parseInt(session.metadata?.quantity || '0', 10);

    if (!tokenType || quantity < 1) {
      console.error('Token purchase checkout missing token_type or quantity');
      return;
    }

    console.log(`Token purchase completed for team ${teamId}: ${quantity} ${tokenType} tokens`);

    // Credit the purchased tokens
    const columnToUpdate = tokenType === 'team'
      ? 'team_purchased_tokens_available'
      : 'opponent_purchased_tokens_available';

    // Get current balance
    const { data: currentBalance } = await supabase
      .from('token_balance')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (currentBalance) {
      const currentValue = tokenType === 'team'
        ? currentBalance.team_purchased_tokens_available || 0
        : currentBalance.opponent_purchased_tokens_available || 0;

      const currentLegacy = currentBalance.purchased_tokens_available || 0;

      await supabase
        .from('token_balance')
        .update({
          [columnToUpdate]: currentValue + quantity,
          purchased_tokens_available: currentLegacy + quantity
        })
        .eq('team_id', teamId);
    } else {
      // Create new token_balance record
      await supabase
        .from('token_balance')
        .insert({
          team_id: teamId,
          subscription_tokens_available: 0,
          subscription_tokens_used_this_period: 0,
          purchased_tokens_available: quantity,
          team_subscription_tokens_available: 0,
          team_subscription_tokens_used_this_period: 0,
          team_purchased_tokens_available: tokenType === 'team' ? quantity : 0,
          opponent_subscription_tokens_available: 0,
          opponent_subscription_tokens_used_this_period: 0,
          opponent_purchased_tokens_available: tokenType === 'opponent' ? quantity : 0,
        });
    }

    // Log the transaction
    await supabase.from('token_transactions').insert({
      team_id: teamId,
      transaction_type: 'purchase',
      amount: quantity,
      source: `${tokenType}_purchased`,
      game_type: tokenType,
      notes: `Purchased ${quantity} ${tokenType} token${quantity !== 1 ? 's' : ''} via Stripe`
    });

    // Log audit event
    await supabase.from('audit_logs').insert({
      action: 'tokens.purchased_via_stripe',
      target_type: 'team',
      target_id: teamId,
      metadata: {
        session_id: session.id,
        token_type: tokenType,
        quantity,
        payment_intent: session.payment_intent
      }
    });

    console.log(`Credited ${quantity} ${tokenType} tokens to team ${teamId}`);
    return;
  }

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

  // Handle communication plan purchase
  if (purchaseType === 'communication_plan' && teamId) {
    const planTier = session.metadata?.plan_tier;
    const userId = session.metadata?.user_id;
    const maxParentsStr = session.metadata?.max_parents;

    if (!planTier) {
      console.error('Communication plan checkout missing plan_tier');
      return;
    }

    const maxParents = maxParentsStr === 'unlimited' ? null : parseInt(maxParentsStr || '20', 10);
    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt);
    expiresAt.setMonth(expiresAt.getMonth() + 6); // 6-month season
    const contentAccessibleUntil = new Date(expiresAt);
    contentAccessibleUntil.setDate(contentAccessibleUntil.getDate() + 30);
    const muxCleanupAt = new Date(expiresAt);
    muxCleanupAt.setDate(muxCleanupAt.getDate() + 60);

    const { error: insertError } = await supabase
      .from('team_communication_plans')
      .insert({
        team_id: teamId,
        purchased_by: userId,
        purchaser_role: (session.metadata?.purchaser_role as 'owner' | 'coach' | 'team_admin') || 'coach',
        stripe_payment_id: session.payment_intent as string,
        stripe_product_id: session.metadata?.stripe_product_id || null,
        plan_tier: planTier,
        max_parents: maxParents,
        max_team_videos: getVideoLimitForTier(planTier as PlanTier),
        team_videos_used: 0,
        includes_reports: getIncludesReportsForTier(planTier as PlanTier),
        activated_at: activatedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        content_accessible_until: contentAccessibleUntil.toISOString(),
        mux_cleanup_at: muxCleanupAt.toISOString(),
        status: 'active',
      });

    if (insertError) {
      console.error('Failed to create communication plan:', insertError);
    }

    await supabase.from('audit_logs').insert({
      action: 'communication_plan.purchased',
      target_type: 'team',
      target_id: teamId,
      metadata: {
        plan_tier: planTier,
        max_parents: maxParents,
        expires_at: expiresAt.toISOString(),
        session_id: session.id,
        payment_intent: session.payment_intent,
      },
    });

    console.log(`Communication plan (${planTier}) created for team ${teamId}`);
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

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  // Handle parent profile subscription updates
  if (subscription.metadata?.subscription_type === 'parent_profile') {
    const status = mapStripeStatus(subscription.status);
    const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
    const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

    const { error } = await supabase
      .from('parent_profile_subscriptions')
      .update({
        status,
        current_period_start: periodStart,
        current_period_end: periodEnd,
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      console.error('Failed to update parent_profile_subscription:', error);
    }

    await supabase.from('audit_logs').insert({
      action: 'parent_profile_subscription.updated',
      target_type: 'stripe_subscription',
      target_id: subscription.id,
      metadata: {
        status,
        period_end: periodEnd,
      },
    });

    console.log(`Parent profile subscription ${subscription.id} updated: status=${status}`);
    return;
  }

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

  // Get current subscription to check status change
  const { data: currentSub } = await supabase
    .from('subscriptions')
    .select('status, past_due_since')
    .eq('team_id', teamId)
    .single();

  const previousStatus = currentSub?.status;
  const isNewlyPastDue = status === 'past_due' && previousStatus !== 'past_due';
  const isNoLongerPastDue = status !== 'past_due' && previousStatus === 'past_due';

  // Build update object
  const subscriptionUpdate: Record<string, unknown> = {
    team_id: teamId,
    tier,
    status,
    billing_waived: false, // Payment confirmed via Stripe - billing is not waived
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
  };

  // Track when subscription enters past_due status for grace period
  if (isNewlyPastDue) {
    subscriptionUpdate.past_due_since = new Date().toISOString();
    subscriptionUpdate.payment_suspended = false;
    subscriptionUpdate.payment_suspended_at = null;
    console.log(`Subscription for team ${teamId} entered past_due status. Grace period started.`);
  }

  // Clear past_due tracking when payment is resolved
  if (isNoLongerPastDue) {
    subscriptionUpdate.past_due_since = null;
    subscriptionUpdate.payment_suspended = false;
    subscriptionUpdate.payment_suspended_at = null;
    console.log(`Subscription for team ${teamId} resolved from past_due to ${status}.`);
  }

  // Update or create local subscription record
  const { error: upsertError } = await supabase
    .from('subscriptions')
    .upsert(subscriptionUpdate, {
      onConflict: 'team_id'
    });

  if (upsertError) {
    console.error('Failed to upsert subscription:', upsertError);
    return;
  }

  // Initialize upload tokens for new subscriptions
  await initializeUploadTokens(supabase, teamId, tier, subscription);

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
  // Handle parent profile subscription cancellation
  if (subscription.metadata?.subscription_type === 'parent_profile') {
    const now = new Date();
    const archiveDate = new Date(now);
    archiveDate.setDate(archiveDate.getDate() + 90);

    const { error } = await supabase
      .from('parent_profile_subscriptions')
      .update({
        status: 'canceled',
        lapsed_at: now.toISOString(),
        data_archive_scheduled_at: archiveDate.toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      console.error('Failed to cancel parent_profile_subscription:', error);
    }

    await supabase.from('audit_logs').insert({
      action: 'parent_profile_subscription.canceled',
      target_type: 'stripe_subscription',
      target_id: subscription.id,
      metadata: {
        lapsed_at: now.toISOString(),
        data_archive_scheduled_at: archiveDate.toISOString(),
      },
    });

    console.log(`Parent profile subscription ${subscription.id} canceled. Data archive scheduled for ${archiveDate.toISOString()}`);
    return;
  }

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
  const subscriptionId = invoice.subscription as string;

  // Handle subscription renewal - refresh tokens
  if (subscriptionId && invoice.billing_reason === 'subscription_cycle') {
    await handleSubscriptionRenewal(supabase, subscriptionId, invoice);
  }

  // Find organization by Stripe customer ID (for invoice storage)
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) {
    // Check if this invoice is for a parent profile subscription
    if (subscriptionId) {
      const { data: parentSub } = await supabase
        .from('parent_profile_subscriptions')
        .select('id, parent_id')
        .eq('stripe_subscription_id', subscriptionId)
        .maybeSingle();

      if (parentSub) {
        const periodStart = invoice.lines.data[0]?.period?.start
          ? new Date(invoice.lines.data[0].period.start * 1000).toISOString()
          : new Date().toISOString();
        const periodEnd = invoice.lines.data[0]?.period?.end
          ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
          : (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString(); })();

        const { error: updateError } = await supabase
          .from('parent_profile_subscriptions')
          .update({
            status: 'active',
            lapsed_at: null,
            current_period_start: periodStart,
            current_period_end: periodEnd,
          })
          .eq('id', parentSub.id);

        if (updateError) {
          console.error('Failed to renew parent_profile_subscription:', updateError);
        }

        await supabase.from('audit_logs').insert({
          action: 'parent_profile_subscription.renewed',
          target_type: 'parent_profile',
          target_id: parentSub.parent_id,
          metadata: {
            stripe_invoice_id: invoice.id,
            subscription_id: parentSub.id,
            period_start: periodStart,
            period_end: periodEnd,
          },
        });

        console.log(`Parent profile subscription ${parentSub.id} renewed via invoice ${invoice.id}`);
        return;
      }
    }

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
    // Check if this customer belongs to a parent profile subscription instead
    const { data: parentSub } = await supabase
      .from('parent_profile_subscriptions')
      .select('id, parent_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    if (parentSub) {
      const { error: updateError } = await supabase
        .from('parent_profile_subscriptions')
        .update({ status: 'past_due' })
        .eq('id', parentSub.id);

      if (updateError) {
        console.error('Failed to mark parent_profile_subscription past_due:', updateError);
      }

      await supabase.from('audit_logs').insert({
        action: 'parent_profile_subscription.payment_failed',
        target_type: 'parent_profile',
        target_id: parentSub.parent_id,
        metadata: {
          stripe_invoice_id: invoice.id,
          amount: invoice.amount_due,
          attempt_count: invoice.attempt_count,
          subscription_id: parentSub.id,
        },
      });

      console.log(`Invoice ${invoice.id} payment failed for parent profile subscription ${parentSub.id}`);
      return;
    }

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

// ============================================================================
// Upload Token Management
// ============================================================================

/**
 * Initialize upload tokens for a new subscription
 * Called when subscription is created or tier changes
 */
async function initializeUploadTokens(
  supabase: ReturnType<typeof createClient>,
  teamId: string,
  tier: string,
  subscription: Stripe.Subscription
) {
  const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  // Use database function to initialize tokens
  const { error } = await supabase.rpc('initialize_subscription_tokens', {
    p_team_id: teamId,
    p_tier_key: tier,
    p_period_start: periodStart,
    p_period_end: periodEnd
  });

  if (error) {
    console.error('Failed to initialize upload tokens:', error);
    // Log for debugging but don't fail the webhook
    await supabase.from('audit_logs').insert({
      action: 'tokens.initialization_failed',
      target_type: 'team',
      target_id: teamId,
      metadata: {
        tier,
        error: error.message
      }
    });
    return;
  }

  console.log(`Initialized upload tokens for team ${teamId} with tier ${tier}`);
}

/**
 * Handle subscription renewal - refresh tokens for new billing period
 * Called when invoice.paid fires for subscription_cycle
 */
async function handleSubscriptionRenewal(
  supabase: ReturnType<typeof createClient>,
  subscriptionId: string,
  invoice: Stripe.Invoice
) {
  // Find the subscription in our database
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('team_id, tier')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!subscription || !subscription.team_id) {
    console.log(`No subscription found for Stripe subscription ${subscriptionId}`);
    return;
  }

  // Get period dates from invoice lines
  const periodStart = invoice.lines.data[0]?.period?.start
    ? new Date(invoice.lines.data[0].period.start * 1000).toISOString()
    : new Date().toISOString();
  const periodEnd = invoice.lines.data[0]?.period?.end
    ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Default 30 days

  // Refresh subscription tokens with rollover
  const { error } = await supabase.rpc('refresh_subscription_tokens', {
    p_team_id: subscription.team_id,
    p_tier_key: subscription.tier,
    p_period_start: periodStart,
    p_period_end: periodEnd
  });

  if (error) {
    console.error('Failed to refresh subscription tokens:', error);
    await supabase.from('audit_logs').insert({
      action: 'tokens.refresh_failed',
      target_type: 'team',
      target_id: subscription.team_id,
      metadata: {
        tier: subscription.tier,
        error: error.message,
        invoice_id: invoice.id
      }
    });
    return;
  }

  // Log successful refresh
  await supabase.from('audit_logs').insert({
    action: 'tokens.refreshed',
    target_type: 'team',
    target_id: subscription.team_id,
    metadata: {
      tier: subscription.tier,
      period_start: periodStart,
      period_end: periodEnd,
      invoice_id: invoice.id
    }
  });

  console.log(`Refreshed upload tokens for team ${subscription.team_id}`);
}

