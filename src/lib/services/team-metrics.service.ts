/**
 * Team Metrics Service
 *
 * Comprehensive football metrics calculation service.
 * Calculates all 28 metrics across offense, defense, special teams, and overall categories.
 *
 * Uses a single database function call for optimal performance (50-80ms).
 * Supports filtering by game, date range, and opponent.
 */

import { createClient } from '@/utils/supabase/server';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface MetricFilters {
  teamId: string;
  gameId?: string;
  startDate?: string;  // ISO date format: "2024-09-01"
  endDate?: string;    // ISO date format: "2024-11-30"
  opponent?: string;
  gamesPlayed?: number;
}

export interface OffensiveVolumeMetrics {
  totalYardsPerGame: number | null;
  rushingYardsPerGame: number | null;
  passingYardsPerGame: number | null;
  touchdowns: number;
  touchdownsPerGame: number | null;
  totalYards: number;
  rushingYards: number;
  passingYards: number;
}

export interface OffensiveEfficiencyMetrics {
  yardsPerPlay: number | null;
  yardsPerCarry: number | null;
  yardsPerCompletion: number | null;
  completionPercentage: number | null;
  thirdDownConversionRate: number | null;
  redZoneEfficiency: number | null;
  totalPlays: number;
  thirdDownAttempts: number;
  thirdDownConversions: number;
}

export interface OffensiveBallSecurityMetrics {
  turnovers: number;
  turnoversPerGame: number | null;
  fumbles: number;
  interceptions: number;
}

export interface OffensivePossessionMetrics {
  timeOfPossessionSeconds: number;
  timeOfPossessionPerGame: number | null;
  timeOfPossessionFormatted: string;  // "MM:SS" format
  averagePlayDuration: number | null;
}

export interface OffensiveMetrics {
  volume: OffensiveVolumeMetrics;
  efficiency: OffensiveEfficiencyMetrics;
  ballSecurity: OffensiveBallSecurityMetrics;
  possession: OffensivePossessionMetrics;
}

export interface DefensiveVolumeMetrics {
  totalYardsAllowedPerGame: number | null;
  rushingYardsAllowedPerGame: number | null;
  passingYardsAllowedPerGame: number | null;
  pointsAllowedPerGame: number | null;
  totalYardsAllowed: number;
  rushingYardsAllowed: number;
  passingYardsAllowed: number;
  pointsAllowed: number;
}

export interface DefensiveEfficiencyMetrics {
  yardsPerPlayAllowed: number | null;
  thirdDownStopPercentage: number | null;
  redZoneDefense: number | null;  // Opponent TD rate in red zone
  opponentThirdDownAttempts: number;
  opponentThirdDownStops: number;
}

export interface DefensiveDisruptiveMetrics {
  takeaways: number;
  takeawaysPerGame: number | null;
  interceptions: number;
  fumbleRecoveries: number;
  sacks: number;
  tacklesForLoss: number;
  forcedFumbles: number;
  passBreakups: number;
  havocRate: number | null;  // Percentage
}

export interface DefensiveMetrics {
  volume: DefensiveVolumeMetrics;
  efficiency: DefensiveEfficiencyMetrics;
  disruptive: DefensiveDisruptiveMetrics;
}

export interface SpecialTeamsMetrics {
  fieldGoalPercentage: number | null;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  extraPointPercentage: number | null;
  extraPointsMade: number;
  extraPointsAttempted: number;
  puntReturnAverage: number | null;
  puntReturns: number;
  puntReturnYards: number;
  kickoffReturnAverage: number | null;
  kickoffReturns: number;
  kickoffReturnYards: number;
  averageStartingFieldPosition: number | null;
}

export interface OverallTeamMetrics {
  turnoverDifferential: number;
  turnoverMargin: number;  // Alias for differential
  gamesPlayed: number;
}

export interface ComprehensiveTeamMetrics {
  filters: MetricFilters;
  offense: OffensiveMetrics;
  defense: DefensiveMetrics;
  specialTeams: SpecialTeamsMetrics;
  overall: OverallTeamMetrics;
}

// ============================================================================
// Service Class
// ============================================================================

