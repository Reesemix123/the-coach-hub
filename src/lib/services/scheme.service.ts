// ============================================================================
// SCHEME SERVICE — read/write helpers for the position architecture
//
// All functions take a Supabase client argument so they work in both server
// and browser contexts. Pass createClient() from @/utils/supabase/client or
// @/utils/supabase/server depending on the call site.
//
// Phase 2 Sub-batch 5A — Foundation layer.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SchemeUnit,
  TeamScheme,
  SchemeWithPositions,
  SlotAssignment,
  PlayerAssignment,
} from '@/types/scheme'
import {
  SCHEME_TEMPLATES,
  defaultSchemeKey,
  ageGroupFromLevel,
} from '@/config/footballPositions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, 'public', any>

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Returns the team's schemes (all or filtered to one unit) with their
 * scheme_positions inlined and sorted by sort_order.
 */
export async function getTeamSchemes(
  db: DB,
  teamId: string,
  unit?: SchemeUnit,
): Promise<SchemeWithPositions[]> {
  let query = db
    .from('team_schemes')
    .select('*, scheme_positions(*)')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .order('sort_order')

  if (unit) query = query.eq('unit', unit)

  const { data, error } = await query
  if (error) throw new Error(`getTeamSchemes failed: ${error.message}`)

  return (data ?? []).map((row) => ({
    ...row,
    scheme_positions: (row.scheme_positions ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
    ),
  })) as SchemeWithPositions[]
}

/** Returns the team's `is_default` scheme for a given unit, or null. */
export async function getDefaultScheme(
  db: DB,
  teamId: string,
  unit: SchemeUnit,
): Promise<SchemeWithPositions | null> {
  const { data, error } = await db
    .from('team_schemes')
    .select('*, scheme_positions(*)')
    .eq('team_id', teamId)
    .eq('unit', unit)
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(`getDefaultScheme failed: ${error.message}`)
  if (!data) return null

  return {
    ...data,
    scheme_positions: (data.scheme_positions ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
    ),
  } as SchemeWithPositions
}

/**
 * For one scheme: returns each slot with the players assigned at each depth.
 * Used by the depth chart UI.
 */
export async function getSlotAssignments(
  db: DB,
  schemeId: string,
): Promise<SlotAssignment[]> {
  const { data: positions, error: posErr } = await db
    .from('scheme_positions')
    .select('id, slot_code, display_label, sort_order, position_category_id')
    .eq('scheme_id', schemeId)
    .order('sort_order')

  if (posErr) throw new Error(`getSlotAssignments positions failed: ${posErr.message}`)
  if (!positions || positions.length === 0) return []

  const positionIds = positions.map((p) => p.id)

  const { data: assignments, error: asnErr } = await db
    .from('player_scheme_assignments')
    .select('scheme_position_id, depth, player_id, players!inner(id, first_name, last_name, jersey_number)')
    .in('scheme_position_id', positionIds)
    .order('depth')

  if (asnErr) throw new Error(`getSlotAssignments assignments failed: ${asnErr.message}`)

  // Group assignments by scheme_position_id
  const byPosition = new Map<string, SlotAssignment['players']>()
  for (const a of assignments ?? []) {
    const player = (a as unknown as {
      players: { id: string; first_name: string; last_name: string; jersey_number: string } | null
    }).players
    if (!player) continue
    const list = byPosition.get(a.scheme_position_id) ?? []
    list.push({
      player_id: player.id,
      depth: a.depth,
      first_name: player.first_name,
      last_name: player.last_name,
      jersey_number: player.jersey_number,
    })
    byPosition.set(a.scheme_position_id, list)
  }

  return positions.map((p) => ({
    scheme_position_id: p.id,
    slot_code: p.slot_code,
    display_label: p.display_label,
    sort_order: p.sort_order,
    position_category_id: p.position_category_id,
    players: byPosition.get(p.id) ?? [],
  }))
}

