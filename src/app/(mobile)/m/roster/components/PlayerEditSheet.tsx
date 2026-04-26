'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { MobilePlayer } from '@/app/(mobile)/MobileContext'
import { POSITION_OPTIONS, getDepthLabel } from '../constants/positions'

interface PlayerEditSheetProps {
  player: MobilePlayer | null
  preSelectedPosition?: string
  highlightPosition?: string
  teamId: string
  allPlayers: MobilePlayer[]
  onClose: () => void
  onSaved: () => void
}

export default function PlayerEditSheet({
  player,
  preSelectedPosition,
  highlightPosition,
  teamId,
  allPlayers,
  onClose,
  onSaved,
}: PlayerEditSheetProps) {
  const isEdit = !!player
  const [firstName, setFirstName] = useState(player?.first_name ?? '')
  const [lastName, setLastName] = useState(player?.last_name ?? '')
  const [jersey, setJersey] = useState(player?.jersey_number ?? '')
  const [gradeLevel, setGradeLevel] = useState(player?.grade_level ?? '')

  // Position chip grid state
  const [positions, setPositions] = useState<Record<string, number>>(
    player?.position_depths ?? (preSelectedPosition ? { [preSelectedPosition]: 1 } : {})
  )
  const [activeChip, setActiveChip] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{
    position: string
    depth: number
    otherPlayer: MobilePlayer
  } | null>(null)
  const [pendingSwap, setPendingSwap] = useState<{
    playerId: string
    position: string
    oldDepth: number
    newDepth: number
  } | null>(null)

  const [saving, setSaving] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  /** Returns the next depth slot not occupied by another player at this position. */
  function getNextAvailableDepth(pos: string): number {
    const taken = new Set<number>()
    // Current player's depth at this position (if any)
    if (positions[pos]) taken.add(positions[pos])
    // Other players' depths
    for (const p of allPlayers) {
      if (p.id === player?.id) continue
      if (p.position_depths[pos] !== undefined) taken.add(p.position_depths[pos])
    }
    for (let d = 1; d <= 4; d++) {
      if (!taken.has(d)) return d
    }
    return 1 // fallback
  }

  /** Adds a position chip at the next available depth. */
  function handleAddPosition(pos: string) {
    const depth = getNextAvailableDepth(pos)
    setPositions(prev => ({ ...prev, [pos]: depth }))
    setActiveChip(pos)
    setConflict(null)
  }

  /** Changes depth for an active position chip; detects and surfaces conflicts. */
  function handleDepthChange(pos: string, newDepth: number) {
    const other = allPlayers.find(p =>
      p.id !== player?.id && p.position_depths[pos] === newDepth
    )
    if (other) {
      setConflict({ position: pos, depth: newDepth, otherPlayer: other })
      setPendingSwap({
        playerId: other.id,
        position: pos,
        oldDepth: newDepth,
        newDepth: positions[pos],
      })
      return
    }
    setPositions(prev => ({ ...prev, [pos]: newDepth }))
    setConflict(null)
    setPendingSwap(null)
  }

  /** Confirms the depth swap with the conflicting player. */
  function handleSwap() {
    if (!conflict || !pendingSwap) return
    setPositions(prev => ({ ...prev, [conflict.position]: conflict.depth }))
    setConflict(null)
    // pendingSwap is intentionally left set — applied at save time
  }

  /** Removes a position from this player's chip grid. */
  function handleRemovePosition(pos: string) {
    setPositions(prev => {
      const next = { ...prev }
      delete next[pos]
      return next
    })
    setActiveChip(null)
    setConflict(null)
    setPendingSwap(null)
  }

  /** Persists player data; applies pending swap to the other player first if needed. */
  async function handleSave() {
    if (!firstName.trim() || !lastName.trim() || !jersey.trim()) return
    if (Object.keys(positions).length === 0) return
    setSaving(true)
    const supabase = createClient()

    // Apply swap to the other player before saving this player
    if (pendingSwap) {
      const otherPlayer = allPlayers.find(p => p.id === pendingSwap.playerId)
      if (otherPlayer) {
        const otherNewDepths = {
          ...otherPlayer.position_depths,
          [pendingSwap.position]: pendingSwap.newDepth,
        }
        await supabase
          .from('players')
          .update({ position_depths: otherNewDepths })
          .eq('id', pendingSwap.playerId)
      }
    }

    if (isEdit && player) {
      await supabase.from('players').update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        jersey_number: jersey.trim(),
        position_depths: positions,
        grade_level: gradeLevel || null,
      }).eq('id', player.id)
    } else {
      await supabase.from('players').insert({
        team_id: teamId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        jersey_number: jersey.trim(),
        position_depths: positions,
        is_active: true,
        grade_level: gradeLevel || null,
      })
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  async function handleRemoveFromRoster() {
    if (!player) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('players').update({ is_active: false }).eq('id', player.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up max-h-[85vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-5 pb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            {isEdit ? 'Edit Player' : 'Add Player'}
          </h3>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="First"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Last"
              />
            </div>
          </div>

          {/* Jersey */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Jersey Number</label>
            <input
              type="text"
              value={jersey}
              onChange={e => setJersey(e.target.value.replace(/\D/g, '').slice(0, 3))}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="#"
              inputMode="numeric"
              maxLength={3}
            />
          </div>

          {/* Position Chip Grid */}
          {/* // TODO: MULTI-SPORT — other sports have different position sets */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
              Positions
            </label>
            {POSITION_OPTIONS.map(({ group, positions: posCodes }) => (
              <div key={group} className="mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {posCodes.map(pos => {
                    const isActive = positions[pos] !== undefined
                    const depth = positions[pos]
                    const isHighlighted = pos === highlightPosition
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() =>
                          isActive
                            ? setActiveChip(activeChip === pos ? null : pos)
                            : handleAddPosition(pos)
                        }
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-[#B8CA6E] text-[#1c1c1e]'
                            : 'bg-gray-100 text-gray-500 active:bg-gray-200'
                        } ${isHighlighted ? 'ring-2 ring-gray-900' : ''}`}
                      >
                        {pos}{isActive ? ` ${getDepthLabel(depth)}` : ''}
                      </button>
                    )
                  })}
                </div>

                {/* Inline controls for active chip in this group */}
                {activeChip && posCodes.includes(activeChip) && positions[activeChip] !== undefined && (
                  <div className="mt-2 bg-gray-50 rounded-lg p-2.5 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Depth:</span>
                    {[1, 2, 3, 4].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleDepthChange(activeChip, d)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold min-w-[40px] transition-colors ${
                          positions[activeChip] === d
                            ? 'bg-[#B8CA6E] text-[#1c1c1e]'
                            : 'bg-white border border-gray-200 text-gray-600 active:bg-gray-100'
                        }`}
                      >
                        {getDepthLabel(d)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleRemovePosition(activeChip)}
                      className="text-xs text-red-500 font-medium ml-auto active:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Conflict warning */}
                {conflict && posCodes.includes(conflict.position) && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <p className="text-xs text-amber-800">
                      #{conflict.otherPlayer.jersey_number} {conflict.otherPlayer.first_name}{' '}
                      {conflict.otherPlayer.last_name} is {conflict.position}{' '}
                      {getDepthLabel(conflict.depth)}. Swap?
                    </p>
                    <div className="flex gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={handleSwap}
                        className="bg-amber-600 text-white rounded-lg px-3 py-1 text-xs font-semibold"
                      >
                        Swap
                      </button>
                      <button
                        type="button"
                        onClick={() => { setConflict(null); setPendingSwap(null) }}
                        className="bg-white border border-gray-200 text-gray-600 rounded-lg px-3 py-1 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {Object.keys(positions).length === 0 && (
              <p className="text-xs text-red-500 mt-1">Select at least one position</p>
            )}
          </div>

          {/* Grade */}
          <div className="mb-6">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Grade / Year</label>
            <select
              value={gradeLevel ?? ''}
              onChange={e => setGradeLevel(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              <option value="">Optional</option>
              {['5th', '6th', '7th', '8th', 'Freshman', 'Sophomore', 'Junior', 'Senior'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={
              saving ||
              !firstName.trim() ||
              !lastName.trim() ||
              !jersey.trim() ||
              Object.keys(positions).length === 0
            }
            className="w-full bg-black text-white rounded-xl py-3 text-sm font-semibold min-h-[48px] active:bg-gray-800 transition-colors disabled:bg-gray-300"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Player'}
          </button>

          {/* Remove from roster */}
          {isEdit && !showRemoveConfirm && (
            <button
              type="button"
              onClick={() => setShowRemoveConfirm(true)}
              className="w-full mt-3 text-red-500 text-sm font-medium py-2 active:text-red-700"
            >
              Remove from Roster
            </button>
          )}

          {isEdit && showRemoveConfirm && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-sm text-red-700 mb-2">Remove this player from the active roster?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(false)}
                  className="flex-1 bg-white border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFromRoster}
                  disabled={saving}
                  className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-semibold"
                >
                  {saving ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
