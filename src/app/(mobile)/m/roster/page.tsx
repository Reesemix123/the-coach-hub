'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useMobile, type MobilePlayer } from '@/app/(mobile)/MobileContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LineupEntry {
  player_id: string
  position: string
  depth: number
}

type PositionGroup = 'Offense' | 'Defense' | 'Special Teams'

// ---------------------------------------------------------------------------
// Position display groups — maps display labels to position code sets
// ---------------------------------------------------------------------------

const OFFENSE_DISPLAY_POSITIONS = [
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

const DEFENSE_DISPLAY_POSITIONS = [
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

const ST_DISPLAY_POSITIONS = [
  { label: 'K', codes: ['K'] },
  { label: 'P', codes: ['P'] },
  { label: 'LS', codes: ['LS'] },
  { label: 'H', codes: ['H'] },
  { label: 'KR', codes: ['KR'] },
  { label: 'PR', codes: ['PR'] },
]

const UNIT_SECTIONS: { label: PositionGroup; positions: { label: string; codes: string[] }[] }[] = [
  { label: 'Offense', positions: OFFENSE_DISPLAY_POSITIONS },
  { label: 'Defense', positions: DEFENSE_DISPLAY_POSITIONS },
  { label: 'Special Teams', positions: ST_DISPLAY_POSITIONS },
]

// ---------------------------------------------------------------------------
// Position grouping for normal roster view (unchanged from original)
// ---------------------------------------------------------------------------

const OFFENSE_POSITIONS = new Set([
  'QB', 'RB', 'FB', 'WR', 'TE', 'X', 'Y', 'Z', 'SL', 'SR',
  'C', 'LG', 'RG', 'LT', 'RT', 'TB', 'SB', 'SE', 'FL', 'WB',
])

const DEFENSE_POSITIONS = new Set([
  'DE', 'DT', 'NT', 'MLB', 'OLB', 'ILB', 'WLB', 'SLB', 'LB',
  'CB', 'SS', 'FS', 'S', 'NB', 'DB',
])

const SPECIAL_TEAMS_POSITIONS = new Set(['K', 'P', 'LS', 'KR', 'PR', 'H'])

const GROUP_ORDER: PositionGroup[] = ['Offense', 'Defense', 'Special Teams']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPrimaryPosition(positionDepths: Record<string, number>): string {
  const keys = Object.keys(positionDepths)
  if (keys.length === 0) return 'ATH'
  const primary = keys.find(k => positionDepths[k] === 1) ?? keys[0]
  return primary
}

function getPositionGroup(position: string): PositionGroup {
  const pos = position.toUpperCase()
  if (OFFENSE_POSITIONS.has(pos)) return 'Offense'
  if (DEFENSE_POSITIONS.has(pos)) return 'Defense'
  if (SPECIAL_TEAMS_POSITIONS.has(pos)) return 'Special Teams'
  return 'Offense'
}

function getDepthLabel(depth: number): string {
  switch (depth) {
    case 1: return '1st'
    case 2: return '2nd'
    case 3: return '3rd'
    case 4: return '4th'
    default: return `${depth}th`
  }
}

// ---------------------------------------------------------------------------
// Shared UI components
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 animate-pulse min-h-[56px]">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
      <div className="flex-1">
        <div className="h-4 bg-gray-100 rounded w-32 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-16" />
      </div>
    </div>
  )
}

function UsersEmptyIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Normal Roster View (no active game)
// ---------------------------------------------------------------------------