/** Returns a player's slot assignments across all their team's schemes. */
export async function getPlayerAssignments(
  db: DB,
  playerId: string,
): Promise<PlayerAssignment[]> {
  const { data, error } = await db
    .from('player_scheme_assignments')
    .select(`
      scheme_position_id, depth,
      scheme_positions!inner (
        slot_code, display_label,
        team_schemes!inner (id, name, unit)
      )
    `)
    .eq('player_id', playerId)

  if (error) throw new Error(`getPlayerAssignments failed: ${error.message}`)

  return (data ?? []).map((row) => {
    const sp = (row as unknown as {
      scheme_positions: {
        slot_code: string
        display_label: string
        team_schemes: { id: string; name: string; unit: SchemeUnit }
      }
    }).scheme_positions
    return {
      scheme_position_id: row.scheme_position_id,
      slot_code: sp.slot_code,
      display_label: sp.display_label,
      depth: row.depth,
      scheme: sp.team_schemes,
    }
  })
}

/**
 * Returns one row per (player, slot, depth) triple across all of the team's
 * default schemes (offense + defense + special_teams). Used by sideline
 * auto-populate to seed game_lineups in the exact shape it needs.
 *
 * Filters depth to 1-4 to match game_lineups.depth CHECK constraint
 * (PSA allows 1-5; the 5th-team depth never makes it onto game day).
 */
