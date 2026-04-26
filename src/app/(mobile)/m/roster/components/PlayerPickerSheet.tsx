'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { MobilePlayer } from '@/app/(mobile)/MobileContext'
import { getDepthLabel } from '../constants/positions'

interface PlayerPickerSheetProps {
  position: string
  allPlayers: MobilePlayer[]
  teamId: string
  onClose: () => void
  onPlayerAdded: () => void
}

export default function PlayerPickerSheet({
  position,
  allPlayers,
  onClose,
  onPlayerAdded,
}: PlayerPickerSheetProps) {
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<string | null>(null)

  // Players not already assigned to this position
  const available = useMemo(() => {
    return allPlayers
      .filter(p => p.position_depths[position] === undefined)
      .filter(p => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          p.jersey_number.includes(q)
        )
      })
  }, [allPlayers, position, search])

  async function handleSelect(player: MobilePlayer) {
    setAdding(player.id)

    // Find the next available depth for this position
    const takenDepths = new Set(
      allPlayers
        .filter(p => p.position_depths[position] !== undefined)
        .map(p => p.position_depths[position])
    )
    let depth = 1
    while (takenDepths.has(depth) && depth <= 4) depth++

    const newDepths = { ...player.position_depths, [position]: depth }
    const supabase = createClient()
    await supabase.from('players').update({ position_depths: newDepths }).eq('id', player.id)
    setAdding(null)
    onPlayerAdded()
    onClose()
  }

  /** Formats a player's current position assignments as a readable string. */
  function formatPositions(player: MobilePlayer): string {
    const entries = Object.entries(player.position_depths)
    if (entries.length === 0) return 'No positions'
    return entries.map(([pos, d]) => `${pos} ${getDepthLabel(d)}`).join(', ')
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] rounded-t-2xl pb-[env(safe-area-inset-bottom)] max-h-[70vh] overflow-hidden flex flex-col">
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--bg-pill-inactive)]" />
        </div>
        <div className="px-5 pb-2 shrink-0">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Add Player to {position}</h3>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full mt-2 px-3 py-2 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="Search by name or number"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {available.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-8">No available players</p>
          ) : (
            available.map(player => (
              <button
                key={player.id}
                type="button"
                onClick={() => handleSelect(player)}
                disabled={adding === player.id}
                className="w-full flex items-center gap-3 py-3 border-b border-[var(--border-primary)] last:border-b-0 active:bg-[var(--bg-card-alt)] text-left"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--bg-card-alt)] text-[var(--text-primary)] font-bold text-sm flex items-center justify-center shrink-0">
                  {player.jersey_number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {player.first_name} {player.last_name}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{formatPositions(player)}</p>
                </div>
                {adding === player.id && (
                  <span className="text-xs text-[var(--text-tertiary)]">Adding...</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}
