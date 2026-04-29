'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { MobilePlayer } from '@/app/(mobile)/MobileContext'
import { getDepthLabel } from '@/utils/playerHelpers'
import { SkeletonRow, ChevronIcon } from './shared'

// TODO: Phase 2 Batch 5 — replace with scheme_positions-driven game lineup
// once the new depth chart UI is built.
type PositionGroup = 'Offense' | 'Defense' | 'Special Teams'

const UNIT_SECTIONS: { label: PositionGroup; positions: { label: string; codes: string[] }[] }[] = [
  {
    label: 'Offense',
    positions: [
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
    ],
  },
  {
    label: 'Defense',
    positions: [
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
    ],
  },
  {
    label: 'Special Teams',
    positions: [
      { label: 'K', codes: ['K'] },
      { label: 'P', codes: ['P'] },
      { label: 'LS', codes: ['LS'] },
      { label: 'H', codes: ['H'] },
      { label: 'KR', codes: ['KR'] },
      { label: 'PR', codes: ['PR'] },
    ],
  },
]

interface LineupEntry {
  player_id: string
  position: string
  depth: number
}

interface GameLineupViewProps {
  activeGameId: string
  teamId: string
  players: MobilePlayer[]
  playersLoading: boolean
  bumpLineupVersion: () => void
}

