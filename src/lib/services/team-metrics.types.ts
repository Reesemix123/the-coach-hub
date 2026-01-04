/**
 * Team Metrics Types
 *
 * TypeScript interfaces and metric definitions for comprehensive football metrics.
 * Separated from the service file to allow client components to import types
 * without pulling in server-side dependencies.
 */

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

export interface KickoffMetrics {
  kickoffs: number;
  touchbacks: number;
  touchbackRate: number;
  averageKickoffYardLine: number;
}

export interface PuntMetrics {
  punts: number;
  totalYards: number;
  averagePuntYards: number;
  netPuntAverage: number;
}

export interface ReturnMetrics {
  returns: number;
  kickReturns: number;
  puntReturns: number;
  totalYards: number;
  averageReturnYards: number;
  longestReturn: number;
}

export interface FieldGoalMetrics {
  made: number;
  attempted: number;
  percentage: number;
  blocked: number;
}

export interface PATMetrics {
  made: number;
  attempted: number;
  percentage: number;
}

export interface FGBlockMetrics {
  blocks: number;
  blocksRecovered: number;
  blocksReturnedForTD: number;
}

export interface SpecialTeamsMetrics {
  // Legacy flat structure (kept for backward compatibility)
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

  // New structured metrics from RPC
  kickoff?: KickoffMetrics;
  punt?: PuntMetrics;
  returns?: ReturnMetrics;
  fieldGoal?: FieldGoalMetrics;
  pat?: PATMetrics;
  fgBlock?: FGBlockMetrics;
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
  interceptionsDefense: {
    title: 'Interceptions (Defense)',
    description: 'Passes caught by defensive players, ending the opponent\'s possession and creating scoring opportunities.',
    useful: 'Creates possession changes and potential return yards. One of the most impactful defensive plays.',
    calculation: 'Count of interceptions by defensive players',
  },
  fumbleRecoveries: {
    title: 'Fumble Recoveries',
    description: 'Loose balls recovered by the defense after opponent fumbles. Creates possession changes.',
    useful: 'While forced fumbles show aggression, recoveries are partly luck. Both matter for takeaways.',
    calculation: 'Count of fumbles recovered by defense',
  },
  passBreakups: {
    title: 'Pass Breakups (PBUs)',
    description: 'Passes defended or broken up by defensive backs, preventing completions.',
    useful: 'Shows coverage ability even when ball isn\'t intercepted. Great PBU rate often precedes interceptions.',
    calculation: 'Count of passes broken up or defended',
  },
  havocRate: {
    title: 'Havoc Rate',
    description: 'Percentage of plays with disruptive impact (TFLs + sacks + FFs + PBUs).',
    calculation: '((TFLs + sacks + forced fumbles + pass breakups) ÷ defensive plays) × 100',
  },

  // Special Teams - Kickoff
  kickoffs: {
    title: 'Total Kickoffs',
    description: 'Number of kickoffs performed by the team.',
    useful: 'Shows special teams volume and opportunities.',
    calculation: 'Count of kickoff plays',
  },
  touchbacks: {
    title: 'Touchbacks',
    description: 'Kickoffs that result in touchbacks, placing the ball at the 25-yard line.',
    useful: 'High touchback rate limits opponent return opportunities. Good kickers have 60%+.',
    calculation: 'Count of kickoffs with touchback result',
  },
  averageKickoffYardLine: {
    title: 'Average Starting Field Position',
    description: 'Average yard line where opponents start after kickoffs.',
    useful: 'Lower is better. Shows kickoff team effectiveness at limiting field position.',
    calculation: 'Average starting yard line after kickoff returns',
  },

  // Special Teams - Punt
  punts: {
    title: 'Total Punts',
    description: 'Number of punts performed by the team.',
    useful: 'Shows field position battles. More punts may indicate offensive struggles.',
    calculation: 'Count of punt plays',
  },
  averagePuntYards: {
    title: 'Average Punt Yards',
    description: 'Average gross yards per punt.',
    useful: 'Good punters average 40+ yards. Helps flip field position.',
    calculation: 'Total punt yards ÷ number of punts',
  },
  netPuntAverage: {
    title: 'Net Punt Average',
    description: 'Average net yards after accounting for returns.',
    useful: 'Better than gross average - accounts for coverage team performance. 35+ is good.',
    calculation: '(Punt yards - return yards) ÷ number of punts',
  },

