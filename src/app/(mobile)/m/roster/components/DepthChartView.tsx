'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useMobile } from '@/app/(mobile)/MobileContext'
import {
  ensureDefaultSchemes,
  getTeamSchemes,
  getSlotAssignments,
  swapDepth,
  type SchemeUnit,
  type SchemeWithPositions,
  type SlotAssignment,
} from '@/lib/services/scheme.service'
import { getDepthLabel } from '@/utils/playerHelpers'
import { SkeletonRow, ChevronIcon, ArrowUpIcon, ArrowDownIcon } from './shared'

const UNIT_ORDER: SchemeUnit[] = ['offense', 'defense', 'special_teams']
const UNIT_LABELS: Record<SchemeUnit, string> = {
  offense: 'Offense',
  defense: 'Defense',
  special_teams: 'Special Teams',
}

interface DepthChartViewProps {
  teamId: string
  onEditPlayer: (playerId: string, slotCode?: string) => void
  onPickPlayer: (schemePositionId: string, slotLabel: string) => void
  onPlayersChanged: () => void
}

export default function DepthChartView({
  teamId,
  onEditPlayer,
  onPickPlayer,
  onPlayersChanged,
}: DepthChartViewProps) {
  const { teams } = useMobile()
  const teamLevel = useMemo(
    () => teams.find(t => t.id === teamId)?.level ?? null,
    [teams, teamId],
  )

  const [loading, setLoading] = useState(true)
  const [defaultSchemeByUnit, setDefaultSchemeByUnit] = useState<Partial<Record<SchemeUnit, SchemeWithPositions>>>({})
  const [slotsByUnit, setSlotsByUnit] = useState<Partial<Record<SchemeUnit, SlotAssignment[]>>>({})
  const [expandedSections, setExpandedSections] = useState<Record<SchemeUnit, boolean>>({
    offense: true,
    defense: true,
    special_teams: true,
  })

  const refreshUnit = useCallback(async (unit: SchemeUnit, schemeId: string) => {
    const supabase = createClient()
    const slots = await getSlotAssignments(supabase, schemeId)
    setSlotsByUnit(prev => ({ ...prev, [unit]: slots }))
  }, [])

  // Initial load — ensure schemes exist, fetch defaults + slot assignments
  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    setLoading(true)

    async function load() {
      const supabase = createClient()
      try {
        await ensureDefaultSchemes(supabase, teamId, teamLevel)
        const allSchemes = await getTeamSchemes(supabase, teamId)
        if (cancelled) return

        const byUnit: Partial<Record<SchemeUnit, SchemeWithPositions>> = {}
        for (const unit of UNIT_ORDER) {
          const def = allSchemes.find(s => s.unit === unit && s.is_default)
          if (def) byUnit[unit] = def
        }
        setDefaultSchemeByUnit(byUnit)

        // Fetch slot assignments per unit (parallel)
        const slotPromises = UNIT_ORDER
          .filter(u => byUnit[u])
          .map(async u => {
            const slots = await getSlotAssignments(supabase, byUnit[u]!.id)
            return [u, slots] as const
          })
        const results = await Promise.all(slotPromises)
        if (cancelled) return

        const slotsMap: Partial<Record<SchemeUnit, SlotAssignment[]>> = {}
        for (const [unit, slots] of results) slotsMap[unit] = slots
        setSlotsByUnit(slotsMap)
      } catch (err) {
        console.error('[DepthChartView] load failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [teamId, teamLevel])

  const handleSwapDepth = useCallback(async (
    schemePositionId: string,
    playerAId: string,
    depthA: number,
    playerBId: string,
    depthB: number,
    unit: SchemeUnit,
  ) => {
    const supabase = createClient()
    try {
      await swapDepth(supabase, schemePositionId, playerAId, depthA, playerBId, depthB)
      const schemeId = defaultSchemeByUnit[unit]?.id
      if (schemeId) await refreshUnit(unit, schemeId)
      onPlayersChanged()
    } catch (err) {
      console.error('[DepthChartView] swap failed:', err)
    }
  }, [defaultSchemeByUnit, refreshUnit, onPlayersChanged])

  if (loading) {
    return <div>{[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}</div>
  }

  return (
    <div>
      {UNIT_ORDER.map(unit => {
        const scheme = defaultSchemeByUnit[unit]
        if (!scheme) return null
        const slots = slotsByUnit[unit] ?? []
        const expanded = expandedSections[unit] !== false

        return (
          <div key={unit}>
            <button
              type="button"
              onClick={() => setExpandedSections(prev => ({ ...prev, [unit]: !prev[unit] }))}
              className="sticky top-0 z-10 w-full px-4 py-2.5 bg-[#f2f2f7] flex items-center justify-between active:bg-[var(--bg-pill-inactive)] transition-colors"
            >
              <span className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider">
                {UNIT_LABELS[unit]}
              </span>
              <ChevronIcon expanded={expanded} />
            </button>

            {expanded && slots.map(slot => {
              const sortedPlayers = [...slot.players].sort((a, b) => a.depth - b.depth)

              return (
                <div key={slot.scheme_position_id}>
                  <div className="px-4 pt-3 pb-1 flex items-center">
                    <span className="text-xs font-bold text-[var(--text-section-header)] uppercase">{slot.slot_code}</span>
                    <span className="text-xs text-[var(--text-tertiary)] ml-2">{slot.display_label}</span>
                  </div>

                  {sortedPlayers.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onPickPlayer(slot.scheme_position_id, slot.display_label)}
                      className="w-full px-4 py-3 border-b border-[var(--border-primary)] text-left"
                    >
                      <p className="text-xs text-[var(--text-tertiary)] italic">Tap to add player</p>
                    </button>
                  ) : (
                    sortedPlayers.map((player, index) => {
                      const isFirst = index === 0
                      const isLast = index === sortedPlayers.length - 1
                      const isStarter = player.depth === 1

                      return (
                        <div
                          key={`${player.player_id}-${slot.scheme_position_id}`}
                          className="bg-[var(--bg-card)] border-b border-[var(--border-primary)] px-4 flex items-center gap-3 min-h-[56px]"
                        >
                          <button
                            type="button"
                            onClick={() => onEditPlayer(player.player_id, slot.slot_code)}
                            className="flex items-center gap-3 flex-1 min-w-0 active:opacity-70 transition-opacity text-left"
                          >
                            <div className="w-10 h-10 rounded-full bg-[var(--bg-card-alt)] text-[var(--text-primary)] font-bold text-sm flex items-center justify-center flex-shrink-0">
                              {player.jersey_number}
                            </div>
                            <div className="flex-1 min-w-0 py-3">
                              <p className="text-base font-medium text-[var(--text-primary)] truncate">
                                {player.first_name} {player.last_name}
                              </p>
                            </div>
                            <span
                              className={`text-xs font-semibold rounded-full px-2.5 py-1 flex-shrink-0 ${
                                isStarter
                                  ? 'bg-[#B8CA6E] text-[#1c1c1e]'
                                  : 'bg-[var(--bg-pill-inactive)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {getDepthLabel(player.depth)}
                            </span>
                          </button>

                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (isFirst) return
                                const above = sortedPlayers[index - 1]
                                handleSwapDepth(slot.scheme_position_id, player.player_id, player.depth, above.player_id, above.depth, unit)
                              }}
                              disabled={isFirst}
                              className={`p-2 rounded ${isFirst ? 'text-gray-200' : 'text-[var(--text-tertiary)] active:text-[var(--text-primary)]'}`}
                            >
                              <ArrowUpIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (isLast) return
                                const below = sortedPlayers[index + 1]
                                handleSwapDepth(slot.scheme_position_id, player.player_id, player.depth, below.player_id, below.depth, unit)
                              }}
                              disabled={isLast}
                              className={`p-2 rounded ${isLast ? 'text-gray-200' : 'text-[var(--text-tertiary)] active:text-[var(--text-primary)]'}`}
                            >
                              <ArrowDownIcon />
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
