// /api/console/overview - Athletic Director Console Overview API
// Returns organization summary, stats, billing status, and alerts

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

interface Alert {
  type: string;
  message: string;
  count?: number;
  team_id?: string;
  days_left?: number;
  action_url: string;
}

interface OverviewResponse {
  organization: {
    id: string;
    name: string;
  } | null;
  summary: {
    teams_count: number;
    active_users_count: number;
    total_games: number;
    total_plays_tagged: number;
  };
  users: {
    total: number;
    new_this_week: number;
    new_this_month: number;
  };
  upload_tokens: {
    used: number;
    available: number;
    total_allocation: number;
    percentage: number;
  };
  billing: {
    status: 'current' | 'past_due' | 'no_payment_method' | 'trial' | 'waived' | 'none';
    next_billing_date: string | null;
    monthly_total: number;
  };
  alerts: Alert[];
  // Fallback for users without organization
  legacy_mode: boolean;
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
    .select('id, email, organization_id, is_platform_admin')
    .eq('id', user.id)
    .single();

  // Get user's organization if they have one
  let organization = null;
  let teams: { id: string; name: string; user_id: string }[] = [];
  let legacyMode = false;

  if (profile?.organization_id) {
    // User belongs to an organization - get org details
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, status')
      .eq('id', profile.organization_id)
      .single();

    if (org) {
      organization = { id: org.id, name: org.name };

      // Get teams for this organization
      const { data: orgTeams } = await supabase
        .from('teams')
        .select('id, name, user_id')
        .eq('organization_id', org.id);

      teams = orgTeams || [];
    }
  }

  // Fallback: If no organization, use legacy mode (teams user owns)
  if (!organization) {
    legacyMode = true;
    const { data: ownedTeams } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('user_id', user.id);

    teams = ownedTeams || [];

    // Create a pseudo-organization name
    organization = {
      id: 'legacy',
      name: profile?.email?.split('@')[0] + "'s Teams" || 'My Teams'
    };
  }

  const teamIds = teams.map(t => t.id);

  // Get stats - games count
  let totalGames = 0;
  if (teamIds.length > 0) {
    const { count: gamesCount } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .in('team_id', teamIds);
    totalGames = gamesCount || 0;
  }

  // Get stats - plays count
  let totalPlays = 0;
  if (teamIds.length > 0) {
    const { count: playsCount } = await supabase
      .from('play_instances')
      .select('id', { count: 'exact', head: true })
      .in('team_id', teamIds);
    totalPlays = playsCount || 0;
  }

  // Get active users count (team members)
  let activeUsersCount = 0;
  if (teamIds.length > 0) {
    const { data: memberships } = await supabase
      .from('team_memberships')
      .select('user_id')
      .in('team_id', teamIds)
      .eq('is_active', true);

    // Count unique users + team owners
    const uniqueUsers = new Set<string>();
    memberships?.forEach(m => uniqueUsers.add(m.user_id));
    teams.forEach(t => uniqueUsers.add(t.user_id));
    activeUsersCount = uniqueUsers.size;
  }

