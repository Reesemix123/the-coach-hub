// Game Plan Categories Configuration
// Defines situational categories, play type subcategories, and setup/counter indicators

export interface SituationalCategory {
  id: string;
  label: string;
  description: string;
  shortLabel?: string;
}

export interface PlayTypeCategory {
  id: string;
  label: string;
  description?: string;
}

export interface KeyIndicator {
  id: string;
  label: string;
  description: string;
}

// Situational categories for organizing OFFENSIVE plays
export const SITUATIONAL_CATEGORIES: SituationalCategory[] = [
  { id: '1st_short', label: '1st & Short', description: '1-5 yards to go', shortLabel: '1st-S' },
  { id: '1st_medium', label: '1st & Medium', description: '6-10 yards to go', shortLabel: '1st-M' },
  { id: '1st_long', label: '1st & Long', description: '11+ yards to go (after penalty)', shortLabel: '1st-L' },
  { id: '2nd_short', label: '2nd & Short', description: '1-3 yards to go', shortLabel: '2nd-S' },
  { id: '2nd_medium', label: '2nd & Medium', description: '4-6 yards to go', shortLabel: '2nd-M' },
  { id: '2nd_long', label: '2nd & Long', description: '7+ yards to go', shortLabel: '2nd-L' },
  { id: '3rd_short', label: '3rd & Short', description: '1-3 yards to go', shortLabel: '3rd-S' },
  { id: '3rd_medium', label: '3rd & Medium', description: '4-6 yards to go', shortLabel: '3rd-M' },
  { id: '3rd_long', label: '3rd & Long', description: '7+ yards to go', shortLabel: '3rd-L' },
  { id: '4th_short', label: '4th & Short', description: '1-2 yards to go', shortLabel: '4th-S' },
  { id: '4th_medium', label: '4th & Medium', description: '3-5 yards to go', shortLabel: '4th-M' },
  { id: '4th_long', label: '4th & Long', description: '6+ yards to go', shortLabel: '4th-L' },
  { id: 'red_zone', label: 'Red Zone', description: 'Inside opponent 20', shortLabel: 'RZ' },
  { id: 'goal_line', label: 'Goal Line', description: 'Inside opponent 5', shortLabel: 'GL' },
  { id: '2_minute', label: '2-Minute', description: 'Hurry-up offense', shortLabel: '2-Min' },
  { id: 'backed_up', label: 'Backed Up', description: 'Inside own 10', shortLabel: 'Back' },
  { id: 'first_15', label: 'First 15 Plays', description: 'Scripted plays to start the game', shortLabel: '1st 15' }
];

// Situational categories for organizing DEFENSIVE plays (mirrored from offense)
export const DEFENSIVE_SITUATIONAL_CATEGORIES: SituationalCategory[] = [
  { id: 'def_1st_short', label: '1st & Short Defense', description: 'Opponent needs 1-5 yards', shortLabel: '1st-S-D' },
  { id: 'def_1st_medium', label: '1st & Medium Defense', description: 'Opponent needs 6-10 yards', shortLabel: '1st-M-D' },
  { id: 'def_1st_long', label: '1st & Long Defense', description: 'Opponent needs 11+ yards', shortLabel: '1st-L-D' },
  { id: 'def_2nd_short', label: '2nd & Short Defense', description: 'Opponent needs 1-3 yards', shortLabel: '2nd-S-D' },
  { id: 'def_2nd_medium', label: '2nd & Medium Defense', description: 'Opponent needs 4-6 yards', shortLabel: '2nd-M-D' },
  { id: 'def_2nd_long', label: '2nd & Long Defense', description: 'Opponent needs 7+ yards', shortLabel: '2nd-L-D' },
  { id: 'def_3rd_short', label: '3rd & Short Defense', description: 'Opponent needs 1-3 yards', shortLabel: '3rd-S-D' },
  { id: 'def_3rd_medium', label: '3rd & Medium Defense', description: 'Opponent needs 4-6 yards', shortLabel: '3rd-M-D' },
  { id: 'def_3rd_long', label: '3rd & Long Defense', description: 'Opponent needs 7+ yards', shortLabel: '3rd-L-D' },
  { id: 'def_4th_short', label: '4th & Short Defense', description: 'Opponent needs 1-2 yards', shortLabel: '4th-S-D' },
  { id: 'def_4th_medium', label: '4th & Medium Defense', description: 'Opponent needs 3-5 yards', shortLabel: '4th-M-D' },
  { id: 'def_4th_long', label: '4th & Long Defense', description: 'Opponent needs 6+ yards', shortLabel: '4th-L-D' },
  { id: 'def_red_zone', label: 'Red Zone Defense', description: 'Inside our 20', shortLabel: 'RZ-D' },
  { id: 'def_goal_line', label: 'Goal Line Defense', description: 'Inside our 5', shortLabel: 'GL-D' },
  { id: 'def_2_minute', label: '2-Minute Defense', description: 'Prevent/hurry-up defense', shortLabel: '2-Min-D' },
  { id: 'def_backed_up', label: 'Backed Up Defense', description: 'Opponent inside their 10', shortLabel: 'Back-D' }
];

