// src/config/footballConfig.ts
// SINGLE SOURCE OF TRUTH for all football-related attributes
// Used by: PlayBuilder, Film Analysis, Analytics, Reports
// ALL FORMATIONS VALIDATED AGAINST footballRules.ts
// Updated with accurate formations based on Throw Deep Publishing research

import { Player } from '@/types/football';

// ============================================
// CORE ATTRIBUTE DEFINITIONS
// ============================================

/**
 * These attributes apply to ALL plays regardless of ODK
 */
export const COMMON_ATTRIBUTES = {
  downDistance: [
    '1st & 10',
    '2nd & Short (1-3)',
    '2nd & Medium (4-7)',
    '2nd & Long (8+)',
    '3rd & Short (1-3)',
    '3rd & Medium (4-7)',
    '3rd & Long (8+)',
    '4th & Short',
    '4th & Medium',
    '4th & Long'
  ],
  
  fieldZone: [
    'Own Red Zone (0-20)',
    'Own Territory (21-49)',
    'Midfield (50)',
    'Opponent Territory (49-21)',
    'Red Zone (20-0)'
  ],
  
  hash: ['Left', 'Middle', 'Right'],
  
  gameContext: [
    '2-Minute Drill',
    'Goal Line',
    'Short Yardage',
    'Backed Up',
    'Coming Out',
    'Hurry Up',
    'Victory Formation'
  ]
} as const;

/**
 * Offensive play attributes
 */
export const OFFENSIVE_ATTRIBUTES = {
  playType: ['Run', 'Pass', 'RPO', 'Screen', 'Draw', 'Play Action'],
  
  personnel: [
    '11 (1RB-1TE-3WR)',
    '12 (1RB-2TE-2WR)',
    '21 (2RB-1TE-2WR)',
    '10 (1RB-0TE-4WR)',
    '13 (1RB-3TE-1WR)',
    '22 (2RB-2TE-1WR)',
    '00 (0RB-0TE-5WR)'
  ],
  
  runConcepts: [
    'Inside Zone',
    'Outside Zone',
    'Power',
    'Counter',
    'Trap',
    'Sweep',
    'Toss',
    'Iso',
    'Lead',
    'Dive',
    'QB Sneak',
    'QB Power',
    'QB Counter',
    'Read Option'
  ],
  
  passConcepts: [
    'Levels',
    'Flood',
    'Mesh',
    'Stick',
    'Follow',
    'Drive',
    'Sail',
    'China',
    'Smash',
    'Corner',
    'Post-Wheel',
    'Four Verticals',
    'Spacing',
    'Shallow Cross'
  ],
  
  protection: [
    '5-Man (Slide)',
    '6-Man (RB)',
    '7-Man (Max)',
    'BOB (Big on Big)',
    'Half Slide',
    'Turnback',
    'Play Action'
  ],
  
  motion: [
    'None',
    'Jet',
    'Orbit',
    'Return',
    'Fly',
    'Trade',
    'Shift',
    'Swing'
  ],
  
  targetHole: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],

  ballCarrier: ['QB', 'RB', 'FB', 'X', 'Y', 'Z', 'TE']
} as const;

/**
 * Defensive play attributes
 */
export const DEFENSIVE_ATTRIBUTES = {
  front: [
    '4-3 Over',
    '4-3 Under',
    '3-4 Base',
    '3-3 Stack',
    '5-2',
    '6-1',
    '4-2-5 Nickel',
    '3-3-5',
    '2-4-5 Dime',
    'Bear'
  ],
  
  coverage: [
    'Cover 0 (Man)',
    'Cover 1 (Man Free)',
    'Cover 2',
    'Cover 3',
    'Cover 4 (Quarters)',
    'Cover 6',
    '2-Man Under',
    'Tampa 2',
    'Palms',
    'Robber'
  ],
  
  blitzType: [
    'None',
    'Inside Blitz',
    'Outside Blitz',
    'Corner Blitz',
    'Safety Blitz',
    'Double A-Gap',
    'Fire Zone',
    'Overload',
    'Green Dog'
  ],
  
  stunt: [
    'None',
    'T-E Twist',
    'E-T Games',
    'Loop',
    'Cross',
    'Pinch',
    'Slant',
    'Spike'
  ],
  
  pressLevel: ['Off', 'Soft', 'Press', 'Jam']
} as const;

/**
 * Special Teams attributes
 */
export const SPECIAL_TEAMS_ATTRIBUTES = {
  unit: [
    'Kickoff',
    'Kick Return',
    'Punt',
    'Punt Return',
    'Field Goal',
    'PAT'
  ],
  
  kickoffType: [
    'Deep Middle',
    'Deep Left',
    'Deep Right',
    'Squib',
    'Pooch',
    'Onside Left',
    'Onside Right'
  ],
  
  puntType: [
    'Standard',
    'Directional Left',
    'Directional Right',
    'Pooch',
    'Rugby',
    'Sky Punt'
  ],
  
  returnScheme: [
    'Middle Return',
    'Left Return',
    'Right Return',
    'Wall',
    'Wedge',
    'Fake'
  ]
} as const;

/**
 * Play result/outcome attributes (for film analysis)
 */
export const PLAY_RESULTS = {
  outcome: [
    'Completion',
    'Incompletion',
    'Gain',
    'No Gain',
    'Loss',
    'Touchdown',
    'Turnover (INT)',
    'Turnover (Fumble)',
    'Sack',
    'Penalty',
    'First Down'
  ],
  
  successCriteria: {
    '1st Down': 'Gain 40% of distance',
    '2nd Down': 'Gain 60% of distance',
    '3rd/4th Down': 'Gain 100% of distance'
  }
} as const;

// ============================================
// ROUTE & ASSIGNMENT CONFIGURATION
// ============================================

/**
 * Simplified blocking assignments for offensive linemen
 * UPDATED: Simplified to 3 core blocking types with draggable direction
 */
export const BLOCKING_ASSIGNMENTS = [
  'Run Block',
  'Pass Block',
  'Pull'
] as const;

/**
 * Block responsibilities (WHO to block - defender assignment)
 */
export const BLOCK_RESPONSIBILITIES = [
  'Nose',
  '1-tech (inside Guard)',
  '3-tech (outside Guard)',
  '5-tech (outside Tackle)',
  'Edge/DE',
  'Mike LB',
  'Will LB',
  'Sam LB',
  'A-gap',
  'B-gap',
  'C-gap',
  'D-gap',
  'Second Level'
] as const;

/**
 * Running holes (gap numbering system)
 * UPDATED: Extended holes 7 and 8 closer to sidelines
 * Odd = Left side, Even = Right side
 * 1 = Between Center and Left Guard
 * 2 = Between Center and Right Guard
 * 3 = Between Left Guard and Left Tackle
 * 4 = Between Right Guard and Right Tackle
 * 5 = Outside Left Tackle
 * 6 = Outside Right Tackle
 * 7 = Far left (wide - extended to sideline)
 * 8 = Far right (wide - extended to sideline)
 */
export const RUNNING_HOLES = [
  '1 (C-LG gap)',
  '2 (C-RG gap)',
  '3 (LG-LT gap)',
  '4 (RG-RT gap)',
  '5 (Outside LT)',
  '6 (Outside RT)',
  '7 (Far Left - Wide)',
  '8 (Far Right - Wide)'
] as const;

/**
 * Standard high school passing routes
 */
export const PASSING_ROUTES = [
  'Go/Streak/9',
  'Post',
  'Corner',
  'Comeback',
  'Curl',
  'Out',
  'In/Dig',
  'Slant',
  'Hitch',
  'Stick',
  'Flat',
  'Wheel',
  'Swing',
  'Bubble Screen',
  'Shallow Cross',
  'Deep Cross',
  'Seam',
  'Fade',
  'Block',
  'Draw Route (Custom)'
] as const;


/**
 * Unified skill position assignments for RB/QB/WR/TE
 * Available on BOTH run and pass plays - coach decides usage
 * Eliminates artificial restrictions, enables creative play design
 */
export const SKILL_POSITION_ASSIGNMENTS = [
  // Custom Drawing - at top so coaches know it's available
  'Draw Route (Custom)',

  // Pass Routes
  'Go/Streak/9',
  'Post',
  'Corner',
  'Comeback',
  'Curl',
  'Out',
  'In/Dig',
  'Slant',
  'Hitch',
  'Flat',
  'Wheel',
  'Seam',
  'Fade',

  // Actions
  'Block'  // Then specify block type via dropdown
] as const;
/**
 * Position group categorization
 */
export const POSITION_GROUPS = {
  linemen: ['LT', 'LG', 'C', 'RG', 'RT'],
  backs: ['QB', 'RB', 'FB', 'TB', 'SB'],
  receivers: ['X', 'Y', 'Z', 'SL', 'SR', 'TE', 'TE1', 'TE2', 'SE', 'FL', 'WB']
} as const;

// ============================================
// ACCURATE OFFENSIVE FORMATIONS
// Field dimensions: 700x400, Line of scrimmage at y=200
// ALL OFFENSIVE PLAYERS: y >= 200 (at or behind LOS)
// UPDATED: Based on Throw Deep Publishing research
// ============================================

export interface FormationConfig {
  [key: string]: Player[];
}

export const OFFENSIVE_FORMATIONS: FormationConfig = {
  // ========== SHOTGUN FORMATIONS (QB 5-7 yards back = y=260) ==========
  
  'Shotgun Spread': [
    // 7 on LOS (y=200)
    { position: 'X', x: 50, y: 200, label: 'X' },
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'TE', x: 420, y: 200, label: 'TE' },
    // 4 in backfield (y > 205)
    { position: 'SL', x: 180, y: 210, label: 'SL' },
    { position: 'Z', x: 550, y: 210, label: 'Z' },
    { position: 'QB', x: 300, y: 260, label: 'QB' },
    { position: 'RB', x: 340, y: 260, label: 'RB' }
  ],
  
  'Gun Trips Right': [
    // 7 on LOS
    { position: 'X', x: 50, y: 200, label: 'X' },
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'Y', x: 460, y: 200, label: 'Y' },
    // 4 in backfield - 3 receivers bunched right
    { position: 'Z', x: 510, y: 210, label: 'Z' },
    { position: 'SL', x: 420, y: 215, label: 'SL' },
    { position: 'QB', x: 300, y: 260, label: 'QB' },
    { position: 'RB', x: 260, y: 260, label: 'RB' }
  ],
  
  'Gun Trips Left': [
    // 7 on LOS
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'Y', x: 140, y: 200, label: 'Y' },
    { position: 'Z', x: 550, y: 200, label: 'Z' },
    // 4 in backfield - 3 receivers bunched left
    { position: 'X', x: 90, y: 210, label: 'X' },
    { position: 'SL', x: 180, y: 215, label: 'SL' },
    { position: 'QB', x: 300, y: 260, label: 'QB' },
    { position: 'RB', x: 340, y: 260, label: 'RB' }
  ],
  
  'Gun Empty': [
    // 7 on LOS (5 receivers spread)
    { position: 'X', x: 50, y: 200, label: 'X' },
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'Z', x: 550, y: 200, label: 'Z' },
    // 4 in backfield (all receivers, empty backfield)
    { position: 'Y', x: 180, y: 210, label: 'Y' },
    { position: 'SL', x: 420, y: 210, label: 'SL' },
    { position: 'RB', x: 280, y: 225, label: 'RB' },
    { position: 'QB', x: 320, y: 260, label: 'QB' }
  ],
  
  'Gun Doubles': [
    // 7 on LOS - Balanced 2x2 receiver sets
    { position: 'X', x: 50, y: 200, label: 'X' },
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'Z', x: 550, y: 200, label: 'Z' },
    // 4 in backfield - 2 slots, QB, RB
    { position: 'SL', x: 150, y: 210, label: 'SL' },
    { position: 'SR', x: 450, y: 210, label: 'SR' },
    { position: 'QB', x: 300, y: 260, label: 'QB' },
    { position: 'RB', x: 300, y: 230, label: 'RB' }
  ],
  
  // ========== UNDER CENTER FORMATIONS (QB at y=215) ==========
  
  'I-Formation': [
    // 7 on LOS
    { position: 'X', x: 50, y: 200, label: 'X' },
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'TE', x: 420, y: 200, label: 'TE' },
    // 4 in backfield - Vertical "I" alignment
    { position: 'QB', x: 300, y: 215, label: 'QB' },
    { position: 'FB', x: 300, y: 245, label: 'FB' },
    { position: 'TB', x: 300, y: 280, label: 'TB' },
    { position: 'Z', x: 550, y: 210, label: 'Z' }
  ],
  
  'Pro Set': [
    // 7 on LOS
    { position: 'X', x: 50, y: 200, label: 'X' },
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'TE', x: 420, y: 200, label: 'TE' },
    // 4 in backfield - Split backs (side-by-side)
    { position: 'QB', x: 300, y: 215, label: 'QB' },
    { position: 'FB', x: 270, y: 245, label: 'FB' },
    { position: 'RB', x: 330, y: 245, label: 'RB' },
    { position: 'Z', x: 550, y: 210, label: 'Z' }
  ],
  
  'Singleback': [
    // 7 on LOS
    { position: 'X', x: 50, y: 200, label: 'X' },
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'TE', x: 420, y: 200, label: 'TE' },
    // 4 in backfield - Single RB
    { position: 'QB', x: 300, y: 215, label: 'QB' },
    { position: 'RB', x: 300, y: 255, label: 'RB' },
    { position: 'SL', x: 180, y: 210, label: 'SL' },
    { position: 'Z', x: 550, y: 210, label: 'Z' }
  ],
  
  'Wing-T': [
    // 7 on LOS - Classic 100/900 formation
    { position: 'SE', x: 50, y: 200, label: 'SE' },
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'TE', x: 420, y: 200, label: 'TE' },
    // 4 in backfield - Wingback just off LOS outside TE
    { position: 'QB', x: 300, y: 215, label: 'QB' },
    { position: 'FB', x: 300, y: 245, label: 'FB' },
    { position: 'TB', x: 300, y: 280, label: 'TB' },
    { position: 'WB', x: 460, y: 210, label: 'WB' }
  ],
  
  'Power I': [
    // 7 on LOS - Double TE for power running
    { position: 'LT', x: 200, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'TE1', x: 140, y: 200, label: 'TE1' },
    { position: 'TE2', x: 440, y: 200, label: 'TE2' },
    // 4 in backfield - I formation
    { position: 'QB', x: 300, y: 215, label: 'QB' },
    { position: 'FB', x: 300, y: 245, label: 'FB' },
    { position: 'TB', x: 300, y: 280, label: 'TB' },
    { position: 'FL', x: 50, y: 210, label: 'FL' }
  ],
  
  // ========== SPECIALTY FORMATIONS ==========
  
  'Wishbone': [
    // 7 on LOS - Triple option formation
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'TE1', x: 160, y: 200, label: 'TE1' },
    { position: 'TE2', x: 440, y: 200, label: 'TE2' },
    // 4 in backfield - Wishbone shape
    { position: 'QB', x: 300, y: 215, label: 'QB' },
    { position: 'FB', x: 300, y: 245, label: 'FB' },
    { position: 'HB1', x: 260, y: 275, label: 'HB1' },
    { position: 'HB2', x: 340, y: 275, label: 'HB2' }
  ],
  
  'Flexbone': [
    // 7 on LOS - Modern option formation
    { position: 'X', x: 50, y: 200, label: 'X' },
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'Z', x: 550, y: 200, label: 'Z' },
    // 4 in backfield - A-backs closer to line
    { position: 'QB', x: 300, y: 215, label: 'QB' },
    { position: 'FB', x: 300, y: 245, label: 'FB' },
    { position: 'AB1', x: 200, y: 220, label: 'AB1' },
    { position: 'AB2', x: 400, y: 220, label: 'AB2' }
  ],
  
  'Pistol': [
    // 7 on LOS - QB 3-4 yards back (between shotgun and under center)
    { position: 'X', x: 50, y: 200, label: 'X' },
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'TE', x: 420, y: 200, label: 'TE' },
    // 4 in backfield - QB at 230, RB directly behind
    { position: 'SL', x: 180, y: 210, label: 'SL' },
    { position: 'Z', x: 550, y: 210, label: 'Z' },
    { position: 'QB', x: 300, y: 230, label: 'QB' },
    { position: 'RB', x: 300, y: 260, label: 'RB' }
  ],

  // ========== GOALLINE FORMATION ==========

  'Goalline': [
    // Heavy formation for short yardage/goalline situations
    // 7 on LOS - Double TE, tight splits
    { position: 'TE1', x: 160, y: 200, label: 'TE1' },
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'C', x: 300, y: 200, label: 'C' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'TE2', x: 440, y: 200, label: 'TE2' },
    // 4 in backfield - QB under center, FB, 2 RBs (I-formation style)
    { position: 'QB', x: 300, y: 215, label: 'QB' },
    { position: 'FB', x: 300, y: 245, label: 'FB' },
    { position: 'TB', x: 300, y: 280, label: 'TB' },
    { position: 'HB', x: 240, y: 250, label: 'HB' }
  ]
};

