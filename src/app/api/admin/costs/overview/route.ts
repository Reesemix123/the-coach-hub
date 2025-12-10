// /api/admin/costs/overview - Costs Overview API
// Returns AI costs, revenue, margins, and trends
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { getTierConfigs } from '@/lib/admin/config';
import { SubscriptionTier } from '@/types/admin';

// Cost per AI video minute (adjust based on actual costs)
// This represents the cost to process 1 minute of video through AI
const COST_PER_VIDEO_MINUTE = 0.10; // $0.10 per video minute
const COST_PER_TEXT_ACTION = 0.01; // $0.01 per text action

interface CostTrendItem {
  date: string;
  cost: number;
}

interface CostsOverviewResponse {
  current_month: {
    video_minutes_used: number;
    text_actions_used: number;
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

    // Get AI usage from the new ai_usage table (migration 071)
    const { data: monthUsage, error: usageError } = await supabase
      .from('ai_usage')
      .select('usage_type, units_consumed')
      .gte('created_at', monthStart.toISOString());

    if (usageError) throw usageError;

    // Calculate video minutes and text actions separately
    let videoMinutesUsed = 0;
    let textActionsUsed = 0;

    for (const row of monthUsage || []) {
      if (row.usage_type === 'video_analysis') {
        videoMinutesUsed += Number(row.units_consumed) || 0;
      } else if (row.usage_type === 'text_action') {
        textActionsUsed += 1;
      }
    }

    // Calculate total AI cost
    const aiCost = (videoMinutesUsed * COST_PER_VIDEO_MINUTE) + (textActionsUsed * COST_PER_TEXT_ACTION);

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
      .from('ai_usage')
      .select('usage_type, units_consumed, created_at')
      .gte('created_at', periodStart.toISOString())
      .order('created_at', { ascending: true });

    if (trendError) throw trendError;

    // Group by week with proper cost calculation
    const costTrend = groupByWeek(trendData || []);

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
        video_minutes_used: Math.round(videoMinutesUsed * 100) / 100,
        text_actions_used: textActionsUsed,
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
  data: { usage_type: string; units_consumed: number; created_at: string }[]
): CostTrendItem[] {
  const weeklyData: Record<string, number> = {};

  for (const row of data) {
    const date = new Date(row.created_at);
    // Get Monday of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    const weekKey = monday.toISOString().slice(0, 10);

    // Calculate cost based on usage type
    let cost = 0;
    if (row.usage_type === 'video_analysis') {
      cost = Number(row.units_consumed) * COST_PER_VIDEO_MINUTE;
    } else if (row.usage_type === 'text_action') {
      cost = COST_PER_TEXT_ACTION;
    }

    weeklyData[weekKey] = (weeklyData[weekKey] || 0) + cost;
  }

  return Object.entries(weeklyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cost]) => ({
      date,
      cost: Math.round(cost * 100) / 100
    }));
}
