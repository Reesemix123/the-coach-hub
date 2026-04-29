/**
 * Player Helper Utilities
 *
 * Phase 2 Batch 1 of the position architecture redesign:
 *   - Helpers now resolve position via `primary_position_category_id` joined
 *     with the position_categories list passed in by the caller.
 *   - position_depths reads remain as a fallback for legacy data; new writes
 *     should target player_scheme_assignments.
 *
 * Six helpers tied to the desktop legacy depth grid (`getPositionDepth`,
 * `getPlayersAtDepth`, `validatePositionDepths`, `validateDepthChartConflicts`,
 * `createPositionDepthsFromSelections`, `convertDepthMapToSelections`) are
 * marked @deprecated below and will be removed in Phase 2 Batch 5 when the
 * legacy desktop depth grid is retired.
 */

import type { PlayerRecord, PositionDepthMap } from '@/types/football'

export type PositionGroup = 'offense' | 'defense' | 'special_teams'

/** Subset of position_categories shape that helpers need. Pre-fetched once
 *  per app boot (via MobileContext on mobile, or a per-route fetch on desktop)
 *  and threaded through here. Avoids per-call DB lookups. */
export interface PositionCategoryRow {
  id: string
  code: string
  name: string
  unit: string                       // 'offense' | 'defense' | 'special_teams' | 'flex'
}

// ---------------------------------------------------------------------------
// Category resolution
// ---------------------------------------------------------------------------

/** Resolve a category UUID to its short code (e.g. "QB"). */
export function getCategoryLabel(
  categoryId: string | null | undefined,
  categories: PositionCategoryRow[] = [],
): string | null {
  if (!categoryId) return null
  return categories.find((c) => c.id === categoryId)?.code ?? null
}

/** Resolve a category UUID to its display name (e.g. "Quarterback"). */
export function getCategoryName(
  categoryId: string | null | undefined,
  categories: PositionCategoryRow[] = [],
): string | null {
  if (!categoryId) return null
  return categories.find((c) => c.id === categoryId)?.name ?? null
}

// ---------------------------------------------------------------------------
// Position queries — category-first with position_depths fallback
// ---------------------------------------------------------------------------

/**
 * Returns the player's primary position code (e.g. "QB", "DL").
 * Resolution order:
 *   1. primary_position_category_id → category.code
 *   2. position_depths lowest-depth key (legacy)
 *   3. 'ATH' fallback (matches the prior mobile constants behavior)
 */
export function getPrimaryPosition(
  player: Pick<PlayerRecord, 'position_depths'> & { primary_position_category_id?: string | null },
  categories: PositionCategoryRow[] = [],
): string {
  if (player.primary_position_category_id) {
    const code = getCategoryLabel(player.primary_position_category_id, categories)
    if (code) return code
  }

  const depths = player.position_depths ?? {}
  const entries = Object.entries(depths)
  if (entries.length > 0) {
    const [position] = entries.reduce((min, curr) => (curr[1] < min[1] ? curr : min))
    return position
  }

  return 'ATH'
}

/**
 * Returns every position code the player is associated with. With the new
 * data model a player has a single primary category; that's a single-element
 * array. Falls back to legacy position_depths keys when no category is set.
 */
export function getPlayerPositions(
  player: Pick<PlayerRecord, 'position_depths'> & { primary_position_category_id?: string | null },
  categories: PositionCategoryRow[] = [],
): string[] {
  if (player.primary_position_category_id) {
    const code = getCategoryLabel(player.primary_position_category_id, categories)
    if (code) return [code]
  }
  return Object.keys(player.position_depths ?? {})
}

