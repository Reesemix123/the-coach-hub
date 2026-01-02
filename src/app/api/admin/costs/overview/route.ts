// /api/admin/costs/overview - Costs Overview API
// Returns AI costs, revenue, margins, and trends
// Includes both AI Film Tagging (new) and AI Chat costs
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { getAllTierConfigsFromTable } from '@/lib/admin/config';
import { AI_CHAT_COST } from '@/lib/admin/ai-costs';

// Use centralized cost constant
const COST_PER_TEXT_ACTION = AI_CHAT_COST.COST_PER_ACTION;

interface CostTrendItem {
  date: string;
  cost: number;
  film_tagging_cost: number;
  chat_cost: number;
}

interface CostsOverviewResponse {
  current_month: {
    // AI Film Tagging metrics (from ai_tag_predictions table)
    plays_analyzed: number;
    film_tagging_cost: number;
    // AI Chat metrics (from ai_usage table)
    chat_actions_used: number;
    chat_cost: number;
    // Combined
    total_ai_cost: number;
    revenue: number;
    margin: number;
    margin_percentage: number;
  };
  cost_trend: CostTrendItem[];
  projected_month_end: {
    ai_cost: number;
    margin: number;
    margin_percentage: number;
  };
  // Breakdown by tagging tier
  tagging_breakdown: {
    quick: { count: number; cost: number };
    standard: { count: number; cost: number };
    comprehensive: { count: number; cost: number };
  };
}

/**
 * GET /api/admin/costs/overview
 * Returns cost overview with trends and projections
 *
 * Query params:
 * - period: '30d' | '90d' | '12m' (default: '30d')
 */
