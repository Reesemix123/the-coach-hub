'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { MobilePlayer } from '@/app/(mobile)/MobileContext'
import { assignPlayerToSlot } from '@/lib/services/scheme.service'

interface PlayerPickerSheetProps {
  schemePositionId: string
  slotLabel: string
  allPlayers: MobilePlayer[]
  teamId: string
  onClose: () => void
  onPlayerAdded: () => void
}

export default function PlayerPickerSheet({
  schemePositionId,
  slotLabel,
  allPlayers,
  onClose,
  onPlayerAdded,
}: PlayerPickerSheetProps) {
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [assignedPlayerIds, setAssignedPlayerIds] = useState<Set<string>>(new Set())
  const [takenDepths, setTakenDepths] = useState<Set<number>>(new Set())
  const [loaded, setLoaded] = useState(false)

  // Load existing assignments at this slot — drives both the "available" filter
  // and the next-available-depth calculation.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('player_scheme_assignments')
      .select('player_id, depth')
      .eq('scheme_position_id', schemePositionId)
      .then(({ data }) => {
        if (cancelled) return
        const ids = new Set<string>()
        const depths = new Set<number>()
        for (const row of data ?? []) {
          ids.add(row.player_id as string)
          depths.add(row.depth as number)
        }
        setAssignedPlayerIds(ids)
        setTakenDepths(depths)
        setLoaded(true)
      })
    return () => { cancelled = true }
  }, [schemePositionId])

  const available = useMemo(() => {
    return allPlayers
      .filter(p => !assignedPlayerIds.has(p.id))
      .filter(p => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          p.jersey_number.includes(q)
        )
      })
  }, [allPlayers, assignedPlayerIds, search])

  async function handleSelect(player: MobilePlayer) {
    // Find first gap in depth 1-4
    let depth = 1
    while (takenDepths.has(depth) && depth <= 4) depth++

    if (depth > 4) {
      alert('All depth slots full — remove a player first.')
      return
    }

    setAdding(player.id)
    const supabase = createClient()
    try {
      await assignPlayerToSlot(supabase, player.id, schemePositionId, depth)
      onPlayerAdded()
      onClose()
    } catch (err) {
      console.error('[PlayerPickerSheet] assign failed:', err)
      alert('Could not add player. Please try again.')
    } finally {
      setAdding(null)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] rounded-t-2xl pb-[env(safe-area-inset-bottom)] max-h-[70vh] overflow-hidden flex flex-col">
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--bg-pill-inactive)]" />
        </div>
        <div className="px-5 pb-2 shrink-0">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Add Player to {slotLabel}</h3>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full mt-2 px-3 py-2 border border-[var(--border-primary)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            placeholder="Search by name or number"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {!loaded ? (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-8">Loading…</p>
          ) : available.length === 0 ? (
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
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {player.grade_level || 'No grade'}
                  </p>
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
