'use client'

import type { MobilePlayer } from '@/app/(mobile)/MobileContext'
import {
  type PositionGroup,
  GROUP_ORDER,
  getPrimaryPosition,
  getPositionGroup,
} from '../constants/positions'
import { SkeletonRow, UsersEmptyIcon } from './shared'

interface RosterListViewProps {
  players: MobilePlayer[]
  playersLoading: boolean
  onEditPlayer: (player: MobilePlayer) => void
}

export default function RosterListView({
  players,
  playersLoading,
  onEditPlayer,
}: RosterListViewProps) {
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
        <p className="text-sm text-[var(--text-secondary)]">No players on roster</p>
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
            <div className="sticky top-0 z-10 px-4 py-2 bg-[var(--bg-primary)]">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{group}</span>
            </div>
            <div>
              {groupPlayers.map(player => {
                const primaryPos = getPrimaryPosition(player.position_depths)
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
