'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
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
type ViewMode = 'roster' | 'depth'

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

// Core positions always shown in depth chart even if empty
const CORE_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'DE', 'DT', 'LB', 'CB', 'S', 'K', 'P'])

// Position grouping for roster view
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

// All selectable position codes grouped for the edit sheet
const POSITION_OPTIONS: { group: string; positions: string[] }[] = [
  { group: 'Offense', positions: ['QB', 'RB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'] },
  { group: 'Defense', positions: ['DE', 'DT', 'NT', 'MLB', 'OLB', 'LB', 'CB', 'FS', 'SS', 'S'] },
  { group: 'Special Teams', positions: ['K', 'P', 'LS', 'H', 'KR', 'PR'] },
]

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

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}

function ArrowDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Player Edit Sheet (add/edit modal)
// ---------------------------------------------------------------------------

interface PlayerEditSheetProps {
  player: MobilePlayer | null  // null = add mode
  preSelectedPosition?: string
  teamId: string
  onClose: () => void
  onSaved: () => void
}

function PlayerEditSheet({ player, preSelectedPosition, teamId, onClose, onSaved }: PlayerEditSheetProps) {
  const isEdit = !!player
  const [firstName, setFirstName] = useState(player?.first_name ?? '')
  const [lastName, setLastName] = useState(player?.last_name ?? '')
  const [jersey, setJersey] = useState(player?.jersey_number ?? '')
  const [position, setPosition] = useState(preSelectedPosition ?? getPrimaryPosition(player?.position_depths ?? {}))
  const [depth, setDepth] = useState(() => {
    if (!player || !position) return 1
    return player.position_depths[position] ?? 1
  })
  const [gradeLevel, setGradeLevel] = useState(player?.grade_level ?? '')
  const [saving, setSaving] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim() || !jersey.trim() || !position) return
    setSaving(true)
    const supabase = createClient()

    if (isEdit && player) {
      // Preserve existing position_depths, only update the selected position
      const newDepths = { ...player.position_depths, [position]: depth }
      await supabase.from('players').update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        jersey_number: jersey.trim(),
        position_depths: newDepths,
        grade_level: gradeLevel || null,
      }).eq('id', player.id)
    } else {
      await supabase.from('players').insert({
        team_id: teamId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        jersey_number: jersey.trim(),
        position_depths: { [position]: depth },
        is_active: true,
        grade_level: gradeLevel || null,
      })
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  async function handleRemove() {
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

          {/* Position */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Position</label>
            <select
              value={position}
              onChange={e => setPosition(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              <option value="">Select position</option>
              {POSITION_OPTIONS.map(({ group, positions }) => (
                <optgroup key={group} label={group}>
                  {positions.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Depth (edit mode only) */}
          {isEdit && (
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Depth</label>
              <div className="flex gap-2 mt-1">
                {[1, 2, 3, 4].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDepth(d)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      depth === d
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                    }`}
                  >
                    {getDepthLabel(d)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grade */}
          <div className="mb-6">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Grade / Year</label>
            <select
              value={gradeLevel}
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
            disabled={saving || !firstName.trim() || !lastName.trim() || !jersey.trim() || !position}
            className="w-full bg-black text-white rounded-xl py-3 text-sm font-semibold min-h-[48px] active:bg-gray-800 transition-colors disabled:bg-gray-300"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Player'}
          </button>

          {/* Remove */}
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
                  onClick={handleRemove}
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

// ---------------------------------------------------------------------------
// Roster List View (improved — tap to edit)
// ---------------------------------------------------------------------------

function RosterListView({
  players,
  playersLoading,
  onEditPlayer,
}: {
  players: MobilePlayer[]
  playersLoading: boolean
  onEditPlayer: (player: MobilePlayer) => void
}) {
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

  if (playersLoading) {
    return <div>{[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}</div>
  }

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <UsersEmptyIcon />
        <p className="text-sm text-gray-500">No players on roster</p>
      </div>
    )
  }

  return (
    <div>
      {GROUP_ORDER.map(group => {
        const groupPlayers = grouped[group]
        if (groupPlayers.length === 0) return null

        return (
          <div key={group}>
            <div className="sticky top-0 z-10 px-4 py-2 bg-[#f2f2f7]">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{group}</span>
            </div>
            <div>
              {groupPlayers.map(player => {
                const primaryPos = getPrimaryPosition(player.position_depths)
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => onEditPlayer(player)}
                    className="w-full bg-white border-b border-gray-100 px-4 flex items-center gap-3 min-h-[56px] active:bg-gray-50 transition-colors text-left"
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
                      <span className="text-xs text-gray-400 flex-shrink-0">{player.grade_level}</span>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300 shrink-0">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Depth Chart View (with up/down reorder)
// ---------------------------------------------------------------------------

function DepthChartView({
  players,
  playersLoading,
  teamId,
  onEditPlayer,
  onAddPlayer,
  onPlayersChanged,
}: {
  players: MobilePlayer[]
  playersLoading: boolean
  teamId: string
  onEditPlayer: (player: MobilePlayer) => void
  onAddPlayer: (position: string) => void
  onPlayersChanged: () => void
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Offense: true, Defense: true, 'Special Teams': true,
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
                  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase">{posLabel}</span>
                    <button
                      type="button"
                      onClick={() => onAddPlayer(codes[0])}
                      className="text-gray-400 active:text-gray-600 p-1"
                    >
                      <PlusIcon />
                    </button>
                  </div>

                  {posPlayers.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onAddPlayer(codes[0])}
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
                          {/* Tap area — opens edit sheet */}
                          <button
                            type="button"
                            onClick={() => onEditPlayer(player)}
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

                          {/* Reorder buttons */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => !isFirst && handleSwapDepth(player.id, position, depth, posPlayers[index - 1].depth)}
                              disabled={isFirst}
                              className={`p-1 rounded ${isFirst ? 'text-gray-200' : 'text-gray-400 active:text-gray-700'}`}
                            >
                              <ArrowUpIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => !isLast && handleSwapDepth(player.id, position, depth, posPlayers[index + 1].depth)}
                              disabled={isLast}
                              className={`p-1 rounded ${isLast ? 'text-gray-200' : 'text-gray-400 active:text-gray-700'}`}
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

// ---------------------------------------------------------------------------
// Game Lineup View (active game — existing behavior, unchanged)
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
              const posEntries = gameLineup
                .filter(e => codes.includes(e.position))
                .sort((a, b) => a.depth - b.depth)

              const posPlayers = posEntries
                .map(e => ({ entry: e, player: playerMap.get(e.player_id) }))
                .filter((p): p is { entry: LineupEntry; player: MobilePlayer } => p.player != null)

              return (
                <div key={posLabel}>
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
                            <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-900 font-bold text-sm flex items-center justify-center flex-shrink-0">
                              {player.jersey_number}
                            </div>
                            <div className="flex-1 min-w-0 py-3">
                              <p className="text-base font-medium text-gray-900 truncate">
                                {player.first_name} {player.last_name}
                              </p>
                              <p className="text-sm text-gray-500">{entry.position}</p>
                            </div>
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
  const { teamId, activeGameId, players, playersLoading, bumpLineupVersion, refreshPlayers } = useMobile()

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (sessionStorage.getItem('ych-roster-view') as ViewMode) || 'roster'
    } catch { return 'roster' }
  })

  const [editingPlayer, setEditingPlayer] = useState<MobilePlayer | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [addPrePosition, setAddPrePosition] = useState<string | undefined>(undefined)

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode)
    try { sessionStorage.setItem('ych-roster-view', mode) } catch {}
  }

  function handleEditPlayer(player: MobilePlayer) {
    setEditingPlayer(player)
  }

  function handleAddPlayer(position?: string) {
    setAddPrePosition(position)
    setShowAddSheet(true)
  }

  function handleSaved() {
    refreshPlayers()
  }

  // Active game → show GameLineupView (existing behavior)
  if (activeGameId && teamId) {
    return (
      <div className="min-h-screen bg-[#f2f2f7] pb-8">
        <GameLineupView
          activeGameId={activeGameId}
          teamId={teamId}
          players={players}
          playersLoading={playersLoading}
          bumpLineupVersion={bumpLineupVersion}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f2f2f7] pb-8">
      {/* Header */}
      <div className="px-4 pt-12 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Roster</h1>
        <button
          type="button"
          onClick={() => handleAddPlayer()}
          className="flex items-center gap-1 text-sm font-semibold text-gray-900 active:text-gray-500 transition-colors"
        >
          <PlusIcon />
          <span>Add</span>
        </button>
      </div>

      {/* Segmented Control */}
      <div className="px-4 pb-3">
        <div className="flex bg-gray-200 rounded-lg p-0.5">
          {(['roster', 'depth'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => handleViewModeChange(mode)}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
                viewMode === mode
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              {mode === 'roster' ? 'Roster' : 'Depth Chart'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {viewMode === 'roster' ? (
        <RosterListView
          players={players}
          playersLoading={playersLoading}
          onEditPlayer={handleEditPlayer}
        />
      ) : (
        <DepthChartView
          players={players}
          playersLoading={playersLoading}
          teamId={teamId ?? ''}
          onEditPlayer={handleEditPlayer}
          onAddPlayer={handleAddPlayer}
          onPlayersChanged={handleSaved}
        />
      )}

      {/* Edit Player Sheet */}
      {editingPlayer && teamId && (
        <PlayerEditSheet
          player={editingPlayer}
          teamId={teamId}
          onClose={() => setEditingPlayer(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Add Player Sheet */}
      {showAddSheet && teamId && (
        <PlayerEditSheet
          player={null}
          preSelectedPosition={addPrePosition}
          teamId={teamId}
          onClose={() => { setShowAddSheet(false); setAddPrePosition(undefined) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
