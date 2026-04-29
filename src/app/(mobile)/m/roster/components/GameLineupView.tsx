'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useMobile, type MobilePlayer } from '@/app/(mobile)/MobileContext'
import {
  ensureDefaultSchemes,
  getTeamSchemes,
  getTeamLineupTriples,
  type SchemeUnit,
  type SchemeWithPositions,
} from '@/lib/services/scheme.service'
import { getDepthLabel } from '@/utils/playerHelpers'
import { SkeletonRow, ChevronIcon } from './shared'

const UNIT_ORDER: SchemeUnit[] = ['offense', 'defense', 'special_teams']
const UNIT_LABELS: Record<SchemeUnit, string> = {
  offense: 'Offense',
  defense: 'Defense',
  special_teams: 'Special Teams',
}

interface LineupEntry {
  player_id: string
  position: string
  depth: number
}

interface GameLineupViewProps {
  activeGameId: string
  teamId: string
  players: MobilePlayer[]
  bumpLineupVersion: () => void
}

export default function GameLineupView({
  activeGameId,
  teamId,
  players,
  bumpLineupVersion,
}: GameLineupViewProps) {
  const { teams } = useMobile()
  const teamLevel = useMemo(
    () => teams.find(t => t.id === teamId)?.level ?? null,
    [teams, teamId],
  )

  const [gameLineup, setGameLineup] = useState<LineupEntry[]>([])
  const [lineupLoading, setLineupLoading] = useState(true)
  const [schemesByUnit, setSchemesByUnit] = useState<Partial<Record<SchemeUnit, SchemeWithPositions>>>({})
  const [schemesLoading, setSchemesLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState<Record<SchemeUnit, boolean>>({
    offense: true,
    defense: true,
    special_teams: true,
  })
  const [activePlayerForDepth, setActivePlayerForDepth] = useState<{
    playerId: string
    position: string
    currentDepth: number
  } | null>(null)

  // Schemes load — ensures default schemes exist, then fetches them by unit
  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    setSchemesLoading(true)

    async function loadSchemes() {
      const supabase = createClient()
      try {
        await ensureDefaultSchemes(supabase, teamId, teamLevel)
        const schemes = await getTeamSchemes(supabase, teamId)
        if (cancelled) return
        const byUnit: Partial<Record<SchemeUnit, SchemeWithPositions>> = {}
        for (const unit of UNIT_ORDER) {
          const def = schemes.find(s => s.unit === unit && s.is_default)
          if (def) byUnit[unit] = def
        }
        setSchemesByUnit(byUnit)
      } catch (err) {
        console.error('[GameLineupView] schemes load failed:', err)
      } finally {
        if (!cancelled) setSchemesLoading(false)
      }
    }

    loadSchemes()
    return () => { cancelled = true }
  }, [teamId, teamLevel])

  // Lineup load + auto-populate from PSA via getTeamLineupTriples
  useEffect(() => {
    if (!activeGameId || !teamId) return
    let cancelled = false
    setLineupLoading(true)

    async function loadOrCreateLineup() {
      const supabase = createClient()

      // Step 1: Check DB via RPC
      const { data } = await supabase.rpc('latest_game_lineup', {
        game_id_param: activeGameId,
        team_id_param: teamId,
      })
      if (cancelled) return

      if (data && data.length > 0) {
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

      // Step 2: Auto-populate from PSA
      const triples = await getTeamLineupTriples(supabase, teamId)
      if (cancelled) return

      if (triples.length === 0) {
        setGameLineup([])
        setLineupLoading(false)
        return
      }

      const rows = triples.map(t => ({
        game_id: activeGameId,
        team_id: teamId,
        player_id: t.player_id,
        position: t.slot_code,
        depth: t.depth,
      }))
      await supabase.from('game_lineups').insert(rows)

      // Re-fetch via RPC
      const { data: fresh } = await supabase.rpc('latest_game_lineup', {
        game_id_param: activeGameId,
        team_id_param: teamId,
      })
      if (cancelled) return

      if (fresh && fresh.length > 0) {
        setGameLineup(
          fresh.map((r: { player_id: string; position: string; depth: number }) => ({
            player_id: r.player_id,
            position: r.position,
            depth: r.depth,
          }))
        )
      } else {
        setGameLineup([])
      }
      bumpLineupVersion()
      setLineupLoading(false)
    }

    loadOrCreateLineup()
    return () => { cancelled = true }
    // bumpLineupVersion intentionally excluded: this view writes the bump,
    // including it would create an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGameId, teamId])

  // Persist to localStorage on change
  useEffect(() => {
    if (!activeGameId || gameLineup.length === 0) return
    try {
      localStorage.setItem(`ych-lineup-${activeGameId}`, JSON.stringify(gameLineup))
    } catch {}
  }, [activeGameId, gameLineup])

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

    // Append-only writes to game_lineups
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

  if (lineupLoading || schemesLoading) {
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

      {UNIT_ORDER.map(unit => {
        const scheme = schemesByUnit[unit]
        if (!scheme) return null
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

            {expanded && scheme.scheme_positions.map(slot => {
              const slotEntries = gameLineup
                .filter(e => e.position === slot.slot_code)
                .sort((a, b) => a.depth - b.depth)

              return (
                <div key={slot.id}>
                  <div className="px-4 pt-3 pb-1 flex items-center">
                    <span className="text-xs font-bold text-[var(--text-section-header)] uppercase">{slot.slot_code}</span>
                    <span className="text-xs text-[var(--text-tertiary)] ml-2">{slot.display_label}</span>
                  </div>

                  {slotEntries.length === 0 ? (
                    <div className="px-4 py-3 border-b border-[var(--border-primary)]">
                      <p className="text-xs text-[var(--text-tertiary)] italic">No player assigned</p>
                    </div>
                  ) : (
                    slotEntries.map(entry => {
                      const player = players.find(p => p.id === entry.player_id)
                      if (!player) return null
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
