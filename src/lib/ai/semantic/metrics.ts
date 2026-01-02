/**
 * Semantic Metrics
 *
 * Core metric calculations for coaching intelligence.
 * These follow standard football analytics formulas.
 */

import type { MetricDefinition, PlayData, AggregatedStats } from './types';

/**
 * Calculate success rate based on down and distance
 * - 1st down: 40% of distance = success
 * - 2nd down: 60% of distance = success
 * - 3rd/4th down: 100% of distance = success (first down)
 */
export function calculateSuccess(
  down: number | null,
  distance: number | null,
  yardsGained: number | null
): boolean | null {
  if (down === null || distance === null || yardsGained === null) {
    return null;
  }

  if (down === 1) {
    return yardsGained >= distance * 0.4;
  } else if (down === 2) {
    return yardsGained >= distance * 0.6;
  } else {
    // 3rd/4th down
    return yardsGained >= distance;
  }
}

/**
 * Calculate if a play is explosive
 * - Run: 12+ yards
 * - Pass: 16+ yards
 */
export function calculateExplosive(
  playType: string | null,
  yardsGained: number | null
): boolean | null {
  if (playType === null || yardsGained === null) {
    return null;
  }

  if (playType === 'run') {
    return yardsGained >= 12;
  } else if (['pass', 'screen', 'rpo'].includes(playType)) {
    return yardsGained >= 16;
  }

  return false;
}

/**
 * Calculate aggregated stats from play data
 */
export function calculateAggregatedStats(plays: PlayData[]): AggregatedStats {
  if (plays.length === 0) {
    return {
      totalPlays: 0,
      totalYards: 0,
      avgYards: 0,
      successRate: 0,
      explosiveRate: 0,
      successfulPlays: 0,
      explosivePlays: 0,
    };
  }

  const totalPlays = plays.length;
  const totalYards = plays.reduce((sum, p) => sum + (p.yards_gained ?? 0), 0);
  const avgYards = totalYards / totalPlays;

  // Count successful plays
  const successfulPlays = plays.filter((p) => p.success === true).length;
  const successRate = (successfulPlays / totalPlays) * 100;

  // Count explosive plays
  const explosivePlays = plays.filter((p) => p.explosive === true).length;
  const explosiveRate = (explosivePlays / totalPlays) * 100;

  return {
    totalPlays,
    totalYards,
    avgYards: Math.round(avgYards * 10) / 10,
    successRate: Math.round(successRate * 10) / 10,
    explosiveRate: Math.round(explosiveRate * 10) / 10,
    successfulPlays,
    explosivePlays,
  };
}

/**
 * Format stats as a readable string
 */
export function formatStats(stats: AggregatedStats, label?: string): string {
  const lines: string[] = [];

  if (label) {
    lines.push(`**${label}**`);
  }

  lines.push(`- Plays: ${stats.totalPlays}`);
  lines.push(`- Total Yards: ${stats.totalYards}`);
  lines.push(`- Yards/Play: ${stats.avgYards.toFixed(1)}`);
  lines.push(`- Success Rate: ${stats.successRate.toFixed(1)}%`);

  if (stats.explosivePlays > 0) {
    lines.push(`- Explosive Plays: ${stats.explosivePlays} (${stats.explosiveRate.toFixed(1)}%)`);
  }

  return lines.join('\n');
}

/**
 * Metric definitions for the semantic layer
 */
export const METRICS: Record<string, MetricDefinition> = {
  successRate: {
    name: 'Success Rate',
    description:
      'Percentage of plays that gain expected yardage based on down and distance',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const playsWithSuccess = plays.filter((p) => p.success !== null);
      if (playsWithSuccess.length === 0) return null;

      const successful = playsWithSuccess.filter((p) => p.success === true).length;
      return (successful / playsWithSuccess.length) * 100;
    },
  },

  yardsPerPlay: {
    name: 'Yards Per Play',
    description: 'Average yards gained per offensive play',
    unit: 'yards',
    calculate: (plays: PlayData[]) => {
      const playsWithYards = plays.filter((p) => p.yards_gained !== null);
      if (playsWithYards.length === 0) return null;

      const totalYards = playsWithYards.reduce(
        (sum, p) => sum + (p.yards_gained ?? 0),
        0
      );
      return totalYards / playsWithYards.length;
    },
  },

  explosivePlayRate: {
    name: 'Explosive Play Rate',
    description: 'Percentage of plays gaining 12+ yards (run) or 16+ yards (pass)',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const playsWithExplosive = plays.filter((p) => p.explosive !== null);
      if (playsWithExplosive.length === 0) return null;

      const explosive = playsWithExplosive.filter((p) => p.explosive === true).length;
      return (explosive / playsWithExplosive.length) * 100;
    },
  },

  runPassRatio: {
    name: 'Run/Pass Ratio',
    description: 'Percentage of plays that are runs vs passes',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const playsWithType = plays.filter((p) => p.play_type !== null);
      if (playsWithType.length === 0) return null;

      const runs = playsWithType.filter((p) => p.play_type === 'run').length;
      return (runs / playsWithType.length) * 100;
    },
  },

  thirdDownConversion: {
    name: 'Third Down Conversion Rate',
    description: 'Percentage of third downs converted to first downs',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const thirdDowns = plays.filter((p) => p.down === 3);
      if (thirdDowns.length === 0) return null;

      const converted = thirdDowns.filter((p) => p.success === true).length;
      return (converted / thirdDowns.length) * 100;
    },
  },

  redZoneEfficiency: {
    name: 'Red Zone Efficiency',
    description: 'Success rate of plays inside the opponent\'s 20-yard line',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const redZonePlays = plays.filter(
        (p) => p.yard_line !== null && p.yard_line >= 80
      );
      if (redZonePlays.length === 0) return null;

      const successful = redZonePlays.filter((p) => p.success === true).length;
      return (successful / redZonePlays.length) * 100;
    },
  },
};