// ============================================
// DEFENSIVE ALIGNMENT SYSTEM
// ============================================

/**
 * Type for offensive line reference points used in defensive positioning
 */
export interface OffensiveLineReference {
  lineOfScrimmage: number;
  centerX: number;
  center?: { x: number; y: number };
  lg?: { x: number; y: number };
  rg?: { x: number; y: number };
  lt?: { x: number; y: number };
  rt?: { x: number; y: number };
  responsibility: string;
}

/**
 * Defensive alignment configuration
 */
export interface DefensiveAlignment {
  matchTerms: string[];
  description: string;
  depth: number;
  getPosition: (ref: OffensiveLineReference) => { x: number; y: number };
}

export const DEFENSIVE_ALIGNMENTS: Record<string, DefensiveAlignment> = {
  NOSE: {
    matchTerms: ['nose', 'nt', '0-tech', '0 tech'],
    description: 'Nose Tackle - Head up on center (0-technique)',
    depth: 1.5,
    getPosition: (ref) => ({
      x: ref.centerX,
      y: ref.lineOfScrimmage - 15
    })
  },

  ONE_TECH: {
    matchTerms: ['1-tech', '1 tech', '1tech', 'inside guard'],
    description: 'Defensive Tackle - Inside shoulder of guard (A-gap)',
    depth: 1.5,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left') || ref.responsibility.includes('lg')) {
        return {
          x: (ref.lg?.x || ref.centerX - 40) - 10,
          y: ref.lineOfScrimmage - 15
        };
      }
      return {
        x: (ref.rg?.x || ref.centerX + 40) + 10,
        y: ref.lineOfScrimmage - 15
      };
    }
  },

  TWO_I_TECH: {
    matchTerms: ['2i-tech', '2i tech', '2i', 'head up guard'],
    description: 'Defensive Tackle - Head up on guard (2i-technique)',
    depth: 1.5,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left') || ref.responsibility.includes('lg')) {
        return {
          x: ref.lg?.x || ref.centerX - 40,
          y: ref.lineOfScrimmage - 15
        };
      }
      return {
        x: ref.rg?.x || ref.centerX + 40,
        y: ref.lineOfScrimmage - 15
      };
    }
  },

  THREE_TECH: {
    matchTerms: ['3-tech', '3 tech', '3tech', 'outside guard', 'rdt', 'ldt'],
    description: 'Defensive Tackle - Outside shoulder of guard (B-gap)',
    depth: 1.5,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left') || ref.responsibility.includes('lg') || ref.responsibility.includes('ldt')) {
        return {
          x: (ref.lg?.x || ref.centerX - 40) - 20,
          y: ref.lineOfScrimmage - 15
        };
      }
      return {
        x: (ref.rg?.x || ref.centerX + 40) + 20,
        y: ref.lineOfScrimmage - 15
      };
    }
  },

  FOUR_I_TECH: {
    matchTerms: ['4i-tech', '4i tech', '4i', 'head up tackle'],
    description: 'Defensive End - Head up on tackle (4i-technique)',
    depth: 1.5,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left') || ref.responsibility.includes('lt')) {
        return {
          x: ref.lt?.x || ref.centerX - 80,
          y: ref.lineOfScrimmage - 15
        };
      }
      return {
        x: ref.rt?.x || ref.centerX + 80,
        y: ref.lineOfScrimmage - 15
      };
    }
  },

  FIVE_TECH: {
    matchTerms: ['5-tech', '5 tech', '5tech', 'outside tackle'],
    description: 'Defensive End - Outside shoulder of tackle (C-gap)',
    depth: 1.5,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left') || ref.responsibility.includes('lt')) {
        return {
          x: (ref.lt?.x || ref.centerX - 80) - 20,
          y: ref.lineOfScrimmage - 15
        };
      }
      return {
        x: (ref.rt?.x || ref.centerX + 80) + 20,
        y: ref.lineOfScrimmage - 15
      };
    }
  },

  SIX_TECH: {
    matchTerms: ['6-tech', '6 tech', '6tech', '6 technique'],
    description: 'Defensive End - Inside shoulder of tight end',
    depth: 1.5,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left')) {
        return {
          x: (ref.lt?.x || ref.centerX - 80) - 40,
          y: ref.lineOfScrimmage - 15
        };
      }
      return {
        x: (ref.rt?.x || ref.centerX + 80) + 40,
        y: ref.lineOfScrimmage - 15
      };
    }
  },

  SEVEN_TECH: {
    matchTerms: ['7-tech', '7 tech', '7tech'],
    description: 'Defensive End - Head up on tight end',
    depth: 1.5,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left')) {
        return {
          x: (ref.lt?.x || ref.centerX - 80) - 50,
          y: ref.lineOfScrimmage - 15
        };
      }
      return {
        x: (ref.rt?.x || ref.centerX + 80) + 50,
        y: ref.lineOfScrimmage - 15
      };
    }
  },

  NINE_TECH: {
    matchTerms: ['9-tech', '9 tech', '9tech', 'wide 9'],
    description: 'Defensive End - Wide outside (speed rush)',
    depth: 1.0,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left')) {
        return {
          x: (ref.lt?.x || ref.centerX - 80) - 70,
          y: ref.lineOfScrimmage - 10
        };
      }
      return {
        x: (ref.rt?.x || ref.centerX + 80) + 70,
        y: ref.lineOfScrimmage - 10
      };
    }
  },

  EDGE: {
    matchTerms: ['edge', 'emol', 'end man on line', 'de'],
    description: 'Edge Defender - Outside the last man on LOS',
    depth: 1.0,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left')) {
        return {
          x: (ref.lt?.x || ref.centerX - 80) - 40,
          y: ref.lineOfScrimmage - 10
        };
      }
      return {
        x: (ref.rt?.x || ref.centerX + 80) + 40,
        y: ref.lineOfScrimmage - 10
      };
    }
  },

  A_GAP: {
    matchTerms: ['a-gap', 'a gap', 'agap', 'playside a', 'backside a'],
    description: 'A-Gap - Between center and guard',
    depth: 1.5,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left') || ref.responsibility.includes('backside a')) {
        return {
          x: ref.centerX - 25,
          y: ref.lineOfScrimmage - 15
        };
      }
      return {
        x: ref.centerX + 25,
        y: ref.lineOfScrimmage - 15
      };
    }
  },

  B_GAP: {
    matchTerms: ['b-gap', 'b gap', 'bgap', 'playside b', 'backside b'],
    description: 'B-Gap - Between guard and tackle',
    depth: 1.5,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left') || ref.responsibility.includes('backside b')) {
        return {
          x: ref.centerX - 60,
          y: ref.lineOfScrimmage - 15
        };
      }
      return {
        x: ref.centerX + 60,
        y: ref.lineOfScrimmage - 15
      };
    }
  },

  C_GAP: {
    matchTerms: ['c-gap', 'c gap', 'cgap', 'playside c', 'backside c'],
    description: 'C-Gap - Between tackle and tight end',
    depth: 1.5,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left') || ref.responsibility.includes('backside c')) {
        return {
          x: ref.centerX - 100,
          y: ref.lineOfScrimmage - 15
        };
      }
      return {
        x: ref.centerX + 100,
        y: ref.lineOfScrimmage - 15
      };
    }
  },

  D_GAP: {
    matchTerms: ['d-gap', 'd gap', 'dgap', 'playside d', 'backside d'],
    description: 'D-Gap - Outside tight end',
    depth: 1.5,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left') || ref.responsibility.includes('backside d')) {
        return {
          x: ref.centerX - 140,
          y: ref.lineOfScrimmage - 15
        };
      }
      return {
        x: ref.centerX + 140,
        y: ref.lineOfScrimmage - 15
      };
    }
  },

  MIKE_LB: {
    matchTerms: ['mike', 'mlb', 'middle linebacker'],
    description: 'Mike Linebacker - Middle, 5-7 yards deep',
    depth: 6,
    getPosition: (ref) => ({
      x: ref.centerX,
      y: ref.lineOfScrimmage - 60
    })
  },

  WILL_LB: {
    matchTerms: ['will', 'wlb', 'weakside linebacker', 'weak lb'],
    description: 'Will Linebacker - Weakside, 5-7 yards deep',
    depth: 6,
    getPosition: (ref) => ({
      x: ref.centerX - 80,
      y: ref.lineOfScrimmage - 60
    })
  },

  SAM_LB: {
    matchTerms: ['sam', 'slb', 'strongside linebacker', 'strong lb'],
    description: 'Sam Linebacker - Strongside, 5-7 yards deep',
    depth: 6,
    getPosition: (ref) => ({
      x: ref.centerX + 80,
      y: ref.lineOfScrimmage - 60
    })
  },

  GENERIC_LB: {
    matchTerms: ['lb', 'linebacker', 'backer'],
    description: 'Generic Linebacker - 5-7 yards deep',
    depth: 6,
    getPosition: (ref) => ({
      x: ref.centerX,
      y: ref.lineOfScrimmage - 60
    })
  },

  SECOND_LEVEL: {
    matchTerms: ['second level', '2nd level', 'next level'],
    description: 'Second level defender - 6-8 yards deep',
    depth: 7,
    getPosition: (ref) => ({
      x: ref.centerX,
      y: ref.lineOfScrimmage - 70
    })
  },

  FREE_SAFETY: {
    matchTerms: ['free safety', 'free', 'fs', 'single high'],
    description: 'Free Safety - Deep middle, 10-12 yards',
    depth: 11,
    getPosition: (ref) => ({
      x: ref.centerX,
      y: ref.lineOfScrimmage - 110
    })
  },

  STRONG_SAFETY: {
    matchTerms: ['strong safety', 'strong', 'ss'],
    description: 'Strong Safety - Strongside, 8-12 yards',
    depth: 10,
    getPosition: (ref) => ({
      x: ref.centerX + 100,
      y: ref.lineOfScrimmage - 100
    })
  },

  CORNERBACK: {
    matchTerms: ['corner', 'cornerback', 'cb'],
    description: 'Cornerback - Outside, 8-10 yards',
    depth: 9,
    getPosition: (ref) => {
      if (ref.responsibility.includes('left')) {
        return {
          x: 100,
          y: ref.lineOfScrimmage - 90
        };
      }
      return {
        x: 600,
        y: ref.lineOfScrimmage - 90
      };
    }
  },

  SAFETY: {
    matchTerms: ['safety'],
    description: 'Generic Safety - Deep, 10-12 yards',
    depth: 11,
    getPosition: (ref) => ({
      x: ref.centerX + 50,
      y: ref.lineOfScrimmage - 110
    })
  }
};

