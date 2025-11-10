// src/config/footballRules.ts
// Football Rules & Validation System
// Enforces legal formations, motion, and positioning

import { Player } from '@/types/football';

// ============================================
// FIELD DIMENSIONS & ZONES
// ============================================

export const FIELD_RULES = {
  canvasWidth: 700,
  canvasHeight: 400,
  
  lineOfScrimmage: 200,
  
  neutralZoneWidth: 12,
  
  bounds: {
    minX: 0,
    maxX: 700,
    minY: 0,
    maxY: 400
  },
  
  leftHash: 250,
  rightHash: 450,
  
  zones: {
    offensiveBackfield: { minY: 200, maxY: 400 },
    defensiveBackfield: { minY: 0, maxY: 200 },
    neutralZone: { minY: 194, maxY: 206 }
  }
} as const;

// ============================================
// POSITION CLASSIFICATION
// ============================================

export const POSITION_TYPES = {
  offensiveLine: ['C', 'LG', 'RG', 'LT', 'RT', 'G', 'T'],

  eligibleReceivers: ['X', 'Y', 'Z', 'SL', 'SR', 'TE', 'TE1', 'TE2', 'SE', 'FL'],

  backs: ['QB', 'RB', 'FB', 'TB', 'SB', 'HB', 'WB'],

  defensiveLine: ['DE', 'DT1', 'DT2', 'NT', 'DL', 'NG'],

  linebackers: ['LB', 'MLB', 'ILB', 'SAM', 'MIKE', 'WILL', 'JACK'],

  defensiveBacks: ['LCB', 'RCB', 'S', 'SS', 'FS', 'NB', 'DB']
} as const;

export function isOffensiveLineman(position: string): boolean {
  return POSITION_TYPES.offensiveLine.some(pos => 
    position.toUpperCase().includes(pos)
  );
}

export function isEligibleReceiver(position: string): boolean {
  return POSITION_TYPES.eligibleReceivers.some(pos => 
    position.toUpperCase().includes(pos)
  );
}

export function isBackfield(position: string): boolean {
  return POSITION_TYPES.backs.some(pos => 
    position.toUpperCase().includes(pos)
  );
}

// ============================================
// OFFENSIVE FORMATION RULES
// ============================================

