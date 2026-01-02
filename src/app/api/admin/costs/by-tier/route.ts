// /api/admin/costs/by-tier - Costs by Tier API
// Returns profitability analysis broken down by subscription tier
// Includes AI Film Tagging and AI Chat costs
// Requires platform admin authentication

import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { getAllTierConfigsFromTable } from '@/lib/admin/config';
import { AI_CHAT_COST } from '@/lib/admin/ai-costs';

// Use centralized cost constant
const COST_PER_TEXT_ACTION = AI_CHAT_COST.COST_PER_ACTION;

interface TierCost {
  tier: string;
  tier_name: string;
  tier_price: number;
  subscriptions: number;
  total_revenue: number;
  // AI Film Tagging
  plays_analyzed: number;
  film_tagging_cost: number;
  // AI Chat
  chat_actions: number;
  chat_cost: number;
  // Combined
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
    // Get tier config from tier_config TABLE (single source of truth)
    const tierConfigsArray = await getAllTierConfigsFromTable();
    if (!tierConfigsArray || tierConfigsArray.length === 0) {
      return NextResponse.json(
        { error: 'Tier configuration not found' },
        { status: 500 }
      );
    }

    // Build tier prices and names from database config
    // tier_config table uses price_monthly_cents (already in cents)
    const tierPrices: Record<string, number> = {};
    const tierNames: Record<string, string> = {};
    for (const config of tierConfigsArray) {
      tierPrices[config.tier_key] = config.price_monthly_cents || 0;
      tierNames[config.tier_key] = config.display_name || config.tier_key;
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

    // Build team -> tier mapping
    const teamToTier: Record<string, string> = {};
    for (const sub of subscriptions || []) {
      teamToTier[sub.team_id] = sub.tier;
    }

    // ============================================
    // AI Film Tagging costs (from ai_tag_predictions)
    // ============================================
    const { data: filmTaggingData, error: filmError } = await supabase
      .from('ai_tag_predictions')
      .select('team_id, cost_usd')
      .gte('created_at', monthStart.toISOString())
      .eq('status', 'completed');

    if (filmError) throw filmError;

    // Calculate film tagging costs by team
    const teamFilmCosts: Record<string, { plays: number; cost: number }> = {};
    for (const row of filmTaggingData || []) {
      if (!teamFilmCosts[row.team_id]) {
        teamFilmCosts[row.team_id] = { plays: 0, cost: 0 };
      }
      teamFilmCosts[row.team_id].plays++;
      teamFilmCosts[row.team_id].cost += Number(row.cost_usd) || 0;
    }

    // ============================================
    // AI Chat costs (from ai_usage table)
    // ============================================
    const { data: chatUsage, error: chatError } = await supabase
      .from('ai_usage')
      .select('team_id')
      .gte('created_at', monthStart.toISOString())
      .eq('usage_type', 'text_action');

    if (chatError) throw chatError;

    // Calculate chat costs by team
    const teamChatCounts: Record<string, number> = {};
    for (const row of chatUsage || []) {
      teamChatCounts[row.team_id] = (teamChatCounts[row.team_id] || 0) + 1;
    }

    // ============================================
    // Calculate metrics per tier
    // ============================================
    const tierMetrics: Record<string, {
      subscriptions: number;
      payingSubscriptions: number;
      totalRevenueCents: number;
      playsAnalyzed: number;
      filmCost: number;
      chatActions: number;
      chatCost: number;
    }> = {};

    // Initialize all tiers from config
    for (const config of tierConfigsArray) {
      tierMetrics[config.tier_key] = {
        subscriptions: 0,
        payingSubscriptions: 0,
        totalRevenueCents: 0,
        playsAnalyzed: 0,
        filmCost: 0,
        chatActions: 0,
        chatCost: 0
      };
    }

    // Aggregate subscription data
    for (const sub of subscriptions || []) {
      const tier = sub.tier;
      if (!tierMetrics[tier]) continue;

      tierMetrics[tier].subscriptions++;

      // Count AI usage for this team
      const filmData = teamFilmCosts[sub.team_id] || { plays: 0, cost: 0 };
      tierMetrics[tier].playsAnalyzed += filmData.plays;
      tierMetrics[tier].filmCost += filmData.cost;

      const chatCount = teamChatCounts[sub.team_id] || 0;
      tierMetrics[tier].chatActions += chatCount;
      tierMetrics[tier].chatCost += chatCount * COST_PER_TEXT_ACTION;

      // Count revenue only for non-waived subscriptions
      if (!sub.billing_waived) {
        tierMetrics[tier].payingSubscriptions++;
        tierMetrics[tier].totalRevenueCents += tierPrices[tier] || 0;
      }
    }

    // Build results
    const results: TierCost[] = [];
    for (const [tier, metrics] of Object.entries(tierMetrics)) {
      const tierPrice = tierPrices[tier] || 0;
      const totalRevenue = Math.round(metrics.totalRevenueCents / 100);
      const totalAiCost = metrics.filmCost + metrics.chatCost;
      const avgAiCostPerSub = metrics.subscriptions > 0
        ? totalAiCost / metrics.subscriptions
        : 0;
      const marginPercentage = totalRevenue > 0
        ? Math.round(((totalRevenue - totalAiCost) / totalRevenue) * 100)
        : 0;

      results.push({
        tier,
        tier_name: tierNames[tier] || tier,
        tier_price: Math.round(tierPrice / 100), // Convert cents to dollars for display
        subscriptions: metrics.subscriptions,
        total_revenue: totalRevenue,
        plays_analyzed: metrics.playsAnalyzed,
        film_tagging_cost: Math.round(metrics.filmCost * 1000) / 1000,
        chat_actions: metrics.chatActions,
        chat_cost: Math.round(metrics.chatCost * 100) / 100,
        total_ai_cost: Math.round(totalAiCost * 100) / 100,
        avg_ai_cost_per_sub: Math.round(avgAiCostPerSub * 100) / 100,
        margin_percentage: marginPercentage
      });
    }

    // Sort by tier price descending (Premium first)
    results.sort((a, b) => b.tier_price - a.tier_price);

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
