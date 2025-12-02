// /api/admin/dashboard - Platform Admin Dashboard API
// Returns business health metrics, revenue, costs, activity, and alerts
// Requires platform admin authentication

import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { createClient } from '@/utils/supabase/server';
import { getTierConfigs } from '@/lib/admin/config';
import { SubscriptionTier } from '@/types/admin';

interface DashboardAlert {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  count?: number;
  action_url: string;
}

interface RecentSignup {
  organization_id: string;
  name: string;
  created_at: string;
  owner_email: string | null;
}

interface DashboardResponse {
  metrics: {
    organizations: {
      total: number;
      active: number;
      trial: number;
      churned: number;
    };
    teams: {
      total: number;
      by_tier: Record<SubscriptionTier, number>;
    };
    users: {
      total: number;
      active_today: number;
      active_week: number;
      active_month: number;
    };
  };
  revenue: {
    mrr: number;
    mrr_change: number;
    arr: number;
  };
  costs: {
    ai_mtd: number;
    ai_projected: number;
    margin_percentage: number;
  };
  activity: {
    games_today: number;
    games_week: number;
    plays_today: number;
    plays_week: number;
  };
  alerts: DashboardAlert[];
  recent_signups: RecentSignup[];
}

/**
 * GET /api/admin/dashboard
 * Returns platform-wide metrics and alerts for admin dashboard
 */
