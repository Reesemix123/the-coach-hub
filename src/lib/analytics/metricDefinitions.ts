/**
 * Analytics Metric Definitions
 *
 * Comprehensive explanations for all analytics metrics.
 * Used in tooltips throughout the analytics dashboard.
 *
 * Each metric includes:
 * - title: Display name
 * - description: What it measures
 * - useful: Why coaches should care
 * - calculation: How it's computed
 */

export interface MetricDefinition {
  title: string;
  description: string;
  useful: string;
  calculation: string;
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  // Basic Performance Metrics
  totalPlays: {
    title: 'Total Plays',
    description: 'Total number of offensive plays run',
    useful: 'Shows pace of play and overall offensive volume. More plays typically mean more opportunities to score.',
    calculation: 'Count of all play instances for your team',
  },

  yardsPerPlay: {
    title: 'Yards Per Play (YPP)',
    description: 'Average yards gained on each play',
    useful: 'Key efficiency metric. High YPP means explosive offense. NFL average is ~5.5 yards.',
    calculation: 'Total yards gained ÷ Total plays',
  },

  successRate: {
    title: 'Success Rate',
    description: 'Percentage of plays that gain "expected" yards for the down and distance',
    useful: 'Better than YPP for measuring offensive effectiveness. High success rate means consistently moving chains.',
    calculation: '1st down: gain 40% of distance | 2nd down: 60% | 3rd/4th: 100% (convert)',
  },

  firstDowns: {
    title: 'First Downs',
    description: 'Total number of first downs earned',
    useful: 'Shows ability to sustain drives and maintain possession. More first downs = more scoring opportunities.',
    calculation: 'Count of plays that resulted in a first down',
  },

  // Down-Specific Metrics
  firstDownSuccess: {
    title: '1st Down Success Rate',
    description: 'Success rate specifically on first down plays',
    useful: 'Starting drives strong puts offense ahead of schedule. Target: 45%+',
    calculation: 'Plays gaining 40%+ of distance ÷ Total 1st down plays',
  },

  secondDownSuccess: {
    title: '2nd Down Success Rate',
    description: 'Success rate specifically on second down plays',
    useful: 'Shows ability to stay ahead of schedule. 2nd-and-short is much easier than 2nd-and-long. Target: 50%+',
    calculation: 'Plays gaining 60%+ of distance ÷ Total 2nd down plays',
  },

  thirdDownConversion: {
    title: '3rd Down Conversion Rate',
    description: 'Percentage of third downs converted to first downs',
    useful: 'Most critical down. High conversion rate = sustained drives = more points. NFL average: ~40%',
    calculation: 'Conversions (gained 100% of distance) ÷ Total 3rd down plays',
  },

  redZoneTD: {
    title: 'Red Zone TD Rate',
    description: 'Percentage of red zone possessions that result in touchdowns',
    useful: 'Shows ability to finish drives. TDs worth 4 more points than FGs. Elite offenses: 60%+',
    calculation: 'Touchdowns scored from inside 20-yard line ÷ Total red zone possessions',
  },

  // Drive Analytics (Tier 2+)
  pointsPerDrive: {
    title: 'Points Per Drive (PPD)',
    description: 'Average points scored per offensive possession',
    useful: 'Best single metric for offensive productivity. Elite offenses: 2.5+ PPD',
    calculation: 'Total points scored ÷ Total drives (excludes end-of-half)',
  },

  threeAndOutRate: {
    title: '3-and-Out Rate',
    description: 'Percentage of drives that end after only 3 plays',
    useful: 'Shows offensive sustainability. High rate = giving ball back quickly = bad. Target: <20%',
    calculation: 'Drives with exactly 3 plays and no first down ÷ Total drives',
  },

  scoringDriveRate: {
    title: 'Scoring Drive Rate',
    description: 'Percentage of drives that result in points (TD or FG)',
    useful: 'Shows red zone efficiency and overall scoring consistency. Elite: 50%+',
    calculation: 'Drives ending in TD or FG ÷ Total drives',
  },

  // Player Stats
  rushingYards: {
    title: 'Rushing Stats',
    description: 'Carries, yards gained, and yards per carry average',
    useful: 'Shows ground game effectiveness. 4.0+ YPC is good for high school',
    calculation: 'Format: Carries-Yards (Average). Example: 15-87 (5.8)',
  },