/** Returns every unit the player participates in (offense / defense / special_teams). */
export function getPlayerPositionGroups(
  player: Pick<PlayerRecord, 'position_depths'> & { primary_position_category_id?: string | null },
  categories: PositionCategoryRow[] = [],
): PositionGroup[] {
  // Category path
  if (player.primary_position_category_id) {
    const cat = categories.find((c) => c.id === player.primary_position_category_id)
    if (cat) {
      if (cat.unit === 'offense' || cat.unit === 'defense' || cat.unit === 'special_teams') {
        return [cat.unit]
      }
      // 'flex' (ATH) — return all three since athlete can play anywhere
      if (cat.unit === 'flex') {
        return ['offense', 'defense', 'special_teams']
      }
    }
  }

  // Legacy fallback — derive group from depths keys via category lookup by code
  const groups = new Set<PositionGroup>()
  for (const code of Object.keys(player.position_depths ?? {})) {
    const cat = categories.find((c) => c.code === code)
    if (cat) {
      if (cat.unit === 'offense' || cat.unit === 'defense' || cat.unit === 'special_teams') {
        groups.add(cat.unit)
      }
    }
  }
  return Array.from(groups)
}

/** Does the player play this code (or any of these codes)? */
export function playerHasPosition(
  player: Pick<PlayerRecord, 'position_depths'> & { primary_position_category_id?: string | null },
  position: string | string[],
  categories: PositionCategoryRow[] = [],
): boolean {
  const targets = (Array.isArray(position) ? position : [position]).map((p) => p.toUpperCase())
  const playerCodes = getPlayerPositions(player, categories).map((p) => p.toUpperCase())
  return targets.some((t) => playerCodes.includes(t))
}

export function playerInPositionGroup(
  player: Pick<PlayerRecord, 'position_depths'> & { primary_position_category_id?: string | null },
  group: PositionGroup,
  categories: PositionCategoryRow[] = [],
): boolean {
  return getPlayerPositionGroups(player, categories).includes(group)
}

/**
 * Returns a display string for the player's positions.
 * Examples:
 *   "QB"               (category-only)
 *   "QB (1st), RB (2nd)"  (legacy depths fallback)
 */
export function getPositionDisplay(
  player: Pick<PlayerRecord, 'position_depths'> & { primary_position_category_id?: string | null },
  maxShow: number = 3,
  showDepth: boolean = true,
  categories: PositionCategoryRow[] = [],
): string {
  // Category-first display
  if (player.primary_position_category_id) {
    const code = getCategoryLabel(player.primary_position_category_id, categories)
    if (code) return code
  }

  // Legacy fallback — old "QB (1st), RB (2nd)" string
  const depths = player.position_depths ?? {}
  const entries = Object.entries(depths).sort((a, b) => a[1] - b[1])
  if (entries.length === 0) return '-'

  const formatted = entries.map(([pos, depth]) =>
    showDepth ? `${pos} (${getDepthLabel(depth)})` : pos,
  )
  if (formatted.length <= maxShow) return formatted.join(', ')
  return `${formatted.slice(0, maxShow).join(', ')} +${formatted.length - maxShow}`
}

// ---------------------------------------------------------------------------
// Convenience predicates
// ---------------------------------------------------------------------------

export function playsOffense(
  player: Pick<PlayerRecord, 'position_depths'> & { primary_position_category_id?: string | null },
  categories: PositionCategoryRow[] = [],
): boolean {
  return playerInPositionGroup(player, 'offense', categories)
}

export function playsDefense(
  player: Pick<PlayerRecord, 'position_depths'> & { primary_position_category_id?: string | null },
  categories: PositionCategoryRow[] = [],
): boolean {
  return playerInPositionGroup(player, 'defense', categories)
}

