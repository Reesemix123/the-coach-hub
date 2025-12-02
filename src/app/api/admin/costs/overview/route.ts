// /api/admin/costs/overview - Costs Overview API
// Returns AI costs, revenue, margins, and trends
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { getTierConfigs } from '@/lib/admin/config';
import { SubscriptionTier } from '@/types/admin';

// Cost per AI credit (adjust based on actual costs)
const COST_PER_AI_CREDIT = 0.02; // $0.02 per credit

interface CostTrendItem {
  date: string;
  cost: number;
}

interface CostsOverviewResponse {
  current_month: {
    ai_credits_used: number;
    ai_cost: number;
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
    // Get tier config from database (single source of truth)
    const tierConfigs = await getTierConfigs();
    if (!tierConfigs) {
      return NextResponse.json(
        { error: 'Tier configuration not found' },
        { status: 500 }
      );
    }

    // Build tier prices from database config (price_monthly is in dollars, convert to cents)
    const tierPrices: Record<string, number> = {};
    for (const [tierId, config] of Object.entries(tierConfigs)) {
      tierPrices[tierId] = (config.price_monthly || 0) * 100;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Get AI credits used this month
    const { data: monthUsage, error: usageError } = await supabase
      .from('ai_usage_logs')
      .select('credits_used')
      .gte('created_at', monthStart.toISOString());

    if (usageError) throw usageError;

    const totalCreditsUsed = (monthUsage || []).reduce(
      (sum, row) => sum + (row.credits_used || 0),
      0
    );
    const aiCost = totalCreditsUsed * COST_PER_AI_CREDIT;

    // Get current MRR (revenue) from active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('tier, status, billing_waived')
      .in('status', ['active', 'trialing']);

    if (subError) throw subError;

    let currentMRR = 0;
    for (const sub of subscriptions || []) {
      if (!sub.billing_waived) {
        const tierPrice = tierPrices[sub.tier as SubscriptionTier] || 0;
        currentMRR += tierPrice;
      }
    }
    const revenue = Math.round(currentMRR / 100); // Convert cents to dollars

    // Calculate margin
    const margin = revenue - aiCost;
    const marginPercentage = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;

    // Calculate cost trend (weekly buckets based on period)
    const periodStart = getPeriodStartDate(period);
    const { data: trendData, error: trendError } = await supabase
      .from('ai_usage_logs')
      .select('credits_used, created_at')
      .gte('created_at', periodStart.toISOString())
      .order('created_at', { ascending: true });

    if (trendError) throw trendError;

    // Group by week
    const costTrend = groupByWeek(trendData || [], COST_PER_AI_CREDIT);

    // Project to month end
    const projectedCost = dayOfMonth > 0
      ? (aiCost / dayOfMonth) * daysInMonth
      : aiCost;
    const projectedMargin = revenue - projectedCost;
    const projectedMarginPercentage = revenue > 0
      ? Math.round((projectedMargin / revenue) * 100)
      : 0;

    const response: CostsOverviewResponse = {
      current_month: {
        ai_credits_used: totalCreditsUsed,
        ai_cost: Math.round(aiCost * 100) / 100,
        revenue,
        margin: Math.round(margin * 100) / 100,
        margin_percentage: marginPercentage
      },
      cost_trend: costTrend,
      projected_month_end: {
        ai_cost: Math.round(projectedCost * 100) / 100,
        margin: Math.round(projectedMargin * 100) / 100,
        margin_percentage: projectedMarginPercentage
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
  data: { credits_used: number; created_at: string }[],
  costPerCredit: number
): CostTrendItem[] {
  const weeklyData: Record<string, number> = {};

  for (const row of data) {
    const date = new Date(row.created_at);
    // Get Monday of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    const weekKey = monday.toISOString().slice(0, 10);

    weeklyData[weekKey] = (weeklyData[weekKey] || 0) + (row.credits_used * costPerCredit);
  }

  return Object.entries(weeklyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cost]) => ({
      date,
      cost: Math.round(cost * 100) / 100
    }));
}
