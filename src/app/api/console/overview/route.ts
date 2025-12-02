// /api/console/overview - Athletic Director Console Overview API
// Returns organization summary, stats, AI credits, billing status, and alerts

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
  ai_credits: {
    used: number;
    allowed: number;
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

  // Get AI credits across all teams
  let aiCreditsUsed = 0;
  let aiCreditsAllowed = 0;
  if (teamIds.length > 0) {
    const { data: credits } = await supabase
      .from('ai_credits')
      .select('credits_used, credits_allowed')
      .in('team_id', teamIds)
      .gte('period_end', new Date().toISOString()); // Current period only

    credits?.forEach(c => {
      aiCreditsUsed += c.credits_used || 0;
      aiCreditsAllowed += c.credits_allowed || 0;
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

  // Check for AI credit warnings (teams at >80% usage)
  if (teamIds.length > 0) {
    const { data: highUsageCredits } = await supabase
      .from('ai_credits')
      .select('team_id, credits_used, credits_allowed')
      .in('team_id', teamIds)
      .gte('period_end', new Date().toISOString());

    highUsageCredits?.forEach(credit => {
      if (credit.credits_allowed > 0) {
        const percentage = (credit.credits_used / credit.credits_allowed) * 100;
        if (percentage >= 80) {
          const team = teams.find(t => t.id === credit.team_id);
          alerts.push({
            type: 'ai_limit_warning',
            message: `${team?.name || 'A team'} at ${Math.round(percentage)}% AI credit usage`,
            team_id: credit.team_id,
            action_url: `/console/teams/${credit.team_id}`
          });
        }
      }
    });
  }

  // Check for expiring trials
  if (teamIds.length > 0) {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const { data: expiringTrials } = await supabase
      .from('subscriptions')
      .select('team_id, trial_ends_at')
      .in('team_id', teamIds)
      .eq('status', 'trialing')
      .lte('trial_ends_at', threeDaysFromNow.toISOString())
      .gte('trial_ends_at', new Date().toISOString());

    expiringTrials?.forEach(trial => {
      const team = teams.find(t => t.id === trial.team_id);
      const daysLeft = Math.ceil(
        (new Date(trial.trial_ends_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      alerts.push({
        type: 'trial_expiring',
        message: `${team?.name || 'A team'} trial expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
        team_id: trial.team_id,
        days_left: daysLeft,
        action_url: `/console/teams/${trial.team_id}/subscribe`
      });
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
    ai_credits: {
      used: aiCreditsUsed,
      allowed: aiCreditsAllowed,
      percentage: aiCreditsAllowed > 0 ? Math.round((aiCreditsUsed / aiCreditsAllowed) * 100) : 0
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
