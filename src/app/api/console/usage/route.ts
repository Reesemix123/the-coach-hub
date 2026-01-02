// /api/console/usage - Usage analytics for athletic director console
// Returns time series data for games, plays, active users, and film uploads

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface TimeSeriesPoint {
  date: string;
  count: number;
}

interface TeamUsage {
  team_id: string;
  team_name: string;
  games: number;
  plays: number;
  tokens_used: number;
  active_users: number;
}

interface UsageResponse {
  period: string;
  time_series: {
    games: TimeSeriesPoint[];
    plays: TimeSeriesPoint[];
    tokens: TimeSeriesPoint[];
    active_users: TimeSeriesPoint[];
  };
  by_team: TeamUsage[];
  totals: {
    games: number;
    plays: number;
    tokens_used: number;
    active_users: number;
  };
}

type Period = '30d' | '90d' | '12m';

function getPeriodConfig(period: Period): { startDate: Date; bucketSize: 'week' | 'month' } {
  const now = new Date();
  let startDate: Date;
  let bucketSize: 'week' | 'month';

  switch (period) {
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      bucketSize = 'week';
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      bucketSize = 'week';
      break;
    case '12m':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      bucketSize = 'month';
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      bucketSize = 'week';
  }

  return { startDate, bucketSize };
}

function generateDateBuckets(startDate: Date, bucketSize: 'week' | 'month'): string[] {
  const buckets: string[] = [];
  const now = new Date();
  const current = new Date(startDate);

  while (current <= now) {
    buckets.push(current.toISOString().split('T')[0]);
    if (bucketSize === 'week') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }

  return buckets;
}

