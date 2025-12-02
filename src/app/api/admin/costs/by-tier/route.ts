// /api/admin/costs/by-tier - Costs by Tier API
// Returns profitability analysis broken down by subscription tier
// Requires platform admin authentication

import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { getTierConfigs } from '@/lib/admin/config';
import { SubscriptionTier } from '@/types/admin';

// Cost per AI credit
const COST_PER_AI_CREDIT = 0.02; // $0.02 per credit

interface TierCost {
  tier: string;
  tier_name: string;
  subscriptions: number;
  total_revenue: number;
  total_ai_cost: number;
  avg_ai_cost_per_sub: number;
  margin_percentage: number;
}

interface CostsByTierResponse {
  tiers: TierCost[];
}

/**
 * GET /api/admin/costs/by-tier
 * Returns profitability analysis by subscription tier
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const supabase = auth.serviceClient;

  try {
    // Get tier config from database (single source of truth)
    const tierConfigs = await getTierConfigs();
    if (!tierConfigs) {
      return NextResponse.json(
        { error: 'Tier configuration not found' },
        { status: 500 }
      );
    }

    // Build tier prices and names from database config
    const tierPrices: Record<string, number> = {};
    const tierNames: Record<string, string> = {};
    for (const [tierId, config] of Object.entries(tierConfigs)) {
      // price_monthly in config is in dollars, convert to cents for calculations
      tierPrices[tierId] = (config.price_monthly || 0) * 100;
      tierNames[tierId] = config.name || tierId;
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Get all active subscriptions with tier
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('team_id, tier, status, billing_waived')
      .in('status', ['active', 'trialing']);

    if (subError) throw subError;

    // Get AI usage this month grouped by team
    const { data: aiUsage, error: usageError } = await supabase
      .from('ai_usage_logs')
      .select('team_id, credits_used')
      .gte('created_at', monthStart.toISOString());

    if (usageError) throw usageError;

    // Build team -> AI usage mapping
    const teamAiCredits: Record<string, number> = {};
    for (const usage of aiUsage || []) {
      teamAiCredits[usage.team_id] = (teamAiCredits[usage.team_id] || 0) + (usage.credits_used || 0);
    }

    // Calculate metrics per tier
    const tierMetrics: Record<string, {
      subscriptions: number;
      payingSubscriptions: number;
      totalAiCredits: number;
      totalRevenueCents: number;
    }> = {};

    // Initialize all tiers from config
    for (const tier of Object.keys(tierConfigs)) {
      tierMetrics[tier] = {
        subscriptions: 0,
        payingSubscriptions: 0,
        totalAiCredits: 0,
        totalRevenueCents: 0
      };
    }

    // Aggregate subscription data
    for (const sub of subscriptions || []) {
      const tier = sub.tier as SubscriptionTier;
      if (!tierMetrics[tier]) continue;

      tierMetrics[tier].subscriptions++;

      // Count AI credits for this team
      const teamCredits = teamAiCredits[sub.team_id] || 0;
      tierMetrics[tier].totalAiCredits += teamCredits;

      // Count revenue only for non-waived subscriptions
      if (!sub.billing_waived) {
        tierMetrics[tier].payingSubscriptions++;
        tierMetrics[tier].totalRevenueCents += tierPrices[tier] || 0;
      }
    }

    // Build results
    const results: TierCost[] = [];
    for (const [tier, metrics] of Object.entries(tierMetrics)) {
      const totalRevenue = Math.round(metrics.totalRevenueCents / 100);
      const totalAiCost = metrics.totalAiCredits * COST_PER_AI_CREDIT;
      const avgAiCostPerSub = metrics.subscriptions > 0
        ? totalAiCost / metrics.subscriptions
        : 0;
      const marginPercentage = totalRevenue > 0
        ? Math.round(((totalRevenue - totalAiCost) / totalRevenue) * 100)
        : 0;

      results.push({
        tier,
        tier_name: tierNames[tier] || tier,
        subscriptions: metrics.subscriptions,
        total_revenue: totalRevenue,
        total_ai_cost: Math.round(totalAiCost * 100) / 100,
        avg_ai_cost_per_sub: Math.round(avgAiCostPerSub * 100) / 100,
        margin_percentage: marginPercentage
      });
    }

    // Sort by total revenue descending
    results.sort((a, b) => b.total_revenue - a.total_revenue);

    const response: CostsByTierResponse = {
      tiers: results
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching costs by tier:', error);
    return NextResponse.json(
      { error: 'Failed to fetch costs by tier' },
      { status: 500 }
    );
  }
}