// Play type subcategories for OFFENSIVE plays
export const PLAY_TYPE_SUBCATEGORIES: PlayTypeCategory[] = [
  { id: 'run', label: 'Run' },
  { id: 'short_pass', label: 'Short Pass', description: '0-10 yards' },
  { id: 'medium_pass', label: 'Medium Pass', description: '10-20 yards' },
  { id: 'long_pass', label: 'Long Pass', description: '20+ yards' },
  { id: 'screen', label: 'Screen' },
  { id: 'play_action', label: 'Play Action' },
  { id: 'rpo', label: 'RPO' },
  { id: 'draw', label: 'Draw' }
];

// Play type subcategories for DEFENSIVE plays
export const DEFENSIVE_PLAY_TYPE_CATEGORIES: PlayTypeCategory[] = [
  { id: 'base_defense', label: 'Base Defense', description: 'Standard 4-3 or 3-4 fronts' },
  { id: 'nickel', label: 'Nickel', description: '5 DBs package' },
  { id: 'dime', label: 'Dime', description: '6 DBs package' },
  { id: 'goal_line_d', label: 'Goal Line', description: 'Heavy run-stopping personnel' },
  { id: 'zone_coverage', label: 'Zone Coverage', description: 'Zone-based pass coverage' },
  { id: 'man_coverage', label: 'Man Coverage', description: 'Man-to-man pass coverage' },
  { id: 'blitz', label: 'Blitz Package', description: 'Extra rushers' },
  { id: 'prevent', label: 'Prevent', description: 'Deep coverage to prevent big plays' }
];

