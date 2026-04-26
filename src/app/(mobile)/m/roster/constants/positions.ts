// ---------------------------------------------------------------------------
// Position constants, types, and helper functions for the mobile roster
// ---------------------------------------------------------------------------

export type PositionGroup = 'Offense' | 'Defense' | 'Special Teams'

// ---------------------------------------------------------------------------
// Position display groups — maps display labels to position code sets
// ---------------------------------------------------------------------------

export const OFFENSE_DISPLAY_POSITIONS = [
  { label: 'QB', codes: ['QB'] },
  { label: 'RB', codes: ['RB', 'TB', 'SB', 'WB'] },
  { label: 'FB', codes: ['FB'] },
  { label: 'WR', codes: ['WR', 'X', 'Y', 'Z', 'SL', 'SR', 'SE', 'FL'] },
  { label: 'TE', codes: ['TE'] },
  { label: 'LT', codes: ['LT'] },
  { label: 'LG', codes: ['LG'] },
  { label: 'C', codes: ['C'] },
  { label: 'RG', codes: ['RG'] },
  { label: 'RT', codes: ['RT'] },
]

export const DEFENSE_DISPLAY_POSITIONS = [
  { label: 'DE', codes: ['DE'] },
  { label: 'DT', codes: ['DT', 'DT1', 'DT2'] },
  { label: 'NT', codes: ['NT'] },
  { label: 'MLB', codes: ['MLB', 'ILB'] },
  { label: 'OLB', codes: ['OLB', 'SAM', 'WILL', 'SLB', 'WLB'] },
  { label: 'LB', codes: ['LB'] },
  { label: 'CB', codes: ['CB', 'LCB', 'RCB'] },
  { label: 'FS', codes: ['FS'] },
  { label: 'SS', codes: ['SS'] },
  { label: 'S', codes: ['S', 'NB', 'DB'] },
]

export const ST_DISPLAY_POSITIONS = [
  { label: 'K', codes: ['K'] },
  { label: 'P', codes: ['P'] },
  { label: 'LS', codes: ['LS'] },
  { label: 'H', codes: ['H'] },
  { label: 'KR', codes: ['KR'] },
  { label: 'PR', codes: ['PR'] },
]

export const UNIT_SECTIONS: { label: PositionGroup; positions: { label: string; codes: string[] }[] }[] = [
  { label: 'Offense', positions: OFFENSE_DISPLAY_POSITIONS },
  { label: 'Defense', positions: DEFENSE_DISPLAY_POSITIONS },
  { label: 'Special Teams', positions: ST_DISPLAY_POSITIONS },
]

// Core positions always shown in depth chart even if empty
export const CORE_POSITIONS = new Set([
  'QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT',
  'DE', 'DT', 'LB', 'CB', 'S', 'K', 'P',
])

// Position grouping for roster view
export const OFFENSE_POSITIONS = new Set([
  'QB', 'RB', 'FB', 'WR', 'TE', 'X', 'Y', 'Z', 'SL', 'SR',
  'C', 'LG', 'RG', 'LT', 'RT', 'TB', 'SB', 'SE', 'FL', 'WB',
])

export const DEFENSE_POSITIONS = new Set([
  'DE', 'DT', 'NT', 'MLB', 'OLB', 'ILB', 'WLB', 'SLB', 'LB',
  'CB', 'SS', 'FS', 'S', 'NB', 'DB',
])

export const SPECIAL_TEAMS_POSITIONS = new Set(['K', 'P', 'LS', 'KR', 'PR', 'H'])

export const GROUP_ORDER: PositionGroup[] = ['Offense', 'Defense', 'Special Teams']

// All selectable position codes grouped for the edit sheet
export const POSITION_OPTIONS: { group: string; positions: string[] }[] = [
  { group: 'Offense', positions: ['QB', 'RB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'] },
  { group: 'Defense', positions: ['DE', 'DT', 'NT', 'MLB', 'OLB', 'LB', 'CB', 'FS', 'SS', 'S'] },
  { group: 'Special Teams', positions: ['K', 'P', 'LS', 'H', 'KR', 'PR'] },
]

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Returns the primary position for a player based on their position depths.
 * Prefers depth === 1; falls back to first key; returns 'ATH' if empty.
 */
export function getPrimaryPosition(positionDepths: Record<string, number>): string {
  const keys = Object.keys(positionDepths)
  if (keys.length === 0) return 'ATH'
  const primary = keys.find(k => positionDepths[k] === 1) ?? keys[0]
  return primary
}

/**
 * Returns the PositionGroup for a given position code.
 * Defaults to 'Offense' for unknown positions.
 */
export function getPositionGroup(position: string): PositionGroup {
  const pos = position.toUpperCase()
  if (OFFENSE_POSITIONS.has(pos)) return 'Offense'
  if (DEFENSE_POSITIONS.has(pos)) return 'Defense'
  if (SPECIAL_TEAMS_POSITIONS.has(pos)) return 'Special Teams'
  return 'Offense'
}

/**
 * Returns a human-readable ordinal label for a depth number (1 → '1st', etc.).
 */
export function getDepthLabel(depth: number): string {
  switch (depth) {
    case 1: return '1st'
    case 2: return '2nd'
    case 3: return '3rd'
    case 4: return '4th'
    default: return `${depth}th`
  }
}