export async function GET() {
  // Verify admin access
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const supabase = await createClient();

  try {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // =========================================================================
    // Organization Metrics
    // =========================================================================
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, status');

    const orgMetrics = {
      total: orgs?.length || 0,
      active: orgs?.filter(o => o.status === 'active').length || 0,
      trial: 0, // Will calculate from subscriptions
      churned: orgs?.filter(o => o.status === 'churned').length || 0
    };

    // =========================================================================
    // Team Metrics with Subscription Tiers
    // =========================================================================
    const { data: teams } = await supabase
      .from('teams')
      .select('id');

    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('team_id, tier, status');

    // Count teams by tier
    const byTier: Record<SubscriptionTier, number> = {
      little_league: 0,
      hs_basic: 0,
      hs_advanced: 0,
      ai_powered: 0
    };

    let trialCount = 0;
    subscriptions?.forEach(sub => {
      if (sub.tier && byTier.hasOwnProperty(sub.tier)) {
        byTier[sub.tier as SubscriptionTier]++;
      }
      if (sub.status === 'trialing') {
        trialCount++;
      }
    });

    orgMetrics.trial = trialCount;

    const teamMetrics = {
      total: teams?.length || 0,
      by_tier: byTier
    };

    // =========================================================================
    // User Metrics
    // =========================================================================
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_platform_admin', false);

    const { count: activeToday } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_platform_admin', false)
      .gte('last_active_at', dayAgo.toISOString());

    const { count: activeWeek } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_platform_admin', false)
      .gte('last_active_at', weekAgo.toISOString());

    const { count: activeMonth } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_platform_admin', false)
      .gte('last_active_at', monthAgo.toISOString());

    const userMetrics = {
      total: totalUsers || 0,
      active_today: activeToday || 0,
      active_week: activeWeek || 0,
      active_month: activeMonth || 0
    };

    // =========================================================================
    // Revenue Calculation (MRR from active subscriptions)
    // =========================================================================
    const tierConfigs = await getTierConfigs();

    let currentMRR = 0;
    subscriptions?.forEach(sub => {
      if (sub.status === 'active' || sub.status === 'trialing') {
        const tierConfig = tierConfigs?.[sub.tier as SubscriptionTier];
        if (tierConfig) {
          currentMRR += tierConfig.price_monthly || 0;
        }
      }
    });

    // Calculate last month's MRR for change percentage
    // For now, we'll estimate based on churned count
    // In production, you'd want a historical revenue table
    const lastMonthMRR = currentMRR * 0.95; // Placeholder - assume 5% growth
    const mrrChange = lastMonthMRR > 0
      ? Math.round(((currentMRR - lastMonthMRR) / lastMonthMRR) * 1000) / 10
      : 0;

    const revenue = {
      mrr: Math.round(currentMRR),
      mrr_change: mrrChange,
      arr: Math.round(currentMRR * 12)
    };

    // =========================================================================
    // AI Costs (from usage logs this month)
    // =========================================================================
    const { data: aiUsage } = await supabase
      .from('ai_usage_logs')
      .select('credits_used')
      .gte('created_at', monthStart.toISOString());

    const totalCreditsUsed = aiUsage?.reduce((sum, log) => sum + (log.credits_used || 0), 0) || 0;

    // Estimate cost per credit (adjust based on actual AI provider costs)
    const costPerCredit = 0.02; // $0.02 per credit
    const aiCostMTD = totalCreditsUsed * costPerCredit;

    // Project to end of month
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const aiProjected = dayOfMonth > 0 ? (aiCostMTD / dayOfMonth) * daysInMonth : 0;

    // Calculate margin
    const marginPercentage = currentMRR > 0
      ? Math.round(((currentMRR - aiProjected) / currentMRR) * 100)
      : 0;

    const costs = {
      ai_mtd: Math.round(aiCostMTD * 100) / 100,
      ai_projected: Math.round(aiProjected * 100) / 100,
      margin_percentage: marginPercentage
    };

    // =========================================================================
    // Activity Metrics
    // =========================================================================
    const { count: gamesToday } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayAgo.toISOString());

    const { count: gamesWeek } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());

    const { count: playsToday } = await supabase
      .from('play_instances')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayAgo.toISOString());

    const { count: playsWeek } = await supabase
      .from('play_instances')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString());

    const activity = {
      games_today: gamesToday || 0,
      games_week: gamesWeek || 0,
      plays_today: playsToday || 0,
      plays_week: playsWeek || 0
    };

    // =========================================================================
    // Alerts
    // =========================================================================
    const alerts: DashboardAlert[] = [];

    // Check for failed payments
    const { count: failedPayments } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'past_due');

    if (failedPayments && failedPayments > 0) {
      alerts.push({
        type: 'failed_payment',
        severity: 'high',
        message: `${failedPayments} organization${failedPayments > 1 ? 's have' : ' has'} failed payments`,
        count: failedPayments,
        action_url: '/admin/billing?filter=failed'
      });
    }

    // Check for expiring trials (within 3 days)
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const { count: expiringTrials } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'trialing')
      .lte('trial_ends_at', threeDaysFromNow.toISOString())
      .gte('trial_ends_at', now.toISOString());

    if (expiringTrials && expiringTrials > 0) {
      alerts.push({
        type: 'expiring_trials',
        severity: 'medium',
        message: `${expiringTrials} trial${expiringTrials > 1 ? 's' : ''} expiring within 3 days`,
        count: expiringTrials,
        action_url: '/admin/organizations?filter=trial_expiring'
      });
    }

    // Check for high AI usage (compare to last week)
    const lastWeekStart = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { data: lastWeekAI } = await supabase
      .from('ai_usage_logs')
      .select('credits_used')
      .gte('created_at', lastWeekStart.toISOString())
      .lt('created_at', weekAgo.toISOString());

    const lastWeekCredits = lastWeekAI?.reduce((sum, log) => sum + (log.credits_used || 0), 0) || 0;

    const { data: thisWeekAI } = await supabase
      .from('ai_usage_logs')
      .select('credits_used')
      .gte('created_at', weekAgo.toISOString());

    const thisWeekCredits = thisWeekAI?.reduce((sum, log) => sum + (log.credits_used || 0), 0) || 0;

    if (lastWeekCredits > 0) {
      const aiChangePercent = Math.round(((thisWeekCredits - lastWeekCredits) / lastWeekCredits) * 100);
      if (aiChangePercent >= 25) {
        alerts.push({
          type: 'high_ai_usage',
          severity: 'medium',
          message: `AI costs up ${aiChangePercent}% from last week`,
          action_url: '/admin/costs'
        });
      }
    }

    // =========================================================================
    // Recent Signups
    // =========================================================================
    const { data: recentOrgs } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        created_at,
        owner_user_id
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get owner emails
    const recentSignups: RecentSignup[] = [];
    if (recentOrgs) {
      for (const org of recentOrgs) {
        let ownerEmail: string | null = null;
        if (org.owner_user_id) {
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', org.owner_user_id)
            .single();
          ownerEmail = ownerProfile?.email || null;
        }

        recentSignups.push({
          organization_id: org.id,
          name: org.name,
          created_at: org.created_at,
          owner_email: ownerEmail
        });
      }
    }

    // =========================================================================
    // Build Response
    // =========================================================================
    const response: DashboardResponse = {
      metrics: {
        organizations: orgMetrics,
        teams: teamMetrics,
        users: userMetrics
      },
      revenue,
      costs,
      activity,
      alerts,
      recent_signups: recentSignups
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
