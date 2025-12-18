/**
 * Practice Data Fetcher
 *
 * Aggregates data for AI practice planning using the SEMANTIC LAYER EXCLUSIVELY.
 * This ensures all analytics are consistent with the coaching chat.
 *
 * CRITICAL: Do not add direct database queries or duplicate analytics calculations.
 * Always use semantic layer concept resolvers.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlayData, PlayerData, GameData } from '../semantic/types';
import type { PositionGroupPerformanceResult } from '../semantic/concepts/position-group-performance';
import type { PlayDrillCandidatesResult } from '../semantic/concepts/play-drill-candidates';
import type { OpponentTendenciesResult } from '../semantic/concepts/opponent-tendencies';

import { fetchPlayInstances, fetchPlayers, fetchAllGames } from '../semantic/data-fetcher';
import { resolveTeamTendencies } from '../semantic/concepts/team-tendencies';
import { resolveSituationAnalysis } from '../semantic/concepts/situation-analysis';
import { resolvePositionGroupPerformance } from '../semantic/concepts/position-group-performance';
import { resolvePlayDrillCandidates } from '../semantic/concepts/play-drill-candidates';
import { resolveOpponentTendencies } from '../semantic/concepts/opponent-tendencies';

/**
 * Complete practice planning context from semantic layer
 */
export interface PracticeDataContext {
  // Team metadata
  teamId: string;
  teamName: string;
  teamLevel: string;

  // Game context (optional - for opponent-specific practice)
  upcomingGame?: {
    gameId: string;
    opponent: string;
    date: string;
  };

  // Semantic layer analysis results (formatted strings)
  teamTendencies: string;
  situationAnalysis: string;

  // Structured data for AI reasoning
  positionGroupPerformance: PositionGroupPerformanceResult;
  playDrillCandidates: PlayDrillCandidatesResult;
  opponentTendencies?: OpponentTendenciesResult;

  // Practice recommendations aggregated from all sources
  practiceRecommendations: string[];

  // Metadata
  playsAnalyzed: number;
  hasAnalyticsData: boolean;
}

/**
 * Fetch team metadata
 */
async function fetchTeamMetadata(
  supabase: SupabaseClient,
  teamId: string
): Promise<{ name: string; level: string }> {
  const { data } = await supabase
    .from('teams')
    .select('name, level')
    .eq('id', teamId)
    .single();

  return {
    name: data?.name || 'Your Team',
    level: data?.level || 'youth',
  };
}

/**
 * Fetch upcoming games for opponent selection
 */
export async function fetchUpcomingGames(
  supabase: SupabaseClient,
  teamId: string
): Promise<Array<{ id: string; opponent: string; date: string }>> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('games')
    .select('id, opponent, date')
    .eq('team_id', teamId)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(10);

  if (error || !data) {
    return [];
  }

  return data.map((g) => ({
    id: g.id,
    opponent: g.opponent,
    date: g.date,
  }));
}

/**
 * Main data fetcher for practice planning
 *
 * Uses semantic layer EXCLUSIVELY - no direct analytics calculations.
 */