  passingStats: {
    title: 'Passing Stats',
    description: 'Completions, attempts, and completion percentage',
    useful: 'Shows passing efficiency. 60%+ completion is good for high school',
    calculation: 'Format: Comp/Att (Pct%). Example: 12/18 (67%)',
  },

  receivingStats: {
    title: 'Receiving Stats',
    description: 'Receptions, yards, and catch rate',
    useful: 'Shows target reliability and production. 60%+ catch rate is good',
    calculation: 'Format: Rec-Yards (Catch%). Example: 5-89 (71%)',
  },

  // Offensive Line (Tier 3)
  blockWinRate: {
    title: 'Block Win Rate',
    description: 'Percentage of plays where lineman successfully blocks their assignment',
    useful: 'Shows individual OL performance. Identifies weak links and stars. Target: 70%+',
    calculation: 'Successful blocks (win) ÷ Total blocks assigned',
  },

  // Defensive Stats (Tier 3)
  tackles: {
    title: 'Tackles',
    description: 'Total tackles made (solo + assisted)',
    useful: 'Shows involvement and production. High tackles = high motor player',
    calculation: 'Count of plays where player made primary or assisted tackle',
  },

  pressures: {
    title: 'Pressures',
    description: 'Times QB was hurried, hit, or forced to move in pocket',
    useful: 'Pressures lead to bad throws and sacks. Shows pass rush effectiveness beyond just sacks',
    calculation: 'Count of plays where player affected QB before throw',
  },

  tfl: {
    title: 'Tackles For Loss (TFL)',
    description: 'Tackles made behind the line of scrimmage',
    useful: 'Disruptive plays that put offense behind schedule. Elite defenders: 10+ per season',
    calculation: 'Count of tackles where ball carrier loses yards',
  },

  sacks: {
    title: 'Sacks',
    description: 'Times QB was tackled behind line of scrimmage on pass play',
    useful: 'Game-changing plays. Forces punts and creates turnovers. Elite: 5+ per season',
    calculation: 'Count of tackles on QB behind line of scrimmage',
  },

  pbu: {
    title: 'Pass Breakups (PBU)',
    description: 'Passes defensed or knocked down',
    useful: 'Shows coverage ability. High PBU = great ball skills and positioning',
    calculation: 'Count of incomplete passes caused by defender contact',
  },

  // Situational Splits (Tier 3)
  motionSplit: {
    title: 'Motion vs No Motion',
    description: 'Offensive performance with and without pre-snap motion',
    useful: 'Shows if motion helps or hurts. Many teams more effective with motion',
    calculation: 'Compare YPP and success rate for plays with/without motion',
  },

  playActionSplit: {
    title: 'Play Action Effectiveness',
    description: 'Passing efficiency on play action vs straight dropback',
    useful: 'Play action typically increases YPP by 1-2 yards. Shows if run game creates pass opportunities',
    calculation: 'Compare pass plays with play action fake vs no fake',
  },

  blitzSplit: {
    title: 'vs Blitz Performance',
    description: 'Offensive performance against defensive blitz',
    useful: 'Shows if offense can handle pressure. Good offenses beat blitz with hot routes',
    calculation: 'Compare YPP and success rate on plays facing 5+ pass rushers',
  },

  // Top Plays
  playSuccessRate: {
    title: 'Play Success Rate',
    description: 'How often this specific play gains expected yards',
    useful: 'Identifies money plays to call in critical situations. 60%+ is elite',
    calculation: 'Successful reps ÷ Total reps of this play',
  },

  playAvgYards: {
    title: 'Play Average Yards',
    description: 'Average yards gained when running this play',
    useful: 'Shows explosiveness. High avg with high success rate = go-to play',
    calculation: 'Total yards on play ÷ Total reps',
  },
};

/**
 * Get metric definition by key
 */
export function getMetricDefinition(key: string): MetricDefinition | null {
  return METRIC_DEFINITIONS[key] || null;
}

/**
 * Check if metric has definition
 */
export function hasMetricDefinition(key: string): boolean {
  return key in METRIC_DEFINITIONS;
}