export default function GameLineupView({
  activeGameId,
  teamId,
  players,
  playersLoading,
  bumpLineupVersion,
}: GameLineupViewProps) {
  const [gameLineup, setGameLineup] = useState<LineupEntry[]>([])
  const [lineupLoading, setLineupLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Offense: true,
    Defense: true,
    'Special Teams': true,
  })
  const [activePlayerForDepth, setActivePlayerForDepth] = useState<{
    playerId: string
    position: string
    currentDepth: number
  } | null>(null)

  const playerMap = useMemo(() => {
    const map = new Map<string, MobilePlayer>()
    for (const p of players) map.set(p.id, p)
    return map
  }, [players])

  useEffect(() => {
    if (!activeGameId || !teamId || playersLoading) return

    let cancelled = false
    setLineupLoading(true)

    async function loadLineup() {
      const supabase = createClient()

      const { data, error } = await supabase.rpc('latest_game_lineup', {
        game_id_param: activeGameId,
        team_id_param: teamId,
      })

      if (cancelled) return

      if (!error && data && data.length > 0) {
        setGameLineup(
          data.map((r: { player_id: string; position: string; depth: number }) => ({
            player_id: r.player_id,
            position: r.position,
            depth: r.depth,
          }))
        )
        setLineupLoading(false)
        return
      }

      // No lineup yet — auto-populate from team depth chart
      if (players.length > 0) {
        const rows: {
          game_id: string
          team_id: string
          player_id: string
          position: string
          depth: number
        }[] = []

        for (const player of players) {
          for (const [pos, depth] of Object.entries(player.position_depths)) {
            rows.push({
              game_id: activeGameId,
              team_id: teamId,
              player_id: player.id,
              position: pos,
              depth,
            })
          }
        }

        if (rows.length > 0) {
          await supabase.from('game_lineups').insert(rows)

          const { data: fresh } = await supabase.rpc('latest_game_lineup', {
            game_id_param: activeGameId,
            team_id_param: teamId,
          })

          if (!cancelled && fresh) {
            setGameLineup(
              fresh.map((r: { player_id: string; position: string; depth: number }) => ({
                player_id: r.player_id,
                position: r.position,
                depth: r.depth,
              }))
            )
            bumpLineupVersion()
          }
        }
      }

      if (!cancelled) setLineupLoading(false)
    }

    loadLineup()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGameId, teamId, players, playersLoading])

  async function handleDepthChange(playerId: string, position: string, newDepth: number) {
    if (!activeGameId || !teamId) return

    const currentEntry = gameLineup.find(e => e.player_id === playerId && e.position === position)
    if (!currentEntry || currentEntry.depth === newDepth) {
      setActivePlayerForDepth(null)
      return
    }

    const displaced = gameLineup.find(
      e => e.position === position && e.depth === newDepth && e.player_id !== playerId
    )

    // Optimistic update
    setGameLineup(prev =>
      prev.map(e => {
        if (e.player_id === playerId && e.position === position) {
          return { ...e, depth: newDepth }
        }
        if (displaced && e.player_id === displaced.player_id && e.position === position) {
          return { ...e, depth: currentEntry.depth }
        }
        return e
      })
    )
    setActivePlayerForDepth(null)

    const supabase = createClient()
    const inserts: {
      game_id: string
      team_id: string
      player_id: string
      position: string
      depth: number
    }[] = [
      { game_id: activeGameId, team_id: teamId, player_id: playerId, position, depth: newDepth },
    ]
    if (displaced) {
      inserts.push({
        game_id: activeGameId,
        team_id: teamId,
        player_id: displaced.player_id,
        position,
        depth: currentEntry.depth,
      })
    }
    await supabase.from('game_lineups').insert(inserts)
    bumpLineupVersion()
  }

  useEffect(() => {
    if (!activeGameId || gameLineup.length === 0) return
    try {
      localStorage.setItem(`ych-lineup-${activeGameId}`, JSON.stringify(gameLineup))
    } catch {}
  }, [activeGameId, gameLineup])

  function toggleSection(label: string) {
    setExpandedSections(prev => ({ ...prev, [label]: !prev[label] }))
  }

  if (lineupLoading || playersLoading) {
    return (
      <>
        <div className="px-4 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Game Lineup</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Loading lineup...</p>
        </div>
        <div>
          {[...Array(10)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Game Lineup</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Tap a player to change depth</p>
      </div>

      {UNIT_SECTIONS.map(({ label: unitLabel, positions }) => {
        const expanded = expandedSections[unitLabel] !== false

        return (
          <div key={unitLabel}>
            <button
              type="button"
              onClick={() => toggleSection(unitLabel)}
              className="sticky top-0 z-10 w-full px-4 py-2.5 bg-[#f2f2f7] flex items-center justify-between active:bg-[var(--bg-pill-inactive)] transition-colors"
            >
              <span className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider">
                {unitLabel}
              </span>
              <ChevronIcon expanded={expanded} />
            </button>

            {expanded && positions.map(({ label: posLabel, codes }) => {
              const posEntries = gameLineup
                .filter(e => codes.includes(e.position))
                .sort((a, b) => a.depth - b.depth)

              const posPlayers = posEntries
                .map(e => ({ entry: e, player: playerMap.get(e.player_id) }))
                .filter(
                  (p): p is { entry: LineupEntry; player: MobilePlayer } => p.player != null
                )

              return (
                <div key={posLabel}>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase">{posLabel}</span>
                  </div>

                  {posPlayers.length === 0 ? (
                    <div className="px-4 py-3 border-b border-[var(--border-primary)]">
                      <p className="text-xs text-[var(--text-tertiary)] italic">No player assigned</p>
                    </div>
                  ) : (
                    posPlayers.map(({ entry, player }) => {
                      const isActive =
                        activePlayerForDepth?.playerId === player.id &&
                        activePlayerForDepth?.position === entry.position
                      const isStarter = entry.depth === 1

                      return (
                        <div key={`${player.id}-${entry.position}`}>
                          <button
                            type="button"
                            onClick={() =>
                              setActivePlayerForDepth(
                                isActive
                                  ? null
                                  : {
                                      playerId: player.id,
                                      position: entry.position,
                                      currentDepth: entry.depth,
                                    }
                              )
                            }
                            className={`w-full bg-[var(--bg-card)] border-b border-[var(--border-primary)] px-4 flex items-center gap-3 min-h-[56px] active:bg-[var(--bg-card-alt)] transition-colors text-left ${
                              isActive ? 'bg-[var(--bg-card-alt)]' : ''
                            }`}
                          >
                            <div className="w-10 h-10 rounded-full bg-[var(--bg-card-alt)] text-[var(--text-primary)] font-bold text-sm flex items-center justify-center flex-shrink-0">
                              {player.jersey_number}
                            </div>
                            <div className="flex-1 min-w-0 py-3">
                              <p className="text-base font-medium text-[var(--text-primary)] truncate">
                                {player.first_name} {player.last_name}
                              </p>
                              <p className="text-sm text-[var(--text-secondary)]">{entry.position}</p>
                            </div>
                            <span
                              className={`text-xs font-semibold rounded-full px-2.5 py-1 flex-shrink-0 ${
                                isStarter
                                  ? 'bg-[#B8CA6E] text-[#1c1c1e]'
                                  : 'bg-[var(--bg-pill-inactive)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {getDepthLabel(entry.depth)}
                            </span>
                          </button>

                          {isActive && (
                            <div className="bg-[var(--bg-card-alt)] border-b border-[var(--border-primary)] px-4 py-2.5 flex items-center gap-2">
                              <span className="text-xs text-[var(--text-secondary)] mr-1">Depth:</span>
                              {[1, 2, 3, 4].map(d => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => handleDepthChange(player.id, entry.position, d)}
                                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors min-w-[44px] ${
                                    d === entry.depth
                                      ? 'bg-[#B8CA6E] text-[#1c1c1e]'
                                      : 'bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-secondary)] active:bg-[var(--bg-card-alt)]'
                                  }`}
                                >
                                  {getDepthLabel(d)}
                                </button>
                              ))}
                            </div>
                          )}
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
    </>
  )
}