export function getDefensivePositionFromConfig(
  responsibility: string,
  offensiveLineRef: OffensiveLineReference
): { x: number; y: number } | null {
  const resp = responsibility.toLowerCase();

  for (const alignment of Object.values(DEFENSIVE_ALIGNMENTS)) {
    const matches = alignment.matchTerms.some(term => resp.includes(term.toLowerCase()));
    
    if (matches) {
      return alignment.getPosition({
        ...offensiveLineRef,
        responsibility: resp
      });
    }
  }

  return null;
}

export function getDefensiveAlignmentsByLevel(level: 'DL' | 'LB' | 'DB'): DefensiveAlignment[] {
  return Object.values(DEFENSIVE_ALIGNMENTS).filter(alignment => {
    if (level === 'DL') return alignment.depth <= 2;
    if (level === 'LB') return alignment.depth > 2 && alignment.depth <= 8;
    if (level === 'DB') return alignment.depth > 8;
    return false;
  });
}

export function getAllDefensiveTechniques(): string[] {
  return Object.values(DEFENSIVE_ALIGNMENTS).map(a => a.description);
}

// ============================================
// FORMATION METADATA FOR COACHES
// ============================================

export const FORMATION_METADATA = {
  'Shotgun Spread': {
    usage: 'Modern base formation, balanced pass/run',
    runPercent: 40,
    passPercent: 60,
    personnel: '11 personnel (1RB, 1TE, 3WR)',
    strengths: 'QB can see defense, multiple passing options, good run lanes',
    weaknesses: 'Less power running, longer snap',
    commonPlays: ['Inside Zone', 'RPO', 'Mesh', 'Four Verticals']
  },
  'Gun Trips Right': {
    usage: 'Pass-heavy, overload one side',
    runPercent: 30,
    passPercent: 70,
    personnel: '11 personnel',
    strengths: 'Forces defense to shift coverage, creates 1-on-1 matchups',
    weaknesses: 'Predictable run direction, exposes backside',
    commonPlays: ['Flood', 'Levels', 'Outside Zone to weak side']
  },
  'Gun Trips Left': {
    usage: 'Mirror of Trips Right',
    runPercent: 30,
    passPercent: 70,
    personnel: '11 personnel',
    strengths: 'Forces defense to shift coverage, creates 1-on-1 matchups',
    weaknesses: 'Predictable run direction, exposes backside',
    commonPlays: ['Flood', 'Levels', 'Outside Zone to weak side']
  },
  'Gun Empty': {
    usage: 'Pure passing formation, spreads defense',
    runPercent: 10,
    passPercent: 90,
    personnel: '10 personnel (1RB, 0TE, 4WR)',
    strengths: 'Maximum passing options, identifies coverage pre-snap',
    weaknesses: 'No pass protection help, difficult to run',
    commonPlays: ['Hot routes', 'Quick game', 'QB draw']
  },
  'Gun Doubles': {
    usage: 'Balanced 2x2 receiver sets',
    runPercent: 45,
    passPercent: 55,
    personnel: '11 personnel',
    strengths: 'Balanced attack, good vs all coverages, versatile',
    weaknesses: 'No clear strength side',
    commonPlays: ['Inside Zone', 'Power Read', 'Spacing']
  },
  'I-Formation': {
    usage: 'Power running, lead blocker',
    runPercent: 70,
    passPercent: 30,
    personnel: '21 personnel (2RB, 1TE, 2WR)',
    strengths: 'Strong inside run game, play action passes, lead blocker',
    weaknesses: 'Predictable, limited passing options',
    commonPlays: ['Power', 'Iso', 'Counter', 'Play Action Boot']
  },
  'Pro Set': {
    usage: 'Balanced traditional formation',
    runPercent: 55,
    passPercent: 45,
    personnel: '21 personnel',
    strengths: 'Can run or pass equally, keeps defense honest',
    weaknesses: 'No clear advantage, less common in modern football',
    commonPlays: ['Inside Zone', 'Outside Zone', 'Play Action']
  },
  'Singleback': {
    usage: 'Modern balanced attack',
    runPercent: 50,
    passPercent: 50,
    personnel: '11 personnel',
    strengths: 'Versatile, can attack anywhere, popular at all levels',
    weaknesses: 'Requires good all-around talent',
    commonPlays: ['Inside Zone', 'Power', 'Drive', 'Smash']
  },
  'Wing-T': {
    usage: 'Misdirection, power running',
    runPercent: 75,
    passPercent: 25,
    personnel: '21 personnel',
    strengths: 'Excellent misdirection, pulls defense out of position',
    weaknesses: 'Limited deep passing, complex for youth, timing critical',
    commonPlays: ['Buck Sweep', 'Trap', 'Counter', 'Waggle']
  },
  'Power I': {
    usage: 'Goal line, short yardage',
    runPercent: 85,
    passPercent: 15,
    personnel: '22 personnel (2RB, 2TE, 1WR)',
    strengths: 'Maximum blocking, dominant at point of attack',
    weaknesses: 'Very predictable, limited in open field',
    commonPlays: ['Power', 'Iso', 'QB Sneak', 'Play Action Boot']
  },
  'Wishbone': {
    usage: 'Triple option, high school specialty',
    runPercent: 90,
    passPercent: 10,
    personnel: '30 personnel (3RB, 0TE, 2WR)',
    strengths: 'Multiple run threats, confuses defense assignments',
    weaknesses: 'Rare in modern football, limited passing threat',
    commonPlays: ['Veer', 'Midline', 'Counter Option', 'Dive']
  },
  'Flexbone': {
    usage: 'Modern option attack',
    runPercent: 80,
    passPercent: 20,
    personnel: '21 personnel',
    strengths: 'Spread option principles, A-backs create mismatches',
    weaknesses: 'Requires mobile QB, complex reads, timing critical',
    commonPlays: ['Triple Option', 'Rocket Sweep', 'Load Option', 'Midline']
  },
  'Pistol': {
    usage: 'Hybrid shotgun/under center',
    runPercent: 55,
    passPercent: 45,
    personnel: '11 or 21 personnel',
    strengths: 'QB closer for handoffs, good read option, versatile',
    weaknesses: 'Jack of all trades, master of none',
    commonPlays: ['Power Read', 'Inside Zone', 'Counter', 'Boot']
  },
  'Goalline': {
    usage: 'Goalline and short yardage situations',
    runPercent: 95,
    passPercent: 5,
    personnel: '23 personnel (2RB, 3TE, 0WR)',
    strengths: 'Maximum blockers, overwhelming power at point of attack, multiple lead blockers',
    weaknesses: 'Extremely predictable, no passing threat, vulnerable to goal line stunts',
    commonPlays: ['QB Sneak', 'Iso', 'Power', 'Dive', 'Toss']
  }
};

// ============================================
// DEFENSIVE FORMATIONS
// ============================================

// REPLACE the DEFENSIVE_FORMATIONS in src/config/footballConfig.ts
// This goes around line 1050-1100
// DELETE the old formations and replace with these 6:

export const DEFENSIVE_FORMATIONS: FormationConfig = {
  
  // ============================================
  // 6-2 FORMATION
  // DL (6): 9–5–3–1–3–9 from strong to weak
  // LB (2): stack over B-gaps at 3.5–4 yds
  // DB (3): two corners, one middle safety
  // ============================================
  '6-2': [
    // Defensive Line (6 players on LOS, y=185 = 1.5 yards off LOS)
    { position: 'DE', x: 140, y: 185, label: 'SDE', responsibility: '9-tech strong' },
    { position: 'DT1', x: 220, y: 185, label: 'SDT', responsibility: '5-tech strong' },
    { position: 'DT1', x: 270, y: 185, label: 'DT1', responsibility: '3-tech strong' },
    { position: 'DT2', x: 330, y: 185, label: 'NT', responsibility: '1-tech weak' },
    { position: 'DT2', x: 380, y: 185, label: 'DT2', responsibility: '3-tech weak' },
    { position: 'DE', x: 460, y: 185, label: 'WDE', responsibility: '9-tech weak' },
    
    // Linebackers (2 players, y=160 = 4 yards deep)
    { position: 'LB', x: 260, y: 160, label: 'SLB', responsibility: 'B-gap strong' },
    { position: 'LB', x: 340, y: 160, label: 'WLB', responsibility: 'B-gap weak' },
    
    // Defensive Backs (3 players)
    { position: 'LCB', x: 70, y: 140, label: 'LCB', responsibility: 'corner strong' },
    { position: 'RCB', x: 530, y: 140, label: 'RCB', responsibility: 'corner weak' },
    { position: 'FS', x: 300, y: 90, label: 'FS', responsibility: 'free safety' }
  ],

  // ============================================
  // 5-3 FORMATION  
  // DL (5): 9–5–0–5–9
  // LB (3): Sam/Will over C-gaps, Mike over ball
  // DB (3): two corners, one high safety
  // ============================================
  '5-3': [
    // Defensive Line (5 players)
    { position: 'DE', x: 140, y: 185, label: 'SDE', responsibility: '9-tech strong' },
    { position: 'DT1', x: 220, y: 185, label: 'SDT', responsibility: '5-tech strong' },
    { position: 'NT', x: 300, y: 185, label: 'NT', responsibility: '0-tech' },
    { position: 'DT2', x: 380, y: 185, label: 'WDT', responsibility: '5-tech weak' },
    { position: 'DE', x: 460, y: 185, label: 'WDE', responsibility: '9-tech weak' },
    
    // Linebackers (3 players, y=160 = 4 yards)
    { position: 'SAM', x: 180, y: 160, label: 'SAM', responsibility: 'C-gap strong' },
    { position: 'MIKE', x: 300, y: 165, label: 'MIKE', responsibility: 'over ball' },
    { position: 'WILL', x: 420, y: 160, label: 'WILL', responsibility: 'C-gap weak' },
    
    // Defensive Backs (3 players)
    { position: 'LCB', x: 70, y: 140, label: 'LCB', responsibility: 'corner strong' },
    { position: 'RCB', x: 530, y: 140, label: 'RCB', responsibility: 'corner weak' },
    { position: 'FS', x: 300, y: 90, label: 'FS', responsibility: 'free safety' }
  ],

  // ============================================
  // 4-4 FORMATION
  // DL (4): 5–3–1–5 (S DT in 3-tech, W DT in 1-tech)
  // LB (4): Sam/Will apex, two inside backers over B/A
  // DB (3): two corners, one safety (or SS down for 4 DBs)
  // ============================================
  '4-4': [
    // Defensive Line (4 players)
    { position: 'DE', x: 180, y: 185, label: 'SDE', responsibility: '5-tech strong' },
    { position: 'DT1', x: 270, y: 185, label: 'SDT', responsibility: '3-tech strong' },
    { position: 'DT2', x: 330, y: 185, label: 'WDT', responsibility: '1-tech weak' },
    { position: 'DE', x: 420, y: 185, label: 'WDE', responsibility: '5-tech weak' },
    
    // Linebackers (4 players, y=160 = 3.5-4 yards)
    { position: 'SAM', x: 140, y: 160, label: 'SAM', responsibility: 'apex strong' },
    { position: 'MIKE', x: 260, y: 160, label: 'MIKE', responsibility: 'B-gap strong' },
    { position: 'WILL', x: 340, y: 160, label: 'WILL', responsibility: 'A-gap weak' },
    { position: 'JACK', x: 460, y: 160, label: 'JACK', responsibility: 'apex weak' },
    
    // Defensive Backs (3 players)
    { position: 'LCB', x: 70, y: 140, label: 'LCB', responsibility: 'corner strong' },
    { position: 'RCB', x: 530, y: 140, label: 'RCB', responsibility: 'corner weak' },
    { position: 'FS', x: 300, y: 90, label: 'FS', responsibility: 'free safety' }
  ],

  // ============================================
  // 4-3 FORMATION (Most common high school defense)
  // DL (4): 5–3–1–5
  // LB (3): Sam apex strong, Mike over ball, Will weak B-gap
  // DB (4): two corners, SS in box (7-8 yds), FS deep
  // ============================================
  '4-3': [
    // Defensive Line (4 players)
    { position: 'DE', x: 180, y: 185, label: 'SDE', responsibility: '5-tech strong' },
    { position: 'DT1', x: 270, y: 185, label: 'DT1', responsibility: '3-tech strong' },
    { position: 'DT2', x: 330, y: 185, label: 'DT2', responsibility: '1-tech weak' },
    { position: 'DE', x: 420, y: 185, label: 'WDE', responsibility: '5-tech weak' },
    
    // Linebackers (3 players)
    { position: 'SAM', x: 140, y: 160, label: 'SAM', responsibility: 'apex strong' },
    { position: 'MIKE', x: 300, y: 160, label: 'MIKE', responsibility: 'over ball' },
    { position: 'WILL', x: 360, y: 160, label: 'WILL', responsibility: 'B-gap weak' },
    
    // Defensive Backs (4 players)
    { position: 'LCB', x: 70, y: 135, label: 'LCB', responsibility: 'corner strong' },
    { position: 'RCB', x: 530, y: 135, label: 'RCB', responsibility: 'corner weak' },
    { position: 'SS', x: 200, y: 130, label: 'SS', responsibility: 'strong safety box' },
    { position: 'FS', x: 300, y: 90, label: 'FS', responsibility: 'free safety' }
  ],

  // ============================================
  // 3-4 FORMATION
  // DL (3): 4i–0–4i (inside shoulders of tackles)
  // LB (4): OLBs at 1 yd on edges (9s), ILBs at 4.5 yds over A-gaps
  // DB (4): two corners, two safeties
  // ============================================
  '3-4': [
    // Defensive Line (3 players)
    { position: 'DE', x: 240, y: 185, label: 'SDE', responsibility: '4i-tech strong' },
    { position: 'NT', x: 300, y: 185, label: 'NT', responsibility: '0-tech' },
    { position: 'DE', x: 360, y: 185, label: 'WDE', responsibility: '4i-tech weak' },
    
    // Linebackers (4 players)
    { position: 'OLB', x: 120, y: 190, label: 'SOLB', responsibility: '9-tech strong edge' },
    { position: 'ILB', x: 270, y: 155, label: 'SILB', responsibility: 'A-gap strong' },
    { position: 'ILB', x: 330, y: 155, label: 'WILB', responsibility: 'A-gap weak' },
    { position: 'OLB', x: 480, y: 190, label: 'WOLB', responsibility: '9-tech weak edge' },
    
    // Defensive Backs (4 players)
    { position: 'LCB', x: 70, y: 135, label: 'LCB', responsibility: 'corner strong' },
    { position: 'RCB', x: 530, y: 135, label: 'RCB', responsibility: 'corner weak' },
    { position: 'SS', x: 200, y: 90, label: 'SS', responsibility: 'strong safety' },
    { position: 'FS', x: 400, y: 90, label: 'FS', responsibility: 'free safety' }
  ],

  // ============================================
  // 4-2-5 FORMATION (Nickel - pass defense)
  // DL (4): 5–3–1–5
  // LB (2): Mike and Will at 4.5 yds (A/B gaps)
  // DB (5): two corners, Nickel apex over #2 field, SS box side, FS deep
  // ============================================
  '4-2-5': [
    // Defensive Line (4 players)
    { position: 'DE', x: 180, y: 185, label: 'SDE', responsibility: '5-tech strong' },
    { position: 'DT1', x: 270, y: 185, label: 'DT1', responsibility: '3-tech strong' },
    { position: 'DT2', x: 330, y: 185, label: 'DT2', responsibility: '1-tech weak' },
    { position: 'DE', x: 420, y: 185, label: 'WDE', responsibility: '5-tech weak' },
    
    // Linebackers (2 players)
    { position: 'MIKE', x: 270, y: 155, label: 'MIKE', responsibility: 'A-gap strong' },
    { position: 'WILL', x: 330, y: 155, label: 'WILL', responsibility: 'B-gap weak' },
    
    // Defensive Backs (5 players)
    { position: 'LCB', x: 70, y: 145, label: 'LCB', responsibility: 'corner strong' },
    { position: 'RCB', x: 530, y: 145, label: 'RCB', responsibility: 'corner weak' },
    { position: 'NB', x: 420, y: 155, label: 'NB', responsibility: 'nickel apex #2' },
    { position: 'SS', x: 200, y: 130, label: 'SS', responsibility: 'strong safety box' },
    { position: 'FS', x: 300, y: 90, label: 'FS', responsibility: 'free safety' }
  ],

  // ============================================
  // GOALLINE DEFENSE (6-5 heavy front)
  // DL (6): Extra linemen to clog gaps
  // LB (3): Stacked tight behind DL
  // DB (2): Only 2 DBs, both in run support
  // ============================================
  'Goalline': [
    // Defensive Line (6 players - heavy front to stop run)
    { position: 'DE', x: 120, y: 185, label: 'SDE', responsibility: 'C-gap contain' },
    { position: 'DT1', x: 200, y: 185, label: 'DT1', responsibility: 'B-gap strong' },
    { position: 'NT', x: 270, y: 185, label: 'NT', responsibility: 'A-gap strong' },
    { position: 'NT2', x: 330, y: 185, label: 'NT2', responsibility: 'A-gap weak' },
    { position: 'DT2', x: 400, y: 185, label: 'DT2', responsibility: 'B-gap weak' },
    { position: 'DE', x: 480, y: 185, label: 'WDE', responsibility: 'C-gap contain' },

    // Linebackers (3 players - stacked tight, fill gaps)
    { position: 'SAM', x: 160, y: 160, label: 'SAM', responsibility: 'D-gap strong' },
    { position: 'MIKE', x: 300, y: 160, label: 'MIKE', responsibility: 'scrape over ball' },
    { position: 'WILL', x: 440, y: 160, label: 'WILL', responsibility: 'D-gap weak' },

    // Defensive Backs (2 players - both in run support)
    { position: 'SS', x: 200, y: 130, label: 'SS', responsibility: 'alley strong, run support' },
    { position: 'FS', x: 400, y: 130, label: 'FS', responsibility: 'alley weak, run support' }
  ]
};
// ============================================
// COVERAGE SYSTEM
// ============================================