  // Get user stats (total users and new users)
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get total users count
  const { count: totalUsersCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  // Get new users this week
  const { count: newUsersThisWeek } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', oneWeekAgo.toISOString());

  // Get new users this month
  const { count: newUsersThisMonth } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', oneMonthAgo.toISOString());

  // Get upload tokens across all teams
  let tokensUsed = 0;
  let tokensAvailable = 0;
  let tokensTotalAllocation = 0;
  if (teamIds.length > 0) {
    const { data: tokenBalances } = await supabase
      .from('token_balance')
      .select('subscription_tokens_available, subscription_tokens_used_this_period, purchased_tokens_available')
      .in('team_id', teamIds);

    tokenBalances?.forEach(tb => {
      tokensUsed += tb.subscription_tokens_used_this_period || 0;
      tokensAvailable += (tb.subscription_tokens_available || 0) + (tb.purchased_tokens_available || 0);
    });

    // Get tier allocations for total allocation calculation
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('tier')
      .in('team_id', teamIds);

    // Tier allocation mapping (matching tier_config)
    const tierTokens: Record<string, number> = {
      'basic': 2,
      'plus': 4,
      'premium': 8
    };

    subscriptions?.forEach(s => {
      tokensTotalAllocation += tierTokens[s.tier] || 4;
    });
  }

  // Get billing status from subscriptions
  let billingStatus: OverviewResponse['billing']['status'] = 'none';
  let monthlyTotal = 0;
  let nextBillingDate: string | null = null;

  if (teamIds.length > 0) {
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('status, billing_waived, current_period_end, tier')
      .in('team_id', teamIds);

    if (subscriptions && subscriptions.length > 0) {
      // Determine overall billing status
      const hasWaived = subscriptions.some(s => s.billing_waived || s.status === 'waived');
      const hasPastDue = subscriptions.some(s => s.status === 'past_due');
      const hasTrialing = subscriptions.some(s => s.status === 'trialing');
      const hasActive = subscriptions.some(s => s.status === 'active');

      if (hasPastDue) {
        billingStatus = 'past_due';
      } else if (hasTrialing) {
        billingStatus = 'trial';
      } else if (hasWaived) {
        billingStatus = 'waived';
      } else if (hasActive) {
        billingStatus = 'current';
      }

      // Calculate monthly total (placeholder - would come from tier config)
      // For now, just count teams with active/waived subscriptions
      monthlyTotal = 0; // Will be calculated from tier pricing

      // Get next billing date (earliest end date)
      const endDates = subscriptions
        .filter(s => s.current_period_end)
        .map(s => new Date(s.current_period_end!));
      if (endDates.length > 0) {
        nextBillingDate = new Date(Math.min(...endDates.map(d => d.getTime()))).toISOString().split('T')[0];
      }
    }
  }

  // Build alerts
  const alerts: Alert[] = [];

  // Check for pending invites (team memberships with pending status)
  if (teamIds.length > 0) {
    const { count: pendingCount } = await supabase
      .from('team_memberships')
      .select('id', { count: 'exact', head: true })
      .in('team_id', teamIds)
      .eq('is_active', false);

    if (pendingCount && pendingCount > 0) {
      alerts.push({
        type: 'pending_invites',
        message: `${pendingCount} pending team invitation${pendingCount > 1 ? 's' : ''}`,
        count: pendingCount,
        action_url: '/console/people'
      });
    }
  }

  // Check for low upload tokens (teams with <=1 token remaining)
  if (teamIds.length > 0) {
    const { data: lowTokenTeams } = await supabase
      .from('token_balance')
      .select('team_id, subscription_tokens_available, purchased_tokens_available')
      .in('team_id', teamIds);

    lowTokenTeams?.forEach(tb => {
      const total = (tb.subscription_tokens_available || 0) + (tb.purchased_tokens_available || 0);
      if (total <= 1) {
        const team = teams.find(t => t.id === tb.team_id);
        alerts.push({
          type: 'low_tokens',
          message: `${team?.name || 'A team'} has ${total} film upload${total === 1 ? '' : 's'} remaining`,
          team_id: tb.team_id,
          action_url: `/teams/${tb.team_id}/settings/addons`
        });
      }
    });
  }

  const response: OverviewResponse = {
    organization,
    summary: {
      teams_count: teams.length,
      active_users_count: activeUsersCount,
      total_games: totalGames,
      total_plays_tagged: totalPlays
    },
    users: {
      total: totalUsersCount || 0,
      new_this_week: newUsersThisWeek || 0,
      new_this_month: newUsersThisMonth || 0
    },
    upload_tokens: {
      used: tokensUsed,
      available: tokensAvailable,
      total_allocation: tokensTotalAllocation,
      percentage: tokensTotalAllocation > 0 ? Math.round((tokensUsed / tokensTotalAllocation) * 100) : 0
    },
    billing: {
      status: billingStatus,
      next_billing_date: nextBillingDate,
      monthly_total: monthlyTotal
    },
    alerts,
    legacy_mode: legacyMode
  };

  return NextResponse.json(response);
}
