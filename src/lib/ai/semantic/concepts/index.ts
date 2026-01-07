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

export { resolveSchedule, resolveRecord, resolveNextGame, resolvePastGames } from './schedule';
export type { ScheduleResult } from './schedule';

export { resolvePlaybookBrowse, resolvePlaybookSearch, resolvePlayRecommendations, findPlayByName } from './playbook';
export type { PlaybookSearchResult } from './playbook';

export { resolvePracticeSchedule, resolveLastPractice, resolveNextPractice, resolvePastPractices, resolveUpcomingPractices, resolvePracticeStats, resolveLastPracticeDetails, resolveNextPracticeDetails, resolvePracticeDrills, resolvePracticeEquipment, formatPracticeDetails } from './practice';
export type { PracticeResult } from './practice';

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
import { resolveOpponentTendencies } from './opponent-tendencies';
import { resolveSchedule, resolveRecord, resolveNextGame, resolvePastGames } from './schedule';
import { resolvePlaybookBrowse, resolvePlaybookSearch } from './playbook';
import { resolvePracticeSchedule, resolveLastPractice, resolveNextPractice, resolvePastPractices, resolveUpcomingPractices, resolvePracticeStats, resolveLastPracticeDetails, resolveNextPracticeDetails, resolvePracticeDrills, resolvePracticeEquipment } from './practice';
import { fetchPlayInstances, fetchPlayers, fetchOpponentsWithScoutingData, matchOpponentName, fetchAllGames, fetchPlaybookPlays, fetchPracticePlansWithDetails, fetchLastPracticeWithDetails, fetchNextPracticeWithDetails } from '../data-fetcher';

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
    opponent: entities.opponent,
    // Playbook search params
    targetPosition: entities.targetPosition,
    concept: entities.concept,
    personnel: entities.personnel,
    odk: entities.odk,
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

    case 'opponent_scouting':
    case 'opponent_tendencies':
    case 'opponent_weaknesses':
    case 'game_plan':
    case 'strategy':
    case 'exploit': {
      // Get all plays (we'll filter to opponent plays in the resolver)
      const allPlays = await fetchPlayInstances(supabase, teamId, {});
      const allGames = await fetchAllGames(supabase, teamId);

      // Get available opponents with scouting data
      const availableOpponents = await fetchOpponentsWithScoutingData(supabase, teamId);

      if (availableOpponents.length === 0) {
        return `**No Opponent Scouting Data Available**\n\nYou haven't tagged any opponent plays yet. To get opponent analysis:\n\n1. Go to Film → select a game\n2. When tagging plays, mark opponent plays as "Opponent Play"\n3. The AI will then be able to analyze their tendencies and weaknesses\n\nAvailable reports:\n- Opponent Scouting Report in Analytics\n- Ask me about opponent tendencies once you have tagged opponent film`;
      }

      // Try to match the requested opponent
      let opponentName = entities.opponent || '';

      if (opponentName) {
        const matched = matchOpponentName(opponentName, availableOpponents);
        if (matched) {
          opponentName = matched;
        } else {
          // Couldn't find a match - list available opponents
          return `**Opponent "${opponentName}" Not Found**\n\nI don't have scouting data for "${opponentName}". Here are the opponents I have film on:\n\n${availableOpponents.map(o => `• ${o}`).join('\n')}\n\nTry asking about one of these opponents, like: "How can I exploit the ${availableOpponents[0]}?"`;
        }
      } else {
        // No specific opponent requested - use the one with most data or ask
        opponentName = availableOpponents[0];
      }

      // Run opponent tendencies analysis
      const result = resolveOpponentTendencies(allPlays, opponentName, allGames);

      if (!result.hasData) {
        return result.summary;
      }

      // Build comprehensive response
      let response = result.summary + '\n\n';
      response += '**Practice Recommendations:**\n';
      response += result.practiceRecommendations.map(r => `• ${r}`).join('\n');

      return response;
    }

    case 'schedule':
    case 'games':
    case 'upcoming_games': {
      const allGames = await fetchAllGames(supabase, teamId);
      const result = resolveSchedule(allGames, params);
      return result.summary;
    }

    case 'record': {
      const allGames = await fetchAllGames(supabase, teamId);
      return resolveRecord(allGames);
    }

    case 'next_game': {
      const allGames = await fetchAllGames(supabase, teamId);
      return resolveNextGame(allGames);
    }

    case 'past_games':
    case 'game_results': {
      const allGames = await fetchAllGames(supabase, teamId);
      return resolvePastGames(allGames);
    }

    case 'playbook':
    case 'playbook_browse': {
      // Fetch plays based on ODK, or all plays if not specified
      const plays = await fetchPlaybookPlays(supabase, teamId, params.odk ? { odk: params.odk } : undefined);
      const result = resolvePlaybookBrowse(plays, params);
      return result.summary;
    }

    case 'playbook_search':
    case 'play_recommendation': {
      // Fetch plays based on ODK, default to offense if not specified
      const odkFilter = params.odk || 'offense';
      const plays = await fetchPlaybookPlays(supabase, teamId, { odk: odkFilter });
      const result = resolvePlaybookSearch(plays, {
        targetPosition: params.targetPosition,
        concept: params.concept,
        personnel: params.personnel,
        playType: params.playType as 'run' | 'pass' | undefined,
        formation: params.formation,
      });
      return result.summary;
    }

    case 'practice':
    case 'practice_schedule': {
      const practices = await fetchPracticePlansWithDetails(supabase, teamId);
      const result = resolvePracticeSchedule(practices, params);
      return result.summary;
    }

    case 'last_practice': {
      const practices = await fetchPracticePlansWithDetails(supabase, teamId);
      return resolveLastPractice(practices);
    }

    case 'next_practice': {
      const practices = await fetchPracticePlansWithDetails(supabase, teamId);
      return resolveNextPractice(practices);
    }

    case 'upcoming_practices': {
      const practices = await fetchPracticePlansWithDetails(supabase, teamId);
      return resolveUpcomingPractices(practices);
    }

    case 'past_practices': {
      const practices = await fetchPracticePlansWithDetails(supabase, teamId);
      return resolvePastPractices(practices);
    }

    case 'last_practice_details':
    case 'practice_drills': {
      const lastPractice = await fetchLastPracticeWithDetails(supabase, teamId);
      return resolveLastPracticeDetails(lastPractice);
    }

    case 'next_practice_details': {
      const nextPractice = await fetchNextPracticeWithDetails(supabase, teamId);
      return resolveNextPracticeDetails(nextPractice);
    }

    case 'practice_equipment': {
      // Default to last practice for equipment queries
      const practiceForEquipment = await fetchLastPracticeWithDetails(supabase, teamId);
      return resolvePracticeEquipment(practiceForEquipment);
    }

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