/**
 * Coverage role types for each position group
 */
export const COVERAGE_ROLES = {
  DB: [
    'Deep Third',
    'Deep Half', 
    'Quarter',
    'Flat',
    'Man'
  ],
  LB: [
    'Hook-Curl',
    'Curl-to-Flat',
    'Middle Hook',
    'Low-Hole (Robber)',
    'Man'
  ],
  
} as const;

/**
 * Blitz gap options
 */
export const BLITZ_GAPS = [
  'Strong A-gap',
  'Weak A-gap',
  'Strong B-gap',
  'Weak B-gap',
  'Strong C-gap',
  'Weak C-gap'
] as const;
/**
 * Coverage definition structure
 */
export interface CoverageDefinition {
  name: string;
  description: string;
  deepCount: number;
  underCount: number;
  assignments: {
    [positionLabel: string]: {
      role: string;
      depth?: number;
      description: string;
    }
  };
}

export const COVERAGES: Record<string, CoverageDefinition> = {
  
  // ============================================
  // COVER 3 - Three deep, four under
  // ============================================
  'Cover 3': {
    name: 'Cover 3',
    description: 'Three deep thirds, four underneath zones',
    deepCount: 3,
    underCount: 4,
    assignments: {
      // Deep zones (corners + safety)
      'LCB': { role: 'Deep Third', depth: 12, description: 'Outside third left' },
      'RCB': { role: 'Deep Third', depth: 12, description: 'Outside third right' },
      'FS': { role: 'Deep Third', depth: 12, description: 'Middle third' },
      'SS': { role: 'Deep Third', depth: 12, description: 'Rolled to third' },
      
      // Underneath zones (linebackers)
      'SAM': { role: 'Hook-Curl', depth: 8, description: 'Hook-curl strong' },
      'MIKE': { role: 'Middle Hook', depth: 10, description: 'Middle hole, carry #3 to 10-12 yds' },
      'WILL': { role: 'Hook-Curl', depth: 8, description: 'Hook-curl weak' },
      'SOLB': { role: 'Hook-Curl', depth: 8, description: 'Hook-curl strong' },
      'WOLB': { role: 'Hook-Curl', depth: 8, description: 'Hook-curl weak' },
      'SILB': { role: 'Middle Hook', depth: 10, description: 'Inside hook' },
      'WILB': { role: 'Middle Hook', depth: 10, description: 'Inside hook' },
      'SLB': { role: 'Hook-Curl', depth: 8, description: 'Hook strong' },
      'WLB': { role: 'Hook-Curl', depth: 8, description: 'Hook weak' },
      'JACK': { role: 'Hook-Curl', depth: 8, description: 'Hook weak' },
      'NB': { role: 'Flat', depth: 6, description: 'Nickel flat' },
      
      // D-Line (contain)
      'SDE': { role: 'Contain', description: 'Contain strong edge' },
      'WDE': { role: 'Contain', description: 'Contain weak edge' },
      'DE': { role: 'Contain', description: 'Contain edge' },
      'DT': { role: 'Contain', description: 'Rush' },
      'NT': { role: 'Contain', description: 'Rush' },
      'SDT': { role: 'Contain', description: 'Rush' },
      'WDT': { role: 'Contain', description: 'Rush' }
    }
  },

  // ============================================
  // COVER 2 - Two deep halves
  // ============================================
  'Cover 2': {
    name: 'Cover 2',
    description: 'Two deep halves, five underneath',
    deepCount: 2,
    underCount: 5,
    assignments: {
      // Deep zones (safeties)
      'FS': { role: 'Deep Half', depth: 12, description: 'Deep half' },
      'SS': { role: 'Deep Half', depth: 12, description: 'Deep half' },
      
      // Corners squat
      'LCB': { role: 'Flat', depth: 5, description: 'Squat/jam flat left' },
      'RCB': { role: 'Flat', depth: 5, description: 'Squat/jam flat right' },

      // Linebackers
      'SAM': { role: 'Curl-to-Flat', depth: 7, description: 'Curl-to-flat strong' },
      'MIKE': { role: 'Middle Hook', depth: 9, description: 'Middle hole 8-10 yds' },
      'WILL': { role: 'Curl-to-Flat', depth: 7, description: 'Curl-to-flat weak' },
      'SOLB': { role: 'Curl-to-Flat', depth: 7, description: 'Curl-to-flat strong' },
      'WOLB': { role: 'Curl-to-Flat', depth: 7, description: 'Curl-to-flat weak' },
      'SILB': { role: 'Middle Hook', depth: 9, description: 'Inside hook' },
      'WILB': { role: 'Middle Hook', depth: 9, description: 'Inside hook' },
      'SLB': { role: 'Hook-Curl', depth: 7, description: 'Hook strong' },
      'WLB': { role: 'Hook-Curl', depth: 7, description: 'Hook weak' },
      'JACK': { role: 'Curl-to-Flat', depth: 7, description: 'Curl weak' },
      'NB': { role: 'Curl-to-Flat', depth: 7, description: 'Nickel curl-flat' },
      
      // D-Line
      'SDE': { role: 'Contain', description: 'Contain strong' },
      'WDE': { role: 'Contain', description: 'Contain weak' },
      'DE': { role: 'Contain', description: 'Contain' },
      'DT': { role: 'Contain', description: 'Rush' },
      'NT': { role: 'Contain', description: 'Rush' },
      'SDT': { role: 'Contain', description: 'Rush' },
      'WDT': { role: 'Contain', description: 'Rush' }
    }
  },

  // ============================================
  // COVER 1 - Man-free
  // ============================================
  'Cover 1': {
    name: 'Cover 1',
    description: 'Man coverage with free safety',
    deepCount: 1,
    underCount: 0,
    assignments: {
      // Deep safety
      'FS': { role: 'Deep Half', depth: 12, description: 'Free safety middle' },
      
      // Man coverage
      'LCB': { role: 'Man', description: 'Man on #1 left' },
      'RCB': { role: 'Man', description: 'Man on #1 right' },
      'SS': { role: 'Man', description: 'Man on TE or #2' },
      'NB': { role: 'Man', description: 'Man on slot' },
      
      // Linebackers in man
      'SAM': { role: 'Man', description: 'Match RB/TE' },
      'MIKE': { role: 'Man', description: 'Match RB/TE' },
      'WILL': { role: 'Man', description: 'Match RB/TE' },
      'SOLB': { role: 'Man', description: 'Match RB/TE' },
      'WOLB': { role: 'Man', description: 'Match RB/TE' },
      'SILB': { role: 'Man', description: 'Match RB' },
      'WILB': { role: 'Man', description: 'Match RB' },
      'SLB': { role: 'Man', description: 'Match back' },
      'WLB': { role: 'Man', description: 'Match back' },
      'JACK': { role: 'Man', description: 'Match back/slot' },
      
      // D-Line
      'SDE': { role: 'Contain', description: 'Contain strong' },
      'WDE': { role: 'Contain', description: 'Contain weak' },
      'DE': { role: 'Contain', description: 'Contain' },
      'DT': { role: 'Contain', description: 'Rush' },
      'NT': { role: 'Contain', description: 'Rush' },
      'SDT': { role: 'Contain', description: 'Rush' },
      'WDT': { role: 'Contain', description: 'Rush' }
    }
  },

  // ============================================
  // COVER 0 - All-out man, no deep help
  // ============================================
  'Cover 0': {
    name: 'Cover 0',
    description: 'Man coverage, no deep help (blitz)',
    deepCount: 0,
    underCount: 0,
    assignments: {
      // Everyone in man
      'LCB': { role: 'Man', description: 'Man on #1 left' },
      'RCB': { role: 'Man', description: 'Man on #1 right' },
      'FS': { role: 'Man', description: 'Man on TE or back' },
      'SS': { role: 'Man', description: 'Man on TE or back' },
      'NB': { role: 'Man', description: 'Man on slot' },
      
      // Linebackers in man
      'SAM': { role: 'Man', description: 'Man on eligible' },
      'MIKE': { role: 'Man', description: 'Man on eligible' },
      'WILL': { role: 'Man', description: 'Man on eligible' },
      'SOLB': { role: 'Man', description: 'Man on eligible' },
      'WOLB': { role: 'Man', description: 'Man on eligible' },
      'SILB': { role: 'Man', description: 'Man on eligible' },
      'WILB': { role: 'Man', description: 'Man on eligible' },
      'SLB': { role: 'Man', description: 'Man on eligible' },
      'WLB': { role: 'Man', description: 'Man on eligible' },
      'JACK': { role: 'Man', description: 'Man on eligible' },
      
      // D-Line (often blitzing)
      'SDE': { role: 'Contain', description: 'Contain or blitz' },
      'WDE': { role: 'Contain', description: 'Contain or blitz' },
      'DE': { role: 'Contain', description: 'Contain or blitz' },
      'DT': { role: 'Contain', description: 'Rush or blitz' },
      'NT': { role: 'Contain', description: 'Rush or blitz' },
      'SDT': { role: 'Contain', description: 'Rush or blitz' },
      'WDT': { role: 'Contain', description: 'Rush or blitz' }
    }
  },

  // ============================================
  // COVER 4 - Quarters
  // ============================================
  'Cover 4': {
    name: 'Cover 4 (Quarters)',
    description: 'Four deep quarters, two underneath',
    deepCount: 4,
    underCount: 2,
    assignments: {
      // Deep quarters (corners + safeties)
      'LCB': { role: 'Quarter', depth: 10, description: 'Quarter, outside leverage left' },
      'RCB': { role: 'Quarter', depth: 10, description: 'Quarter, outside leverage right' },
      'FS': { role: 'Quarter', depth: 10, description: 'Quarter inside' },
      'SS': { role: 'Quarter', depth: 10, description: 'Quarter inside' },
      
      // OLBs apex and wall #2
      'SAM': { role: 'Hook-Curl', depth: 7, description: 'Apex, wall #2' },
      'WILL': { role: 'Hook-Curl', depth: 7, description: 'Apex, wall #2' },
      'SOLB': { role: 'Hook-Curl', depth: 7, description: 'Apex, wall #2' },
      'WOLB': { role: 'Hook-Curl', depth: 7, description: 'Apex, wall #2' },
      'JACK': { role: 'Hook-Curl', depth: 7, description: 'Apex, wall #2' },
      'NB': { role: 'Quarter', depth: 10, description: 'Nickel quarter' },
      
      // Mike carries #3
      'MIKE': { role: 'Middle Hook', depth: 11, description: 'Carry #3 to 10-12' },
      'SILB': { role: 'Middle Hook', depth: 11, description: 'Carry #3' },
      'WILB': { role: 'Middle Hook', depth: 11, description: 'Carry #3' },
      'SLB': { role: 'Hook-Curl', depth: 7, description: 'Hook' },
      'WLB': { role: 'Hook-Curl', depth: 7, description: 'Hook' },
      
      // D-Line
      'SDE': { role: 'Contain', description: 'Contain strong' },
      'WDE': { role: 'Contain', description: 'Contain weak' },
      'DE': { role: 'Contain', description: 'Contain' },
      'DT': { role: 'Contain', description: 'Rush' },
      'NT': { role: 'Contain', description: 'Rush' },
      'SDT': { role: 'Contain', description: 'Rush' },
      'WDT': { role: 'Contain', description: 'Rush' }
    }
  },

  // ============================================
  // COVER 6 - Quarter-Quarter-Half
  // ============================================
  'Cover 6': {
    name: 'Cover 6 (Quarter-Quarter-Half)',
    description: 'Quarters to one side, Cover 2 to other',
    deepCount: 3,
    underCount: 3,
    assignments: {
      // Quarters side (strong)
      'LCB': { role: 'Quarter', depth: 10, description: 'Strong corner quarter' },
      'SS': { role: 'Quarter', depth: 10, description: 'Strong safety quarter' },

      // Half side (weak)
      'RCB': { role: 'Flat', depth: 5, description: 'Weak corner flat' },
      'FS': { role: 'Deep Half', depth: 12, description: 'Weak safety deep half' },
      
      // Linebackers
      'SAM': { role: 'Hook-Curl', depth: 7, description: 'Wall #2 strong' },
      'WILL': { role: 'Curl-to-Flat', depth: 7, description: 'Curl-to-flat weak' },
      'MIKE': { role: 'Middle Hook', depth: 10, description: 'Relate to #3' },
      'SOLB': { role: 'Hook-Curl', depth: 7, description: 'Wall #2 strong' },
      'WOLB': { role: 'Curl-to-Flat', depth: 7, description: 'Curl-flat weak' },
      'SILB': { role: 'Middle Hook', depth: 10, description: 'Relate to #3' },
      'WILB': { role: 'Middle Hook', depth: 10, description: 'Relate to #3' },
      'SLB': { role: 'Hook-Curl', depth: 7, description: 'Hook strong' },
      'WLB': { role: 'Curl-to-Flat', depth: 7, description: 'Curl-flat weak' },
      'JACK': { role: 'Curl-to-Flat', depth: 7, description: 'Curl-flat' },
      'NB': { role: 'Flat', depth: 5, description: 'Nickel flat' },
      
      // D-Line
      'SDE': { role: 'Contain', description: 'Contain strong' },
      'WDE': { role: 'Contain', description: 'Contain weak' },
      'DE': { role: 'Contain', description: 'Contain' },
      'DT': { role: 'Contain', description: 'Rush' },
      'NT': { role: 'Contain', description: 'Rush' },
      'SDT': { role: 'Contain', description: 'Rush' },
      'WDT': { role: 'Contain', description: 'Rush' }
    }
  }
};
/**
 * Helper function to get coverage assignment for a specific player
 */
