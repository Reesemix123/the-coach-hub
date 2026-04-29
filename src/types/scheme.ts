// ============================================================================
// SCHEME TYPES — position architecture Phase 2
//
// Mirrors the team_schemes / scheme_positions / player_scheme_assignments
// tables introduced in migration 190. The team-creation hook seeds default
// schemes from SCHEME_TEMPLATES in `src/config/footballPositions.ts`.
// ============================================================================

export type SchemeUnit = 'offense' | 'defense' | 'special_teams'

export interface TeamScheme {
  id: string
  team_id: string
  sport: string
  template_key: string | null
  name: string
  unit: SchemeUnit
  is_default: boolean
  is_active: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface SchemePosition {
  id: string
  scheme_id: string
  position_category_id: string
  slot_code: string
  display_label: string
  diagram_x: number | null
  diagram_y: number | null
  sort_order: number
  is_optional: boolean
}

export interface PlayerSchemeAssignment {
  id: string
  player_id: string
  scheme_position_id: string
  depth: number
  notes: string | null
  assigned_at: string
}

/** A scheme with its slot definitions inlined — primary read shape. */
export interface SchemeWithPositions extends TeamScheme {
  scheme_positions: SchemePosition[]
}

/** A scheme slot with the player(s) assigned at each depth. */
export interface SlotAssignment {
  scheme_position_id: string
  slot_code: string
  display_label: string
  sort_order: number
  position_category_id: string
  players: Array<{
    player_id: string
    depth: number
    first_name: string
    last_name: string
    jersey_number: string
  }>
}

/** A player's slot across all schemes (used in player-detail views). */
export interface PlayerAssignment {
  scheme_position_id: string
  slot_code: string
  display_label: string
  depth: number
  scheme: {
    id: string
    name: string
    unit: SchemeUnit
  }
}