// Situational categories for organizing SPECIAL TEAMS plays
export const SPECIAL_TEAMS_SITUATIONAL_CATEGORIES: SituationalCategory[] = [
  // Kickoff - situations based on time & score
  { id: 'st_ko_start_game', label: 'Start of Game', description: 'Opening kickoff', shortLabel: 'KO-Start' },
  { id: 'st_ko_start_half', label: 'Start of Half', description: 'Second half kickoff', shortLabel: 'KO-Half' },
  { id: 'st_ko_late_game_ahead', label: 'Late Game (Ahead)', description: 'Q4 kickoff when leading', shortLabel: 'KO-Late-A' },
  { id: 'st_ko_late_game_behind', label: 'Late Game (Behind)', description: 'Q4 kickoff when trailing', shortLabel: 'KO-Late-B' },

  // Kick Return - situations based on time & score
  { id: 'st_kr_standard', label: 'Standard Return', description: 'Normal kick return', shortLabel: 'KR-Std' },
  { id: 'st_kr_late_game_ahead', label: 'Late Game (Ahead)', description: 'Q4 return when leading', shortLabel: 'KR-Late-A' },
  { id: 'st_kr_late_game_behind', label: 'Late Game (Behind)', description: 'Q4 return when trailing', shortLabel: 'KR-Late-B' },

  // Punt - situations based on field position & time
  { id: 'st_punt_own_territory', label: 'Own Territory', description: 'Punt from own 20-40', shortLabel: 'P-Own' },
  { id: 'st_punt_midfield', label: 'Midfield', description: 'Punt from 40-50', shortLabel: 'P-Mid' },
  { id: 'st_punt_plus_territory', label: 'Plus Territory', description: 'Punt from opp 40-50', shortLabel: 'P-Plus' },
  { id: 'st_punt_backed_up', label: 'Backed Up', description: 'Punt from own end zone', shortLabel: 'P-Back' },
  { id: 'st_punt_late_game_ahead', label: 'Late Game (Ahead)', description: 'Q4 punt when leading', shortLabel: 'P-Late-A' },
  { id: 'st_punt_late_game_behind', label: 'Late Game (Behind)', description: 'Q4 punt when trailing - consider fake', shortLabel: 'P-Late-B' },

  // Punt Return - situations based on field position & time
  { id: 'st_pr_standard', label: 'Standard Return', description: 'Normal punt return', shortLabel: 'PR-Std' },
  { id: 'st_pr_plus_territory', label: 'Plus Territory', description: 'Return in opponent territory', shortLabel: 'PR-Plus' },
  { id: 'st_pr_own_territory', label: 'Own Territory', description: 'Return in own territory', shortLabel: 'PR-Own' },
  { id: 'st_pr_late_game_ahead', label: 'Late Game (Ahead)', description: 'Q4 return when leading - fair catch', shortLabel: 'PR-Late-A' },
  { id: 'st_pr_late_game_behind', label: 'Late Game (Behind)', description: 'Q4 return when trailing - big play', shortLabel: 'PR-Late-B' },

  // Field Goal - situations based on field position
  { id: 'st_fg_short', label: 'Short FG (0-29)', description: 'FG under 30 yards', shortLabel: 'FG-S' },
  { id: 'st_fg_medium', label: 'Medium FG (30-39)', description: 'FG 30-39 yards', shortLabel: 'FG-M' },
  { id: 'st_fg_long', label: 'Long FG (40-49)', description: 'FG 40-49 yards', shortLabel: 'FG-L' },
  { id: 'st_fg_max', label: 'Max Range (50+)', description: 'FG 50+ yards', shortLabel: 'FG-Max' },

  // Field Goal Block - situations based on opponent field position
  { id: 'st_fgb_short', label: 'Block Short FG', description: 'Block attempt under 30 yards', shortLabel: 'FGB-S' },
  { id: 'st_fgb_medium', label: 'Block Medium FG', description: 'Block attempt 30-39 yards', shortLabel: 'FGB-M' },
  { id: 'st_fgb_long', label: 'Block Long FG', description: 'Block attempt 40+ yards', shortLabel: 'FGB-L' },
  { id: 'st_fgb_game_critical', label: 'Block Game Critical', description: 'Must block to win/stay alive', shortLabel: 'FGB-Crit' },

  // PAT / 2-Point
  { id: 'st_pat_standard', label: 'PAT', description: 'Standard extra point', shortLabel: 'PAT' },
  { id: 'st_2pt_ahead', label: '2-Point (Ahead)', description: '2-pt when leading', shortLabel: '2PT-A' },
  { id: 'st_2pt_behind', label: '2-Point (Behind)', description: '2-pt when trailing', shortLabel: '2PT-B' },
  { id: 'st_2pt_tied', label: '2-Point (Tied)', description: '2-pt when tied', shortLabel: '2PT-T' },
];

// Play type subcategories for SPECIAL TEAMS plays
export const SPECIAL_TEAMS_PLAY_TYPE_CATEGORIES: PlayTypeCategory[] = [
  // Kickoff
  { id: 'kickoff_deep', label: 'Deep Kickoff', description: 'Standard deep kick' },
  { id: 'kickoff_onside', label: 'Onside Kick', description: 'Attempt to recover' },
  { id: 'kickoff_squib', label: 'Squib Kick', description: 'Low bouncing kick' },

  // Kick Return
  { id: 'kick_return_middle', label: 'Middle Return', description: 'Return up the middle' },
  { id: 'kick_return_wall', label: 'Wall Return', description: 'Return behind wall' },
  { id: 'kick_return_wedge', label: 'Wedge Return', description: 'Wedge blocking scheme' },

  // Punt
  { id: 'punt_standard', label: 'Standard Punt', description: 'Traditional punt' },
  { id: 'punt_directional', label: 'Directional Punt', description: 'Aimed punt' },
  { id: 'punt_fake', label: 'Fake Punt', description: 'Fake punt play' },

  // Punt Return
  { id: 'punt_return', label: 'Punt Return', description: 'Standard return' },
  { id: 'punt_block', label: 'Punt Block', description: 'Block attempt' },
  { id: 'punt_safe', label: 'Safe/Fair Catch', description: 'Fair catch setup' },

  // Field Goal
  { id: 'field_goal', label: 'Field Goal', description: 'FG attempt' },
  { id: 'fg_fake', label: 'Fake FG', description: 'Fake field goal play' },
  { id: 'fg_block', label: 'FG Block', description: 'Block attempt' },

  // PAT
  { id: 'pat_kick', label: 'PAT Kick', description: 'Extra point kick' },
  { id: 'pat_fake', label: 'Fake PAT', description: 'Fake extra point' },
  { id: 'two_point', label: '2-Point Play', description: '2-point conversion' },
];