export function getCoverageAssignment(
  playerLabel: string,
  coverageName: string
): { role: string; depth?: number; description: string } | null {
  const coverage = COVERAGES[coverageName];
  if (!coverage) return null;
  
  return coverage.assignments[playerLabel] || null;
}

/**
 * Apply coverage to all players in formation
 */
export function applyCoverageToFormation(
  players: any[],
  coverageName: string
): any[] {
  const coverage = COVERAGES[coverageName];
  if (!coverage) return players;
  
  return players.map(player => {
    const assignment = coverage.assignments[player.label];
    if (assignment) {
      return {
        ...player,
        coverageRole: assignment.role,
        coverageDepth: assignment.depth,
        coverageDescription: assignment.description
      };
    }
    return player;
  });
}

// ============================================
// ATTRIBUTE SCHEMA FOR DATABASE
// ============================================

export interface PlayAttributes {
  odk: 'offense' | 'defense' | 'specialTeams';
  formation: string;
  downDistance?: string;
  fieldZone?: string;
  hash?: string;
  gameContext?: string[];
  customTags?: string[];
  
  playType?: string;
  personnel?: string;
  runConcept?: string;
  passConcept?: string;
  protection?: string;
  motion?: string;
  targetHole?: string;
  ballCarrier?: string;
  
  front?: string;
  coverage?: string;
  blitzType?: string;
  stunt?: string;
  pressLevel?: string;
  
  unit?: string;
  kickoffType?: string;
  puntType?: string;
  returnScheme?: string;
  
