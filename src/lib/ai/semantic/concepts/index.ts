/**
 * Semantic Concepts
 *
 * Exports all concept resolvers for the coaching intelligence system.
 * Each resolver takes team data and returns formatted analysis.
 */

export { resolveTeamTendencies } from './team-tendencies';
export { resolveSituationAnalysis } from './situation-analysis';
export { resolveFormationEffectiveness } from './formation-effectiveness';
export { resolvePlayPerformance } from './play-performance';
export { resolveTrendAnalysis } from './trend-analysis';
export { resolvePlayerPerformance } from './player-performance';
export { resolveOLPerformance } from './ol-performance';
export { resolveDefensivePerformance } from './defensive-performance';
export { resolveSpecialTeamsPerformance } from './special-teams-performance';

// Practice planning concepts
export { resolvePositionGroupPerformance } from './position-group-performance';
export type { PositionGroupStats, PositionGroupPerformanceResult } from './position-group-performance';

export { resolvePlayDrillCandidates } from './play-drill-candidates';
export type { PlayDrillCandidate, PlayDrillCandidatesResult } from './play-drill-candidates';

export { resolveOpponentTendencies } from './opponent-tendencies';
export type { OpponentTendenciesResult } from './opponent-tendencies';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConceptParams } from '../types';
import type { ClassificationEntities } from '../../router/intent-classifier';

import { resolveTeamTendencies } from './team-tendencies';
import { resolveSituationAnalysis } from './situation-analysis';
import { resolveFormationEffectiveness } from './formation-effectiveness';
import { resolvePlayPerformance } from './play-performance';
import { resolveTrendAnalysis } from './trend-analysis';
import { resolvePlayerPerformance } from './player-performance';
import { resolveOLPerformance } from './ol-performance';
import { resolveDefensivePerformance } from './defensive-performance';
import { resolveSpecialTeamsPerformance } from './special-teams-performance';
import { fetchPlayInstances, fetchPlayers } from '../data-fetcher';

/**
 * Map topic from classification to concept resolver
 */
export async function resolveConceptForTopic(
  supabase: SupabaseClient,
  teamId: string,
  entities: ClassificationEntities
): Promise<string> {
  // Convert entities to params
  const params: ConceptParams = {
    timeframe: entities.timeframe,
    playType: entities.playType,
    down: entities.situation?.down,
    fieldZone: entities.situation?.fieldZone,
    formation: entities.formation,
    playerNumber: entities.player,
  };

  // Route to appropriate resolver based on topic
  const topic = entities.topic || 'tendencies';

  switch (topic) {
    case 'run_game':
      return resolveTrendAnalysis(supabase, teamId, { ...params, playType: 'run' });

    case 'pass_game':
      return resolveTrendAnalysis(supabase, teamId, { ...params, playType: 'pass' });

    case 'tendencies':
      return resolveTeamTendencies(supabase, teamId, params);

    case 'formations':
      return resolveFormationEffectiveness(supabase, teamId, params);

    case 'plays':
    case 'playbook':
      return resolvePlayPerformance(supabase, teamId, params);

    case 'player_stats':
      return resolvePlayerPerformance(supabase, teamId, params);

    case 'ol_performance':
    case 'offensive_line':
    case 'blocking':
    case 'linemen': {
      // Fetch plays and players for OL analysis
      const plays = await fetchPlayInstances(supabase, teamId, params);
      const players = await fetchPlayers(supabase, teamId);
      const olResult = resolveOLPerformance(plays, players);
      return olResult.summary + '\n\n**Recommendations:**\n' + olResult.recommendations.map(r => `- ${r}`).join('\n');
    }

    case 'defensive_performance':
    case 'defense':
    case 'tackling':
    case 'pass_rush':
    case 'coverage':
    case 'secondary': {
      // Fetch plays and players for defensive analysis
      const defPlays = await fetchPlayInstances(supabase, teamId, params);
      const defPlayers = await fetchPlayers(supabase, teamId);
      const defResult = resolveDefensivePerformance(defPlays, defPlayers);
      return defResult.summary + '\n\n**Recommendations:**\n' + defResult.recommendations.map(r => `- ${r}`).join('\n');
    }

    case 'special_teams':
    case 'kicking':
    case 'punting':
    case 'returns':
    case 'kickoff':
    case 'punt':
    case 'field_goal': {
      // Fetch plays and players for special teams analysis
      const stPlays = await fetchPlayInstances(supabase, teamId, params);
      const stPlayers = await fetchPlayers(supabase, teamId);
      const stResult = resolveSpecialTeamsPerformance(stPlays, stPlayers);
      return stResult.summary + '\n\n**Recommendations:**\n' + stResult.recommendations.map(r => `- ${r}`).join('\n');
    }

    case 'trends':
      return resolveTrendAnalysis(supabase, teamId, params);

    case 'situations':
    case 'third_down':
    case 'red_zone':
      return resolveSituationAnalysis(supabase, teamId, params);

    default:
      // If no specific topic, provide general tendencies
      return resolveTeamTendencies(supabase, teamId, params);
  }
}

/**
 * Get all relevant data for a comprehensive coaching analysis
 */
export async function getComprehensiveAnalysis(
  supabase: SupabaseClient,
  teamId: string
): Promise<string> {
  const sections: string[] = [];

  // Get tendencies
  try {
    const tendencies = await resolveTeamTendencies(supabase, teamId, { timeframe: 'season' });
    sections.push(tendencies);
  } catch (error) {
    console.error('Error getting tendencies:', error);
  }

  // Get play performance
  try {
    const plays = await resolvePlayPerformance(supabase, teamId, { timeframe: 'season' });
    sections.push(plays);
  } catch (error) {
    console.error('Error getting play performance:', error);
  }

  // Get trends
  try {
    const trends = await resolveTrendAnalysis(supabase, teamId, {});
    sections.push(trends);
  } catch (error) {
    console.error('Error getting trends:', error);
  }

  if (sections.length === 0) {
    return 'Unable to generate analysis. Please ensure you have tagged game film.';
  }

  return sections.join('\n\n---\n\n');
}
