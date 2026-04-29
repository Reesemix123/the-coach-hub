'use client'

import { useMobile } from '@/app/(mobile)/MobileContext'
import type { MobilePlayer } from '@/app/(mobile)/MobileContext'
import { getPrimaryPosition, getPlayerPositionGroups } from '@/utils/playerHelpers'
import { SkeletonRow, UsersEmptyIcon } from './shared'

interface RosterListViewProps {
  players: MobilePlayer[]
  playersLoading: boolean
  onEditPlayer: (player: MobilePlayer) => void
}

type Unit = 'offense' | 'defense' | 'special_teams'
const UNIT_ORDER: Unit[] = ['offense', 'defense', 'special_teams']
const UNIT_LABELS: Record<Unit, string> = {
  offense: 'Offense',
  defense: 'Defense',
  special_teams: 'Special Teams',
}

export default function RosterListView({
  players,
  playersLoading,
  onEditPlayer,
}: RosterListViewProps) {
  const { positionCategories } = useMobile()

  const grouped: Record<Unit, MobilePlayer[]> = {
    offense: [],
    defense: [],
    special_teams: [],
  }

  for (const player of players) {
    const groups = getPlayerPositionGroups(player, positionCategories)
    // Players with no resolvable group (e.g. ATH/flex) fall into the first
    // unit they touch — default to offense to match prior behavior.
    const primaryGroup: Unit = groups[0] ?? 'offense'
    grouped[primaryGroup].push(player)
  }

  if (playersLoading) {
    return <div>{[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}</div>
  }

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <UsersEmptyIcon />
        <p className="text-sm text-[var(--text-secondary)]">No players on roster</p>
      </div>
    )
  }

  return (
    <div>
      {UNIT_ORDER.map(unit => {
        const groupPlayers = grouped[unit]
        if (groupPlayers.length === 0) return null

        return (
          <div key={unit}>
            <div className="sticky top-0 z-10 px-4 py-2 bg-[var(--bg-primary)]">
              <span className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider">{UNIT_LABELS[unit]}</span>
            </div>
            <div>
              {groupPlayers.map(player => {
                const primaryPos = getPrimaryPosition(player, positionCategories)
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => onEditPlayer(player)}
                    className="w-full bg-[var(--bg-card)] border-b border-[var(--border-primary)] px-4 flex items-center gap-3 min-h-[56px] active:bg-[var(--bg-card-alt)] transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-[var(--bg-card-alt)] text-[var(--text-primary)] font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {player.jersey_number}
                    </div>
                    <div className="flex-1 min-w-0 py-3">
                      <p className="text-base font-medium text-[var(--text-primary)] truncate">
                        {player.first_name} {player.last_name}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">{primaryPos}</p>
                    </div>
                    {player.grade_level && (
                      <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">{player.grade_level}</span>
                    )}
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)] shrink-0"
                    >
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
