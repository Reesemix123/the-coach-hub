/**
 * Game Week Command Center Service
 * Handles data fetching and status calculations for all 5 stations
 */

import { createClient } from '@/utils/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export type Status = 'green' | 'yellow' | 'red' | 'gray';
export type SeasonPhase = 'pre_game' | 'bye_week' | 'post_game' | 'off_season';
export type AnalyticsTier = 'little_league' | 'hs_basic' | 'hs_advanced' | 'ai_powered';

export interface GameWeekContext {
  gameId: string | null;
  opponent: string | null;
  gameDate: Date | null;
  daysUntilGame: number | null;
  weekStart: Date;
  weekEnd: Date;
  phase: SeasonPhase;
}

export interface MetricItem {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface SecondaryAction {
  label: string;
  href: string;
}

export interface StationData {
  name: string;
  status: Status;
  metrics: MetricItem[];
  primaryAction: {
    label: string;
    href: string;
  };
  secondaryActions: SecondaryAction[];
  comingSoon?: string; // Optional message for features not yet implemented
  badge?: number; // Optional badge count (e.g., for critical insights)
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Get the current game week context
 * @param teamId - The team ID
 * @param gameId - Optional specific game ID to prepare for
 */
export async function getGameWeekContext(
  teamId: string,
  gameId?: string
): Promise<GameWeekContext> {
  const supabase = await createClient();
  const now = new Date();

  // If gameId is provided, get that specific game
  if (gameId) {
    const { data: selectedGame } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .eq('team_id', teamId)
      .single();

    if (selectedGame) {
      const gameDate = new Date(selectedGame.date);
      const daysUntilGame = Math.ceil(
        (gameDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        gameId: selectedGame.id,
        opponent: selectedGame.opponent,
        gameDate,
        daysUntilGame,
        weekStart: daysUntilGame <= 10 ? getStartOfWeek(gameDate) : getStartOfWeek(now),
        weekEnd: daysUntilGame <= 10 ? gameDate : getEndOfWeek(now),
        phase: daysUntilGame > 10 ? 'bye_week' : 'pre_game'
      };
    }
  }

  // Find next upcoming game (fallback if no gameId or game not found)
  const { data: upcomingGame } = await supabase
    .from('games')
    .select('*')
    .eq('team_id', teamId)
    .gte('date', now.toISOString().split('T')[0])
    .order('date', { ascending: true })
    .limit(1)
    .single();

  if (!upcomingGame) {
    // No upcoming games = off-season
    return {
      gameId: null,
      opponent: null,
      gameDate: null,
      daysUntilGame: null,
      weekStart: getStartOfWeek(now),
      weekEnd: getEndOfWeek(now),
      phase: 'off_season'
    };
  }

  const gameDate = new Date(upcomingGame.date);
  const daysUntilGame = Math.ceil((gameDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Bye week if game is > 10 days away
  if (daysUntilGame > 10) {
    return {
      gameId: upcomingGame.id,
      opponent: upcomingGame.opponent,
      gameDate,
      daysUntilGame,
      weekStart: getStartOfWeek(now),
      weekEnd: getEndOfWeek(now),
      phase: 'bye_week'
    };
  }

  return {
    gameId: upcomingGame.id,
    opponent: upcomingGame.opponent,
    gameDate,
    daysUntilGame,
    weekStart: getStartOfWeek(gameDate),
    weekEnd: gameDate,
    phase: 'pre_game'
  };
}

/**
 * Get all upcoming games for team (for game selector dropdown)
 * @param teamId - The team ID
 * @param includeAll - If true, show all future games; if false, only next 60 days
 */
export async function getUpcomingGames(
  teamId: string,
  includeAll: boolean = false
): Promise<any[]> {
  const supabase = await createClient();
  const now = new Date();

  let query = supabase
    .from('games')
    .select('*')
    .eq('team_id', teamId)
    .order('date', { ascending: true });

  if (!includeAll) {
    // Only show games within next 60 days
    const sixtyDaysFromNow = new Date(now);
    sixtyDaysFromNow.setDate(now.getDate() + 60);
    query = query
      .gte('date', now.toISOString().split('T')[0])
      .lte('date', sixtyDaysFromNow.toISOString().split('T')[0]);
  } else {
    // Show all future games
    query = query.gte('date', now.toISOString().split('T')[0]);
  }

  const { data } = await query;
  return data || [];
}

/**
 * Get all station data for the game week
 * Simplified to show only Game Prep Hub and Game Plan tiles
 */
export async function getStationData(
  teamId: string,
  gameId: string,
  daysUntilGame: number
): Promise<StationData[]> {
  const supabase = await createClient();

  // Get analytics tier (defaults to hs_basic if not set)
  const tier = await getAnalyticsTier(supabase, teamId);

  // Fetch only the two main stations: Game Prep Hub and Game Plan
  const [prepHubData, gamePlanData] = await Promise.all([
    getGamePrepHubData(supabase, teamId, gameId, tier),
    getGamePlanStationData(supabase, teamId, gameId, tier)
  ]);

  // Apply time-based urgency modifiers
  // Game Prep Hub first (overall preparation), Game Plan second (specific plays)
  return [
    applyUrgencyModifier(prepHubData, daysUntilGame),
    applyUrgencyModifier(gamePlanData, daysUntilGame)
  ];
}

// ============================================================================
// Station Data Fetchers
// ============================================================================

async function getFilmStationData(
  supabase: SupabaseClient,
  teamId: string,
  gameId: string,
  tier: AnalyticsTier
): Promise<StationData> {
  // Get the upcoming game details
  const { data: game } = await supabase
    .from('games')
    .select('opponent, date')
    .eq('id', gameId)
    .single();

  const opponentName = game?.opponent || 'opponent';

  // OPTIMIZED: Get recent game IDs first, then query videos
  const { data: recentGames } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId)
    .lt('date', game?.date || new Date().toISOString())
    .order('date', { ascending: false })
    .limit(2);

  const recentGameIds = recentGames?.map(g => g.id) || [];

  // Count your videos and tagged videos (parallel queries)
  const [yourVideoResult, yourTaggedResult] = await Promise.all([
    supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .in('game_id', recentGameIds.length > 0 ? recentGameIds : ['none']),

    supabase
      .from('videos')
      .select('id, play_instances!inner(id)', { count: 'exact', head: true })
      .in('game_id', recentGameIds.length > 0 ? recentGameIds : ['none'])
  ]);

  const yourTotal = yourVideoResult.count ?? 0;
  const yourTagged = yourTaggedResult.count ?? 0;

  // Get opponent game IDs
  const { data: opponentGames } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId)
    .eq('is_opponent_game', true)
    .order('date', { ascending: false })
    .limit(3);

  const opponentGameIds = opponentGames?.map(g => g.id) || [];

  // Count opponent videos and tagged videos (parallel queries)
  const [opponentVideoResult, opponentTaggedResult] = await Promise.all([
    supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .in('game_id', opponentGameIds.length > 0 ? opponentGameIds : ['none']),

    supabase
      .from('videos')
      .select('id, play_instances!inner(id)', { count: 'exact', head: true })
      .in('game_id', opponentGameIds.length > 0 ? opponentGameIds : ['none'])
  ]);

  const opponentTotal = opponentVideoResult.count ?? 0;
  const opponentTagged = opponentTaggedResult.count ?? 0;

  // Status logic: Need BOTH your film reviewed AND opponent scouted
  let status: Status = 'gray';

  if (yourTotal === 0 && opponentTotal === 0) {
    status = 'gray'; // No film at all - not started
  } else if (yourTotal > 0 && opponentTotal === 0) {
    // Have your film but no opponent film
    if (yourTagged === 0) {
      status = 'red'; // Your film not tagged
    } else if (yourTagged / yourTotal >= 0.8) {
      status = 'yellow'; // Your film mostly done, but no opponent film
    } else {
      status = 'red'; // Your film partially done, no opponent film
    }
  } else if (yourTotal === 0 && opponentTotal > 0) {
    // Have opponent film but no your film
    if (opponentTagged === 0) {
      status = 'red'; // Opponent film not tagged
    } else if (opponentTagged / opponentTotal >= 0.8) {
      status = 'yellow'; // Opponent film mostly done, but no your film
    } else {
      status = 'red'; // Opponent film partially done, no your film
    }
  } else {
    // Have both types of film
    const yourProgress = yourTotal > 0 ? yourTagged / yourTotal : 0;
    const opponentProgress = opponentTotal > 0 ? opponentTagged / opponentTotal : 0;
    const avgProgress = (yourProgress + opponentProgress) / 2;

    if (avgProgress >= 0.9) {
      status = 'green'; // Both mostly complete
    } else if (avgProgress >= 0.5) {
      status = 'yellow'; // Making progress on both
    } else {
      status = 'red'; // Need more work
    }
  }

  return {
    name: 'Film Review & Scout',
    status,
    metrics: [
      { label: 'Your Film Reviewed', value: `${yourTagged}/${yourTotal} videos` },
      { label: `${opponentName} Scouted`, value: `${opponentTagged}/${opponentTotal} videos` }
    ],
    primaryAction: {
      label: yourTotal === 0 ? 'Upload Your Film' : 'Review Your Film',
      href: `/teams/${teamId}/film`
    },
    secondaryActions: [
      { label: 'Scout Opponent', href: `/teams/${teamId}/film?filter=opponent` },
      { label: 'View Analytics', href: `/teams/${teamId}/analytics-reporting` }
    ]
  };
}

async function getGamePlanStationData(
  supabase: SupabaseClient,
  teamId: string,
  gameId: string,
  tier: AnalyticsTier
): Promise<StationData> {
  // Query: Game plan for this game
  const { data: gamePlan } = await supabase
    .from('game_plans')
    .select('id, name, updated_at, game_plan_plays(count)')
    .eq('team_id', teamId)
    .eq('game_id', gameId)
    .single();

  const playsCount = gamePlan?.game_plan_plays?.[0]?.count || 0;
  const exists = !!gamePlan;

  // Status logic
  let status: Status = 'red';
  if (!exists || playsCount === 0) {
    status = 'red'; // No game plan
  } else if (playsCount < 20) {
    status = 'yellow'; // Incomplete (< 20 plays)
  } else if (playsCount >= 30) {
    status = 'green'; // Complete (30+ plays)
  } else {
    status = 'yellow'; // In progress (20-29 plays)
  }

  return {
    name: 'Game Plan',
    status,
    metrics: [
      { label: 'Plays Selected', value: `${playsCount} plays` },
      { label: 'Last Updated', value: exists ? 'Recently' : 'Not started' }
    ],
    primaryAction: {
      label: exists && playsCount > 0 ? 'Edit Game Plan' : 'Build Game Plan',
      href: `/teams/${teamId}/game-week/game-plan/${gameId}`
    },
    secondaryActions: [
      { label: 'View Playbook', href: `/teams/${teamId}/playbook` },
      { label: 'Print Wristband', href: gamePlan ? `/teams/${teamId}/playbook/print-wristband/${gamePlan.id}` : `/teams/${teamId}/playbook` }
    ]
  };
}

async function getPlaybookStationData(
  supabase: SupabaseClient,
  teamId: string,
  tier: AnalyticsTier
): Promise<StationData> {
  // Query: Playbook summary
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: playbookStats } = await supabase
    .from('playbook_plays')
    .select('id, created_at')
    .eq('team_id', teamId)
    .eq('is_archived', false);

  const totalPlays = playbookStats?.length || 0;
  const newThisWeek = playbookStats?.filter(
    (p: any) => new Date(p.created_at) > sevenDaysAgo
  ).length || 0;

  // Status logic
  let status: Status = 'gray';
  if (totalPlays === 0) {
    status = 'gray'; // No playbook yet
  } else if (totalPlays < 20) {
    status = 'red'; // Too few plays
  } else if (totalPlays < 40 || newThisWeek > 5) {
    status = 'yellow'; // Growing playbook or adding too many in game week
  } else {
    status = 'green'; // Solid playbook
  }

  return {
    name: 'Playbook',
    status,
    metrics: [
      { label: 'Total Plays', value: `${totalPlays} plays` },
      { label: 'Added This Week', value: `+${newThisWeek}` }
    ],
    primaryAction: {
      label: 'View Playbook',
      href: `/teams/${teamId}/playbook`
    },
    secondaryActions: [
      { label: 'Add New Play', href: `/teams/${teamId}/playbook?mode=create` },
      { label: 'View Analytics', href: `/teams/${teamId}/analytics` }
    ]
  };
}

async function getPracticeStationData(
  supabase: SupabaseClient,
  teamId: string,
  gameId: string,
  tier: AnalyticsTier
): Promise<StationData> {
  // Query: Practice plans for this week
  const { data: game } = await supabase
    .from('games')
    .select('date')
    .eq('id', gameId)
    .single();

  if (!game) {
    return {
      name: 'Practice',
      status: 'gray',
      metrics: [],
      primaryAction: { label: 'Plan Practice', href: `/teams/${teamId}/practice` },
      secondaryActions: []
    };
  }

  const gameDate = new Date(game.date);
  const weekStart = getStartOfWeek(gameDate);
  const now = new Date();

  // Get practices for this week
  const { data: practices } = await supabase
    .from('practice_plans')
    .select('id, date, title, duration_minutes')
    .eq('team_id', teamId)
    .gte('date', weekStart.toISOString().split('T')[0])
    .lte('date', gameDate.toISOString().split('T')[0])
    .order('date', { ascending: true});

  const scheduledCount = practices?.length || 0;

  // Find next practice
  const nextPractice = practices?.find(p => new Date(p.date) >= now);
  const nextPracticeText = nextPractice
    ? new Date(nextPractice.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Not scheduled';

  // OPTIMIZED: Skip complex drill query for now - use practice count as proxy
  // This can be enhanced later with a database view or RPC function
  const totalPlays = scheduledCount * 5; // Estimate: ~5 plays per practice

  // Status logic: Need practices scheduled
  let status: Status = 'gray';

  if (scheduledCount === 0) {
    status = 'gray'; // No practices planned
  } else if (scheduledCount >= 3) {
    status = 'green'; // Good practice schedule
  } else if (scheduledCount >= 2) {
    status = 'yellow'; // Some practices
  } else {
    status = 'yellow'; // At least one practice scheduled
  }

  return {
    name: 'Practice',
    status,
    metrics: [
      { label: 'Practices Scheduled', value: `${scheduledCount} practices` },
      { label: 'Next Practice', value: nextPracticeText }
    ],
    primaryAction: {
      label: scheduledCount > 0 ? 'Edit Practice Plan' : 'Plan Practice',
      href: `/teams/${teamId}/practice`
    },
    secondaryActions: [
      { label: 'View Playbook', href: `/teams/${teamId}/playbook` },
      { label: 'View Schedule', href: `/teams/${teamId}/schedule` }
    ]
  };
}

async function getPersonnelStationData(
  supabase: SupabaseClient,
  teamId: string,
  tier: AnalyticsTier
): Promise<StationData> {
  // Query: Roster summary
  const { data: players } = await supabase
    .from('players')
    .select('id, injury_status')
    .eq('team_id', teamId)
    .eq('is_active', true);

  const activeCount = players?.length || 0;
  const injuredCount = players?.filter((p: any) => p.injury_status && p.injury_status !== 'healthy').length || 0;

  // Status logic
  let status: Status = 'gray';
  if (activeCount === 0) {
    status = 'gray'; // No roster yet
  } else if (injuredCount > 5) {
    status = 'red'; // Many injuries
  } else if (injuredCount > 0 || activeCount < 30) {
    status = 'yellow'; // Some concerns
  } else {
    status = 'green'; // Healthy roster
  }

  return {
    name: 'Personnel',
    status,
    metrics: [
      { label: 'Active Roster', value: `${activeCount} players` },
      { label: 'Injured/Questionable', value: `${injuredCount} players` }
    ],
    primaryAction: {
      label: 'Manage Roster',
      href: `/teams/${teamId}/players`
    },
    secondaryActions: [
      { label: 'Update Depth Chart', href: `/teams/${teamId}/players` },
      { label: 'Update Injuries', href: `/teams/${teamId}/players` }
    ]
  };
}

async function getGamePrepHubData(
  supabase: SupabaseClient,
  teamId: string,
  gameId: string,
  tier: AnalyticsTier
): Promise<StationData> {
  // Query prep plan data
  const { data: prepPlan } = await supabase
    .from('prep_plans')
    .select('*')
    .eq('team_id', teamId)
    .eq('game_id', gameId)
    .single();

  // Get insights count (critical ones for badge)
  let criticalInsightsCount = 0;
  let totalInsights = 0;
  let tasksCompleted = 0;
  let tasksTotal = 0;
  let promptsAnswered = 0;
  let promptsTotal = 0;

  if (prepPlan) {
    // Get critical insights count
    const { count: criticalCount } = await supabase
      .from('prep_insights')
      .select('*', { count: 'exact', head: true })
      .eq('prep_plan_id', prepPlan.id)
      .eq('priority', 1)
      .eq('is_reviewed', false);

    criticalInsightsCount = criticalCount || 0;
    totalInsights = prepPlan.insights_total || 0;
    tasksCompleted = prepPlan.tasks_completed || 0;
    tasksTotal = prepPlan.tasks_total || 0;
    promptsAnswered = prepPlan.prompts_answered || 0;
    promptsTotal = prepPlan.prompts_total || 0;
  }

  // Status logic based on overall readiness
  let status: Status = 'gray';
  const overallReadiness = prepPlan?.overall_readiness || 0;

  if (!prepPlan || prepPlan.status === 'not_started') {
    status = 'gray'; // Not started
  } else if (overallReadiness >= 75) {
    status = 'green'; // Ready
  } else if (overallReadiness >= 40) {
    status = 'yellow'; // In progress
  } else {
    status = 'red'; // Needs attention
  }

  // Build metrics
  const metrics: MetricItem[] = [];

  if (totalInsights > 0) {
    metrics.push({
      label: 'Insights',
      value: `${totalInsights} available`
    });
  }

  if (tasksTotal > 0) {
    metrics.push({
      label: 'Prep Tasks',
      value: `${tasksCompleted}/${tasksTotal} done`
    });
  } else {
    metrics.push({
      label: 'Prep Tasks',
      value: 'Not started'
    });
  }

  if (promptsTotal > 0) {
    metrics.push({
      label: 'Questions',
      value: `${promptsAnswered}/${promptsTotal} answered`
    });
  }

  return {
    name: 'Game Prep Hub',
    status,
    metrics: metrics.length > 0 ? metrics.slice(0, 2) : [
      { label: 'Status', value: 'Get started' },
      { label: 'Progress', value: '0%' }
    ],
    primaryAction: {
      label: prepPlan ? 'Review Prep Hub' : 'Start Prep Plan',
      href: `/teams/${teamId}/game-prep-hub?game=${gameId}`
    },
    secondaryActions: [
      { label: 'View Analytics', href: `/teams/${teamId}/analytics-reporting` },
      { label: 'View Film', href: `/teams/${teamId}/film` }
    ],
    badge: criticalInsightsCount > 0 ? criticalInsightsCount : undefined
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getAnalyticsTier(
  supabase: SupabaseClient,
  teamId: string
): Promise<AnalyticsTier> {
  const { data } = await supabase
    .from('team_analytics_config')
    .select('tier')
    .eq('team_id', teamId)
    .single();

  return (data?.tier as AnalyticsTier) || 'hs_basic';
}

function applyUrgencyModifier(station: StationData, daysUntilGame: number): StationData {
  let status = station.status;

  // Escalate yellow → red if game is within 2 days
  if (daysUntilGame <= 2 && status === 'yellow') {
    status = 'red';
  }

  // Downgrade red → yellow if game is > 7 days away (more time to fix)
  if (daysUntilGame > 7 && status === 'red') {
    status = 'yellow';
  }

  return { ...station, status };
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday = 0
  return new Date(d.setDate(diff));
}

function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
}
