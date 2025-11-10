/**
 * Player Helper Utilities
 * Functions to handle multi-position players with per-position depth tracking
 */

import type { PlayerRecord, PositionDepthMap } from '@/types/football';

export type PositionGroup = 'offense' | 'defense' | 'special_teams';

// Position to group mapping
const POSITION_TO_GROUP: Record<string, PositionGroup> = {
  // Offense
  QB: 'offense', RB: 'offense', FB: 'offense', TE: 'offense',
  X: 'offense', Y: 'offense', Z: 'offense',
  LT: 'offense', LG: 'offense', C: 'offense', RG: 'offense', RT: 'offense',
  // Defense
  DE: 'defense', DT1: 'defense', DT2: 'defense', NT: 'defense', LB: 'defense', MLB: 'defense',
  SAM: 'defense', WILL: 'defense',
  LCB: 'defense', RCB: 'defense',
  S: 'defense', FS: 'defense', SS: 'defense',
  // Special Teams
  K: 'special_teams', P: 'special_teams', LS: 'special_teams',
  H: 'special_teams', KR: 'special_teams', PR: 'special_teams',
};

/**
 * Get all positions a player plays
 */
export function getPlayerPositions(player: PlayerRecord): string[] {
  return Object.keys(player.position_depths || {});
}

/**
 * Get all position groups a player plays in
 */
export function getPlayerPositionGroups(player: PlayerRecord): PositionGroup[] {
  const positions = getPlayerPositions(player);
  const groups = new Set<PositionGroup>();

  positions.forEach(pos => {
    const group = POSITION_TO_GROUP[pos];
    if (group) {
      groups.add(group);
    }
  });

  return Array.from(groups);
}

/**
 * Check if player plays a specific position or any position in a list
 */
export function playerHasPosition(
  player: PlayerRecord,
  position: string | string[]
): boolean {
  const positions = Array.isArray(position) ? position : [position];
  const playerPositions = getPlayerPositions(player);
  return positions.some(pos => playerPositions.includes(pos));
}

/**
 * Check if player is in a specific position group
 */
export function playerInPositionGroup(
  player: PlayerRecord,
  group: PositionGroup
): boolean {
  const playerGroups = getPlayerPositionGroups(player);
  return playerGroups.includes(group);
}

/**
 * Get depth order for a specific position
 * Returns null if player doesn't play that position
 */
export function getPositionDepth(
  player: PlayerRecord,
  position: string
): number | null {
  return player.position_depths?.[position] ?? null;
}

/**
 * Get primary (highest priority) position
 * Returns position with lowest depth order
 */
export function getPrimaryPosition(player: PlayerRecord): string | null {
  const depths = player.position_depths || {};
  const entries = Object.entries(depths);

  if (entries.length === 0) return null;

  // Find position with lowest depth order
  const [position] = entries.reduce((min, curr) =>
    curr[1] < min[1] ? curr : min
  );

  return position;
}

/**
 * Get display string for player positions with depth
 * Examples:
 *   - "QB (1st)"
 *   - "QB (1st), RB (2nd)"
 *   - "QB (1st), RB (2nd), S (3rd) +2"
 * @param player Player record
 * @param maxShow Maximum number of positions to show before truncating
 * @param showDepth Whether to show depth labels
 */
export function getPositionDisplay(
  player: PlayerRecord,
  maxShow: number = 3,
  showDepth: boolean = true
): string {
  const depths = player.position_depths || {};
  const entries = Object.entries(depths).sort((a, b) => a[1] - b[1]); // Sort by depth

  if (entries.length === 0) return '-';

  const formatted = entries.map(([pos, depth]) => {
    if (showDepth) {
      return `${pos} (${getDepthLabel(depth)})`;
    }
    return pos;
  });

  if (formatted.length <= maxShow) {
    return formatted.join(', ');
  }

  return `${formatted.slice(0, maxShow).join(', ')} +${formatted.length - maxShow}`;
}

/**
 * Get depth label (1st, 2nd, 3rd, 4th)
 */
export function getDepthLabel(depth: number): string {
  switch (depth) {
    case 1: return '1st';
    case 2: return '2nd';
    case 3: return '3rd';
    case 4: return '4th';
    default: return `${depth}th`;
  }
}

/**
 * Get ordinal suffix (st, nd, rd, th)
 */
export function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Filter players by position
 * Optionally filter by depth order as well
 */
