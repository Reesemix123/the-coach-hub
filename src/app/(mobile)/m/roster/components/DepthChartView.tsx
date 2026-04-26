'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { MobilePlayer } from '@/app/(mobile)/MobileContext'
import { UNIT_SECTIONS, CORE_POSITIONS, getDepthLabel } from '../constants/positions'
import { SkeletonRow, ChevronIcon, ArrowUpIcon, ArrowDownIcon } from './shared'

// TODO: drag-to-reorder for depth chart

interface DepthChartViewProps {
  players: MobilePlayer[]
  playersLoading: boolean
  teamId: string
  onEditPlayer: (player: MobilePlayer, position?: string) => void
  onPickPlayer: (position: string) => void
  onPlayersChanged: () => void
}

export default function DepthChartView({
  players,
  playersLoading,
  onEditPlayer,
  onPickPlayer,
  onPlayersChanged,
}: DepthChartViewProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Offense: true,
    Defense: true,
    'Special Teams': true,
  })

  const playerMap = useMemo(() => {
    const map = new Map<string, MobilePlayer>()
    for (const p of players) map.set(p.id, p)
    return map
  }, [players])

  const handleSwapDepth = useCallback(async (
    playerId: string,
    position: string,
    currentDepth: number,
    targetDepth: number,
  ) => {
    // Find the other player at the target depth for this position
    const otherPlayer = players.find(p =>
      p.id !== playerId && p.position_depths[position] === targetDepth
    )

    const supabase = createClient()

    // Update current player
    const player = playerMap.get(playerId)
    if (!player) return
    const newDepths = { ...player.position_depths, [position]: targetDepth }
    await supabase.from('players').update({ position_depths: newDepths }).eq('id', playerId)

    // Swap other player if exists
    if (otherPlayer) {
      const otherNewDepths = { ...otherPlayer.position_depths, [position]: currentDepth }
      await supabase.from('players').update({ position_depths: otherNewDepths }).eq('id', otherPlayer.id)
    }

    onPlayersChanged()
  }, [players, playerMap, onPlayersChanged])

  if (playersLoading) {
    return <div>{[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}</div>
  }

  return (
    <div>
      {UNIT_SECTIONS.map(({ label: unitLabel, positions }) => {
        const expanded = expandedSections[unitLabel] !== false

        return (
          <div key={unitLabel}>
            <button
              type="button"
              onClick={() => setExpandedSections(prev => ({ ...prev, [unitLabel]: !prev[unitLabel] }))}
              className="sticky top-0 z-10 w-full px-4 py-2.5 bg-[#f2f2f7] flex items-center justify-between active:bg-[var(--bg-pill-inactive)] transition-colors"
            >
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{unitLabel}</span>
              <ChevronIcon expanded={expanded} />
            </button>

            {expanded && positions.map(({ label: posLabel, codes }) => {
              // Find players at this position, sorted by depth
              const posPlayers = players
                .filter(p => codes.some(code => p.position_depths[code] !== undefined))
                .map(p => {
                  const matchingCode = codes.find(c => p.position_depths[c] !== undefined)!
                  return { player: p, position: matchingCode, depth: p.position_depths[matchingCode] }
                })
                .sort((a, b) => a.depth - b.depth)

              // Skip non-core positions with no players
              if (posPlayers.length === 0 && !CORE_POSITIONS.has(posLabel)) return null

              return (
                <div key={posLabel}>
                  {/* Position header — no + button */}
                  <div className="px-4 pt-3 pb-1 flex items-center">
                    <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase">{posLabel}</span>
                  </div>

                  {posPlayers.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onPickPlayer(codes[0])}
                      className="w-full px-4 py-3 border-b border-[var(--border-primary)] text-left"
                    >
                      <p className="text-xs text-[var(--text-tertiary)] italic">Tap to add player</p>
                    </button>
                  ) : (
                    posPlayers.map(({ player, position, depth }, index) => {
                      const isFirst = index === 0
                      const isLast = index === posPlayers.length - 1
                      const isStarter = depth === 1

                      return (
                        <div
                          key={`${player.id}-${position}`}
                          className="bg-[var(--bg-card)] border-b border-[var(--border-primary)] px-4 flex items-center gap-3 min-h-[56px]"
                        >
                          {/* Tap area — opens edit sheet with position context */}
                          <button
                            type="button"
                            onClick={() => onEditPlayer(player, position)}
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
                              {getDepthLabel(depth)}
                            </span>
                          </button>

                          {/* Reorder buttons — enlarged touch targets */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => !isFirst && handleSwapDepth(player.id, position, depth, posPlayers[index - 1].depth)}
                              disabled={isFirst}
                              className={`p-2 rounded ${isFirst ? 'text-gray-200' : 'text-[var(--text-tertiary)] active:text-[var(--text-primary)]'}`}
                            >
                              <ArrowUpIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => !isLast && handleSwapDepth(player.id, position, depth, posPlayers[index + 1].depth)}
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