// Situation groups for organizing plays by unit
export interface SituationGroup {
  id: string;
  label: string;
  situations: string[];
}

// Offensive situation groups (down-based)
export const OFFENSIVE_SITUATION_GROUPS: SituationGroup[] = [
  {
    id: '1st_down_group',
    label: '1st Down',
    situations: ['1st_short', '1st_medium', '1st_long']
  },
  {
    id: '2nd_down_group',
    label: '2nd Down',
    situations: ['2nd_short', '2nd_medium', '2nd_long']
  },
  {
    id: '3rd_down_group',
    label: '3rd Down',
    situations: ['3rd_short', '3rd_medium', '3rd_long']
  },
  {
    id: '4th_down_group',
    label: '4th Down',
    situations: ['4th_short', '4th_medium', '4th_long']
  },
  {
    id: 'special_situations_group',
    label: 'Special Situations',
    situations: ['red_zone', 'goal_line', '2_minute', 'backed_up', 'first_15']
  }
];

// Defensive situation groups (down-based)
export const DEFENSIVE_SITUATION_GROUPS: SituationGroup[] = [
  {
    id: 'def_1st_down_group',
    label: '1st Down Defense',
    situations: ['def_1st_short', 'def_1st_medium', 'def_1st_long']
  },
  {
    id: 'def_2nd_down_group',
    label: '2nd Down Defense',
    situations: ['def_2nd_short', 'def_2nd_medium', 'def_2nd_long']
  },
  {
    id: 'def_3rd_down_group',
    label: '3rd Down Defense',
    situations: ['def_3rd_short', 'def_3rd_medium', 'def_3rd_long']
  },
  {
    id: 'def_4th_down_group',
    label: '4th Down Defense',
    situations: ['def_4th_short', 'def_4th_medium', 'def_4th_long']
  },
  {
    id: 'def_special_situations_group',
    label: 'Special Situations Defense',
    situations: ['def_red_zone', 'def_goal_line', 'def_2_minute', 'def_backed_up']
  }
];

// Special teams situation groups (by unit)
export const SPECIAL_TEAMS_SITUATION_GROUPS: SituationGroup[] = [
  {
    id: 'kickoff_group',
    label: 'Kickoff',
    situations: ['st_ko_start_game', 'st_ko_start_half', 'st_ko_late_game_ahead', 'st_ko_late_game_behind']
  },
  {
    id: 'kick_return_group',
    label: 'Kick Return',
    situations: ['st_kr_standard', 'st_kr_late_game_ahead', 'st_kr_late_game_behind']
  },
  {
    id: 'punt_group',
    label: 'Punt',
    situations: ['st_punt_own_territory', 'st_punt_midfield', 'st_punt_plus_territory', 'st_punt_backed_up', 'st_punt_late_game_ahead', 'st_punt_late_game_behind']
  },
  {
    id: 'punt_return_group',
    label: 'Punt Return',
    situations: ['st_pr_standard', 'st_pr_plus_territory', 'st_pr_own_territory', 'st_pr_late_game_ahead', 'st_pr_late_game_behind']
  },
  {
    id: 'field_goal_group',
    label: 'Field Goal',
    situations: ['st_fg_short', 'st_fg_medium', 'st_fg_long', 'st_fg_max']
  },
  {
    id: 'fg_block_group',
    label: 'FG Block',
    situations: ['st_fgb_short', 'st_fgb_medium', 'st_fgb_long', 'st_fgb_game_critical']
  },
  {
    id: 'pat_group',
    label: 'PAT / 2-Point',
    situations: ['st_pat_standard', 'st_2pt_ahead', 'st_2pt_behind', 'st_2pt_tied']
  }
];

// Defensive positions to watch for setup/counter plays
export const KEY_DEFENSIVE_POSITIONS = [
  'MLB',
  'WILL',
  'SAM',
  'ILB',
  'SS',
  'FS',
  'CB1',
  'CB2',
  'NB',
  'NT',
  '3-tech',
  '5-tech',
  'DE',
  'EDGE',
  'OLB'
] as const;

export type KeyDefensivePosition = typeof KEY_DEFENSIVE_POSITIONS[number];

