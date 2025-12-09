// /api/admin/billing/churn - Churn Analytics API
// Returns churned organizations and churn metrics over time
// Requires platform admin authentication

import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { SubscriptionTier } from '@/types/admin';

// Tier pricing in cents (ai_powered removed)
const TIER_PRICES: Record<SubscriptionTier, number> = {
  basic: 0,
  plus: 2900, // $29
  premium: 7900 // $79
};

interface ChurnedOrganization {
  id: string;
  name: string;
  churned_at: string;
  was_paying: number;
  reason: 'canceled' | 'expired' | 'payment_failed';
  lifetime_value: number;
}

interface ChurnByMonth {
  month: string;
  count: number;
  mrr_lost: number;
}

interface ChurnResponse {
  churned_organizations: ChurnedOrganization[];
  churn_by_month: ChurnByMonth[];
  total_churned_30d: number;
  total_mrr_lost_30d: number;
  average_lifetime_days: number;
}

/**
 * GET /api/admin/billing/churn
 * Returns churn analytics and churned organization list
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const supabase = auth.serviceClient;

  try {
    // Get canceled subscriptions with team and organization info
    const { data: canceledSubs, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        team_id,
        tier,
        status,
        billing_waived,
        created_at,
        canceled_at,
        teams!inner (
          id,
          name,
          organization_id,
          organizations (
            id,
            name,
            status
          )
        )
      `)
      .eq('status', 'canceled')
      .not('canceled_at', 'is', null)
      .order('canceled_at', { ascending: false });

    if (subError) throw subError;

    // Also get churned organizations (status = 'churned')
    const { data: churnedOrgs, error: orgError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        status,
        updated_at,
        created_at
      `)
      .eq('status', 'churned');

    if (orgError) throw orgError;

    // Build churned organizations list
    const churnedOrganizations: ChurnedOrganization[] = [];
    const processedOrgIds = new Set<string>();

    // Process canceled subscriptions
    for (const sub of canceledSubs || []) {
      if (sub.billing_waived) continue; // Skip waived subscriptions

      const team = sub.teams as {
        id: string;
        name: string;
        organization_id: string | null;
        organizations: {
          id: string;
          name: string;
          status: string;
        } | null;
      };

      const orgId = team?.organization_id || team?.organizations?.id;
      const orgName = team?.organizations?.name || team?.name || 'Unknown';

      // Skip if we've already processed this org
      if (orgId && processedOrgIds.has(orgId)) continue;
      if (orgId) processedOrgIds.add(orgId);

      const monthlyPrice = TIER_PRICES[sub.tier as SubscriptionTier] || 0;
      const createdAt = new Date(sub.created_at);
      const canceledAt = new Date(sub.canceled_at!);
      const monthsActive = Math.max(1, Math.ceil(
        (canceledAt.getTime() - createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)
      ));

      churnedOrganizations.push({
        id: orgId || sub.id,
        name: orgName,
        churned_at: sub.canceled_at!,
        was_paying: Math.round(monthlyPrice / 100),
        reason: 'canceled',
        lifetime_value: Math.round((monthlyPrice * monthsActive) / 100)
      });
    }

    // Process churned organizations that might not have subscription records
    for (const org of churnedOrgs || []) {
      if (processedOrgIds.has(org.id)) continue;

      churnedOrganizations.push({
        id: org.id,
        name: org.name,
        churned_at: org.updated_at,
        was_paying: 0, // Unknown
        reason: 'canceled',
        lifetime_value: 0
      });
    }

    // Sort by churned_at descending
    churnedOrganizations.sort((a, b) =>
      new Date(b.churned_at).getTime() - new Date(a.churned_at).getTime()
    );

    // Calculate churn by month (last 6 months)
    const churnByMonth: ChurnByMonth[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM

      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      let count = 0;
      let mrrLost = 0;

      for (const org of churnedOrganizations) {
        const churnedAt = new Date(org.churned_at);
        if (churnedAt >= monthStart && churnedAt <= monthEnd) {
          count++;
          mrrLost += org.was_paying;
        }
      }

      churnByMonth.push({
        month: monthKey,
        count,
        mrr_lost: mrrLost
      });
    }

    // Calculate 30-day metrics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentChurn = churnedOrganizations.filter(org =>
      new Date(org.churned_at) >= thirtyDaysAgo
    );

    const totalChurned30d = recentChurn.length;
    const totalMrrLost30d = recentChurn.reduce((sum, org) => sum + org.was_paying, 0);

    // Calculate average lifetime
    let totalLifetimeDays = 0;
    let lifetimeCount = 0;

    for (const sub of canceledSubs || []) {
      if (sub.canceled_at) {
        const createdAt = new Date(sub.created_at);
        const canceledAt = new Date(sub.canceled_at);
        const days = Math.round((canceledAt.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
        totalLifetimeDays += days;
        lifetimeCount++;
      }
    }

    const averageLifetimeDays = lifetimeCount > 0
      ? Math.round(totalLifetimeDays / lifetimeCount)
      : 0;

    const response: ChurnResponse = {
      churned_organizations: churnedOrganizations.slice(0, 50), // Limit to 50 most recent
      churn_by_month: churnByMonth,
      total_churned_30d: totalChurned30d,
      total_mrr_lost_30d: totalMrrLost30d,
      average_lifetime_days: averageLifetimeDays
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching churn data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch churn data' },
      { status: 500 }
    );
  }
}