export function playsSpecialTeams(
  player: Pick<PlayerRecord, 'position_depths'> & { primary_position_category_id?: string | null },
  categories: PositionCategoryRow[] = [],
): boolean {
  return playerInPositionGroup(player, 'special_teams', categories)
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/** Filter players by their primary category code (e.g. 'DL'). */
export function filterPlayersByCategory<
  T extends Pick<PlayerRecord, 'position_depths'> & { primary_position_category_id?: string | null }
>(players: T[], categoryCode: string, categories: PositionCategoryRow[]): T[] {
  const target = categoryCode.toUpperCase()
  return players.filter((p) => playerHasPosition(p, target, categories))
}

/** Filter players by unit (offense / defense / special_teams). */
export function filterPlayersByUnit<
  T extends Pick<PlayerRecord, 'position_depths'> & { primary_position_category_id?: string | null }
>(players: T[], unit: PositionGroup, categories: PositionCategoryRow[]): T[] {
  return players.filter((p) => playerInPositionGroup(p, unit, categories))
}

// ---------------------------------------------------------------------------
// Display helpers (position-agnostic)
// ---------------------------------------------------------------------------

export function getDepthLabel(depth: number): string {
  switch (depth) {
    case 1: return '1st'
    case 2: return '2nd'
    case 3: return '3rd'
    case 4: return '4th'
    default: return `${depth}th`
  }
}

export function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

/** Display name with optional positions appended.
 *  Categories must be passed because internally calls getPositionDisplay. */
export function getPlayerDisplayName(
  player: Pick<PlayerRecord, 'jersey_number' | 'first_name' | 'last_name' | 'position_depths'> & { primary_position_category_id?: string | null },
  showPositions: boolean = true,
  showDepth: boolean = false,
  categories: PositionCategoryRow[] = [],
): string {
  const name = `#${player.jersey_number || '?'} ${player.first_name || ''} ${player.last_name || ''}`.trim()
  if (!showPositions) return name
  const positions = getPositionDisplay(player, 2, showDepth, categories)
  return positions !== '-' ? `${name} (${positions})` : name
}

// ---------------------------------------------------------------------------
// @deprecated — retained for the desktop legacy depth grid. Phase 2 Batch 5
// retires the depth grid and removes these.
// ---------------------------------------------------------------------------

/** @deprecated Phase 2 Batch 5 — depth concept moves to player_scheme_assignments. */
export function getPositionDepth(
  player: Pick<PlayerRecord, 'position_depths'>,
  position: string,
): number | null {
  return player.position_depths?.[position] ?? null
}

/** @deprecated Phase 2 Batch 5 — depth concept moves to player_scheme_assignments. */
export function getPlayersAtDepth<T extends Pick<PlayerRecord, 'position_depths'>>(
  players: T[],
  position: string,
  depth: number,
): T[] {
  return players.filter((p) => p.position_depths?.[position] === depth)
}

/** @deprecated Phase 2 Batch 5 — validation moves to scheme-aware UI. */
export function validatePositionDepths(depths: PositionDepthMap): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  if (!depths || typeof depths !== 'object') {
    errors.push('Position depths must be an object')
    return { isValid: false, errors }
  }
  const entries = Object.entries(depths)
  if (entries.length === 0) {
    errors.push('Player must have at least one position')
  }
  entries.forEach(([pos, depth]) => {
    if (typeof depth !== 'number' || depth < 1 || depth > 4) {
      errors.push(`Depth for ${pos} must be between 1-4, got: ${depth}`)
    }
  })
  return { isValid: errors.length === 0, errors }
}

/** @deprecated Phase 2 Batch 5. */
export function validateDepthChartConflicts(
  depths: PositionDepthMap,
  allPlayers: PlayerRecord[],
  editingPlayerId: string | null,
): {
  isValid: boolean
  conflicts: Array<{ position: string; depth: number; conflictingPlayer: PlayerRecord }>
} {
  const conflicts: Array<{ position: string; depth: number; conflictingPlayer: PlayerRecord }> = []
  Object.entries(depths).forEach(([position, depth]) => {
    const conflictingPlayer = allPlayers.find((player) => {
      if (editingPlayerId && player.id === editingPlayerId) return false
      return player.position_depths?.[position] === depth
    })
    if (conflictingPlayer) {
      conflicts.push({ position, depth, conflictingPlayer })
    }
  })
  return { isValid: conflicts.length === 0, conflicts }
}

/** @deprecated Phase 2 Batch 5. */
export function createPositionDepthsFromSelections(
  selections: Array<{ position: string; depth: number }>,
): PositionDepthMap {
  const depths: PositionDepthMap = {}
  selections.forEach(({ position, depth }) => {
    depths[position] = depth
  })
  return depths
}

/** @deprecated Phase 2 Batch 5. */
export function convertDepthMapToSelections(
  depths: PositionDepthMap,
): Array<{ position: string; depth: number }> {
  return Object.entries(depths || {}).map(([position, depth]) => ({ position, depth }))
}
