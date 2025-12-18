/**
 * Team Tendencies Concept Resolver
 *
 * Analyzes overall team tendencies including:
 * - Run/pass ratio
 * - Formation preferences
 * - Down and distance tendencies
 * - Direction preferences
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConceptParams, PlayData, AggregatedStats } from '../types';
import { fetchPlayInstances, filterToRecentGames } from '../data-fetcher';
import { calculateAggregatedStats } from '../metrics';

interface TendencyData {
  overall: AggregatedStats;
  byPlayType: {
    run: AggregatedStats;
    pass: AggregatedStats;
  };
  byDown: Record<number, AggregatedStats & { runPct: number; passPct: number }>;
  byFormation: Record<string, AggregatedStats>;
  byDirection: Record<string, AggregatedStats>;
}

/**
 * Resolve team tendencies
 */
export async function resolveTeamTendencies(
  supabase: SupabaseClient,
  teamId: string,
  params: ConceptParams = {}
): Promise<string> {
  // Fetch play data
  let plays = await fetchPlayInstances(supabase, teamId, params);

  // Filter to recent games if requested
  if (params.timeframe === 'recent') {
    plays = filterToRecentGames(plays, 2);
  }

  if (plays.length === 0) {
    return 'No play data available for analysis. Make sure you have tagged some game film.';
  }

  // Calculate tendencies
  const tendencies = calculateTendencies(plays);

  // Format the response
  return formatTendencies(tendencies, plays.length);
}

function calculateTendencies(plays: PlayData[]): TendencyData {
  // Overall stats
  const overall = calculateAggregatedStats(plays);

  // By play type
  const runPlays = plays.filter((p) => p.play_type === 'run');
  const passPlays = plays.filter((p) => ['pass', 'screen', 'rpo'].includes(p.play_type || ''));

  const byPlayType = {
    run: calculateAggregatedStats(runPlays),
    pass: calculateAggregatedStats(passPlays),
  };

  // By down
  const byDown: Record<number, AggregatedStats & { runPct: number; passPct: number }> = {};
  for (let down = 1; down <= 4; down++) {
    const downPlays = plays.filter((p) => p.down === down);
    if (downPlays.length > 0) {
      const stats = calculateAggregatedStats(downPlays);
      const runs = downPlays.filter((p) => p.play_type === 'run').length;
      const passes = downPlays.filter((p) => ['pass', 'screen', 'rpo'].includes(p.play_type || '')).length;
      const total = runs + passes;

      byDown[down] = {
        ...stats,
        runPct: total > 0 ? Math.round((runs / total) * 100) : 0,
        passPct: total > 0 ? Math.round((passes / total) * 100) : 0,
      };
    }
  }

  // By formation
  const byFormation: Record<string, AggregatedStats> = {};
  const formationPlays = plays.filter((p) => p.playbook_play?.attributes?.formation);
  const formations = [...new Set(formationPlays.map((p) => p.playbook_play?.attributes?.formation || 'Unknown'))];

  for (const formation of formations) {
    const formPlays = formationPlays.filter(
      (p) => p.playbook_play?.attributes?.formation === formation
    );
    if (formPlays.length >= 3) {
      // Only include formations with enough data
      byFormation[formation] = calculateAggregatedStats(formPlays);
    }
  }

  // By direction
  const byDirection: Record<string, AggregatedStats> = {};
  const directionPlays = plays.filter((p) => p.direction);
  const directions = ['left', 'middle', 'right'];

  for (const dir of directions) {
    const dirPlays = directionPlays.filter((p) => p.direction === dir);
    if (dirPlays.length >= 3) {
      byDirection[dir] = calculateAggregatedStats(dirPlays);
    }
  }

  return {
    overall,
    byPlayType,
    byDown,
    byFormation,
    byDirection,
  };
}

function formatTendencies(data: TendencyData, totalPlays: number): string {
  const lines: string[] = [];

  lines.push(`## Team Tendencies (${totalPlays} plays analyzed)\n`);

  // Run/Pass split
  const runPct = data.byPlayType.run.totalPlays > 0
    ? Math.round((data.byPlayType.run.totalPlays / totalPlays) * 100)
    : 0;
  const passPct = 100 - runPct;

  lines.push('### Run/Pass Balance');
  lines.push(`- **Run**: ${runPct}% (${data.byPlayType.run.totalPlays} plays) - ${data.byPlayType.run.successRate.toFixed(1)}% success, ${data.byPlayType.run.avgYards.toFixed(1)} YPC`);
  lines.push(`- **Pass**: ${passPct}% (${data.byPlayType.pass.totalPlays} plays) - ${data.byPlayType.pass.successRate.toFixed(1)}% success, ${data.byPlayType.pass.avgYards.toFixed(1)} YPA`);
  lines.push('');

  // Down tendencies
  lines.push('### By Down');
  for (const [down, stats] of Object.entries(data.byDown)) {
    lines.push(`- **${getDownLabel(parseInt(down))}**: ${stats.runPct}% run / ${stats.passPct}% pass (${stats.successRate.toFixed(1)}% success)`);
  }
  lines.push('');

  // Top formations
  if (Object.keys(data.byFormation).length > 0) {
    lines.push('### Formation Usage');
    const sortedFormations = Object.entries(data.byFormation)
      .sort((a, b) => b[1].totalPlays - a[1].totalPlays)
      .slice(0, 5);

    for (const [formation, stats] of sortedFormations) {
      const pct = Math.round((stats.totalPlays / totalPlays) * 100);
      lines.push(`- **${formation}**: ${pct}% (${stats.totalPlays} plays) - ${stats.successRate.toFixed(1)}% success`);
    }
    lines.push('');
  }

  // Direction tendencies (if data available)
  if (Object.keys(data.byDirection).length > 0) {
    lines.push('### Direction Tendencies');
    for (const dir of ['left', 'middle', 'right']) {
      const stats = data.byDirection[dir];
      if (stats) {
        const pct = Math.round((stats.totalPlays / totalPlays) * 100);
        lines.push(`- **${capitalize(dir)}**: ${pct}% (${stats.successRate.toFixed(1)}% success)`);
      }
    }
  }

  return lines.join('\n');
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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
