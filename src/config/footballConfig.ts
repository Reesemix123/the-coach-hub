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
  
  ballCarrier: ['QB', 'RB', 'FB', 'WR', 'TE']
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
  'Block',  // Then specify block type via dropdown
  'Draw Route (Custom)'
] as const;
/**
 * Position group categorization
 */
export const POSITION_GROUPS = {
  linemen: ['LT', 'LG', 'C', 'RG', 'RT'],
  backs: ['QB', 'RB', 'FB', 'TB', 'SB'],
  receivers: ['WR', 'WR1', 'WR2', 'WR3', 'WR4', 'WR5', 'X', 'Y', 'Z', 'SL', 'SR', 'TE', 'TE1', 'TE2', 'SE', 'FL', 'WB']
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
  }
};

// ============================================
// DEFENSIVE FORMATIONS
// ============================================

export const DEFENSIVE_FORMATIONS: FormationConfig = {
  '4-3 Base': [
    { position: 'DE', x: 180, y: 185, label: 'DE' },
    { position: 'DT', x: 270, y: 185, label: 'DT' },
    { position: 'DT', x: 330, y: 185, label: 'DT' },
    { position: 'DE', x: 420, y: 185, label: 'DE' },
    { position: 'SAM', x: 140, y: 160, label: 'SAM' },
    { position: 'MIKE', x: 300, y: 160, label: 'MIKE' },
    { position: 'WILL', x: 460, y: 160, label: 'WILL' },
    { position: 'CB', x: 70, y: 135, label: 'CB' },
    { position: 'CB', x: 530, y: 135, label: 'CB' },
    { position: 'FS', x: 300, y: 95, label: 'FS' },
    { position: 'SS', x: 400, y: 125, label: 'SS' }
  ],
  
  '3-4 Base': [
    { position: 'DE', x: 240, y: 185, label: 'DE' },
    { position: 'NT', x: 300, y: 185, label: 'NT' },
    { position: 'DE', x: 360, y: 185, label: 'DE' },
    { position: 'OLB', x: 100, y: 160, label: 'OLB' },
    { position: 'ILB', x: 260, y: 160, label: 'ILB' },
    { position: 'ILB', x: 340, y: 160, label: 'ILB' },
    { position: 'OLB', x: 500, y: 160, label: 'OLB' },
    { position: 'CB', x: 70, y: 135, label: 'CB' },
    { position: 'CB', x: 530, y: 135, label: 'CB' },
    { position: 'FS', x: 300, y: 95, label: 'FS' },
    { position: 'SS', x: 200, y: 125, label: 'SS' }
  ],
  
  'Nickel (4-2-5)': [
    { position: 'DE', x: 180, y: 185, label: 'DE' },
    { position: 'DT', x: 270, y: 185, label: 'DT' },
    { position: 'DT', x: 330, y: 185, label: 'DT' },
    { position: 'DE', x: 420, y: 185, label: 'DE' },
    { position: 'MLB', x: 270, y: 160, label: 'MLB' },
    { position: 'MLB', x: 330, y: 160, label: 'MLB' },
    { position: 'CB', x: 70, y: 145, label: 'CB' },
    { position: 'CB', x: 530, y: 145, label: 'CB' },
    { position: 'NB', x: 180, y: 155, label: 'NB' },
    { position: 'FS', x: 300, y: 95, label: 'FS' },
    { position: 'SS', x: 400, y: 125, label: 'SS' }
  ]
};

// ============================================
// SPECIAL TEAMS FORMATIONS
// ============================================

export const SPECIAL_TEAMS_FORMATIONS: FormationConfig = {
  'Kickoff': [
    { position: 'K', x: 300, y: 300, label: 'K' },
    { position: 'L5', x: 80, y: 250, label: 'L5' },
    { position: 'L4', x: 160, y: 250, label: 'L4' },
    { position: 'L3', x: 240, y: 250, label: 'L3' },
    { position: 'L2', x: 280, y: 250, label: 'L2' },
    { position: 'L1', x: 320, y: 250, label: 'L1' },
    { position: 'R1', x: 360, y: 250, label: 'R1' },
    { position: 'R2', x: 420, y: 250, label: 'R2' },
    { position: 'R3', x: 480, y: 250, label: 'R3' },
    { position: 'R4', x: 540, y: 250, label: 'R4' },
    { position: 'R5', x: 620, y: 250, label: 'R5' }
  ],
  
  'Kick Return': [
    { position: 'L5', x: 80, y: 155, label: 'L5' },
    { position: 'L4', x: 160, y: 155, label: 'L4' },
    { position: 'L3', x: 240, y: 155, label: 'L3' },
    { position: 'L2', x: 280, y: 155, label: 'L2' },
    { position: 'L1', x: 320, y: 155, label: 'L1' },
    { position: 'R1', x: 360, y: 155, label: 'R1' },
    { position: 'R2', x: 420, y: 155, label: 'R2' },
    { position: 'R3', x: 480, y: 155, label: 'R3' },
    { position: 'R4', x: 540, y: 155, label: 'R4' },
    { position: 'KR1', x: 250, y: 75, label: 'KR1' },
    { position: 'KR2', x: 350, y: 75, label: 'KR2' }
  ],
  
  'Punt': [
    { position: 'LS', x: 300, y: 200, label: 'LS' },
    { position: 'LG', x: 260, y: 200, label: 'LG' },
    { position: 'RG', x: 340, y: 200, label: 'RG' },
    { position: 'LT', x: 220, y: 200, label: 'LT' },
    { position: 'RT', x: 380, y: 200, label: 'RT' },
    { position: 'LW', x: 100, y: 200, label: 'LW' },
    { position: 'RW', x: 500, y: 200, label: 'RW' },
    { position: 'LU', x: 230, y: 230, label: 'LU' },
    { position: 'RU', x: 370, y: 230, label: 'RU' },
    { position: 'PP', x: 300, y: 250, label: 'PP' },
    { position: 'P', x: 300, y: 320, label: 'P' }
  ],
  
  'Punt Return': [
    { position: 'RL', x: 100, y: 175, label: 'RL' },
    { position: 'LL', x: 220, y: 175, label: 'LL' },
    { position: 'LC', x: 280, y: 175, label: 'LC' },
    { position: 'RC', x: 320, y: 175, label: 'RC' },
    { position: 'RR', x: 380, y: 175, label: 'RR' },
    { position: 'RR2', x: 500, y: 175, label: 'RR2' },
    { position: 'VL', x: 250, y: 190, label: 'VL' },
    { position: 'VR', x: 350, y: 190, label: 'VR' },
    { position: 'JL', x: 100, y: 195, label: 'JL' },
    { position: 'JR', x: 500, y: 195, label: 'JR' },
    { position: 'PR', x: 300, y: 95, label: 'PR' }
  ],
  
  'Field Goal': [
    { position: 'LS', x: 300, y: 200, label: 'LS' },
    { position: 'LG', x: 270, y: 200, label: 'LG' },
    { position: 'RG', x: 330, y: 200, label: 'RG' },
    { position: 'LT', x: 240, y: 200, label: 'LT' },
    { position: 'RT', x: 360, y: 200, label: 'RT' },
    { position: 'LE', x: 210, y: 200, label: 'LE' },
    { position: 'RE', x: 390, y: 200, label: 'RE' },
    { position: 'LW', x: 180, y: 200, label: 'LW' },
    { position: 'RW', x: 420, y: 200, label: 'RW' },
    { position: 'H', x: 300, y: 255, label: 'H' },
    { position: 'K', x: 290, y: 265, label: 'K' }
  ]
};

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