function bucketDate(dateStr: string, bucketSize: 'week' | 'month', startDate: Date): string {
  const date = new Date(dateStr);

  if (bucketSize === 'month') {
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  }

  // For weekly, find the start of the week bucket
  const buckets = generateDateBuckets(startDate, 'week');
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (date >= new Date(buckets[i])) {
      return buckets[i];
    }
  }
  return buckets[0];
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get('period') || '30d') as Period;

  // Validate period
  if (!['30d', '90d', '12m'].includes(period)) {
    return NextResponse.json(
      { error: 'Invalid period. Use 30d, 90d, or 12m' },
      { status: 400 }
    );
  }

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

  // Get teams for this user
  let teams: { id: string; name: string; user_id: string }[] = [];

  if (profile?.organization_id) {
    const { data: orgTeams } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('organization_id', profile.organization_id);
    teams = orgTeams || [];
  } else {
    const { data: ownedTeams } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('user_id', user.id);
    teams = ownedTeams || [];
  }

  if (teams.length === 0) {
    return NextResponse.json({
      period,
      time_series: {
        games: [],
        plays: [],
        tokens: [],
        active_users: []
      },
      by_team: [],
      totals: { games: 0, plays: 0, tokens_used: 0, active_users: 0 }
    });
  }

  const teamIds = teams.map(t => t.id);
  const teamMap = new Map(teams.map(t => [t.id, t.name]));
  const { startDate, bucketSize } = getPeriodConfig(period);
  const startDateStr = startDate.toISOString();

  // Initialize buckets for time series
  const dateBuckets = generateDateBuckets(startDate, bucketSize);
  const initializeBuckets = (): Map<string, number> => {
    const map = new Map<string, number>();
    dateBuckets.forEach(d => map.set(d, 0));
    return map;
  };

  // Fetch games in period
  const { data: games } = await supabase
    .from('games')
    .select('id, team_id, created_at')
    .in('team_id', teamIds)
    .gte('created_at', startDateStr);

  // Fetch plays in period
  const { data: plays } = await supabase
    .from('play_instances')
    .select('id, team_id, created_at')
    .in('team_id', teamIds)
    .gte('created_at', startDateStr);

  // Fetch token transactions for time series (consumption only)
  const { data: tokenTransactions } = await supabase
    .from('token_transactions')
    .select('team_id, amount, transaction_type, created_at')
    .in('team_id', teamIds)
    .eq('transaction_type', 'consumption')
    .gte('created_at', startDateStr);

  // Fetch active users (unique users with last_active_at in period)
  const { data: memberships } = await supabase
    .from('team_memberships')
    .select('team_id, user_id')
    .in('team_id', teamIds)
    .eq('is_active', true);

  // Get unique user IDs including team owners
  const allUserIds = new Set<string>();
  memberships?.forEach(m => allUserIds.add(m.user_id));
  teams.forEach(t => allUserIds.add(t.user_id));

  // Get profiles to check last_active_at
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, last_active_at')
    .in('id', Array.from(allUserIds));

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

  // Build time series for games
  const gamesBuckets = initializeBuckets();
  games?.forEach(g => {
    const bucket = bucketDate(g.created_at, bucketSize, startDate);
    gamesBuckets.set(bucket, (gamesBuckets.get(bucket) || 0) + 1);
  });

  // Build time series for plays
  const playsBuckets = initializeBuckets();
  plays?.forEach(p => {
    const bucket = bucketDate(p.created_at, bucketSize, startDate);
    playsBuckets.set(bucket, (playsBuckets.get(bucket) || 0) + 1);
  });

  // Active users time series (based on last_active_at - simplified)
  // Since we don't have historical activity logs, we'll show cumulative active users
  const activeUsersBuckets = initializeBuckets();
  const activeUsersInPeriod = new Set<string>();
  profiles?.forEach(p => {
    if (p.last_active_at && new Date(p.last_active_at) >= startDate) {
      activeUsersInPeriod.add(p.id);
      // Bucket by their last activity
      const bucket = bucketDate(p.last_active_at, bucketSize, startDate);
      activeUsersBuckets.set(bucket, (activeUsersBuckets.get(bucket) || 0) + 1);
    }
  });

  // Token consumption time series
  const tokensBuckets = initializeBuckets();
  let totalTokensUsed = 0;

  tokenTransactions?.forEach(tx => {
    const bucket = bucketDate(tx.created_at, bucketSize, startDate);
    const amount = Math.abs(tx.amount); // Consumption amounts are negative, so use absolute
    tokensBuckets.set(bucket, (tokensBuckets.get(bucket) || 0) + amount);
    totalTokensUsed += amount;
  });

  // Convert buckets to time series arrays
  const convertToTimeSeries = (buckets: Map<string, number>): TimeSeriesPoint[] => {
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  };

  // Calculate by-team breakdown
  const teamGames: Record<string, number> = {};
  const teamPlays: Record<string, number> = {};
  const teamTokens: Record<string, number> = {};
  const teamUsers: Record<string, Set<string>> = {};

  // Initialize
  teamIds.forEach(id => {
    teamGames[id] = 0;
    teamPlays[id] = 0;
    teamTokens[id] = 0;
    teamUsers[id] = new Set();
  });

  // Count games per team
  games?.forEach(g => {
    if (g.team_id) teamGames[g.team_id] = (teamGames[g.team_id] || 0) + 1;
  });

  // Count plays per team
  plays?.forEach(p => {
    if (p.team_id) teamPlays[p.team_id] = (teamPlays[p.team_id] || 0) + 1;
  });

  // Tokens consumed per team
  tokenTransactions?.forEach(tx => {
    if (tx.team_id) {
      teamTokens[tx.team_id] = (teamTokens[tx.team_id] || 0) + Math.abs(tx.amount);
    }
  });

  // Active users per team
  teams.forEach(t => {
    if (teamUsers[t.id]) {
      const ownerProfile = profileMap.get(t.user_id);
      if (ownerProfile?.last_active_at && new Date(ownerProfile.last_active_at) >= startDate) {
        teamUsers[t.id].add(t.user_id);
      }
    }
  });
  memberships?.forEach(m => {
    if (teamUsers[m.team_id]) {
      const userProfile = profileMap.get(m.user_id);
      if (userProfile?.last_active_at && new Date(userProfile.last_active_at) >= startDate) {
        teamUsers[m.team_id].add(m.user_id);
      }
    }
  });

  const byTeam: TeamUsage[] = teamIds.map(id => ({
    team_id: id,
    team_name: teamMap.get(id) || 'Unknown',
    games: teamGames[id] || 0,
    plays: teamPlays[id] || 0,
    tokens_used: teamTokens[id] || 0,
    active_users: teamUsers[id]?.size || 0
  })).sort((a, b) => b.plays - a.plays); // Sort by most active

  // Calculate totals
  const totals = {
    games: games?.length || 0,
    plays: plays?.length || 0,
    tokens_used: totalTokensUsed,
    active_users: activeUsersInPeriod.size
  };

  const response: UsageResponse = {
    period,
    time_series: {
      games: convertToTimeSeries(gamesBuckets),
      plays: convertToTimeSeries(playsBuckets),
      tokens: convertToTimeSeries(tokensBuckets),
      active_users: convertToTimeSeries(activeUsersBuckets)
    },
    by_team: byTeam,
    totals
  };

  return NextResponse.json(response);
}