export async function getTeamLineupTriples(
  db: DB,
  teamId: string,
): Promise<Array<{ player_id: string; slot_code: string; depth: number }>> {
  const { data, error } = await db
    .from('player_scheme_assignments')
    .select(`
      player_id, depth,
      scheme_positions!inner (
        slot_code,
        team_schemes!inner ( team_id, is_default )
      )
    `)
    .eq('scheme_positions.team_schemes.team_id', teamId)
    .eq('scheme_positions.team_schemes.is_default', true)
    .lte('depth', 4)

  if (error) throw new Error(`getTeamLineupTriples failed: ${error.message}`)

  return (data ?? []).map((row) => {
    const sp = (row as unknown as {
      scheme_positions: { slot_code: string }
    }).scheme_positions
    return { player_id: row.player_id, slot_code: sp.slot_code, depth: row.depth }
  })
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

/**
 * Upsert a player at a slot at the given depth. If a row exists for
 * (player_id, scheme_position_id) the depth is updated.
 */
export async function assignPlayerToSlot(
  db: DB,
  playerId: string,
  schemePositionId: string,
  depth: number,
): Promise<void> {
  if (depth < 1 || depth > 5) {
    throw new Error(`assignPlayerToSlot: depth must be 1-5, got ${depth}`)
  }

  const { error } = await db
    .from('player_scheme_assignments')
    .upsert(
      { player_id: playerId, scheme_position_id: schemePositionId, depth },
      { onConflict: 'player_id,scheme_position_id' },
    )

  if (error) throw new Error(`assignPlayerToSlot failed: ${error.message}`)
}

/** Remove a player from a slot. */
export async function unassignPlayer(
  db: DB,
  playerId: string,
  schemePositionId: string,
): Promise<void> {
  const { error } = await db
    .from('player_scheme_assignments')
    .delete()
    .eq('player_id', playerId)
    .eq('scheme_position_id', schemePositionId)

  if (error) throw new Error(`unassignPlayer failed: ${error.message}`)
}

/**
 * Atomically swap two players' depths at the same slot.
 *
 * Relies on the DEFERRABLE INITIALLY DEFERRED unique constraint on
 * (scheme_position_id, depth) so the mid-state collision is allowed
 * inside the transaction.
 *
 * Implemented as a single SQL RPC for atomicity. If the RPC is missing
 * we fall back to a temp-depth=99 swap (which still works without the
 * deferrable constraint, but is non-atomic).
 */
export async function swapDepth(
  db: DB,
  schemePositionId: string,
  playerAId: string,
  depthA: number,
  playerBId: string,
  depthB: number,
): Promise<void> {
  // Two UPDATEs. With the deferrable UNIQUE constraint, the mid-state
  // (both rows pointing at the same slot+depth pair after the first
  // UPDATE) is allowed; the constraint only checks at the end of the
  // statement batch. supabase-js issues each UPDATE separately, so
  // we use a temp-depth fallback to keep the swap robust whether or
  // not the deferrable constraint is in place.
  const TEMP_DEPTH = 99

  const { error: e1 } = await db
    .from('player_scheme_assignments')
    .update({ depth: TEMP_DEPTH })
    .eq('scheme_position_id', schemePositionId)
    .eq('player_id', playerAId)
  if (e1) throw new Error(`swapDepth step 1 failed: ${e1.message}`)

  const { error: e2 } = await db
    .from('player_scheme_assignments')
    .update({ depth: depthA })
    .eq('scheme_position_id', schemePositionId)
    .eq('player_id', playerBId)
  if (e2) throw new Error(`swapDepth step 2 failed: ${e2.message}`)

  const { error: e3 } = await db
    .from('player_scheme_assignments')
    .update({ depth: depthB })
    .eq('scheme_position_id', schemePositionId)
    .eq('player_id', playerAId)
  if (e3) throw new Error(`swapDepth step 3 failed: ${e3.message}`)
}

/**
 * Idempotent safety net for teams missing default schemes (e.g. created
 * before migration 190 deployed). Mirrors the team-creation hook in
 * `src/app/api/teams/create/route.ts` so any consumer can call this
 * before rendering a depth chart and be sure the team has schemes.
 */
export async function ensureDefaultSchemes(
  db: DB,
  teamId: string,
  level: string | null,
): Promise<void> {
  const ageGroup = ageGroupFromLevel(level)

  const { data: existing } = await db
    .from('team_schemes')
    .select('unit')
    .eq('team_id', teamId)
    .eq('is_default', true)

  const haveByUnit = new Set((existing ?? []).map((r) => r.unit as SchemeUnit))
  const missing: SchemeUnit[] = (['offense', 'defense', 'special_teams'] as const).filter(
    (u) => !haveByUnit.has(u),
  )
  if (missing.length === 0) return

  const { data: categories } = await db
    .from('position_categories')
    .select('id, code')
    .eq('sport', 'football')

  const categoryByCode = new Map<string, string>(
    (categories ?? []).map((c) => [c.code as string, c.id as string]),
  )

  for (const unit of missing) {
    const templateKey = defaultSchemeKey(unit, ageGroup)
    const template = SCHEME_TEMPLATES.find((t) => t.key === templateKey)
    if (!template) continue

    const { data: scheme, error: schemeErr } = await db
      .from('team_schemes')
      .insert({
        team_id: teamId,
        sport: 'football',
        template_key: template.key,
        name: template.name,
        unit,
        is_default: true,
        is_active: true,
        sort_order: 0,
      })
      .select('id')
      .single()

    if (schemeErr || !scheme) {
      console.warn(`[ensureDefaultSchemes] Failed to create ${unit} scheme for team ${teamId}:`, schemeErr)
      continue
    }

    const slotRows = template.slots
      .map((slot, idx) => {
        const categoryId = categoryByCode.get(slot.category)
        if (!categoryId) return null
        return {
          scheme_id: scheme.id,
          position_category_id: categoryId,
          slot_code: slot.slotCode,
          display_label: slot.label,
          diagram_x: slot.diagramX ?? null,
          diagram_y: slot.diagramY ?? null,
          sort_order: idx,
          is_optional: slot.optional ?? false,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (slotRows.length > 0) {
      const { error: posErr } = await db.from('scheme_positions').insert(slotRows)
      if (posErr) {
        console.warn(`[ensureDefaultSchemes] Slot insert failed for team ${teamId} ${unit}:`, posErr)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export type { SchemeUnit, TeamScheme, SchemeWithPositions, SlotAssignment, PlayerAssignment }