export function filterPlayersByPosition(
  players: PlayerRecord[],
  position: string | string[],
  depth?: number
): PlayerRecord[] {
  const positions = Array.isArray(position) ? position : [position];

  return players.filter(player => {
    const hasPosition = playerHasPosition(player, positions);
    if (!hasPosition) return false;

    if (depth !== undefined) {
      // Check if player plays any of the positions at the specified depth
      return positions.some(pos => getPositionDepth(player, pos) === depth);
    }

    return true;
  });
}

/**
 * Filter players by position group
 */
export function filterPlayersByGroup(
  players: PlayerRecord[],
  group: PositionGroup
): PlayerRecord[] {
  return players.filter(p => playerInPositionGroup(p, group));
}

/**
 * Get players at a specific depth for a position
 * Used for building depth charts
 */
export function getPlayersAtDepth(
  players: PlayerRecord[],
  position: string,
  depth: number
): PlayerRecord[] {
  return players.filter(player =>
    getPositionDepth(player, position) === depth
  );
}

/**
 * Sort players by depth order for a specific position
 */
export function sortPlayersByDepthForPosition(
  players: PlayerRecord[],
  position: string
): PlayerRecord[] {
  return [...players]
    .filter(p => playerHasPosition(p, position))
    .sort((a, b) => {
      const depthA = getPositionDepth(a, position) ?? 99;
      const depthB = getPositionDepth(b, position) ?? 99;
      return depthA - depthB;
    });
}

/**
 * Get full player display name with jersey and positions
 */
export function getPlayerDisplayName(
  player: PlayerRecord,
  showPositions: boolean = true,
  showDepth: boolean = false
): string {
  const name = `#${player.jersey_number || '?'} ${player.first_name || ''} ${player.last_name || ''}`.trim();

  if (!showPositions) {
    return name;
  }

  const positions = getPositionDisplay(player, 2, showDepth);
  return positions !== '-' ? `${name} (${positions})` : name;
}

/**
 * Check convenience functions
 */
export function playsOffense(player: PlayerRecord): boolean {
  return playerInPositionGroup(player, 'offense');
}

export function playsDefense(player: PlayerRecord): boolean {
  return playerInPositionGroup(player, 'defense');
}

export function playsSpecialTeams(player: PlayerRecord): boolean {
  return playerInPositionGroup(player, 'special_teams');
}

/**
 * Validate position_depths object
 */
export function validatePositionDepths(depths: PositionDepthMap): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!depths || typeof depths !== 'object') {
    errors.push('Position depths must be an object');
    return { isValid: false, errors };
  }

  const entries = Object.entries(depths);

  if (entries.length === 0) {
    errors.push('Player must have at least one position');
  }

  entries.forEach(([pos, depth]) => {
    if (typeof depth !== 'number' || depth < 1 || depth > 4) {
      errors.push(`Depth for ${pos} must be between 1-4, got: ${depth}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate that position/depth assignments don't conflict with existing players
 * @param depths Position depths for the player being saved
 * @param allPlayers All players in the roster
 * @param editingPlayerId ID of player being edited (null if adding new)
 */
export function validateDepthChartConflicts(
  depths: PositionDepthMap,
  allPlayers: PlayerRecord[],
  editingPlayerId: string | null
): {
  isValid: boolean;
  conflicts: Array<{ position: string; depth: number; conflictingPlayer: PlayerRecord }>;
} {
  const conflicts: Array<{ position: string; depth: number; conflictingPlayer: PlayerRecord }> = [];

  // Check each position/depth combination
  Object.entries(depths).forEach(([position, depth]) => {
    // Find any other player with this position at this depth
    const conflictingPlayer = allPlayers.find(player => {
      // Skip if this is the same player being edited
      if (editingPlayerId && player.id === editingPlayerId) {
        return false;
      }

      // Check if this player has the same position at the same depth
      return getPositionDepth(player, position) === depth;
    });

    if (conflictingPlayer) {
      conflicts.push({
        position,
        depth,
        conflictingPlayer
      });
    }
  });

  return {
    isValid: conflicts.length === 0,
    conflicts
  };
}

/**
 * Create position depths from form selections
 */
export function createPositionDepthsFromSelections(
  selections: Array<{ position: string; depth: number }>
): PositionDepthMap {
  const depths: PositionDepthMap = {};

  selections.forEach(({ position, depth }) => {
    depths[position] = depth;
  });

  return depths;
}

/**
 * Convert position_depths object to selection array for form editing
 */
export function convertDepthMapToSelections(
  depths: PositionDepthMap
): Array<{ position: string; depth: number }> {
  return Object.entries(depths || {}).map(([position, depth]) => ({
    position,
    depth
  }));
}
