/**
 * Formation Effectiveness Concept Resolver
 *
 * Analyzes how different formations perform:
 * - Success rate by formation
 * - Yards per play by formation
 * - Best formations for specific situations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConceptParams, PlayData, FormationStats } from '../types';
import { fetchPlayInstances, filterToRecentGames } from '../data-fetcher';
import { calculateAggregatedStats } from '../metrics';

/**
 * Resolve formation effectiveness
 */
export async function resolveFormationEffectiveness(
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

  // Filter to plays with formation data
  const formationPlays = plays.filter((p) => p.playbook_play?.attributes?.formation);

  if (formationPlays.length === 0) {
    return 'No formation data available. Make sure plays are linked to playbook plays with formations.';
  }

  // If a specific situation is requested, filter to that
  if (params.down) {
    return formatFormationsByDown(formationPlays, params.down);
  }

  // General formation analysis
  return formatFormationAnalysis(formationPlays, plays.length);
}

function formatFormationAnalysis(plays: PlayData[], totalPlays: number): string {
  const lines: string[] = [];
  lines.push(`## Formation Effectiveness (${plays.length} plays with formations)\n`);

  // Group by formation
  const formationStats = calculateFormationStats(plays);

  // Sort by success rate (minimum 5 plays for ranking)
  const rankedFormations = formationStats
    .filter((f) => f.totalPlays >= 5)
    .sort((a, b) => b.successRate - a.successRate);

  if (rankedFormations.length === 0) {
    return 'Not enough plays per formation for meaningful analysis. Need at least 5 plays per formation.';
  }

  // Top performers
  lines.push('### Most Effective Formations');
  const top3 = rankedFormations.slice(0, 3);
  for (let i = 0; i < top3.length; i++) {
    const f = top3[i];
    const pct = Math.round((f.totalPlays / totalPlays) * 100);
    lines.push(`${i + 1}. **${f.formation}** (${f.totalPlays} plays, ${pct}% of offense)`);
    lines.push(`   - Success Rate: ${f.successRate.toFixed(1)}%`);
    lines.push(`   - Yards/Play: ${f.avgYards.toFixed(1)}`);
    if (f.explosivePlays > 0) {
      lines.push(`   - Explosive Plays: ${f.explosivePlays}`);
    }
  }
  lines.push('');

  // Formations needing work (if any have low success rates)
  const struggling = rankedFormations
    .filter((f) => f.successRate < 40 && f.totalPlays >= 5)
    .slice(0, 2);

  if (struggling.length > 0) {
    lines.push('### Formations to Evaluate');
    for (const f of struggling) {
      lines.push(`- **${f.formation}**: ${f.successRate.toFixed(1)}% success (${f.totalPlays} plays)`);
    }
    lines.push('');
  }

  // Run vs Pass by formation
  lines.push('### Formation Usage');
  const usageFormations = formationStats
    .sort((a, b) => b.totalPlays - a.totalPlays)
    .slice(0, 5);

  for (const f of usageFormations) {
    const pct = Math.round((f.totalPlays / totalPlays) * 100);
    lines.push(`- ${f.formation}: ${pct}% (${f.totalPlays} plays)`);
  }

  return lines.join('\n');
}

function formatFormationsByDown(plays: PlayData[], down: number): string {
  const downPlays = plays.filter((p) => p.down === down);

  if (downPlays.length === 0) {
    return `No ${getDownLabel(down)} plays with formation data found.`;
  }

  const lines: string[] = [];
  lines.push(`## Best Formations on ${getDownLabel(down)} (${downPlays.length} plays)\n`);

  // Calculate stats by formation
  const formationStats = calculateFormationStats(downPlays);

  // Sort by success rate (minimum 3 plays)
  const ranked = formationStats
    .filter((f) => f.totalPlays >= 3)
    .sort((a, b) => b.successRate - a.successRate);

  if (ranked.length === 0) {
    return `Not enough plays per formation on ${getDownLabel(down)} for analysis.`;
  }

  lines.push('### Ranked by Success Rate');
  for (let i = 0; i < Math.min(5, ranked.length); i++) {
    const f = ranked[i];
    lines.push(`${i + 1}. **${f.formation}**: ${f.successRate.toFixed(1)}% (${f.totalPlays} plays, ${f.avgYards.toFixed(1)} YPP)`);
  }

  return lines.join('\n');
}

function calculateFormationStats(plays: PlayData[]): FormationStats[] {
  const formationMap = new Map<string, PlayData[]>();

  for (const play of plays) {
    const formation = play.playbook_play?.attributes?.formation || 'Unknown';
    if (!formationMap.has(formation)) {
      formationMap.set(formation, []);
    }
    formationMap.get(formation)!.push(play);
  }

  const stats: FormationStats[] = [];

  for (const [formation, formPlays] of formationMap) {
    const agg = calculateAggregatedStats(formPlays);
    stats.push({
      formation,
      ...agg,
    });
  }

  return stats;
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
