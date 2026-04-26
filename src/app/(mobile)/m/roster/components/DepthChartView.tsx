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
              className="sticky top-0 z-10 w-full px-4 py-2.5 bg-[#f2f2f7] flex items-center justify-between active:bg-gray-200 transition-colors"
            >
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{unitLabel}</span>
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
                    <span className="text-xs font-bold text-gray-400 uppercase">{posLabel}</span>
                  </div>

                  {posPlayers.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onPickPlayer(codes[0])}
                      className="w-full px-4 py-3 border-b border-gray-100 text-left"
                    >
                      <p className="text-xs text-gray-400 italic">Tap to add player</p>
                    </button>
                  ) : (
                    posPlayers.map(({ player, position, depth }, index) => {
                      const isFirst = index === 0
                      const isLast = index === posPlayers.length - 1
                      const isStarter = depth === 1

                      return (
                        <div
                          key={`${player.id}-${position}`}
                          className="bg-white border-b border-gray-100 px-4 flex items-center gap-3 min-h-[56px]"
                        >
                          {/* Tap area — opens edit sheet with position context */}
                          <button
                            type="button"
                            onClick={() => onEditPlayer(player, position)}
                            className="flex items-center gap-3 flex-1 min-w-0 active:opacity-70 transition-opacity text-left"
                          >
                            <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-900 font-bold text-sm flex items-center justify-center flex-shrink-0">
                              {player.jersey_number}
                            </div>
                            <div className="flex-1 min-w-0 py-3">
                              <p className="text-base font-medium text-gray-900 truncate">
                                {player.first_name} {player.last_name}
                              </p>
                            </div>
                            <span
                              className={`text-xs font-semibold rounded-full px-2.5 py-1 flex-shrink-0 ${
                                isStarter
                                  ? 'bg-[#B8CA6E] text-[#1c1c1e]'
                                  : 'bg-gray-200 text-gray-600'
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
                              className={`p-2 rounded ${isFirst ? 'text-gray-200' : 'text-gray-400 active:text-gray-700'}`}
                            >
                              <ArrowUpIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => !isLast && handleSwapDepth(player.id, position, depth, posPlayers[index + 1].depth)}
                              disabled={isLast}
                              className={`p-2 rounded ${isLast ? 'text-gray-200' : 'text-gray-400 active:text-gray-700'}`}
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