export interface FormationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateOffensiveFormation(players: Player[], playType?: string): FormationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const playersAheadOfLOS = players.filter(p => p.y < FIELD_RULES.lineOfScrimmage);
  if (playersAheadOfLOS.length > 0) {
    errors.push(`${playersAheadOfLOS.length} offensive player(s) ahead of line of scrimmage: ${playersAheadOfLOS.map(p => p.label).join(', ')}`);
  }

  const lineOfScrimmageY = FIELD_RULES.lineOfScrimmage;
  const tolerance = 5;
  const playersOnLine = players.filter(p =>
    Math.abs(p.y - lineOfScrimmageY) <= tolerance
  );

  if (playersOnLine.length < 7) {
    errors.push(`Only ${playersOnLine.length} players on line of scrimmage. Need at least 7.`);
  }

  const backfieldPlayers = players.filter(p =>
    p.y > lineOfScrimmageY + tolerance
  );

  if (backfieldPlayers.length > 4) {
    warnings.push(`${backfieldPlayers.length} players in backfield. Maximum is 4.`);
  }

  const outOfBounds = players.filter(p =>
    p.x < FIELD_RULES.bounds.minX ||
    p.x > FIELD_RULES.bounds.maxX ||
    p.y < FIELD_RULES.bounds.minY ||
    p.y > FIELD_RULES.bounds.maxY
  );

  if (outOfBounds.length > 0) {
    errors.push(`${outOfBounds.length} player(s) out of bounds`);
  }

  // Only check eligible receivers for pass plays
  if (playType === 'Pass') {
    const eligibleCount = players.filter(p =>
      isEligibleReceiver(p.position) || isBackfield(p.position)
    ).length;

    if (eligibleCount < 5) {
      warnings.push(`Only ${eligibleCount} eligible receivers. Typically need at least 5.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateDefensiveFormation(players: Player[]): FormationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const playersBehindLOS = players.filter(p => p.y >= FIELD_RULES.lineOfScrimmage);
  if (playersBehindLOS.length > 0) {
    errors.push(`${playersBehindLOS.length} defensive player(s) behind line of scrimmage (offsides): ${playersBehindLOS.map(p => p.label).join(', ')}`);
  }
  
  const inNeutralZone = players.filter(p => 
    p.y >= FIELD_RULES.zones.neutralZone.minY && 
    p.y <= FIELD_RULES.zones.neutralZone.maxY
  );
  
  if (inNeutralZone.length > 0) {
    warnings.push(`${inNeutralZone.length} player(s) in neutral zone: ${inNeutralZone.map(p => p.label).join(', ')}`);
  }
  
  const outOfBounds = players.filter(p => 
    p.x < FIELD_RULES.bounds.minX || 
    p.x > FIELD_RULES.bounds.maxX ||
    p.y < FIELD_RULES.bounds.minY ||
    p.y > FIELD_RULES.bounds.maxY
  );
  
  if (outOfBounds.length > 0) {
    errors.push(`${outOfBounds.length} player(s) out of bounds`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================
// MOTION RULES
// ============================================

/**
 * Validate pre-snap motion legality
 * NFHS/High School Rules:
 * 1. Only 1 player in motion at snap
 * 2. Must be set for 1 second before motion
 * 3. Motion at snap must be parallel or backward (not toward LOS)
 * 4. Motion player must be off the line of scrimmage
 * 5. Linemen cannot be in motion
 */
export function validateMotion(players: Player[]): FormationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Find all players with motion
  const playersWithMotion = players.filter(p => 
    p.motionType && p.motionType !== 'None'
  );
  
  // Rule 1: Only one player can be in motion at snap
  const playersInMotionAtSnap = playersWithMotion.filter(p => {
    const type = p.motionType?.toUpperCase();
    // Return and Shift must be set at snap, so they don't count as "in motion at snap"
    return type !== 'RETURN' && type !== 'SHIFT';
  });
  
  if (playersInMotionAtSnap.length > 1) {
    errors.push(`${playersInMotionAtSnap.length} players in motion at snap. Only 1 allowed (${playersInMotionAtSnap.map(p => p.label).join(', ')})`);
  }
  
  // Rule 2: Check each motion player
  playersWithMotion.forEach(player => {
    // Rule 2a: Linemen cannot be in motion
    if (isOffensiveLineman(player.position)) {
      errors.push(`${player.label} (${player.position}) is a lineman and cannot be in motion`);
    }
    
    // Rule 2b: Must be off the line of scrimmage
    const onLineOfScrimmage = Math.abs(player.y - FIELD_RULES.lineOfScrimmage) <= 5;
    if (onLineOfScrimmage) {
      errors.push(`${player.label} is on line of scrimmage. Motion player must be off the line.`);
    }
    
    // Rule 2c: Check if moving toward line of scrimmage
    if (player.motionEndpoint) {
      const movingTowardLOS = player.motionEndpoint.y < player.y;
      if (movingTowardLOS) {
        errors.push(`${player.label}'s motion moves toward line of scrimmage. Motion must be parallel or backward.`);
      }
    }
    
    // Rule 2d: Shift and Return must come to set
    if (player.motionType === 'Return' || player.motionType === 'Shift') {
      warnings.push(`${player.label} (${player.motionType}) must come to a full set for 1 second before snap`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================
// OFFSIDES DETECTION
// ============================================

export function checkOffsides(
  players: Player[],
  side: 'offense' | 'defense'
): FormationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (side === 'offense') {
    const offsidePlayers = players.filter(p => p.y < FIELD_RULES.lineOfScrimmage);
    
    if (offsidePlayers.length > 0) {
      errors.push(`Offensive offsides: ${offsidePlayers.map(p => p.label).join(', ')}`);
    }
  } else {
    const offsidePlayers = players.filter(p => 
      p.y >= FIELD_RULES.zones.neutralZone.minY
    );
    
    if (offsidePlayers.length > 0) {
      errors.push(`Defensive offsides: ${offsidePlayers.map(p => p.label).join(', ')}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================
// ILLEGAL FORMATION DETECTION
// ============================================

export function checkIllegalFormation(players: Player[]): FormationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (players.length !== 11) {
    errors.push(`Formation has ${players.length} players. Must have exactly 11.`);
  }
  
  const lineOfScrimmageY = FIELD_RULES.lineOfScrimmage;
  const tolerance = 5;
  const playersOnLine = players
    .filter(p => Math.abs(p.y - lineOfScrimmageY) <= tolerance)
    .sort((a, b) => a.x - b.x);
  
  if (playersOnLine.length >= 2) {
    const leftEnd = playersOnLine[0];
    const rightEnd = playersOnLine[playersOnLine.length - 1];
    
    if (!isEligibleReceiver(leftEnd.position) && !isOffensiveLineman(leftEnd.position)) {
      warnings.push(`Left end (${leftEnd.label}) may need to be eligible receiver`);
    }
    
    if (!isEligibleReceiver(rightEnd.position) && !isOffensiveLineman(rightEnd.position)) {
      warnings.push(`Right end (${rightEnd.label}) may need to be eligible receiver`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function autoCorrectFormation(
  players: Player[],
  side: 'offense' | 'defense'
): Player[] {
  return players.map(player => {
    if (side === 'offense') {
      if (player.y < FIELD_RULES.lineOfScrimmage) {
        return { ...player, y: FIELD_RULES.lineOfScrimmage };
      }
    } else {
      if (player.y >= FIELD_RULES.lineOfScrimmage) {
        return { ...player, y: FIELD_RULES.lineOfScrimmage - 10 };
      }
    }
    return player;
  });
}

export function getValidationSummary(validation: FormationValidation): string {
  if (validation.isValid && validation.warnings.length === 0) {
    return '✅ Formation is legal';
  }
  
  const parts: string[] = [];
  
  if (validation.errors.length > 0) {
    parts.push(`❌ ${validation.errors.length} error(s)`);
  }
  
  if (validation.warnings.length > 0) {
    parts.push(`⚠️ ${validation.warnings.length} warning(s)`);
  }
  
  return parts.join(' | ');
}

// ============================================
// EXPORT ALL VALIDATION FUNCTIONS
// ============================================

export const FOOTBALL_RULES = {
  field: FIELD_RULES,
  positions: POSITION_TYPES,
  validate: {
    offensiveFormation: validateOffensiveFormation,
    defensiveFormation: validateDefensiveFormation,
    motion: validateMotion,
    offsides: checkOffsides,
    illegalFormation: checkIllegalFormation
  },
  helpers: {
    isOffensiveLineman,
    isEligibleReceiver,
    isBackfield,
    autoCorrectFormation,
    getValidationSummary
  }
} as const;