export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const supabase = auth.serviceClient;
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '30d';

  try {
    // Get tier config from tier_config TABLE (single source of truth)
    const tierConfigsArray = await getAllTierConfigsFromTable();
    if (!tierConfigsArray || tierConfigsArray.length === 0) {
      return NextResponse.json(
        { error: 'Tier configuration not found' },
        { status: 500 }
      );
    }

    // Build tier prices from database config
    // tier_config table uses price_monthly_cents (already in cents)
    const tierPrices: Record<string, number> = {};
    for (const config of tierConfigsArray) {
      tierPrices[config.tier_key] = config.price_monthly_cents || 0;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // ============================================
    // AI Film Tagging Costs (from ai_tag_predictions)
    // ============================================
    const { data: filmTaggingData, error: filmError } = await supabase
      .from('ai_tag_predictions')
      .select('tagging_tier, cost_usd, status')
      .gte('created_at', monthStart.toISOString())
      .eq('status', 'completed');

    if (filmError) throw filmError;

    // Calculate film tagging metrics
    let playsAnalyzed = 0;
    let filmTaggingCost = 0;
    const tierCounts = { quick: 0, standard: 0, comprehensive: 0 };
    const tierCosts = { quick: 0, standard: 0, comprehensive: 0 };

    for (const row of filmTaggingData || []) {
      playsAnalyzed++;
      const cost = Number(row.cost_usd) || 0;
      filmTaggingCost += cost;

      const tier = row.tagging_tier as keyof typeof tierCounts;
      if (tier in tierCounts) {
        tierCounts[tier]++;
        tierCosts[tier] += cost;
      }
    }

    // ============================================
    // AI Chat Costs (from ai_usage table)
    // ============================================
    const { data: chatUsage, error: chatError } = await supabase
      .from('ai_usage')
      .select('usage_type, units_consumed')
      .gte('created_at', monthStart.toISOString())
      .eq('usage_type', 'text_action');

    if (chatError) throw chatError;

    const chatActionsUsed = chatUsage?.length || 0;
    const chatCost = chatActionsUsed * COST_PER_TEXT_ACTION;

    // ============================================
    // Total AI Cost
    // ============================================
    const totalAiCost = filmTaggingCost + chatCost;

    // ============================================
    // Revenue from subscriptions
    // ============================================
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('tier, status, billing_waived')
      .in('status', ['active', 'trialing']);

    if (subError) throw subError;

    let currentMRR = 0;
    for (const sub of subscriptions || []) {
      if (!sub.billing_waived) {
        const tierPrice = tierPrices[sub.tier] || 0;
        currentMRR += tierPrice;
      }
    }
    const revenue = Math.round(currentMRR / 100); // Convert cents to dollars

    // Calculate margin
    const margin = revenue - totalAiCost;
    const marginPercentage = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;

    // ============================================
    // Cost Trend (weekly buckets)
    // ============================================
    const periodStart = getPeriodStartDate(period);

    // Get film tagging trend
    const { data: filmTrendData, error: filmTrendError } = await supabase
      .from('ai_tag_predictions')
      .select('cost_usd, created_at')
      .gte('created_at', periodStart.toISOString())
      .eq('status', 'completed')
      .order('created_at', { ascending: true });

    if (filmTrendError) throw filmTrendError;

    // Get chat usage trend
    const { data: chatTrendData, error: chatTrendError } = await supabase
      .from('ai_usage')
      .select('created_at')
      .gte('created_at', periodStart.toISOString())
      .eq('usage_type', 'text_action')
      .order('created_at', { ascending: true });

    if (chatTrendError) throw chatTrendError;

    // Group by week
    const costTrend = groupByWeek(filmTrendData || [], chatTrendData || []);

    // ============================================
    // Projections
    // ============================================
    const projectedCost = dayOfMonth > 0
      ? (totalAiCost / dayOfMonth) * daysInMonth
      : totalAiCost;
    const projectedMargin = revenue - projectedCost;
    const projectedMarginPercentage = revenue > 0
      ? Math.round((projectedMargin / revenue) * 100)
      : 0;

    const response: CostsOverviewResponse = {
      current_month: {
        plays_analyzed: playsAnalyzed,
        film_tagging_cost: Math.round(filmTaggingCost * 1000) / 1000,
        chat_actions_used: chatActionsUsed,
        chat_cost: Math.round(chatCost * 100) / 100,
        total_ai_cost: Math.round(totalAiCost * 100) / 100,
        revenue,
        margin: Math.round(margin * 100) / 100,
        margin_percentage: marginPercentage
      },
      cost_trend: costTrend,
      projected_month_end: {
        ai_cost: Math.round(projectedCost * 100) / 100,
        margin: Math.round(projectedMargin * 100) / 100,
        margin_percentage: projectedMarginPercentage
      },
      tagging_breakdown: {
        quick: { count: tierCounts.quick, cost: Math.round(tierCosts.quick * 1000) / 1000 },
        standard: { count: tierCounts.standard, cost: Math.round(tierCosts.standard * 1000) / 1000 },
        comprehensive: { count: tierCounts.comprehensive, cost: Math.round(tierCosts.comprehensive * 1000) / 1000 }
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching costs overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch costs overview' },
      { status: 500 }
    );
  }
}

function getPeriodStartDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '12m':
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case '30d':
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function groupByWeek(
  filmData: { cost_usd: number; created_at: string }[],
  chatData: { created_at: string }[]
): CostTrendItem[] {
  const weeklyData: Record<string, { film: number; chat: number }> = {};

  // Process film tagging costs
  for (const row of filmData) {
    const date = new Date(row.created_at);
    const weekKey = getWeekKey(date);

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { film: 0, chat: 0 };
    }
    weeklyData[weekKey].film += Number(row.cost_usd) || 0;
  }

  // Process chat costs
  for (const row of chatData) {
    const date = new Date(row.created_at);
    const weekKey = getWeekKey(date);

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { film: 0, chat: 0 };
    }
    weeklyData[weekKey].chat += COST_PER_TEXT_ACTION;
  }

  return Object.entries(weeklyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, costs]) => ({
      date,
      cost: Math.round((costs.film + costs.chat) * 100) / 100,
      film_tagging_cost: Math.round(costs.film * 1000) / 1000,
      chat_cost: Math.round(costs.chat * 100) / 100
    }));
}

function getWeekKey(date: Date): string {
  // Get Monday of the week
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}
