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

  // ========================================
  // DEFENSIVE METRICS
  // ========================================

  havocRate: {
    name: 'Havoc Rate',
    description: 'Percentage of defensive plays resulting in TFL, sack, PBU, INT, or forced fumble',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const defensivePlays = plays.filter((p) => p.is_opponent_play === true);
      if (defensivePlays.length === 0) return null;

      const havocPlays = defensivePlays.filter(
        (p) => p.is_tfl || p.is_sack || p.is_pbu || p.is_forced_fumble
      ).length;
      return (havocPlays / defensivePlays.length) * 100;
    },
  },

  pressureRate: {
    name: 'Pressure Rate',
    description: 'Percentage of pass plays where defense generated pressure or sack',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const defensivePassPlays = plays.filter(
        (p) => p.is_opponent_play === true && p.play_type === 'pass'
      );
      if (defensivePassPlays.length === 0) return null;

      const pressurePlays = defensivePassPlays.filter(
        (p) =>
          p.is_sack ||
          (p.pressure_player_ids && p.pressure_player_ids.length > 0)
      ).length;
      return (pressurePlays / defensivePassPlays.length) * 100;
    },
  },

  sackRate: {
    name: 'Sack Rate',
    description: 'Percentage of pass plays resulting in a sack',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const defensivePassPlays = plays.filter(
        (p) => p.is_opponent_play === true && p.play_type === 'pass'
      );
      if (defensivePassPlays.length === 0) return null;

      const sacks = defensivePassPlays.filter((p) => p.is_sack === true).length;
      return (sacks / defensivePassPlays.length) * 100;
    },
  },

  tflRate: {
    name: 'TFL Rate',
    description: 'Percentage of run plays resulting in a tackle for loss',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const defensiveRunPlays = plays.filter(
        (p) => p.is_opponent_play === true && p.play_type === 'run'
      );
      if (defensiveRunPlays.length === 0) return null;

      const tfls = defensiveRunPlays.filter((p) => p.is_tfl === true).length;
      return (tfls / defensiveRunPlays.length) * 100;
    },
  },

  yardsAllowedPerPlay: {
    name: 'Yards Allowed Per Play',
    description: 'Average yards allowed per defensive play',
    unit: 'yards',
    calculate: (plays: PlayData[]) => {
      const defensivePlays = plays.filter(
        (p) => p.is_opponent_play === true && p.yards_gained !== null
      );
      if (defensivePlays.length === 0) return null;

      const totalYards = defensivePlays.reduce(
        (sum, p) => sum + (p.yards_gained ?? 0),
        0
      );
      return totalYards / defensivePlays.length;
    },
  },

  opposingSuccessRate: {
    name: 'Opposing Success Rate',
    description: 'Success rate allowed to opponents (lower is better)',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const defensivePlays = plays.filter(
        (p) => p.is_opponent_play === true && p.success !== null
      );
      if (defensivePlays.length === 0) return null;

      const successfulOpponentPlays = defensivePlays.filter(
        (p) => p.success === true
      ).length;
      return (successfulOpponentPlays / defensivePlays.length) * 100;
    },
  },

  // ========================================
  // SPECIAL TEAMS METRICS
  // ========================================

  fieldGoalPercentage: {
    name: 'Field Goal Percentage',
    description: 'Percentage of field goal attempts made',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const fgAttempts = plays.filter(
        (p) => p.special_teams_unit === 'field_goal' && p.kick_result !== null
      );
      if (fgAttempts.length === 0) return null;

      const made = fgAttempts.filter((p) => p.kick_result === 'made').length;
      return (made / fgAttempts.length) * 100;
    },
  },

  patPercentage: {
    name: 'PAT Percentage',
    description: 'Percentage of extra point attempts made',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const patAttempts = plays.filter(
        (p) => p.special_teams_unit === 'pat' && p.kick_result !== null
      );
      if (patAttempts.length === 0) return null;

      const made = patAttempts.filter((p) => p.kick_result === 'made').length;
      return (made / patAttempts.length) * 100;
    },
  },

  puntAverage: {
    name: 'Punt Average',
    description: 'Average yards per punt',
    unit: 'yards',
    calculate: (plays: PlayData[]) => {
      const punts = plays.filter(
        (p) => p.special_teams_unit === 'punt' && p.kick_distance !== null
      );
      if (punts.length === 0) return null;

      const totalYards = punts.reduce((sum, p) => sum + (p.kick_distance ?? 0), 0);
      return totalYards / punts.length;
    },
  },

  netPuntAverage: {
    name: 'Net Punt Average',
    description: 'Average net yards per punt (gross minus return yards)',
    unit: 'yards',
    calculate: (plays: PlayData[]) => {
      const punts = plays.filter(
        (p) => p.special_teams_unit === 'punt' && p.kick_distance !== null
      );
      if (punts.length === 0) return null;

      const netYards = punts.reduce((sum, p) => {
        const gross = p.kick_distance ?? 0;
        const returnYds = p.return_yards ?? 0;
        return sum + (gross - returnYds);
      }, 0);
      return netYards / punts.length;
    },
  },

  kickoffTouchbackRate: {
    name: 'Kickoff Touchback Rate',
    description: 'Percentage of kickoffs resulting in touchback',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const kickoffs = plays.filter((p) => p.special_teams_unit === 'kickoff');
      if (kickoffs.length === 0) return null;

      const touchbacks = kickoffs.filter((p) => p.is_touchback === true).length;
      return (touchbacks / kickoffs.length) * 100;
    },
  },

  kickReturnAverage: {
    name: 'Kick Return Average',
    description: 'Average yards per kick return',
    unit: 'yards',
    calculate: (plays: PlayData[]) => {
      const returns = plays.filter(
        (p) =>
          p.special_teams_unit === 'kick_return' &&
          p.return_yards !== null &&
          p.is_fair_catch !== true &&
          p.is_touchback !== true
      );
      if (returns.length === 0) return null;

      const totalYards = returns.reduce((sum, p) => sum + (p.return_yards ?? 0), 0);
      return totalYards / returns.length;
    },
  },

  puntReturnAverage: {
    name: 'Punt Return Average',
    description: 'Average yards per punt return',
    unit: 'yards',
    calculate: (plays: PlayData[]) => {
      const returns = plays.filter(
        (p) =>
          p.special_teams_unit === 'punt_return' &&
          p.return_yards !== null &&
          p.is_fair_catch !== true
      );
      if (returns.length === 0) return null;

      const totalYards = returns.reduce((sum, p) => sum + (p.return_yards ?? 0), 0);
      return totalYards / returns.length;
    },
  },

  fairCatchRate: {
    name: 'Fair Catch Rate',
    description: 'Percentage of punt returns that are fair catches',
    unit: 'percentage',
    calculate: (plays: PlayData[]) => {
      const puntReturns = plays.filter((p) => p.special_teams_unit === 'punt_return');
      if (puntReturns.length === 0) return null;

      const fairCatches = puntReturns.filter((p) => p.is_fair_catch === true).length;
      return (fairCatches / puntReturns.length) * 100;
    },
  },
};
