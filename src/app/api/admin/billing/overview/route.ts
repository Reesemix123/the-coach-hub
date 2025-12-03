// /api/admin/billing/overview - Billing Overview API
// Returns MRR, ARR, subscription counts, and revenue trends
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { SubscriptionTier, SubscriptionStatus } from '@/types/admin';

// Tier pricing in cents
const TIER_PRICES: Record<SubscriptionTier, number> = {
  basic: 0,
  plus: 2900, // $29
  premium: 7900, // $79
  ai_powered: 14900 // $149 (future tier)
};

interface MRRTrendItem {
  date: string;
  mrr: number;
}

interface BillingOverviewResponse {
  mrr: {
    current: number;
    previous: number;
    change_percentage: number;
  };
  arr: number;
  mrr_by_tier: Record<SubscriptionTier, number>;
  mrr_trend: MRRTrendItem[];
  subscriptions: {
    total: number;
    active: number;
    trialing: number;
    past_due: number;
    canceled: number;
    waived: number;
  };
  new_subscriptions_this_month: number;
  churned_this_month: number;
  churn_rate: number;
}

/**
 * GET /api/admin/billing/overview
 * Returns billing overview metrics
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
    // Get all subscriptions with team info
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        team_id,
        tier,
        status,
        billing_waived,
        created_at,
        updated_at,
        canceled_at,
        teams!inner (
          id,
          name,
          organization_id
        )
      `);

    if (subError) throw subError;

    // Calculate current MRR (from active and trialing subscriptions, excluding waived)
    let currentMRR = 0;
    const mrrByTier: Record<SubscriptionTier, number> = {
      basic: 0,
      plus: 0,
      premium: 0,
      ai_powered: 0
    };

    const statusCounts: Record<string, number> = {
      active: 0,
      trialing: 0,
      past_due: 0,
      canceled: 0,
      waived: 0,
      none: 0
    };

    for (const sub of subscriptions || []) {
      // Count by status
      statusCounts[sub.status] = (statusCounts[sub.status] || 0) + 1;

      // Calculate MRR only for paying subscriptions (active/trialing, not waived)
      if ((sub.status === 'active' || sub.status === 'trialing') && !sub.billing_waived) {
        const tierPrice = TIER_PRICES[sub.tier as SubscriptionTier] || 0;
        currentMRR += tierPrice;
        mrrByTier[sub.tier as SubscriptionTier] += tierPrice;
      }
    }

    // Calculate previous month MRR (simplified - would need historical data for accuracy)
    // For now, we'll estimate based on subscription created_at dates
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    let previousMRR = 0;
    for (const sub of subscriptions || []) {
      const createdAt = new Date(sub.created_at);
      // If subscription existed a month ago and was active
      if (createdAt <= oneMonthAgo) {
        if ((sub.status === 'active' || sub.status === 'trialing') && !sub.billing_waived) {
          previousMRR += TIER_PRICES[sub.tier as SubscriptionTier] || 0;
        }
        // Also count canceled subs that were active last month
        if (sub.status === 'canceled' && sub.canceled_at) {
          const canceledAt = new Date(sub.canceled_at);
          if (canceledAt > oneMonthAgo) {
            previousMRR += TIER_PRICES[sub.tier as SubscriptionTier] || 0;
          }
        }
      }
    }

    // Calculate change percentage
    const changePercentage = previousMRR > 0
      ? Math.round(((currentMRR - previousMRR) / previousMRR) * 1000) / 10
      : currentMRR > 0 ? 100 : 0;

    // Calculate MRR trend
    const mrrTrend = await calculateMRRTrend(supabase, period, subscriptions || []);

    // Count new subscriptions this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newThisMonth = (subscriptions || []).filter(sub => {
      const createdAt = new Date(sub.created_at);
      return createdAt >= startOfMonth && sub.status !== 'none';
    }).length;

    // Count churned this month
    const churnedThisMonth = (subscriptions || []).filter(sub => {
      if (sub.status !== 'canceled' || !sub.canceled_at) return false;
      const canceledAt = new Date(sub.canceled_at);
      return canceledAt >= startOfMonth;
    }).length;

    // Calculate churn rate (churned / (active + trialing) at start of month)
    const activeAtStartOfMonth = statusCounts.active + statusCounts.trialing + churnedThisMonth;
    const churnRate = activeAtStartOfMonth > 0
      ? Math.round((churnedThisMonth / activeAtStartOfMonth) * 1000) / 10
      : 0;

    const response: BillingOverviewResponse = {
      mrr: {
        current: Math.round(currentMRR / 100), // Convert cents to dollars
        previous: Math.round(previousMRR / 100),
        change_percentage: changePercentage
      },
      arr: Math.round((currentMRR * 12) / 100),
      mrr_by_tier: {
        basic: Math.round(mrrByTier.basic / 100),
        plus: Math.round(mrrByTier.plus / 100),
        premium: Math.round(mrrByTier.premium / 100),
        ai_powered: Math.round(mrrByTier.ai_powered / 100)
      },
      mrr_trend: mrrTrend,
      subscriptions: {
        total: subscriptions?.length || 0,
        active: statusCounts.active || 0,
        trialing: statusCounts.trialing || 0,
        past_due: statusCounts.past_due || 0,
        canceled: statusCounts.canceled || 0,
        waived: statusCounts.waived || 0
      },
      new_subscriptions_this_month: newThisMonth,
      churned_this_month: churnedThisMonth,
      churn_rate: churnRate
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching billing overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing overview' },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function calculateMRRTrend(supabase: any, period: string, subscriptions: any[]): Promise<MRRTrendItem[]> {
  const months = period === '12m' ? 12 : period === '90d' ? 3 : 1;
  const trend: MRRTrendItem[] = [];

  for (let i = months; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setMonth(endDate.getMonth() + 1);

    // Calculate MRR at this point in time
    let mrr = 0;
    for (const sub of subscriptions) {
      const createdAt = new Date(sub.created_at);
      const canceledAt = sub.canceled_at ? new Date(sub.canceled_at) : null;

      // Subscription was active at this date
      if (createdAt <= date) {
        if (!canceledAt || canceledAt > date) {
          if (!sub.billing_waived && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'canceled')) {
            mrr += TIER_PRICES[sub.tier as SubscriptionTier] || 0;
          }
        }
      }
    }

    trend.push({
      date: date.toISOString().slice(0, 7), // YYYY-MM format
      mrr: Math.round(mrr / 100)
    });
  }

  return trend;
}