// Key indicators for when a counter play is "ripe"
export const KEY_INDICATORS: KeyIndicator[] = [
  { id: 'cheating_inside', label: 'Cheating Inside', description: 'Creeping toward A gap pre-snap' },
  { id: 'cheating_outside', label: 'Cheating Outside', description: 'Widening to C gap pre-snap' },
  { id: 'biting_motion', label: 'Biting on Motion', description: 'Jumping pre-snap motion' },
  { id: 'jumping_routes', label: 'Jumping Routes', description: 'Breaking early on patterns' },
  { id: 'run_fit_aggressive', label: 'Aggressive Run Fit', description: 'Crashing hard at snap' },
  { id: 'deep_alignment', label: 'Playing Deep', description: 'Alignment deeper than normal' },
  { id: 'soft_coverage', label: 'Soft Coverage', description: 'Giving cushion to receivers' },
  { id: 'press_alignment', label: 'Press Alignment', description: 'Lined up in press coverage' },
  { id: 'spy_qb', label: 'Spying QB', description: 'Defender assigned to watch QB' },
  { id: 'robber_technique', label: 'Robber Technique', description: 'Safety robbing underneath routes' }
];

// Helper functions

/**
 * Get situational category by ID
 */
export function getSituationalCategory(id: string): SituationalCategory | undefined {
  return SITUATIONAL_CATEGORIES.find(cat => cat.id === id);
}

/**
 * Get play type category by ID
 */
export function getPlayTypeCategory(id: string): PlayTypeCategory | undefined {
  return PLAY_TYPE_SUBCATEGORIES.find(cat => cat.id === id);
}

/**
 * Get key indicator by ID
 */
export function getKeyIndicator(id: string): KeyIndicator | undefined {
  return KEY_INDICATORS.find(ind => ind.id === id);
}

/**
 * Infer play type category from play attributes
 */
export function inferPlayTypeCategory(attributes: {
  playType?: string;
  passConcept?: string;
  runConcept?: string;
}): string {
  const { playType, passConcept } = attributes;

  if (!playType) return 'run';

  const lowerType = playType.toLowerCase();

  if (lowerType === 'run' || lowerType === 'draw') {
    if (lowerType === 'draw') return 'draw';
    return 'run';
  }

  if (lowerType === 'screen') return 'screen';
  if (lowerType === 'play action') return 'play_action';
  if (lowerType === 'rpo') return 'rpo';

  // For pass plays, try to infer depth from concept
  if (passConcept) {
    const lowerConcept = passConcept.toLowerCase();

    // Long pass concepts
    if (['go', 'streak', 'four verts', 'deep', 'bomb', 'post', 'corner', 'wheel'].some(c => lowerConcept.includes(c))) {
      return 'long_pass';
    }

    // Short pass concepts
    if (['slant', 'quick', 'hitch', 'flat', 'swing', 'screen', 'bubble'].some(c => lowerConcept.includes(c))) {
      return 'short_pass';
    }

    // Medium pass concepts
    if (['curl', 'out', 'dig', 'in', 'levels', 'mesh', 'drive', 'cross'].some(c => lowerConcept.includes(c))) {
      return 'medium_pass';
    }
  }

  // Default to short pass for unclassified pass plays
  return 'short_pass';
}

/**
 * Infer situation from down and distance
 */
export function inferSituation(down: number, distance: number, yardLine: number): string {
  // Special field positions
  if (yardLine <= 10) return 'backed_up';
  if (yardLine >= 80) return 'red_zone';
  if (yardLine >= 95) return 'goal_line';

  // Down and distance based situations
  if (down === 1) return '1st_down';

  if (down === 2) {
    if (distance <= 3) return '2nd_short';
    if (distance <= 6) return '2nd_medium';
    return '2nd_long';
  }

  if (down === 3) {
    if (distance <= 3) return '3rd_short';
    if (distance <= 6) return '3rd_medium';
    return '3rd_long';
  }

  if (down === 4) {
    if (distance <= 2) return '4th_short';
    return '3rd_long'; // Use 3rd & long plays for 4th & long
  }

  return '1st_down';
}

/**
 * Get display order for situations (for sorting)
 */