export async function fetchPracticeContext(
  supabase: SupabaseClient,
  teamId: string,
  options: {
    opponentName?: string;
    gameId?: string;
  } = {}
): Promise<PracticeDataContext> {
  // Fetch base data in parallel
  const [teamMeta, plays, players, games] = await Promise.all([
    fetchTeamMetadata(supabase, teamId),
    fetchPlayInstances(supabase, teamId, {}),
    fetchPlayers(supabase, teamId),
    fetchAllGames(supabase, teamId),
  ]);

  const hasAnalyticsData = plays.length > 0;

  // If no analytics data, return empty context
  if (!hasAnalyticsData) {
    return {
      teamId,
      teamName: teamMeta.name,
      teamLevel: teamMeta.level,
      teamTendencies: 'No play data available. Tag game film to unlock AI practice planning.',
      situationAnalysis: '',
      positionGroupPerformance: {
        summary: 'No position group data available.',
        groups: [],
        weakestGroup: null,
        practiceRecommendations: ['Tag your game film with player assignments'],
      },
      playDrillCandidates: {
        summary: 'No play data available.',
        needsDrilling: [],
        considerRemoving: [],
        workingWell: [],
        practiceRecommendations: ['Tag your game film with plays'],
      },
      practiceRecommendations: [
        'Tag game film to unlock AI-powered practice planning',
        'For now, create a fundamentals-focused practice manually',
      ],
      playsAnalyzed: 0,
      hasAnalyticsData: false,
    };
  }

  // Resolve semantic layer concepts in parallel
  const [
    teamTendencies,
    situationAnalysis,
    positionGroupPerformance,
    playDrillCandidates,
  ] = await Promise.all([
    resolveTeamTendencies(supabase, teamId, { timeframe: 'season' }),
    resolveSituationAnalysis(supabase, teamId, {}),
    Promise.resolve(resolvePositionGroupPerformance(plays, players)),
    Promise.resolve(resolvePlayDrillCandidates(plays, players)),
  ]);

  // Resolve opponent tendencies if opponent specified
  let opponentTendencies: OpponentTendenciesResult | undefined;
  if (options.opponentName) {
    opponentTendencies = resolveOpponentTendencies(
      plays,
      options.opponentName,
      games
    );
  }

  // Find upcoming game if specified
  let upcomingGame: PracticeDataContext['upcomingGame'];
  if (options.gameId) {
    const game = games.find((g) => g.id === options.gameId);
    if (game) {
      upcomingGame = {
        gameId: game.id,
        opponent: game.opponent,
        date: game.date,
      };
    }
  }

  // Aggregate practice recommendations from all sources
  const practiceRecommendations = aggregateRecommendations(
    positionGroupPerformance,
    playDrillCandidates,
    opponentTendencies
  );

  return {
    teamId,
    teamName: teamMeta.name,
    teamLevel: teamMeta.level,
    upcomingGame,
    teamTendencies,
    situationAnalysis,
    positionGroupPerformance,
    playDrillCandidates,
    opponentTendencies,
    practiceRecommendations,
    playsAnalyzed: plays.length,
    hasAnalyticsData: true,
  };
}

/**
 * Aggregate recommendations from all semantic layer sources
 * Returns more recommendations to give coaches more options
 */
function aggregateRecommendations(
  positionGroup: PositionGroupPerformanceResult,
  playDrills: PlayDrillCandidatesResult,
  opponent?: OpponentTendenciesResult
): string[] {
  const recommendations: string[] = [];

  // Position group recommendations (priority 1)
  if (positionGroup.weakestGroup) {
    recommendations.push(positionGroup.weakestGroup.recommendation);
  }

  // Add other position group recommendations (only if they have valid data)
  for (const group of positionGroup.groups.slice(0, 3)) {
    if (group.groupName !== positionGroup.weakestGroup?.groupName &&
        group.grade !== 'No Data' &&
        !isNaN(group.winRate) &&
        group.winRate !== null &&
        group.winRate !== undefined) {
      const rec = `${group.groupName} performance (${Math.round(group.winRate)}%)`;
      if (!recommendations.includes(rec)) {
        recommendations.push(rec);
      }
    }
  }

  // Play drill recommendations (priority 2)
  for (const rec of playDrills.practiceRecommendations.slice(0, 4)) {
    recommendations.push(rec);
  }

  // Opponent-specific recommendations (priority 3)
  if (opponent?.hasData) {
    for (const rec of opponent.practiceRecommendations.slice(0, 3)) {
      recommendations.push(rec);
    }
  }

  // Deduplicate and return more recommendations (up to 8)
  const unique = [...new Set(recommendations)];
  return unique.slice(0, 8);
}

/**
 * Format context for AI prompt
 *
 * Returns a formatted string summarizing all analytics for the AI.
 */
export function formatContextForPrompt(context: PracticeDataContext): string {
  if (!context.hasAnalyticsData) {
    return `No analytics data available for ${context.teamName}. Generate a fundamentals-focused practice plan appropriate for ${context.teamLevel} level.`;
  }

  let prompt = `## Team: ${context.teamName} (${context.teamLevel})\n`;
  prompt += `Plays Analyzed: ${context.playsAnalyzed}\n\n`;

  // Team tendencies
  prompt += `### Team Tendencies\n${context.teamTendencies}\n\n`;

  // Position group performance
  prompt += `### Position Group Performance\n${context.positionGroupPerformance.summary}\n\n`;

  // Play drill candidates
  prompt += `### Play Analysis\n${context.playDrillCandidates.summary}\n\n`;

  // Opponent analysis (if available)
  if (context.opponentTendencies?.hasData) {
    prompt += `### Opponent Analysis: ${context.opponentTendencies.opponentName}\n`;
    prompt += `${context.opponentTendencies.summary}\n\n`;
  }

  // Aggregated recommendations
  prompt += `### Priority Practice Focus\n`;
  for (let i = 0; i < context.practiceRecommendations.length; i++) {
    prompt += `${i + 1}. ${context.practiceRecommendations[i]}\n`;
  }

  return prompt;
}