function NormalRosterView({ players, playersLoading }: { players: MobilePlayer[]; playersLoading: boolean }) {
  const grouped: Record<PositionGroup, MobilePlayer[]> = {
    Offense: [],
    Defense: [],
    'Special Teams': [],
  }

  for (const player of players) {
    const primaryPos = getPrimaryPosition(player.position_depths)
    const group = getPositionGroup(primaryPos)
    grouped[group].push(player)
  }

  return (
    <>
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Roster</h1>
      </div>

      {playersLoading && (
        <div>
          {[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      )}

      {!playersLoading && players.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <UsersEmptyIcon />
          <p className="text-sm text-gray-500">No players on roster</p>
        </div>
      )}

      {!playersLoading && players.length > 0 && (
        <div>
          {GROUP_ORDER.map(group => {
            const groupPlayers = grouped[group]
            if (groupPlayers.length === 0) return null

            return (
              <div key={group}>
                <div className="sticky top-0 z-10 px-4 py-2 bg-[#f2f2f7]">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {group}
                  </span>
                </div>
                <div>
                  {groupPlayers.map(player => {
                    const primaryPos = getPrimaryPosition(player.position_depths)
                    return (
                      <div
                        key={player.id}
                        className="bg-white border-b border-gray-100 px-4 flex items-center gap-3 min-h-[56px] cursor-pointer active:bg-gray-50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-900 font-bold text-sm flex items-center justify-center flex-shrink-0">
                          {player.jersey_number}
                        </div>
                        <div className="flex-1 min-w-0 py-3">
                          <p className="text-base font-medium text-gray-900 truncate">
                            {player.first_name} {player.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{primaryPos}</p>
                        </div>
                        {player.grade_level && (
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {player.grade_level}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Game Lineup View (active game)
// ---------------------------------------------------------------------------

function GameLineupView({
  activeGameId,
  teamId,
  players,
  playersLoading,
  bumpLineupVersion,
}: {
  activeGameId: string
  teamId: string
  players: MobilePlayer[]
  playersLoading: boolean
  bumpLineupVersion: () => void
}) {
  const [gameLineup, setGameLineup] = useState<LineupEntry[]>([])
  const [lineupLoading, setLineupLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Offense: true, Defense: true, 'Special Teams': true,
  })
  const [activePlayerForDepth, setActivePlayerForDepth] = useState<{
    playerId: string; position: string; currentDepth: number
  } | null>(null)

  // Player lookup map
  const playerMap = useMemo(() => {
    const map = new Map<string, MobilePlayer>()
    for (const p of players) map.set(p.id, p)
    return map
  }, [players])

  // Load or auto-populate lineup
  useEffect(() => {
    if (!activeGameId || !teamId || playersLoading) return

    let cancelled = false
    setLineupLoading(true)

    async function loadLineup() {
      const supabase = createClient()

      // Fetch existing lineup for this game
      const { data, error } = await supabase.rpc('latest_game_lineup', {
        game_id_param: activeGameId,
        team_id_param: teamId,
      })

      if (cancelled) return

      if (!error && data && data.length > 0) {
        setGameLineup(data.map((r: { player_id: string; position: string; depth: number }) => ({
          player_id: r.player_id,
          position: r.position,
          depth: r.depth,
        })))
        setLineupLoading(false)
        return
      }

      // No lineup yet — auto-populate from team depth chart
      if (players.length > 0) {
        const rows: { game_id: string; team_id: string; player_id: string; position: string; depth: number }[] = []
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

          // Re-fetch to get the canonical state
          const { data: fresh } = await supabase.rpc('latest_game_lineup', {
            game_id_param: activeGameId,
            team_id_param: teamId,
          })

          if (!cancelled && fresh) {
            setGameLineup(fresh.map((r: { player_id: string; position: string; depth: number }) => ({
              player_id: r.player_id,
              position: r.position,
              depth: r.depth,
            })))
            bumpLineupVersion()
          }
        }
      }

      if (!cancelled) setLineupLoading(false)
    }

    loadLineup()
    return () => { cancelled = true }
  }, [activeGameId, teamId, players, playersLoading])

  // Handle depth change with swap logic
  async function handleDepthChange(playerId: string, position: string, newDepth: number) {
    if (!activeGameId || !teamId) return

    const currentEntry = gameLineup.find(e => e.player_id === playerId && e.position === position)
    if (!currentEntry || currentEntry.depth === newDepth) {
      setActivePlayerForDepth(null)
      return
    }

    // Find displaced player (same position, target depth)
    const displaced = gameLineup.find(
      e => e.position === position && e.depth === newDepth && e.player_id !== playerId
    )

    // Optimistic update
    setGameLineup(prev => prev.map(e => {
      if (e.player_id === playerId && e.position === position) {
        return { ...e, depth: newDepth }
      }
      if (displaced && e.player_id === displaced.player_id && e.position === position) {
        return { ...e, depth: currentEntry.depth }
      }
      return e
    }))
    setActivePlayerForDepth(null)

    // Persist (append-only)
    const supabase = createClient()
    const inserts: { game_id: string; team_id: string; player_id: string; position: string; depth: number }[] = [
      { game_id: activeGameId, team_id: teamId, player_id: playerId, position, depth: newDepth },
    ]
    if (displaced) {
      inserts.push({
        game_id: activeGameId, team_id: teamId,
        player_id: displaced.player_id, position, depth: currentEntry.depth,
      })
    }
    await supabase.from('game_lineups').insert(inserts)
    bumpLineupVersion()
  }

  // Cache lineup to localStorage on every change
  useEffect(() => {
    if (!activeGameId || gameLineup.length === 0) return
    try { localStorage.setItem(`ych-lineup-${activeGameId}`, JSON.stringify(gameLineup)) } catch {}
  }, [activeGameId, gameLineup])

  function toggleSection(label: string) {
    setExpandedSections(prev => ({ ...prev, [label]: !prev[label] }))
  }

  if (lineupLoading || playersLoading) {
    return (
      <>
        <div className="px-4 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-gray-900">Game Lineup</h1>
          <p className="text-sm text-gray-500 mt-1">Loading lineup...</p>
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
        <h1 className="text-2xl font-bold text-gray-900">Game Lineup</h1>
        <p className="text-sm text-gray-500 mt-1">Tap a player to change depth</p>
      </div>

      {UNIT_SECTIONS.map(({ label: unitLabel, positions }) => {
        const expanded = expandedSections[unitLabel] !== false

        return (
          <div key={unitLabel}>
            {/* Unit section header */}
            <button
              type="button"
              onClick={() => toggleSection(unitLabel)}
              className="sticky top-0 z-10 w-full px-4 py-2.5 bg-[#f2f2f7] flex items-center justify-between active:bg-gray-200 transition-colors"
            >
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {unitLabel}
              </span>
              <ChevronIcon expanded={expanded} />
            </button>

            {expanded && positions.map(({ label: posLabel, codes }) => {
              // Find lineup entries for this position group
              const posEntries = gameLineup
                .filter(e => codes.includes(e.position))
                .sort((a, b) => a.depth - b.depth)

              // Look up players for each entry
              const posPlayers = posEntries
                .map(e => ({ entry: e, player: playerMap.get(e.player_id) }))
                .filter((p): p is { entry: LineupEntry; player: MobilePlayer } => p.player != null)

              return (
                <div key={posLabel}>
                  {/* Position label */}
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-xs font-bold text-gray-400 uppercase">{posLabel}</span>
                  </div>

                  {posPlayers.length === 0 ? (
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs text-gray-400 italic">No player assigned</p>
                    </div>
                  ) : (
                    posPlayers.map(({ entry, player }) => {
                      const isActive = activePlayerForDepth?.playerId === player.id &&
                        activePlayerForDepth?.position === entry.position
                      const isStarter = entry.depth === 1

                      return (
                        <div key={`${player.id}-${entry.position}`}>
                          <button
                            type="button"
                            onClick={() =>
                              setActivePlayerForDepth(
                                isActive ? null : {
                                  playerId: player.id,
                                  position: entry.position,
                                  currentDepth: entry.depth,
                                }
                              )
                            }
                            className={`w-full bg-white border-b border-gray-100 px-4 flex items-center gap-3 min-h-[56px] active:bg-gray-50 transition-colors text-left ${
                              isActive ? 'bg-gray-50' : ''
                            }`}
                          >
                            {/* Jersey circle */}
                            <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-900 font-bold text-sm flex items-center justify-center flex-shrink-0">
                              {player.jersey_number}
                            </div>

                            {/* Name */}
                            <div className="flex-1 min-w-0 py-3">
                              <p className="text-base font-medium text-gray-900 truncate">
                                {player.first_name} {player.last_name}
                              </p>
                              <p className="text-sm text-gray-500">{entry.position}</p>
                            </div>

                            {/* Depth badge */}
                            <span
                              className={`text-xs font-semibold rounded-full px-2.5 py-1 flex-shrink-0 ${
                                isStarter
                                  ? 'bg-[#B8CA6E] text-[#1c1c1e]'
                                  : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              {getDepthLabel(entry.depth)}
                            </span>
                          </button>

                          {/* Inline depth selector */}
                          {isActive && (
                            <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center gap-2">
                              <span className="text-xs text-gray-500 mr-1">Depth:</span>
                              {[1, 2, 3, 4].map(d => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => handleDepthChange(player.id, entry.position, d)}
                                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors min-w-[44px] ${
                                    d === entry.depth
                                      ? 'bg-[#B8CA6E] text-[#1c1c1e]'
                                      : 'bg-white border border-gray-200 text-gray-600 active:bg-gray-100'
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

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function MobileRosterPage() {
  const { teamId, activeGameId, players, playersLoading, bumpLineupVersion } = useMobile()

  return (
    <div className="min-h-screen bg-[#f2f2f7] pb-8">
      {activeGameId && teamId ? (
        <GameLineupView
          activeGameId={activeGameId}
          teamId={teamId}
          players={players}
          playersLoading={playersLoading}
          bumpLineupVersion={bumpLineupVersion}
        />
      ) : (
        <NormalRosterView players={players} playersLoading={playersLoading} />
      )}
    </div>
  )
}
