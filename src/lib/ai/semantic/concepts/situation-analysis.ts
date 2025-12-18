/**
 * Situation Analysis Concept Resolver
 *
 * Analyzes performance in specific down and distance situations:
 * - 1st and 10
 * - 3rd and short/medium/long
 * - Red zone
 * - Goal line
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConceptParams, PlayData, AggregatedStats, SituationStats } from '../types';
import { fetchPlayInstances, filterToRecentGames } from '../data-fetcher';
import { calculateAggregatedStats } from '../metrics';

/**
 * Resolve situation analysis
 */
export async function resolveSituationAnalysis(
  supabase: SupabaseClient,
  teamId: string,
  params: ConceptParams = {}
): Promise<string> {
  // Fetch all plays
  let plays = await fetchPlayInstances(supabase, teamId, {});

  // Filter to recent games if requested
  if (params.timeframe === 'recent') {
    plays = filterToRecentGames(plays, 2);
  }

  if (plays.length === 0) {
    return 'No play data available for analysis. Make sure you have tagged some game film.';
  }

  // If a specific down is requested, analyze that
  if (params.down) {
    return formatDownAnalysis(plays, params.down, params.distance);
  }

  // If a specific field zone is requested
  if (params.fieldZone) {
    return formatFieldZoneAnalysis(plays, params.fieldZone);
  }

  // Otherwise, provide comprehensive situation breakdown
  return formatComprehensiveSituationAnalysis(plays);
}

function formatDownAnalysis(plays: PlayData[], down: number, distance?: string): string {
  const downPlays = plays.filter((p) => p.down === down);

  if (downPlays.length === 0) {
    return `No ${getDownLabel(down)} plays found in the data.`;
  }

  const lines: string[] = [];
  lines.push(`## ${getDownLabel(down)} Analysis (${downPlays.length} plays)\n`);

  // Overall stats for this down
  const overall = calculateAggregatedStats(downPlays);
  lines.push(`**Overall**: ${overall.successRate.toFixed(1)}% success, ${overall.avgYards.toFixed(1)} yards/play\n`);

  // Break down by distance
  const shortPlays = downPlays.filter((p) => p.distance !== null && p.distance <= 3);
  const mediumPlays = downPlays.filter((p) => p.distance !== null && p.distance >= 4 && p.distance <= 6);
  const longPlays = downPlays.filter((p) => p.distance !== null && p.distance >= 7);

  lines.push('### By Distance');

  if (shortPlays.length > 0) {
    const shortStats = calculateAggregatedStats(shortPlays);
    const runPct = calculateRunPassSplit(shortPlays);
    lines.push(`- **Short (1-3 yds)**: ${shortPlays.length} plays, ${shortStats.successRate.toFixed(1)}% success (${runPct.run}% run / ${runPct.pass}% pass)`);
  }

  if (mediumPlays.length > 0) {
    const medStats = calculateAggregatedStats(mediumPlays);
    const runPct = calculateRunPassSplit(mediumPlays);
    lines.push(`- **Medium (4-6 yds)**: ${mediumPlays.length} plays, ${medStats.successRate.toFixed(1)}% success (${runPct.run}% run / ${runPct.pass}% pass)`);
  }

  if (longPlays.length > 0) {
    const longStats = calculateAggregatedStats(longPlays);
    const runPct = calculateRunPassSplit(longPlays);
    lines.push(`- **Long (7+ yds)**: ${longPlays.length} plays, ${longStats.successRate.toFixed(1)}% success (${runPct.run}% run / ${runPct.pass}% pass)`);
  }

  lines.push('');

  // Run vs Pass comparison
  const runPlays = downPlays.filter((p) => p.play_type === 'run');
  const passPlays = downPlays.filter((p) => ['pass', 'screen', 'rpo'].includes(p.play_type || ''));

  if (runPlays.length > 0 && passPlays.length > 0) {
    lines.push('### Run vs Pass');
    const runStats = calculateAggregatedStats(runPlays);
    const passStats = calculateAggregatedStats(passPlays);

    lines.push(`- **Run**: ${runStats.successRate.toFixed(1)}% success, ${runStats.avgYards.toFixed(1)} YPC`);
    lines.push(`- **Pass**: ${passStats.successRate.toFixed(1)}% success, ${passStats.avgYards.toFixed(1)} YPA`);
  }

  return lines.join('\n');
}