export function getSituationOrder(situationId: string): number {
  const order: Record<string, number> = {
    // Offensive situations
    'opening_script': 0,
    'first_15': 0,
    '1st_down': 1,
    '2nd_short': 2,
    '2nd_medium': 3,
    '2nd_long': 4,
    '3rd_short': 5,
    '3rd_medium': 6,
    '3rd_long': 7,
    '4th_short': 8,
    'red_zone': 9,
    'goal_line': 10,
    '2_minute': 11,
    'backed_up': 12,
    // Defensive situations (same order, offset by 100)
    'def_1st_down': 101,
    'def_2nd_short': 102,
    'def_2nd_medium': 103,
    'def_2nd_long': 104,
    'def_3rd_short': 105,
    'def_3rd_medium': 106,
    'def_3rd_long': 107,
    'def_4th_short': 108,
    'def_red_zone': 109,
    'def_goal_line': 110,
    'def_2_minute': 111,
    'def_backed_up': 112,
    // Special teams situations (offset by 200)
    // Kickoff
    'st_ko_start_game': 201,
    'st_ko_start_half': 202,
    'st_ko_late_game_ahead': 203,
    'st_ko_late_game_behind': 204,
    // Kick Return
    'st_kr_standard': 210,
    'st_kr_late_game_ahead': 211,
    'st_kr_late_game_behind': 212,
    // Punt
    'st_punt_own_territory': 220,
    'st_punt_midfield': 221,
    'st_punt_plus_territory': 222,
    'st_punt_backed_up': 223,
    'st_punt_late_game_ahead': 224,
    'st_punt_late_game_behind': 225,
    // Punt Return
    'st_pr_standard': 230,
    'st_pr_plus_territory': 231,
    'st_pr_own_territory': 232,
    'st_pr_late_game_ahead': 233,
    'st_pr_late_game_behind': 234,
    // Field Goal
    'st_fg_short': 240,
    'st_fg_medium': 241,
    'st_fg_long': 242,
    'st_fg_max': 243,
    // FG Block
    'st_fgb_short': 250,
    'st_fgb_medium': 251,
    'st_fgb_long': 252,
    'st_fgb_game_critical': 253,
    // PAT / 2-Point
    'st_pat_standard': 260,
    'st_2pt_ahead': 261,
    'st_2pt_behind': 262,
    'st_2pt_tied': 263
  };
  return order[situationId] ?? 99;
}

// Type for game plan side
export type GamePlanSide = 'offense' | 'defense' | 'special_teams';

/**
 * Get situational categories based on side (offense/defense/special_teams)
 */
export function getSituationalCategories(side: GamePlanSide): SituationalCategory[] {
  if (side === 'offense') return SITUATIONAL_CATEGORIES;
  if (side === 'defense') return DEFENSIVE_SITUATIONAL_CATEGORIES;
  return SPECIAL_TEAMS_SITUATIONAL_CATEGORIES;
}

/**
 * Get play type categories based on side (offense/defense/special_teams)
 */
export function getPlayTypeCategories(side: GamePlanSide): PlayTypeCategory[] {
  if (side === 'offense') return PLAY_TYPE_SUBCATEGORIES;
  if (side === 'defense') return DEFENSIVE_PLAY_TYPE_CATEGORIES;
  return SPECIAL_TEAMS_PLAY_TYPE_CATEGORIES;
}

/**
 * Get situation groups based on side (offense/defense/special_teams)
 */
export function getSituationGroups(side: GamePlanSide): SituationGroup[] {
  if (side === 'offense') return OFFENSIVE_SITUATION_GROUPS;
  if (side === 'defense') return DEFENSIVE_SITUATION_GROUPS;
  return SPECIAL_TEAMS_SITUATION_GROUPS;
}

/**
 * Infer defensive situation from down and distance (opponent's perspective)
 */
export function inferDefensiveSituation(down: number, distance: number, yardLine: number): string {
  // yardLine from opponent's perspective (100 - our yardLine)
  const oppYardLine = 100 - yardLine;

  // Special field positions
  if (oppYardLine <= 10) return 'def_backed_up'; // Opponent inside their 10
  if (yardLine <= 20) return 'def_red_zone'; // Inside our 20
  if (yardLine <= 5) return 'def_goal_line'; // Inside our 5

  // Down and distance based situations
  if (down === 1) return 'def_1st_down';

  if (down === 2) {
    if (distance <= 3) return 'def_2nd_short';
    if (distance <= 6) return 'def_2nd_medium';
    return 'def_2nd_long';
  }

  if (down === 3) {
    if (distance <= 3) return 'def_3rd_short';
    if (distance <= 6) return 'def_3rd_medium';
    return 'def_3rd_long';
  }

  if (down === 4) {
    if (distance <= 2) return 'def_4th_short';
    return 'def_3rd_long'; // Use 3rd & long defense for 4th & long
  }

  return 'def_1st_down';
}