export class TeamMetricsService {
  /**
   * Calculate comprehensive metrics for a team
   *
   * @param filters - Filter criteria for metrics calculation
   * @returns All 28 metrics organized by category
   *
   * @example
   * // Season-level metrics
   * const metrics = await TeamMetricsService.getComprehensiveMetrics({
   *   teamId: 'uuid-here'
   * });
   *
   * @example
   * // Single game metrics
   * const gameMetrics = await TeamMetricsService.getComprehensiveMetrics({
   *   teamId: 'uuid-here',
   *   gameId: 'game-uuid-here'
   * });
   *
   * @example
   * // Metrics vs specific opponent
   * const opponentMetrics = await TeamMetricsService.getComprehensiveMetrics({
   *   teamId: 'uuid-here',
   *   opponent: 'Vikings'
   * });
   */
  static async getComprehensiveMetrics(
    filters: Omit<MetricFilters, 'gamesPlayed'>
  ): Promise<ComprehensiveTeamMetrics> {
    const supabase = createClient();

    try {
      const { data, error } = await supabase.rpc('calculate_team_metrics', {
        p_team_id: filters.teamId,
        p_game_id: filters.gameId || null,
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_opponent: filters.opponent || null,
      });

      if (error) {
        console.error('Error calculating team metrics:', error);
        throw new Error(`Failed to calculate metrics: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from metrics calculation');
      }

      return data as ComprehensiveTeamMetrics;
    } catch (err) {
      console.error('TeamMetricsService error:', err);
      throw err;
    }
  }

  /**
   * Get offensive metrics only
   */
  static async getOffensiveMetrics(
    filters: Omit<MetricFilters, 'gamesPlayed'>
  ): Promise<OffensiveMetrics> {
    const metrics = await this.getComprehensiveMetrics(filters);
    return metrics.offense;
  }

  /**
   * Get defensive metrics only
   */
  static async getDefensiveMetrics(
    filters: Omit<MetricFilters, 'gamesPlayed'>
  ): Promise<DefensiveMetrics> {
    const metrics = await this.getComprehensiveMetrics(filters);
    return metrics.defense;
  }

  /**
   * Get special teams metrics only
   */
  static async getSpecialTeamsMetrics(
    filters: Omit<MetricFilters, 'gamesPlayed'>
  ): Promise<SpecialTeamsMetrics> {
    const metrics = await this.getComprehensiveMetrics(filters);
    return metrics.specialTeams;
  }

  /**
   * Get turnover differential (quick helper)
   *
   * Most predictive single stat for wins.
   */
  static async getTurnoverDifferential(
    teamId: string,
    gameId?: string
  ): Promise<number> {
    const supabase = createClient();

    try {
      const { data, error } = await supabase.rpc('get_turnover_differential', {
        p_team_id: teamId,
        p_game_id: gameId || null,
      });

      if (error) {
        console.error('Error getting turnover differential:', error);
        throw new Error(`Failed to get turnover differential: ${error.message}`);
      }

      return data as number;
    } catch (err) {
      console.error('getTurnoverDifferential error:', err);
      throw err;
    }
  }

  /**
   * Compare metrics across multiple games
   *
   * @param teamId - Team to analyze
   * @param gameIds - Array of game IDs to compare
   * @returns Array of metrics, one per game
   */
  static async compareGameMetrics(
    teamId: string,
    gameIds: string[]
  ): Promise<ComprehensiveTeamMetrics[]> {
    const promises = gameIds.map(gameId =>
      this.getComprehensiveMetrics({ teamId, gameId })
    );

    return Promise.all(promises);
  }

  /**
   * Get season metrics for multiple teams (for comparison)
   */
  static async compareTeamMetrics(
    teamIds: string[]
  ): Promise<Record<string, ComprehensiveTeamMetrics>> {
    const promises = teamIds.map(async (teamId) => ({
      teamId,
      metrics: await this.getComprehensiveMetrics({ teamId }),
    }));

    const results = await Promise.all(promises);

    return results.reduce((acc, { teamId, metrics }) => {
      acc[teamId] = metrics;
      return acc;
    }, {} as Record<string, ComprehensiveTeamMetrics>);
  }

  /**
   * Helper: Format time of possession for display
   */
  static formatTimeOfPossession(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Helper: Check if metrics indicate good performance
   */
  static isGoodOffensivePerformance(metrics: OffensiveMetrics): boolean {
    const ypp = metrics.efficiency.yardsPerPlay || 0;
    const thirdDown = metrics.efficiency.thirdDownConversionRate || 0;
    const turnovers = metrics.ballSecurity.turnoversPerGame || 0;

    // Good offense: >5.5 YPP, >40% 3rd down, <1.5 TO/game
    return ypp > 5.5 && thirdDown > 40 && turnovers < 1.5;
  }

  /**
   * Helper: Check if metrics indicate good defensive performance
   */
  static isGoodDefensivePerformance(metrics: DefensiveMetrics): boolean {
    const yppAllowed = metrics.efficiency.yardsPerPlayAllowed || 999;
    const thirdDownStops = metrics.efficiency.thirdDownStopPercentage || 0;
    const takeaways = metrics.disruptive.takeawaysPerGame || 0;

    // Good defense: <5.0 YPP allowed, >60% 3rd down stops, >1.0 takeaway/game
    return yppAllowed < 5.0 && thirdDownStops > 60 && takeaways > 1.0;
  }
}

// ============================================================================
// Metric Definitions (for tooltips/help text)
// ============================================================================

export const METRIC_DEFINITIONS = {
  // Offensive Volume
  totalYardsPerGame: {
    title: 'Total Yards Per Game',
    description: 'Average offensive yards (rushing + passing) per game. Shows overall offensive production.',
    calculation: 'Total yards ÷ games played',
  },
  rushingYardsPerGame: {
    title: 'Rushing Yards Per Game',
    description: 'Average ground yards per game. Indicates run game effectiveness and ability to control clock.',
    calculation: 'Total rushing yards ÷ games played',
  },
  passingYardsPerGame: {
    title: 'Passing Yards Per Game',
    description: 'Average air yards per game. Shows passing attack productivity and explosiveness.',
    calculation: 'Total passing yards ÷ games played',
  },
  touchdowns: {
    title: 'Touchdowns',
    description: 'Total offensive TDs scored. The ultimate measure of finishing drives successfully.',
    calculation: 'Count of all offensive touchdowns',
  },

  // Offensive Efficiency
  yardsPerPlay: {
    title: 'Yards Per Play',
    description: 'More valuable than total yards—shows efficiency regardless of tempo or number of possessions.',
    calculation: 'Total yards ÷ total plays',
  },
  yardsPerCarry: {
    title: 'Yards Per Carry',
    description: 'Measures run game efficiency per touch.',
    calculation: 'Rushing yards ÷ rushing attempts',
  },
  yardsPerCompletion: {
    title: 'Yards Per Completion',
    description: 'Indicates big-play ability through the air.',
    calculation: 'Passing yards ÷ completions',
  },
  thirdDownConversionRate: {
    title: '3rd Down Conversion Rate',
    description: 'Critical for sustaining drives and maintaining possession.',
    calculation: '(3rd down conversions ÷ 3rd down attempts) × 100',
  },
  redZoneEfficiency: {
    title: 'Red Zone Efficiency',
    description: 'Measures ability to finish drives in scoring position (inside opponent\'s 20-yard line).',
    calculation: '(Red zone TDs ÷ red zone attempts) × 100',
  },

  // Ball Security
  turnovers: {
    title: 'Turnovers',
    description: 'Fumbles lost plus interceptions thrown. Game-changing negative plays that directly give opponent possession.',
    calculation: 'Fumbles lost + interceptions thrown',
  },

  // Possession
  timeOfPossession: {
    title: 'Time of Possession',
    description: 'Minutes and seconds offense controls the ball. Keeps defense rested and limits opponent opportunities.',
    calculation: 'Sum of play durations',
  },

  // Defensive Volume
  totalYardsAllowedPerGame: {
    title: 'Total Yards Allowed Per Game',
    description: 'Average yards surrendered per game. Overall defensive effectiveness measure.',
    calculation: 'Opponent yards ÷ games played',
  },
  pointsAllowedPerGame: {
    title: 'Points Allowed Per Game',
    description: 'The ultimate defensive measure—goal is to prevent scoring.',
    calculation: 'Opponent points ÷ games played',
  },

  // Defensive Efficiency
  yardsPerPlayAllowed: {
    title: 'Yards Per Play Allowed',
    description: 'Shows defensive efficiency regardless of opponent tempo.',
    calculation: 'Opponent yards ÷ opponent plays',
  },
  thirdDownStopPercentage: {
    title: '3rd Down Stop Percentage',
    description: 'Measures ability to get off the field and end opponent drives.',
    calculation: '(3rd downs stopped ÷ opponent 3rd downs) × 100',
  },
  redZoneDefense: {
    title: 'Red Zone Defense',
    description: 'Shows ability to limit damage when backed up.',
    calculation: '(Opponent RZ TDs ÷ opponent RZ attempts) × 100',
  },

  // Defensive Disruptive
  takeaways: {
    title: 'Takeaways',
    description: 'Interceptions plus fumble recoveries. Game-changing positive plays that create possession changes.',
    calculation: 'Interceptions + fumble recoveries',
  },
  sacks: {
    title: 'Sacks',
    description: 'Quarterback tackles behind the line. Forces lost yardage and disrupts passing rhythm.',
    calculation: 'Count of QB sacks',
  },
  tacklesForLoss: {
    title: 'Tackles For Loss (TFLs)',
    description: 'Any tackle behind the line of scrimmage. Shows penetration and playmaking in the backfield.',
    calculation: 'Count of tackles for loss',
  },
  havocRate: {
    title: 'Havoc Rate',
    description: 'Percentage of plays with disruptive impact (TFLs + sacks + FFs + PBUs).',
    calculation: '((TFLs + sacks + forced fumbles + pass breakups) ÷ defensive plays) × 100',
  },

  // Special Teams
  fieldGoalPercentage: {
    title: 'Field Goal Percentage',
    description: 'Crucial for capitalizing on stalled drives.',
    calculation: '(FGs made ÷ FG attempts) × 100',
  },
  puntReturnAverage: {
    title: 'Punt Return Average',
    description: 'Measures ability to gain field position on opponent punts.',
    calculation: 'Punt return yards ÷ number of returns',
  },
  averageStartingFieldPosition: {
    title: 'Average Starting Field Position',
    description: 'Huge impact on scoring probability. Better field position = easier scoring.',
    calculation: 'Average yard line where offensive drives begin',
  },

  // Overall
  turnoverDifferential: {
    title: 'Turnover Differential',
    description: 'Single best statistical predictor of wins. Positive differential correlates strongly with success.',
    calculation: 'Takeaways - turnovers',
  },
} as const;
