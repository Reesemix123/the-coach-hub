// /api/console/teams - Teams list with subscription and usage data
// Returns all teams for the user's organization (or owned teams in legacy mode)

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/admin/config';

interface TeamResponse {
  id: string;
  name: string;
  level: string;
  tier: string;
  tier_display_name: string;
  subscription: {
    status: string;
    billing_waived: boolean;
    trial_days_remaining: number | null;
    current_period_end: string | null;
  };
  members_count: number;
  games_count: number;
  plays_count: number;
  ai_credits: {
    used: number;
    allowed: number;
    percentage: number;
  };
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
    .select('id, organization_id')
    .eq('id', user.id)
    .single();

  // Determine which teams to fetch
  let teamsQuery = supabase
    .from('teams')
    .select('id, name, level, user_id, created_at');

  if (profile?.organization_id) {
    // Organization mode - get teams by org
    teamsQuery = teamsQuery.eq('organization_id', profile.organization_id);
  } else {
    // Legacy mode - get teams owned by user
    teamsQuery = teamsQuery.eq('user_id', user.id);
  }

  const { data: teams, error: teamsError } = await teamsQuery.order('name');

  if (teamsError) {
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }

  if (!teams || teams.length === 0) {
    return NextResponse.json({
      teams: [],
      totals: { teams: 0, monthly_cost: 0 }
    });
  }

  const teamIds = teams.map(t => t.id);

  // Fetch subscriptions for all teams
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('team_id, tier, status, billing_waived, trial_ends_at, current_period_end')
    .in('team_id', teamIds);

  // Fetch team_analytics_config for tiers (fallback)
  const { data: analyticsConfigs } = await supabase
    .from('team_analytics_config')
    .select('team_id, tier')
    .in('team_id', teamIds);

  // Fetch AI credits for all teams (current period only)
  const { data: aiCredits } = await supabase
    .from('ai_credits')
    .select('team_id, credits_used, credits_allowed')
    .in('team_id', teamIds)
    .gte('period_end', new Date().toISOString());

  // Fetch member counts
  const { data: memberships } = await supabase
    .from('team_memberships')
    .select('team_id, user_id')
    .in('team_id', teamIds)
    .eq('is_active', true);

  // Fetch game counts
  const gameCounts: Record<string, number> = {};
  for (const teamId of teamIds) {
    const { count } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId);
    gameCounts[teamId] = count || 0;
  }

  // Fetch play counts
  const playCounts: Record<string, number> = {};
  for (const teamId of teamIds) {
    const { count } = await supabase
      .from('play_instances')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId);
    playCounts[teamId] = count || 0;
  }

  // Get tier config for display names
  const tierConfig = await getConfig<Record<string, { name: string; price_monthly: number }>>('tier_config');

  // Build lookup maps
  const subscriptionMap = new Map(subscriptions?.map(s => [s.team_id, s]) || []);
  const analyticsMap = new Map(analyticsConfigs?.map(a => [a.team_id, a]) || []);
  const creditsMap = new Map(aiCredits?.map(c => [c.team_id, c]) || []);

  // Count members per team (including owner)
  const memberCounts: Record<string, Set<string>> = {};
  teams.forEach(t => {
    memberCounts[t.id] = new Set([t.user_id]); // Owner always counted
  });
  memberships?.forEach(m => {
    if (memberCounts[m.team_id]) {
      memberCounts[m.team_id].add(m.user_id);
    }
  });

  // Format teams response
  const formattedTeams: TeamResponse[] = teams.map(team => {
    const subscription = subscriptionMap.get(team.id);
    const analyticsConfig = analyticsMap.get(team.id);
    const credits = creditsMap.get(team.id);

    // Get tier from subscription first, then analytics config, then default
    const tier = subscription?.tier || analyticsConfig?.tier || 'hs_basic';
    const tierDisplayName = tierConfig?.[tier]?.name || tier;

    // Calculate trial days remaining
    let trialDaysRemaining: number | null = null;
    if (subscription?.status === 'trialing' && subscription.trial_ends_at) {
      const trialEnd = new Date(subscription.trial_ends_at);
      const now = new Date();
      const diffMs = trialEnd.getTime() - now.getTime();
      trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    const creditsUsed = credits?.credits_used || 0;
    const creditsAllowed = credits?.credits_allowed || 0;

    return {
      id: team.id,
      name: team.name,
      level: team.level || 'High School',
      tier,
      tier_display_name: tierDisplayName,
      subscription: {
        status: subscription?.status || 'none',
        billing_waived: subscription?.billing_waived || false,
        trial_days_remaining: trialDaysRemaining,
        current_period_end: subscription?.current_period_end || null
      },
      members_count: memberCounts[team.id]?.size || 1,
      games_count: gameCounts[team.id] || 0,
      plays_count: playCounts[team.id] || 0,
      ai_credits: {
        used: creditsUsed,
        allowed: creditsAllowed,
        percentage: creditsAllowed > 0 ? Math.round((creditsUsed / creditsAllowed) * 100) : 0
      }
    };
  });

  // Calculate monthly cost (only for non-waived subscriptions)
  const monthlyTotal = formattedTeams.reduce((sum, team) => {
    if (team.subscription.billing_waived || team.subscription.status === 'waived') {
      return sum;
    }
    return sum + (tierConfig?.[team.tier]?.price_monthly || 0);
  }, 0);

  return NextResponse.json({
    teams: formattedTeams,
    totals: {
      teams: formattedTeams.length,
      monthly_cost: monthlyTotal
    }
  });
}