function formatFieldZoneAnalysis(plays: PlayData[], fieldZone: string): string {
  let zonePlays: PlayData[];
  let zoneLabel: string;

  switch (fieldZone) {
    case 'red_zone':
      zonePlays = plays.filter((p) => p.yard_line !== null && p.yard_line >= 80);
      zoneLabel = 'Red Zone (Inside 20)';
      break;
    case 'scoring_position':
      zonePlays = plays.filter((p) => p.yard_line !== null && p.yard_line >= 70);
      zoneLabel = 'Scoring Position (Inside 30)';
      break;
    case 'midfield':
      zonePlays = plays.filter((p) => p.yard_line !== null && p.yard_line >= 40 && p.yard_line <= 60);
      zoneLabel = 'Midfield (40-60 yard line)';
      break;
    case 'own_territory':
      zonePlays = plays.filter((p) => p.yard_line !== null && p.yard_line < 50);
      zoneLabel = 'Own Territory';
      break;
    default:
      zonePlays = plays;
      zoneLabel = 'All Plays';
  }

  if (zonePlays.length === 0) {
    return `No plays found in ${zoneLabel}.`;
  }

  const lines: string[] = [];
  lines.push(`## ${zoneLabel} Analysis (${zonePlays.length} plays)\n`);

  const stats = calculateAggregatedStats(zonePlays);
  lines.push(`**Overall**: ${stats.successRate.toFixed(1)}% success, ${stats.avgYards.toFixed(1)} yards/play\n`);

  // Run/Pass split
  const runPct = calculateRunPassSplit(zonePlays);
  lines.push(`**Play Calling**: ${runPct.run}% run / ${runPct.pass}% pass\n`);

  // By play type
  const runPlays = zonePlays.filter((p) => p.play_type === 'run');
  const passPlays = zonePlays.filter((p) => ['pass', 'screen', 'rpo'].includes(p.play_type || ''));

  lines.push('### By Play Type');
  if (runPlays.length > 0) {
    const runStats = calculateAggregatedStats(runPlays);
    lines.push(`- **Run**: ${runStats.successRate.toFixed(1)}% success, ${runStats.avgYards.toFixed(1)} YPC`);
  }
  if (passPlays.length > 0) {
    const passStats = calculateAggregatedStats(passPlays);
    lines.push(`- **Pass**: ${passStats.successRate.toFixed(1)}% success, ${passStats.avgYards.toFixed(1)} YPA`);
  }

  return lines.join('\n');
}

function formatComprehensiveSituationAnalysis(plays: PlayData[]): string {
  const lines: string[] = [];
  lines.push(`## Situational Performance (${plays.length} plays)\n`);

  // Key situations
  const situations = [
    { name: '1st & 10', filter: (p: PlayData) => p.down === 1 && p.distance === 10 },
    { name: '2nd & Short', filter: (p: PlayData) => p.down === 2 && (p.distance ?? 0) <= 3 },
    { name: '2nd & Long', filter: (p: PlayData) => p.down === 2 && (p.distance ?? 0) >= 7 },
    { name: '3rd & Short', filter: (p: PlayData) => p.down === 3 && (p.distance ?? 0) <= 3 },
    { name: '3rd & Medium', filter: (p: PlayData) => p.down === 3 && (p.distance ?? 0) >= 4 && (p.distance ?? 0) <= 6 },
    { name: '3rd & Long', filter: (p: PlayData) => p.down === 3 && (p.distance ?? 0) >= 7 },
    { name: 'Red Zone', filter: (p: PlayData) => (p.yard_line ?? 0) >= 80 },
  ];

  for (const sit of situations) {
    const sitPlays = plays.filter(sit.filter);
    if (sitPlays.length >= 3) {
      const stats = calculateAggregatedStats(sitPlays);
      const runPct = calculateRunPassSplit(sitPlays);
      lines.push(`**${sit.name}**: ${sitPlays.length} plays, ${stats.successRate.toFixed(1)}% success (${runPct.run}/${runPct.pass} R/P)`);
    }
  }

  return lines.join('\n');
}

function calculateRunPassSplit(plays: PlayData[]): { run: number; pass: number } {
  const runs = plays.filter((p) => p.play_type === 'run').length;
  const passes = plays.filter((p) => ['pass', 'screen', 'rpo'].includes(p.play_type || '')).length;
  const total = runs + passes;

  if (total === 0) {
    return { run: 0, pass: 0 };
  }

  return {
    run: Math.round((runs / total) * 100),
    pass: Math.round((passes / total) * 100),
  };
}

function getDownLabel(down: number): string {
  switch (down) {
    case 1:
      return '1st Down';
    case 2:
      return '2nd Down';
    case 3:
      return '3rd Down';
    case 4:
      return '4th Down';
    default:
      return `${down} Down`;
  }
}