  result?: {
    outcome?: string;
    yardsGained?: number;
    isSuccess?: boolean;
    notes?: string;
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getAttributeOptions(odk: 'offense' | 'defense' | 'specialTeams') {
  const common = COMMON_ATTRIBUTES;
  
  switch (odk) {
    case 'offense':
      return {
        ...common,
        ...OFFENSIVE_ATTRIBUTES,
        formations: Object.keys(OFFENSIVE_FORMATIONS)
      };
    case 'defense':
      return {
        ...common,
        ...DEFENSIVE_ATTRIBUTES,
        formations: Object.keys(DEFENSIVE_FORMATIONS)
      };
    case 'specialTeams':
      return {
        ...common,
        ...SPECIAL_TEAMS_ATTRIBUTES,
        formations: Object.keys(SPECIAL_TEAMS_FORMATIONS)
      };
  }
}

export function getAssignmentOptions(position: string, playType: 'run' | 'pass'): string[] {
  const positionUpper = position.toUpperCase();
  
  // Offensive Linemen: Only blocking assignments
  if (POSITION_GROUPS.linemen.includes(position)) {
    return [...BLOCKING_ASSIGNMENTS];
  }
  
  // QB/RB/FB/TB: Unified skill position assignments (routes + block)
  // Coach decides what makes sense for their play design
  if (POSITION_GROUPS.backs.includes(position)) {
    return [...SKILL_POSITION_ASSIGNMENTS];
  }
  
  // WR/TE/Receivers: Same unified assignments
  if (POSITION_GROUPS.receivers.includes(position) || 
      positionUpper.includes('WR') || 
      positionUpper.includes('TE') ||
      ['X', 'Y', 'Z', 'SL', 'SR', 'SE', 'FL'].includes(positionUpper)) {
    return [...SKILL_POSITION_ASSIGNMENTS];
  }
  
  // Fallback: return skill position assignments
  return [...SKILL_POSITION_ASSIGNMENTS];
}

export function validatePlayAttributes(attributes: Partial<PlayAttributes>): boolean {
  if (!attributes.odk || !attributes.formation) {
    return false;
  }
  return true;
}
// Special Teams Formations Configuration
// Kickoff: Players start near top of field (y=50) to show coverage lanes going down
export const SPECIAL_TEAMS_FORMATIONS = {
  'Kickoff': [
    { position: 'K', label: 'K', x: 350, y: 50 },
    { position: 'KL1', label: 'L1', x: 290, y: 50 },
    { position: 'KL2', label: 'L2', x: 240, y: 50 },
    { position: 'KL3', label: 'L3', x: 190, y: 50 },
    { position: 'KL4', label: 'L4', x: 140, y: 50 },
    { position: 'KL5', label: 'L5', x: 90, y: 50 },
    { position: 'KR1', label: 'R1', x: 410, y: 50 },
    { position: 'KR2', label: 'R2', x: 460, y: 50 },
    { position: 'KR3', label: 'R3', x: 510, y: 50 },
    { position: 'KR4', label: 'R4', x: 560, y: 50 },
    { position: 'KR5', label: 'R5', x: 610, y: 50 },
  ],
  'Kick Return': [
    // Front line of blockers at TOP (closest to opponent, will block toward top)
    { position: 'FL1', label: 'L1', x: 140, y: 210 },
    { position: 'FL2', label: 'L2', x: 245, y: 210 },
    { position: 'FL3', label: 'L3', x: 350, y: 210 },
    { position: 'FL4', label: 'L4', x: 455, y: 210 },
    { position: 'FL5', label: 'L5', x: 560, y: 210 },
    // Second line of blockers (wedge) - in the MIDDLE
    { position: 'SL1', label: 'L6', x: 280, y: 290 },
    { position: 'SL2', label: 'L7', x: 350, y: 290 },
    { position: 'SL3', label: 'L8', x: 420, y: 290 },
    // Returners at the BOTTOM (deepest, catching kick, will return toward top)
    { position: 'R', label: 'R', x: 320, y: 370 },
    { position: 'R2', label: 'R2', x: 380, y: 370 },
  ],
  'Punt': [
    // Gunners (wide on each side)
    { position: 'GunnerL', label: 'GL', x: 120, y: 200 },
    { position: 'GunnerR', label: 'GR', x: 580, y: 200 },
    // Wings (between gunners and line)
    { position: 'WingL', label: 'WL', x: 240, y: 230 },
    { position: 'WingR', label: 'WR', x: 460, y: 230 },
    // Line (5 players) - LT, LG, LS, RG, RT
    { position: 'LT', label: 'LT', x: 300, y: 200 },
    { position: 'LG', label: 'LG', x: 330, y: 200 },
    { position: 'LS', label: 'LS', x: 350, y: 200 },
    { position: 'RG', label: 'RG', x: 370, y: 200 },
    { position: 'RT', label: 'RT', x: 400, y: 200 },
    // Personal Protector (behind line, slightly right)
    { position: 'PP', label: 'PP', x: 380, y: 270 },
    // Punter (deep)
    { position: 'P', label: 'P', x: 350, y: 330 },
  ],
  'Punt Return': [
    { position: 'R', label: 'R', x: 350, y: 60 },
    { position: 'R2', label: 'R2', x: 380, y: 90 },
    { position: 'JamL', label: 'JL', x: 150, y: 195 },
    { position: 'JamR', label: 'JR', x: 550, y: 195 },
    { position: 'Box1', label: 'B1', x: 250, y: 195 },
    { position: 'Box2', label: 'B2', x: 300, y: 195 },
    { position: 'Box3', label: 'B3', x: 350, y: 195 },
    { position: 'Box4', label: 'B4', x: 400, y: 195 },
    { position: 'Box5', label: 'B5', x: 450, y: 195 },
    { position: 'Box6', label: 'B6', x: 500, y: 195 },
  ],
  'Field Goal': [
    // Line (9 players tight together)
    { position: 'LS', label: 'LS', x: 350, y: 210 },
    { position: 'LG', label: 'LG', x: 325, y: 210 },
    { position: 'RG', label: 'RG', x: 375, y: 210 },
    { position: 'LT', label: 'LT', x: 300, y: 210 },
    { position: 'RT', label: 'RT', x: 400, y: 210 },
    { position: 'TEL', label: 'TL', x: 275, y: 210 },
    { position: 'TER', label: 'TR', x: 425, y: 210 },
    // Wings (outside the tight ends)
    { position: 'WL', label: 'WL', x: 250, y: 210 },
    { position: 'WR', label: 'WR', x: 450, y: 210 },
    // Holder and Kicker (behind the line, K to left and below H)
    { position: 'Holder', label: 'H', x: 350, y: 280 },
    { position: 'Kicker', label: 'K', x: 310, y: 310 },
  ],
};

export const SPECIAL_TEAMS_PLAYS = {
  'Kickoff': [
    'Deep Center',
    'Deep Left', 
    'Deep Right',
    'Squib Middle',
    'Squib Left',
    'Squib Right',
    'Onside Center',
    'Onside Left',
    'Onside Right',
  ],
  'Kick Return': [
    'Return Left',
    'Return Middle',
    'Return Right',
    'Onside Recovery Left',
    'Onside Recovery Right',
  ],
  'Punt': [
    'Punt',
    'Fake Punt Pass',
    'Fake Punt Run Off Tackle',
  ],
  'Punt Return': [
    'Return Left',
    'Return Middle',
    'Return Right',
    'Rush/Block',
  ],
  'Field Goal': [
    'Standard Field Goal',
    'Fake Field Goal Run',
    'Fake Field Goal Pass',
  ],
};

export const isOffensiveStyleSpecialTeam = (teamType: string): boolean => {
  return ['Kickoff', 'Punt', 'Field Goal'].includes(teamType);
};

// Generate kickoff coverage paths based on the selected play
// Returns an array of { position, endpoint } for each player
export function getKickoffPlayPaths(playName: string): Array<{ position: string; endpoint: { x: number; y: number } }> {
  // Field dimensions: 700w x 400h
  // Players start at y=50, field goes down to y=400
  // Center of field is x=350

  // Define target landing zones for different kick types
  // Players start at y=50, so all targets should be BELOW (higher Y values)
  const deepY = 380;      // Deep kicks land near bottom of field
  const squibY = 280;     // Squib kicks land mid-field
  const onsideY = 150;    // Onside kicks: short distance downfield (~10 yards = ~100px from y=50)

  // Horizontal targets
  const centerX = 350;
  const leftX = 180;
  const rightX = 520;

  // Player positions from formation (L5, L4, L3, L2, L1, K, R1, R2, R3, R4, R5)
  // For coverage lanes, players generally converge toward the ball landing spot
  // while maintaining their lane discipline

  switch (playName) {
    case 'Deep Center':
      // All players run straight lanes to deep center
      return [
        { position: 'K', endpoint: { x: centerX, y: deepY } },
        { position: 'KL1', endpoint: { x: centerX - 30, y: deepY } },
        { position: 'KL2', endpoint: { x: centerX - 70, y: deepY } },
        { position: 'KL3', endpoint: { x: centerX - 120, y: deepY } },
        { position: 'KL4', endpoint: { x: centerX - 170, y: deepY } },
        { position: 'KL5', endpoint: { x: leftX - 40, y: deepY } },
        { position: 'KR1', endpoint: { x: centerX + 30, y: deepY } },
        { position: 'KR2', endpoint: { x: centerX + 70, y: deepY } },
        { position: 'KR3', endpoint: { x: centerX + 120, y: deepY } },
        { position: 'KR4', endpoint: { x: centerX + 170, y: deepY } },
        { position: 'KR5', endpoint: { x: rightX + 40, y: deepY } },
      ];

    case 'Deep Left':
      // Players angle toward the left side
      return [
        { position: 'K', endpoint: { x: leftX + 50, y: deepY } },
        { position: 'KL1', endpoint: { x: leftX + 20, y: deepY } },
        { position: 'KL2', endpoint: { x: leftX - 10, y: deepY } },
        { position: 'KL3', endpoint: { x: leftX - 40, y: deepY } },
        { position: 'KL4', endpoint: { x: leftX - 60, y: deepY } },
        { position: 'KL5', endpoint: { x: 50, y: deepY } },
        { position: 'KR1', endpoint: { x: leftX + 80, y: deepY } },
        { position: 'KR2', endpoint: { x: leftX + 120, y: deepY } },
        { position: 'KR3', endpoint: { x: leftX + 170, y: deepY } },
        { position: 'KR4', endpoint: { x: centerX + 80, y: deepY } },
        { position: 'KR5', endpoint: { x: centerX + 150, y: deepY } },
      ];

    case 'Deep Right':
      // Players angle toward the right side
      return [
        { position: 'K', endpoint: { x: rightX - 50, y: deepY } },
        { position: 'KL1', endpoint: { x: rightX - 80, y: deepY } },
        { position: 'KL2', endpoint: { x: rightX - 120, y: deepY } },
        { position: 'KL3', endpoint: { x: rightX - 170, y: deepY } },
        { position: 'KL4', endpoint: { x: centerX - 80, y: deepY } },
        { position: 'KL5', endpoint: { x: centerX - 150, y: deepY } },
        { position: 'KR1', endpoint: { x: rightX - 20, y: deepY } },
        { position: 'KR2', endpoint: { x: rightX + 10, y: deepY } },
        { position: 'KR3', endpoint: { x: rightX + 40, y: deepY } },
        { position: 'KR4', endpoint: { x: rightX + 60, y: deepY } },
        { position: 'KR5', endpoint: { x: 650, y: deepY } },
      ];

    case 'Squib Middle':
      // Shorter paths, converge on mid-field center
      return [
        { position: 'K', endpoint: { x: centerX, y: squibY } },
        { position: 'KL1', endpoint: { x: centerX - 40, y: squibY } },
        { position: 'KL2', endpoint: { x: centerX - 90, y: squibY } },
        { position: 'KL3', endpoint: { x: centerX - 140, y: squibY } },
        { position: 'KL4', endpoint: { x: centerX - 180, y: squibY } },
        { position: 'KL5', endpoint: { x: leftX - 30, y: squibY } },
        { position: 'KR1', endpoint: { x: centerX + 40, y: squibY } },
        { position: 'KR2', endpoint: { x: centerX + 90, y: squibY } },
        { position: 'KR3', endpoint: { x: centerX + 140, y: squibY } },
        { position: 'KR4', endpoint: { x: centerX + 180, y: squibY } },
        { position: 'KR5', endpoint: { x: rightX + 30, y: squibY } },
      ];

    case 'Squib Left':
      return [
        { position: 'K', endpoint: { x: leftX + 30, y: squibY } },
        { position: 'KL1', endpoint: { x: leftX, y: squibY } },
        { position: 'KL2', endpoint: { x: leftX - 30, y: squibY } },
        { position: 'KL3', endpoint: { x: leftX - 60, y: squibY } },
        { position: 'KL4', endpoint: { x: 80, y: squibY } },
        { position: 'KL5', endpoint: { x: 50, y: squibY } },
        { position: 'KR1', endpoint: { x: leftX + 70, y: squibY } },
        { position: 'KR2', endpoint: { x: leftX + 120, y: squibY } },
        { position: 'KR3', endpoint: { x: centerX, y: squibY } },
        { position: 'KR4', endpoint: { x: centerX + 80, y: squibY } },
        { position: 'KR5', endpoint: { x: centerX + 150, y: squibY } },
      ];

    case 'Squib Right':
      return [
        { position: 'K', endpoint: { x: rightX - 30, y: squibY } },
        { position: 'KL1', endpoint: { x: rightX - 70, y: squibY } },
        { position: 'KL2', endpoint: { x: rightX - 120, y: squibY } },
        { position: 'KL3', endpoint: { x: centerX, y: squibY } },
        { position: 'KL4', endpoint: { x: centerX - 80, y: squibY } },
        { position: 'KL5', endpoint: { x: centerX - 150, y: squibY } },
        { position: 'KR1', endpoint: { x: rightX, y: squibY } },
        { position: 'KR2', endpoint: { x: rightX + 30, y: squibY } },
        { position: 'KR3', endpoint: { x: rightX + 60, y: squibY } },
        { position: 'KR4', endpoint: { x: 620, y: squibY } },
        { position: 'KR5', endpoint: { x: 650, y: squibY } },
      ];

    case 'Onside Center':
      // Very short paths, everyone converges quickly to center
      return [
        { position: 'K', endpoint: { x: centerX, y: onsideY } },
        { position: 'KL1', endpoint: { x: centerX - 20, y: onsideY } },
        { position: 'KL2', endpoint: { x: centerX - 50, y: onsideY } },
        { position: 'KL3', endpoint: { x: centerX - 80, y: onsideY } },
        { position: 'KL4', endpoint: { x: centerX - 110, y: onsideY } },
        { position: 'KL5', endpoint: { x: centerX - 140, y: onsideY } },
        { position: 'KR1', endpoint: { x: centerX + 20, y: onsideY } },
        { position: 'KR2', endpoint: { x: centerX + 50, y: onsideY } },
        { position: 'KR3', endpoint: { x: centerX + 80, y: onsideY } },
        { position: 'KR4', endpoint: { x: centerX + 110, y: onsideY } },
        { position: 'KR5', endpoint: { x: centerX + 140, y: onsideY } },
      ];

    case 'Onside Left':
      // Short paths converging to the left
      return [
        { position: 'K', endpoint: { x: leftX, y: onsideY } },
        { position: 'KL1', endpoint: { x: leftX - 20, y: onsideY } },
        { position: 'KL2', endpoint: { x: leftX - 50, y: onsideY } },
        { position: 'KL3', endpoint: { x: leftX - 70, y: onsideY } },
        { position: 'KL4', endpoint: { x: 70, y: onsideY } },
        { position: 'KL5', endpoint: { x: 50, y: onsideY } },
        { position: 'KR1', endpoint: { x: leftX + 30, y: onsideY } },
        { position: 'KR2', endpoint: { x: leftX + 60, y: onsideY } },
        { position: 'KR3', endpoint: { x: leftX + 100, y: onsideY } },
        { position: 'KR4', endpoint: { x: leftX + 150, y: onsideY } },
        { position: 'KR5', endpoint: { x: centerX + 50, y: onsideY } },
      ];

    case 'Onside Right':
      // Short paths converging to the right
      return [
        { position: 'K', endpoint: { x: rightX, y: onsideY } },
        { position: 'KL1', endpoint: { x: rightX - 30, y: onsideY } },
        { position: 'KL2', endpoint: { x: rightX - 60, y: onsideY } },
        { position: 'KL3', endpoint: { x: rightX - 100, y: onsideY } },
        { position: 'KL4', endpoint: { x: rightX - 150, y: onsideY } },
        { position: 'KL5', endpoint: { x: centerX - 50, y: onsideY } },
        { position: 'KR1', endpoint: { x: rightX + 20, y: onsideY } },
        { position: 'KR2', endpoint: { x: rightX + 50, y: onsideY } },
        { position: 'KR3', endpoint: { x: rightX + 70, y: onsideY } },
        { position: 'KR4', endpoint: { x: 630, y: onsideY } },
        { position: 'KR5', endpoint: { x: 650, y: onsideY } },
      ];

    default:
      // Default: straight lanes downfield
      return [
        { position: 'K', endpoint: { x: 350, y: deepY } },
        { position: 'KL1', endpoint: { x: 290, y: deepY } },
        { position: 'KL2', endpoint: { x: 240, y: deepY } },
        { position: 'KL3', endpoint: { x: 190, y: deepY } },
        { position: 'KL4', endpoint: { x: 140, y: deepY } },
        { position: 'KL5', endpoint: { x: 90, y: deepY } },
        { position: 'KR1', endpoint: { x: 410, y: deepY } },
        { position: 'KR2', endpoint: { x: 460, y: deepY } },
        { position: 'KR3', endpoint: { x: 510, y: deepY } },
        { position: 'KR4', endpoint: { x: 560, y: deepY } },
        { position: 'KR5', endpoint: { x: 610, y: deepY } },
      ];
  }
}

// Get play-specific paths for kick return plays
// Positions: FL at y=210 (top), SL at y=290 (middle), R at y=370 (bottom)
// All paths go UP (toward lower Y / top of screen) for the return
// For onside recovery plays, startPosition moves players to clustered formation
export function getKickReturnPlayPaths(playName: string): Array<{ position: string; endpoint: { x: number; y: number }; startPosition?: { x: number; y: number } }> {
  // Field dimensions: 700w x 400h
  // FL starts at y=210, SL at y=290, R at y=370
  // All arrows point UP (toward y=0)

  // Target zones - ALL paths are SHORT
  const flBlockY = 160;       // Front line blocks - short path up from y=210 (just 50px)
  const slBlockY = 230;       // Second line blocks - short path up from y=290 (just 60px)
  const returnEndY = 300;     // Returners - short path up from y=370 (just 70px) - shows direction only
  const onsideY = 250;        // Onside recovery zone (short upward movement)

  // Horizontal targets
  const centerX = 350;
  const leftX = 150;
  const rightX = 550;

  switch (playName) {
    case 'Return Left':
      // Returners go up and left, blockers angle to create left lane
      return [
        // Returners go UP and LEFT
        { position: 'R', endpoint: { x: leftX, y: returnEndY } },
        { position: 'R2', endpoint: { x: leftX + 80, y: returnEndY + 20 } },
        // Second line forms wedge going left (up from y=290)
        { position: 'SL1', endpoint: { x: leftX - 20, y: slBlockY } },
        { position: 'SL2', endpoint: { x: leftX + 60, y: slBlockY } },
        { position: 'SL3', endpoint: { x: leftX + 140, y: slBlockY } },
        // Front line blocks upfield, angling left (up from y=210)
        { position: 'FL1', endpoint: { x: 60, y: flBlockY } },
        { position: 'FL2', endpoint: { x: 150, y: flBlockY } },
        { position: 'FL3', endpoint: { x: 250, y: flBlockY } },
        { position: 'FL4', endpoint: { x: 360, y: flBlockY } },
        { position: 'FL5', endpoint: { x: 480, y: flBlockY } },
      ];

    case 'Return Middle':
      // Returners go straight up, blockers create middle wedge
      return [
        // Returners go UP the middle
        { position: 'R', endpoint: { x: centerX - 30, y: returnEndY } },
        { position: 'R2', endpoint: { x: centerX + 30, y: returnEndY + 20 } },
        // Second line forms tight wedge in middle (up from y=290)
        { position: 'SL1', endpoint: { x: centerX - 80, y: slBlockY } },
        { position: 'SL2', endpoint: { x: centerX, y: slBlockY - 20 } },
        { position: 'SL3', endpoint: { x: centerX + 80, y: slBlockY } },
        // Front line blocks upfield, spread across (up from y=210)
        { position: 'FL1', endpoint: { x: 100, y: flBlockY } },
        { position: 'FL2', endpoint: { x: 220, y: flBlockY } },
        { position: 'FL3', endpoint: { x: centerX, y: flBlockY - 20 } },
        { position: 'FL4', endpoint: { x: 480, y: flBlockY } },
        { position: 'FL5', endpoint: { x: 600, y: flBlockY } },
      ];

    case 'Return Right':
      // Returners go up and right, blockers angle to create right lane
      return [
        // Returners go UP and RIGHT
        { position: 'R', endpoint: { x: rightX, y: returnEndY } },
        { position: 'R2', endpoint: { x: rightX - 80, y: returnEndY + 20 } },
        // Second line forms wedge going right (up from y=290)
        { position: 'SL1', endpoint: { x: rightX - 140, y: slBlockY } },
        { position: 'SL2', endpoint: { x: rightX - 60, y: slBlockY } },
        { position: 'SL3', endpoint: { x: rightX + 20, y: slBlockY } },
        // Front line blocks upfield, angling right (up from y=210)
        { position: 'FL1', endpoint: { x: 220, y: flBlockY } },
        { position: 'FL2', endpoint: { x: 340, y: flBlockY } },
        { position: 'FL3', endpoint: { x: 450, y: flBlockY } },
        { position: 'FL4', endpoint: { x: 550, y: flBlockY } },
        { position: 'FL5', endpoint: { x: 640, y: flBlockY } },
      ];

    case 'Onside Recovery Left':
      // Players clustered on LEFT side with vertical blocking arrows
      // R in center-bottom, R2 on right, L1-L8 clustered on left
      // Field is 700x400, so keep all y values under 400
      return [
        // R - center-bottom, short upward arrow
        { position: 'R', startPosition: { x: 400, y: 360 }, endpoint: { x: 400, y: 280 } },
        // R2 - right side, short upward arrow
        { position: 'R2', startPosition: { x: 680, y: 260 }, endpoint: { x: 680, y: 180 } },
        // FL (L1-L5) - clustered on left at y=260, all arrows go to same height (y=220)
        { position: 'FL1', startPosition: { x: 60, y: 260 }, endpoint: { x: 60, y: 220 } },
        { position: 'FL2', startPosition: { x: 140, y: 260 }, endpoint: { x: 140, y: 220 } },
        { position: 'FL3', startPosition: { x: 220, y: 260 }, endpoint: { x: 220, y: 220 } },
        { position: 'FL4', startPosition: { x: 300, y: 260 }, endpoint: { x: 300, y: 220 } },
        { position: 'FL5', startPosition: { x: 340, y: 310 }, endpoint: { x: 340, y: 270 } },
        // SL (L6-L8) - below L1-L4 at y=320, all arrows go to same height (y=280)
        { position: 'SL1', startPosition: { x: 100, y: 320 }, endpoint: { x: 100, y: 280 } },
        { position: 'SL2', startPosition: { x: 180, y: 320 }, endpoint: { x: 180, y: 280 } },
        { position: 'SL3', startPosition: { x: 260, y: 320 }, endpoint: { x: 260, y: 280 } },
      ];

    case 'Onside Recovery Right':
      // Players clustered on RIGHT side with vertical blocking arrows
      // R on left, R2 in center, L1-L8 clustered on right
      return [
        // R - left side, short upward arrow
        { position: 'R', startPosition: { x: 140, y: 260 }, endpoint: { x: 140, y: 180 } },
        // R2 - center, longer upward arrow
        { position: 'R2', startPosition: { x: 400, y: 360 }, endpoint: { x: 400, y: 260 } },
        // FL (L1-L5) - clustered on right at y=260, all arrows go to same height (y=220)
        { position: 'FL1', startPosition: { x: 480, y: 260 }, endpoint: { x: 480, y: 220 } },
        { position: 'FL2', startPosition: { x: 540, y: 260 }, endpoint: { x: 540, y: 220 } },
        { position: 'FL3', startPosition: { x: 590, y: 260 }, endpoint: { x: 590, y: 220 } },
        { position: 'FL4', startPosition: { x: 640, y: 260 }, endpoint: { x: 640, y: 220 } },
        { position: 'FL5', startPosition: { x: 700, y: 260 }, endpoint: { x: 700, y: 220 } },
        // SL (L6-L8) - below FL at y=320, all arrows go to same height (y=280)
        { position: 'SL1', startPosition: { x: 520, y: 320 }, endpoint: { x: 520, y: 280 } },
        { position: 'SL2', startPosition: { x: 580, y: 320 }, endpoint: { x: 580, y: 280 } },
        { position: 'SL3', startPosition: { x: 640, y: 320 }, endpoint: { x: 640, y: 280 } },
      ];

    default:
      // Default: Return Middle
      return [
        { position: 'R', endpoint: { x: centerX - 30, y: returnEndY } },
        { position: 'R2', endpoint: { x: centerX + 30, y: returnEndY + 20 } },
        { position: 'SL1', endpoint: { x: centerX - 80, y: slBlockY } },
        { position: 'SL2', endpoint: { x: centerX, y: slBlockY - 20 } },
        { position: 'SL3', endpoint: { x: centerX + 80, y: slBlockY } },
        { position: 'FL1', endpoint: { x: 100, y: flBlockY } },
        { position: 'FL2', endpoint: { x: 220, y: flBlockY } },
        { position: 'FL3', endpoint: { x: centerX, y: flBlockY - 20 } },
        { position: 'FL4', endpoint: { x: 480, y: flBlockY } },
        { position: 'FL5', endpoint: { x: 600, y: flBlockY } },
      ];
  }
}

// Get play-specific paths for field goal plays
// Line players have short T-shaped blocking arrows pointing UP
// Holder and Kicker have no arrows (just their position) for standard FG
export function getFieldGoalPlayPaths(playName: string): Array<{ position: string; endpoint: { x: number; y: number }; isRunPath?: boolean; isPassRoute?: boolean }> {
  // All line players block straight up with short arrows
  // Arrow endpoint is 40px above player position (y=210 -> endpoint y=170)
  const blockEndY = 170;

  switch (playName) {
    case 'Fake Field Goal Run':
      // Line players block, Holder runs right around the edge
      return [
        // Line players - all have short upward blocking arrows
        { position: 'LS', endpoint: { x: 350, y: blockEndY } },
        { position: 'LG', endpoint: { x: 325, y: blockEndY } },
        { position: 'RG', endpoint: { x: 375, y: blockEndY } },
        { position: 'LT', endpoint: { x: 300, y: blockEndY } },
        { position: 'RT', endpoint: { x: 400, y: blockEndY } },
        { position: 'TEL', endpoint: { x: 275, y: blockEndY } },
        { position: 'TER', endpoint: { x: 425, y: blockEndY } },
        { position: 'WL', endpoint: { x: 250, y: blockEndY } },
        { position: 'WR', endpoint: { x: 450, y: blockEndY } },
        // Holder runs right around the edge (curved path to the right and up)
        { position: 'Holder', endpoint: { x: 520, y: 140 }, isRunPath: true },
        // Kicker has no path on fake
      ];

    case 'Fake Field Goal Pass':
      // Line players block, WR runs a pass route, Holder throws
      return [
        // Line players - all have short upward blocking arrows
        { position: 'LS', endpoint: { x: 350, y: blockEndY } },
        { position: 'LG', endpoint: { x: 325, y: blockEndY } },
        { position: 'RG', endpoint: { x: 375, y: blockEndY } },
        { position: 'LT', endpoint: { x: 300, y: blockEndY } },
        { position: 'RT', endpoint: { x: 400, y: blockEndY } },
        { position: 'TEL', endpoint: { x: 275, y: blockEndY } },
        { position: 'TER', endpoint: { x: 425, y: blockEndY } },
        { position: 'WL', endpoint: { x: 250, y: blockEndY } },
        // WR runs a pass route - out and up to the right
        { position: 'WR', endpoint: { x: 580, y: 120 }, isPassRoute: true },
        // Holder stays to throw (no movement path needed)
        // Kicker has no path on fake
      ];

    case 'Standard Field Goal':
    default:
      return [
        // Line players - all have short upward blocking arrows
        { position: 'LS', endpoint: { x: 350, y: blockEndY } },
        { position: 'LG', endpoint: { x: 325, y: blockEndY } },
        { position: 'RG', endpoint: { x: 375, y: blockEndY } },
        { position: 'LT', endpoint: { x: 300, y: blockEndY } },
        { position: 'RT', endpoint: { x: 400, y: blockEndY } },
        { position: 'TEL', endpoint: { x: 275, y: blockEndY } },
        { position: 'TER', endpoint: { x: 425, y: blockEndY } },
        { position: 'WL', endpoint: { x: 250, y: blockEndY } },
        { position: 'WR', endpoint: { x: 450, y: blockEndY } },
        // Holder and Kicker - no arrows (endpoint same as position means no visible arrow)
      ];
  }
}

// Get play-specific paths for punt plays
// Line players have short T-shaped blocking arrows pointing UP
// Gunners and Wings have longer arrows going downfield (coverage lanes)
// PP and P have no arrows
export function getPuntPlayPaths(playName: string): Array<{ position: string; endpoint: { x: number; y: number }; isRunPath?: boolean; isPassRoute?: boolean }> {
  // Line players block straight up with short arrows
  const blockEndY = 160;
  // Coverage players release downfield - arrows going up
  const coverageEndY = 60;

  switch (playName) {
    case 'Fake Punt Pass':
      // Line players block, PP runs left, WR runs pass route
      return [
        // Line players (5) - short upward blocking arrows with T-shape
        { position: 'LS', endpoint: { x: 350, y: blockEndY } },
        { position: 'LG', endpoint: { x: 330, y: blockEndY } },
        { position: 'RG', endpoint: { x: 370, y: blockEndY } },
        { position: 'LT', endpoint: { x: 300, y: blockEndY } },
        { position: 'RT', endpoint: { x: 400, y: blockEndY } },
        // Gunners - coverage arrows
        { position: 'GunnerL', endpoint: { x: 120, y: coverageEndY } },
        { position: 'GunnerR', endpoint: { x: 580, y: coverageEndY } },
        // WL - coverage arrow going up and left
        { position: 'WingL', endpoint: { x: 160, y: coverageEndY } },
        // WR - pass route (curved, going right then up)
        { position: 'WingR', endpoint: { x: 580, y: 120 }, isPassRoute: true },
        // PP - run path going left and up
        { position: 'PP', endpoint: { x: 240, y: 100 }, isRunPath: true },
        // P stays (no arrow)
      ];

    case 'Fake Punt Run Off Tackle':
      // Line players block, PP runs right off tackle
      return [
        // Line players (5) - short upward blocking arrows with T-shape
        { position: 'LS', endpoint: { x: 350, y: blockEndY } },
        { position: 'LG', endpoint: { x: 330, y: blockEndY } },
        { position: 'RG', endpoint: { x: 370, y: blockEndY } },
        { position: 'LT', endpoint: { x: 300, y: blockEndY } },
        { position: 'RT', endpoint: { x: 400, y: blockEndY } },
        // PP - run path going right off tackle then upfield
        { position: 'PP', endpoint: { x: 480, y: 80 }, isRunPath: true },
        // Gunners, Wings, and P have no arrows on this play
      ];

    case 'Punt':
    default:
      return [
        // Line players (5) - short upward blocking arrows with T-shape
        { position: 'LS', endpoint: { x: 350, y: blockEndY } },
        { position: 'LG', endpoint: { x: 330, y: blockEndY } },
        { position: 'RG', endpoint: { x: 370, y: blockEndY } },
        { position: 'LT', endpoint: { x: 300, y: blockEndY } },
        { position: 'RT', endpoint: { x: 400, y: blockEndY } },
        // Gunners - long coverage arrows going straight up
        { position: 'GunnerL', endpoint: { x: 120, y: coverageEndY } },
        { position: 'GunnerR', endpoint: { x: 580, y: coverageEndY } },
        // Wings - coverage arrows going up (slightly inside)
        { position: 'WingL', endpoint: { x: 200, y: coverageEndY } },
        { position: 'WingR', endpoint: { x: 500, y: coverageEndY } },
        // PP and P have no arrows
      ];
  }
}

// Get play-specific paths for punt return plays
// Box players and Jam players block downward (toward punt team)
// Returners have return paths
export function getPuntReturnPlayPaths(playName: string): Array<{ position: string; endpoint: { x: number; y: number }; isReturnPath?: boolean }> {
  // Box and Jam players block downward (toward the punting team at bottom of screen)
  const blockEndY = 280;

  switch (playName) {
    case 'Return Left':
      return [
        // Box players - blocking arrows pointing down
        { position: 'Box1', endpoint: { x: 250, y: blockEndY } },
        { position: 'Box2', endpoint: { x: 300, y: blockEndY } },
        { position: 'Box3', endpoint: { x: 350, y: blockEndY } },
        { position: 'Box4', endpoint: { x: 400, y: blockEndY } },
        { position: 'Box5', endpoint: { x: 450, y: blockEndY } },
        { position: 'Box6', endpoint: { x: 500, y: blockEndY } },
        // Jam players - blocking arrows pointing down
        { position: 'JamL', endpoint: { x: 150, y: blockEndY } },
        { position: 'JamR', endpoint: { x: 550, y: blockEndY } },
        // R2 - arrow pointing down (setting up block or fair catch signal)
        { position: 'R2', endpoint: { x: 380, y: 170 } },
        // R - return path going left then up
        { position: 'R', endpoint: { x: 120, y: 20 }, isReturnPath: true },
      ];

    case 'Return Middle':
      return [
        // Box players - blocking arrows pointing down
        { position: 'Box1', endpoint: { x: 250, y: blockEndY } },
        { position: 'Box2', endpoint: { x: 300, y: blockEndY } },
        { position: 'Box3', endpoint: { x: 350, y: blockEndY } },
        { position: 'Box4', endpoint: { x: 400, y: blockEndY } },
        { position: 'Box5', endpoint: { x: 450, y: blockEndY } },
        { position: 'Box6', endpoint: { x: 500, y: blockEndY } },
        // Jam players - blocking arrows pointing down
        { position: 'JamL', endpoint: { x: 150, y: blockEndY } },
        { position: 'JamR', endpoint: { x: 550, y: blockEndY } },
        // R2 - arrow pointing down
        { position: 'R2', endpoint: { x: 380, y: 170 } },
        // R - return path going straight up
        { position: 'R', endpoint: { x: 350, y: 20 }, isReturnPath: true },
      ];

    case 'Return Right':
      return [
        // Box players - blocking arrows pointing down
        { position: 'Box1', endpoint: { x: 250, y: blockEndY } },
        { position: 'Box2', endpoint: { x: 300, y: blockEndY } },
        { position: 'Box3', endpoint: { x: 350, y: blockEndY } },
        { position: 'Box4', endpoint: { x: 400, y: blockEndY } },
        { position: 'Box5', endpoint: { x: 450, y: blockEndY } },
        { position: 'Box6', endpoint: { x: 500, y: blockEndY } },
        // Jam players - blocking arrows pointing down
        { position: 'JamL', endpoint: { x: 150, y: blockEndY } },
        { position: 'JamR', endpoint: { x: 550, y: blockEndY } },
        // R2 - arrow pointing down
        { position: 'R2', endpoint: { x: 380, y: 170 } },
        // R - return path curving down and to the right
        { position: 'R', endpoint: { x: 580, y: 160 }, isReturnPath: true },
      ];

    case 'Rush/Block':
    default:
      return [
        // All players rush/block - arrows pointing down
        { position: 'Box1', endpoint: { x: 250, y: blockEndY } },
        { position: 'Box2', endpoint: { x: 300, y: blockEndY } },
        { position: 'Box3', endpoint: { x: 350, y: blockEndY } },
        { position: 'Box4', endpoint: { x: 400, y: blockEndY } },
        { position: 'Box5', endpoint: { x: 450, y: blockEndY } },
        { position: 'Box6', endpoint: { x: 500, y: blockEndY } },
        { position: 'JamL', endpoint: { x: 150, y: blockEndY } },
        { position: 'JamR', endpoint: { x: 550, y: blockEndY } },
        // Returners stay back
      ];
  }
}

export const FOOTBALL_CONFIG = {
  common: COMMON_ATTRIBUTES,
  offensive: OFFENSIVE_ATTRIBUTES,
  defensive: DEFENSIVE_ATTRIBUTES,
  specialTeams: SPECIAL_TEAMS_ATTRIBUTES,
  results: PLAY_RESULTS,
  routes: {
    blockingAssignments: BLOCKING_ASSIGNMENTS,
    blockResponsibilities: BLOCK_RESPONSIBILITIES,
    runningHoles: RUNNING_HOLES,
    passingRoutes: PASSING_ROUTES,
    skillPositionAssignments: SKILL_POSITION_ASSIGNMENTS
  },
  formations: {
    offensive: OFFENSIVE_FORMATIONS,
    defensive: DEFENSIVE_FORMATIONS,
    specialTeams: SPECIAL_TEAMS_FORMATIONS
  },
  coverages: COVERAGES,
  coverageRoles: COVERAGE_ROLES,
  blitzGaps: BLITZ_GAPS,
  formationMetadata: FORMATION_METADATA,
  positionGroups: POSITION_GROUPS,
  helpers: {
    getAttributeOptions,
    getAssignmentOptions,
    validatePlayAttributes
  }
} as const;

// ============================================
// MOTION CONFIGURATION
// ============================================

export interface MotionType {
  name: string;
  description: string;
  defaultEndpointOffset: { x: number; y: number };
  isLegalAtSnap: boolean;
  requiresSet: boolean;
}

export const MOTION_TYPES: Record<string, MotionType> = {
  NONE: {
    name: 'None',
    description: 'No motion. Player stays in original alignment.',
    defaultEndpointOffset: { x: 0, y: 0 },
    isLegalAtSnap: true,
    requiresSet: false
  },

  JET: {
    name: 'Jet',
    description: 'Fast lateral motion toward center, timed to arrive at snap. Threatens sweep or creates bunch.',
    defaultEndpointOffset: { x: 0, y: 0 },
    isLegalAtSnap: true,
    requiresSet: true
  },

  ORBIT: {
    name: 'Orbit',
    description: 'Arcing loop behind QB, exiting to opposite side. Sets up swing/wheel or backfield misdirection.',
    defaultEndpointOffset: { x: 0, y: 30 },
    isLegalAtSnap: true,
    requiresSet: true
  },

  ACROSS: {
    name: 'Across',
    description: 'Short lateral move across formation (in front of QB) to re-stack or flip strength.',
    defaultEndpointOffset: { x: 100, y: 0 },
    isLegalAtSnap: true,
    requiresSet: true
  },

  RETURN: {
    name: 'Return',
    description: 'Fake motion that starts then returns to final spot before snap. Misleads defense rotations.',
    defaultEndpointOffset: { x: 0, y: 0 },
    isLegalAtSnap: false,
    requiresSet: true
  },

  SHIFT: {
    name: 'Shift',
    description: 'Static realignment. Player moves to new position, then comes fully set (1 sec) before snap.',
    defaultEndpointOffset: { x: 80, y: 0 },
    isLegalAtSnap: false,
    requiresSet: true
  }
};

export type MotionDirection = 'toward-center' | 'away-from-center';

/**
 * Calculate motion endpoint based on type and direction
 * UPDATED: Players on LOS arc backward 1 yard before lateral motion
 * 
 * @param playerStart - Player's starting position {x, y}
 * @param motionType - Type of motion (Jet, Orbit, etc.)
 * @param direction - Direction of motion (toward-center or away-from-center)
 * @param centerX - X coordinate of field center (default 350)
 * @param isOnLOS - Whether player is on line of scrimmage (default false)
 * @returns Calculated endpoint position {x, y}
 */
export function calculateMotionEndpoint(
  playerStart: { x: number; y: number },
  motionType: string,
  direction: MotionDirection,
  centerX: number = 350,
  isOnLOS: boolean = false
): { x: number; y: number } {
  const motion = MOTION_TYPES[motionType.toUpperCase()];
  if (!motion || motionType === 'None') {
    return playerStart;
  }

  const isLeftOfCenter = playerStart.x < centerX;
  const offset = motion.defaultEndpointOffset;
  
  // If player is on LOS, arc backward 1 yard (10 pixels ≈ 1 yard)
  const archBackward = isOnLOS ? 10 : 0;

  switch (motionType) {
    case 'Jet':
      if (direction === 'toward-center') {
        return {
          x: isLeftOfCenter ? playerStart.x + 120 : playerStart.x - 120,
          y: playerStart.y + archBackward
        };
      } else {
        return {
          x: isLeftOfCenter ? playerStart.x - 80 : playerStart.x + 80,
          y: playerStart.y + archBackward
        };
      }

    case 'Orbit':
      if (direction === 'toward-center') {
        return {
          x: isLeftOfCenter ? centerX + 80 : centerX - 80,
          y: playerStart.y + 30 + archBackward
        };
      } else {
        return {
          x: isLeftOfCenter ? playerStart.x - 60 : playerStart.x + 60,
          y: playerStart.y + 40 + archBackward
        };
      }

    case 'Across':
      if (direction === 'toward-center') {
        return {
          x: centerX,
          y: playerStart.y + archBackward
        };
      } else {
        return {
          x: isLeftOfCenter ? playerStart.x - 80 : playerStart.x + 80,
          y: playerStart.y + archBackward
        };
      }

    case 'Return':
      return {
        x: direction === 'toward-center' 
          ? playerStart.x + (isLeftOfCenter ? 30 : -30)
          : playerStart.x + (isLeftOfCenter ? -20 : 20),
        y: playerStart.y + archBackward
      };

    case 'Shift':
      if (direction === 'toward-center') {
        return {
          x: isLeftOfCenter ? playerStart.x + 80 : playerStart.x - 80,
          y: playerStart.y + archBackward
        };
      } else {
        return {
          x: isLeftOfCenter ? playerStart.x - 80 : playerStart.x + 80,
          y: playerStart.y + archBackward
        };
      }

    default:
      return {
        x: playerStart.x + offset.x,
        y: playerStart.y + offset.y + archBackward
      };
  }
}

export function getLegalMotionTypes(position: string): string[] {
  const linemen = ['LT', 'LG', 'C', 'RG', 'RT'];
  if (linemen.includes(position)) {
    return ['None'];
  }

  return Object.keys(MOTION_TYPES);
}

export function isMotionLegalAtSnap(motionType: string): boolean {
  const motion = MOTION_TYPES[motionType.toUpperCase()];
  return motion ? motion.isLegalAtSnap : true;
}
// Helper function to get gap position
// Strong side = LEFT (offensive TE side assumed left)
// Weak side = RIGHT
export const getGapPositionFromName = (gapName: string, centerX: number = 350): { x: number; y: number } => {
  const lineOfScrimmage = 200;
  const throughLine = 205; // Penetration past LOS
  
  // Standard yard spacing (1 yard ≈ 10 pixels in our scale)
  switch (gapName) {
    case 'Strong A-gap':
      return { x: centerX - 10, y: throughLine }; // 1 yard left
    case 'Weak A-gap':
      return { x: centerX + 10, y: throughLine }; // 1 yard right
    case 'Strong B-gap':
      return { x: centerX - 25, y: throughLine }; // 2.5 yards left
    case 'Weak B-gap':
      return { x: centerX + 25, y: throughLine }; // 2.5 yards right
    case 'Strong C-gap':
      return { x: centerX - 40, y: throughLine }; // 4 yards left
    case 'Weak C-gap':
      return { x: centerX + 40, y: throughLine }; // 4 yards right
    default:
      return { x: centerX, y: throughLine };
  }
};

// Position check helpers
export const DEFENSIVE_LINE_POSITIONS = ['DE', 'DT1', 'DT2', 'NT', 'SDE', 'WDE', 'SDT', 'WDT'] as const;
export const LINEBACKER_POSITIONS = ['SAM', 'MIKE', 'WILL', 'ILB', 'SOLB', 'WOLB', 'SILB', 'WILB', 'SLB', 'WLB', 'JACK', 'LB'] as const;
export const DEFENSIVE_BACK_POSITIONS = ['LCB', 'RCB', 'FS', 'SS', 'NB', 'S', 'DB'] as const;

export const isDefensiveLineman = (position: string): boolean => {
  return DEFENSIVE_LINE_POSITIONS.includes(position as any);
};

export const isLinebacker = (position: string): boolean => {
  return LINEBACKER_POSITIONS.includes(position as any);
};
// Add this BEFORE the final closing brace/export
/**
 * Standardized opponent play categories for scouting
 * Used when tagging opponent film without a playbook
 */
export const OPPONENT_PLAY_TYPES = {
  run: [
    'Inside Zone',
    'Outside Zone',
    'Power',
    'Counter',
    'Sweep',
    'Trap',
    'QB Run',
    'Draw',
    'Other Run'
  ],
  pass: [
    'Quick Pass (0-5 yds)',
    'Short Pass (6-10 yds)',
    'Medium Pass (11-20 yds)',
    'Deep Pass (20+ yds)',
    'Screen',
    'Play Action',
    'RPO',
    'Bootleg',
    'Other Pass'
  ],
  special: [
    'Punt',
    'Kickoff',
    'Field Goal',
    'PAT',
    'Onside Kick'
  ]
} as const;

export const isDefensiveBack = (position: string): boolean => {
  return DEFENSIVE_BACK_POSITIONS.includes(position as any);
};