// /api/console/billing - Billing management for athletic director console
// Returns billing overview: teams with subscriptions, AI credits, payment methods

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getTierConfigs } from '@/lib/admin/config';
import { SubscriptionTier, SubscriptionStatus, TierConfigValue } from '@/types/admin';
import { getStripeClient, isStripeConfigured } from '@/lib/stripe/client';

interface TeamBilling {
  team_id: string;
  team_name: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_waived: boolean;
  billing_waived_reason: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  monthly_cost_cents: number;
  ai_credits_used: number;
  ai_credits_allowed: number;
  upload_tokens: {
    available: number;
    allocation: number;
  };
}

interface BillingSummary {
  total_mrr_cents: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  waived_subscriptions: number;
  past_due_subscriptions: number;
}

interface PaymentMethod {
  type: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface BillingResponse {
  summary: BillingSummary;
  teams: TeamBilling[];
  tier_configs: Record<string, TierConfigValue> | null;
  payment_method: PaymentMethod | null;
  stripe_configured: boolean;
}

export async function GET() {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Get user's profile with organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id')
    .eq('id', user.id)
    .single();

  // Get teams for this user
  let teams: { id: string; name: string; user_id: string }[] = [];

  if (profile?.organization_id) {
    const { data: orgTeams } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('organization_id', profile.organization_id);
    teams = orgTeams || [];
  } else {
    const { data: ownedTeams } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('user_id', user.id);
    teams = ownedTeams || [];
  }

  if (teams.length === 0) {
    return NextResponse.json({
      summary: {
        total_mrr_cents: 0,
        active_subscriptions: 0,
        trialing_subscriptions: 0,
        waived_subscriptions: 0,
        past_due_subscriptions: 0
      },
      teams: [],
      tier_configs: null,
      payment_method: null,
      stripe_configured: isStripeConfigured()
    });
  }

  const teamIds = teams.map(t => t.id);
  const teamMap = new Map(teams.map(t => [t.id, t.name]));

  // Fetch subscriptions for all teams
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('*')
    .in('team_id', teamIds);

  // Fetch current AI credits for all teams
  const now = new Date().toISOString();
  const { data: aiCredits } = await supabase
    .from('ai_credits')
    .select('*')
    .in('team_id', teamIds)
    .gte('period_end', now);

  // Fetch token balances for all teams
  const { data: tokenBalances } = await supabase
    .from('token_balance')
    .select('team_id, subscription_tokens_available, purchased_tokens_available')
    .in('team_id', teamIds);

  // Get tier configs for pricing
  const tierConfigs = await getTierConfigs();

  // Build subscription map
  const subscriptionMap = new Map(
    (subscriptions || []).map(s => [s.team_id, s])
  );

  // Build AI credits map
  const creditsMap = new Map(
    (aiCredits || []).map(c => [c.team_id, c])
  );

  // Build token balance map
  const tokenMap = new Map(
    (tokenBalances || []).map(t => [t.team_id, t])
  );

  // Tier token allocation mapping
  const tierTokens: Record<string, number> = {
    'basic': 2,
    'plus': 4,
    'premium': 8
  };

  // Build team billing data
  const teamBillings: TeamBilling[] = teamIds.map(teamId => {
    const subscription = subscriptionMap.get(teamId);
    const credits = creditsMap.get(teamId);
    const tokens = tokenMap.get(teamId);
    const tier = (subscription?.tier || 'plus') as SubscriptionTier;
    const tierConfig = tierConfigs?.[tier];

    // Calculate monthly cost (0 if waived or no subscription)
    let monthlyCostCents = 0;
    if (subscription && !subscription.billing_waived && subscription.status === 'active') {
      monthlyCostCents = tierConfig?.price_monthly || 0;
    }

    // Token calculations
    const tokensAvailable = (tokens?.subscription_tokens_available || 0) + (tokens?.purchased_tokens_available || 0);
    const tokenAllocation = tierTokens[tier] || 4;

    return {
      team_id: teamId,
      team_name: teamMap.get(teamId) || 'Unknown',
      tier,
      status: (subscription?.status || 'none') as SubscriptionStatus,
      billing_waived: subscription?.billing_waived || false,
      billing_waived_reason: subscription?.billing_waived_reason || null,
      current_period_end: subscription?.current_period_end || null,
      trial_ends_at: subscription?.trial_ends_at || null,
      monthly_cost_cents: monthlyCostCents,
      ai_credits_used: credits?.credits_used || 0,
      ai_credits_allowed: credits?.credits_allowed || tierConfig?.ai_credits || 0,
      upload_tokens: {
        available: tokensAvailable,
        allocation: tokenAllocation
      }
    };
  });

  // Calculate summary
  const summary: BillingSummary = {
    total_mrr_cents: teamBillings.reduce((sum, t) => sum + t.monthly_cost_cents, 0),
    active_subscriptions: teamBillings.filter(t => t.status === 'active').length,
    trialing_subscriptions: teamBillings.filter(t => t.status === 'trialing').length,
    waived_subscriptions: teamBillings.filter(t => t.billing_waived).length,
    past_due_subscriptions: teamBillings.filter(t => t.status === 'past_due').length
  };

  // Get payment method from Stripe if configured
  let paymentMethod: PaymentMethod | null = null;

  if (isStripeConfigured() && profile?.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', profile.organization_id)
      .single();

    if (org?.stripe_customer_id) {
      try {
        const stripe = getStripeClient();
        const paymentMethods = await stripe.paymentMethods.list({
          customer: org.stripe_customer_id,
          type: 'card',
          limit: 1
        });

        if (paymentMethods.data.length > 0) {
          const pm = paymentMethods.data[0];
          if (pm.card) {
            paymentMethod = {
              type: 'card',
              brand: pm.card.brand,
              last4: pm.card.last4,
              exp_month: pm.card.exp_month,
              exp_year: pm.card.exp_year
            };
          }
        }
      } catch (err) {
        console.error('Error fetching payment methods:', err);
      }
    }
  }

  const response: BillingResponse = {
    summary,
    teams: teamBillings.sort((a, b) => b.monthly_cost_cents - a.monthly_cost_cents),
    tier_configs: tierConfigs,
    payment_method: paymentMethod,
    stripe_configured: isStripeConfigured()
  };

  return NextResponse.json(response);
}
