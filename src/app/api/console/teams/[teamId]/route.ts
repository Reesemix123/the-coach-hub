// /api/console/teams/[teamId] - Get detailed info for a single team in the console context
// Returns usage, billing, tokens, and activity data for a specific team

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getTierConfigs } from '@/lib/admin/config';

interface TeamDetailResponse {
  team: {
    id: string;
    name: string;
    level: string;
    created_at: string;
  };
  subscription: {
    tier: string;
    tier_display_name: string;
    status: string;
    billing_waived: boolean;
    billing_waived_reason: string | null;
    current_period_end: string | null;
    trial_ends_at: string | null;
    trial_days_remaining: number | null;
    monthly_cost_cents: number;
  };
  usage: {
    games_count: number;
    plays_count: number;
    players_count: number;
    members_count: number;
  };
  upload_tokens: {
    available: number;
    used_this_period: number;
    allocation: number;
  };
  recent_games: Array<{
    id: string;
    name: string;
    opponent: string | null;
    date: string | null;
    plays_count: number;
    created_at: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
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

  // Get the team and verify access
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, name, level, created_at, user_id, organization_id')
    .eq('id', teamId)
    .single();

  if (teamError || !team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Verify user has access to this team
  const hasAccess = profile?.organization_id
    ? team.organization_id === profile.organization_id
    : team.user_id === user.id;

  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  // Get tier configs for pricing and limits
  const tierConfigs = await getTierConfigs();

  // Get subscription for this team
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('team_id', teamId)
    .single();

  const tier = subscription?.tier || 'plus';
  const tierConfig = tierConfigs?.[tier];

  // Calculate trial days remaining
  let trialDaysRemaining: number | null = null;
  if (subscription?.status === 'trialing' && subscription?.trial_ends_at) {
    const trialEnd = new Date(subscription.trial_ends_at);
    const now = new Date();
    trialDaysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // Get token balance
  const { data: tokenBalance } = await supabase
    .from('token_balance')
    .select('subscription_tokens_available, subscription_tokens_used_this_period, purchased_tokens_available')
    .eq('team_id', teamId)
    .single();

  // Tier token allocation
  const tierTokens: Record<string, number> = {
    'basic': 2,
    'plus': 4,
    'premium': 8,
  };

  // Get usage counts
  const [gamesResult, playsResult, playersResult, membersResult] = await Promise.all([
    supabase.from('games').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
    supabase.from('play_instances').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
    supabase.from('players').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
    supabase.from('team_memberships').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('is_active', true)
  ]);

  // Get recent games with play counts
  const { data: recentGames } = await supabase
    .from('games')
    .select('id, name, opponent, date, created_at')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Get play counts for each game
  const gamesWithPlays = await Promise.all(
    (recentGames || []).map(async (game) => {
      const { count } = await supabase
        .from('play_instances')
        .select('id', { count: 'exact', head: true })
        .eq('video_id', game.id);

      return {
        ...game,
        plays_count: count || 0
      };
    })
  );

  // Calculate monthly cost
  let monthlyCostCents = 0;
  if (subscription && !subscription.billing_waived && subscription.status === 'active') {
    monthlyCostCents = tierConfig?.price_monthly || 0;
  }

  // Token calculations
  const tokensAvailable = (tokenBalance?.subscription_tokens_available || 0) + (tokenBalance?.purchased_tokens_available || 0);
  const tokensUsed = tokenBalance?.subscription_tokens_used_this_period || 0;
  const tokenAllocation = tierTokens[tier] || 4;

  const tierDisplayNames: Record<string, string> = {
    'basic': 'Basic',
    'plus': 'Plus',
    'premium': 'Premium',
  };

  const response: TeamDetailResponse = {
    team: {
      id: team.id,
      name: team.name,
      level: team.level || 'High School',
      created_at: team.created_at
    },
    subscription: {
      tier,
      tier_display_name: tierDisplayNames[tier] || tier,
      status: subscription?.status || 'none',
      billing_waived: subscription?.billing_waived || false,
      billing_waived_reason: subscription?.billing_waived_reason || null,
      current_period_end: subscription?.current_period_end || null,
      trial_ends_at: subscription?.trial_ends_at || null,
      trial_days_remaining: trialDaysRemaining,
      monthly_cost_cents: monthlyCostCents
    },
    usage: {
      games_count: gamesResult.count || 0,
      plays_count: playsResult.count || 0,
      players_count: playersResult.count || 0,
      members_count: (membersResult.count || 0) + 1 // +1 for owner
    },
    upload_tokens: {
      available: tokensAvailable,
      used_this_period: tokensUsed,
      allocation: tokenAllocation
    },
    recent_games: gamesWithPlays
  };

  return NextResponse.json(response);
}
