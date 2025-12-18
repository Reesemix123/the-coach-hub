/**
 * Play Performance Concept Resolver
 *
 * Analyzes how specific plays from the playbook perform:
 * - Success rate by play
 * - Best and worst performing plays
 * - Play recommendations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConceptParams, PlayData, PlayConceptStats } from '../types';
import { fetchPlayInstances, filterToRecentGames } from '../data-fetcher';
import { calculateAggregatedStats } from '../metrics';

/**
 * Resolve play performance analysis
 */
export async function resolvePlayPerformance(
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

  // Filter to plays with play codes
  const codedPlays = plays.filter((p) => p.play_code && p.playbook_play);

  if (codedPlays.length === 0) {
    return 'No plays linked to playbook. Make sure plays are tagged with play codes from your playbook.';
  }

  // Analyze play performance
  return formatPlayPerformance(codedPlays, params.playType);
}

function formatPlayPerformance(plays: PlayData[], playTypeFilter?: 'run' | 'pass' | 'all'): string {
  const lines: string[] = [];

  // Calculate stats by play
  const playStats = calculatePlayStats(plays);

  // Filter by play type if requested
  let filteredStats = playStats;
  if (playTypeFilter && playTypeFilter !== 'all') {
    filteredStats = playStats.filter((p) => {
      if (playTypeFilter === 'run') {
        return p.playType === 'Run';
      } else {
        return ['Pass', 'Screen', 'RPO'].includes(p.playType);
      }
    });
  }

  // Sort by success rate (minimum 3 executions)
  const rankedPlays = filteredStats
    .filter((p) => p.totalPlays >= 3)
    .sort((a, b) => b.successRate - a.successRate);

  if (rankedPlays.length === 0) {
    return 'Not enough play execution data. Each play needs at least 3 executions for analysis.';
  }

  lines.push(`## Play Performance Analysis (${plays.length} plays)\n`);

  // Top performers
  const topPlays = rankedPlays.slice(0, 5);
  lines.push('### Top Performing Plays');
  for (let i = 0; i < topPlays.length; i++) {
    const p = topPlays[i];
    lines.push(`${i + 1}. **${p.playName}** (${p.playCode})`);
    lines.push(`   - ${p.totalPlays} executions, ${p.successRate.toFixed(1)}% success`);
    lines.push(`   - ${p.avgYards.toFixed(1)} yards/play, ${p.totalYards} total yards`);
    if (p.explosivePlays > 0) {
      lines.push(`   - ${p.explosivePlays} explosive play(s)`);
    }
  }
  lines.push('');

  // Plays to consider using more
  const underused = rankedPlays
    .filter((p) => p.successRate >= 50 && p.totalPlays <= 8)
    .slice(0, 3);

  if (underused.length > 0) {
    lines.push('### Consider Using More');
    for (const p of underused) {
      lines.push(`- **${p.playName}**: ${p.successRate.toFixed(1)}% success but only ${p.totalPlays} calls`);
    }
    lines.push('');
  }

  // Plays that may need work
  const struggling = rankedPlays
    .filter((p) => p.successRate < 35 && p.totalPlays >= 5)
    .slice(0, 3);

  if (struggling.length > 0) {
    lines.push('### Plays to Evaluate');
    for (const p of struggling) {
      lines.push(`- **${p.playName}**: ${p.successRate.toFixed(1)}% success (${p.totalPlays} attempts, ${p.avgYards.toFixed(1)} YPP)`);
    }
    lines.push('');
  }

  // Run vs Pass breakdown
  const runPlays = rankedPlays.filter((p) => p.playType === 'Run');
  const passPlays = rankedPlays.filter((p) => ['Pass', 'Screen', 'RPO'].includes(p.playType));

  if (runPlays.length > 0 && passPlays.length > 0) {
    lines.push('### Best by Play Type');

    // Best run play
    const bestRun = runPlays[0];
    lines.push(`- **Best Run**: ${bestRun.playName} (${bestRun.successRate.toFixed(1)}% success, ${bestRun.avgYards.toFixed(1)} YPC)`);

    // Best pass play
    const bestPass = passPlays[0];
    lines.push(`- **Best Pass**: ${bestPass.playName} (${bestPass.successRate.toFixed(1)}% success, ${bestPass.avgYards.toFixed(1)} YPA)`);
  }

  return lines.join('\n');
}

function calculatePlayStats(plays: PlayData[]): PlayConceptStats[] {
  const playMap = new Map<string, PlayData[]>();

  for (const play of plays) {
    const playCode = play.play_code || 'Unknown';
    if (!playMap.has(playCode)) {
      playMap.set(playCode, []);
    }
    playMap.get(playCode)!.push(play);
  }

  const stats: PlayConceptStats[] = [];

  for (const [playCode, playInstances] of playMap) {
    const agg = calculateAggregatedStats(playInstances);
    const first = playInstances[0];
    const playName = first.playbook_play?.play_name || playCode;
    const playType = first.playbook_play?.attributes?.playType || 'Unknown';

    stats.push({
      playCode,
      playName,
      playType,
      ...agg,
    });
  }

  return stats;
}