  // Special Teams - Returns
  returns: {
    title: 'Total Returns',
    description: 'Combined kickoff and punt returns.',
    useful: 'Shows return opportunities. More returns = more chances for explosive plays.',
    calculation: 'Kickoff returns + punt returns',
  },
  averageReturnYards: {
    title: 'Average Return Yards',
    description: 'Average yards gained per return.',
    useful: 'Shows return unit effectiveness. 20+ on kickoffs, 10+ on punts is good.',
    calculation: 'Total return yards ÷ number of returns',
  },
  longestReturn: {
    title: 'Longest Return',
    description: 'Longest single return yardage.',
    useful: 'Shows explosive play potential in return game.',
    calculation: 'Maximum return yards in a single play',
  },

  // Special Teams - Field Goals
  fieldGoalPercentage: {
    title: 'Field Goal Percentage',
    description: 'Crucial for capitalizing on stalled drives.',
    useful: 'Shows kicker reliability. Elite kickers: 85%+. Game-changing in close games.',
    calculation: '(FGs made ÷ FG attempts) × 100',
  },
  fieldGoalsMade: {
    title: 'Field Goals Made',
    description: 'Number of successful field goals.',
    useful: 'Shows scoring ability when drives stall. Each FG is 3 points.',
    calculation: 'Count of made field goals',
  },
  fieldGoalsAttempted: {
    title: 'Field Goals Attempted',
    description: 'Total field goal attempts.',
    useful: 'Shows red zone opportunities and offensive drive finishing ability.',
    calculation: 'Count of all field goal attempts',
  },
  fieldGoalsBlocked: {
    title: 'Field Goals Blocked',
    description: 'Field goals blocked by the opponent.',
    useful: 'May indicate protection issues or slow operation. Review technique.',
    calculation: 'Count of blocked field goals',
  },

  // Special Teams - PAT
  patPercentage: {
    title: 'PAT Percentage',
    description: 'Extra point success rate.',
    useful: 'Should be near 100%. Missed PATs can cost games. Routine but critical.',
    calculation: '(PATs made ÷ PAT attempts) × 100',
  },
  patsMade: {
    title: 'PATs Made',
    description: 'Number of successful extra points.',
    useful: 'Shows touchdown conversion follow-through.',
    calculation: 'Count of made PATs',
  },
  patsAttempted: {
    title: 'PATs Attempted',
    description: 'Total extra point attempts.',
    useful: 'Equals number of touchdowns scored (minus 2-pt attempts).',
    calculation: 'Count of all PAT attempts',
  },

  // Special Teams - FG Block
  fgBlocks: {
    title: 'FG Blocks',
    description: 'Field goals blocked by your team.',
    useful: 'Game-changing plays. Denies 3 points and can create scoring opportunities.',
    calculation: 'Count of blocked field goals on defense',
  },
  fgBlocksReturnedForTD: {
    title: 'FG Blocks Returned for TD',
    description: 'Blocked field goals returned for touchdowns.',
    useful: 'Massive swing plays worth 9+ point differential.',
    calculation: 'Count of FG blocks returned for TDs',
  },

  // Legacy metrics
  puntReturnAverage: {
    title: 'Punt Return Average',
    description: 'Measures ability to gain field position on opponent punts.',
    useful: '10+ yards per return is good. Shows return game effectiveness.',
    calculation: 'Punt return yards ÷ number of returns',
  },
  averageStartingFieldPosition: {
    title: 'Average Starting Field Position',
    description: 'Huge impact on scoring probability. Better field position = easier scoring.',
    useful: 'Starting inside own 30 is tough. Own 35+ is good. Affects scoring probability.',
    calculation: 'Average yard line where offensive drives begin',
  },

  // Overall
  turnoverDifferential: {
    title: 'Turnover Differential',
    description: 'Single best statistical predictor of wins. Positive differential correlates strongly with success.',
    calculation: 'Takeaways - turnovers',
  },
} as const;
