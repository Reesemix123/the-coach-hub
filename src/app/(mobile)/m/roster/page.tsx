'use client'

import { useMobile, type MobilePlayer } from '@/app/(mobile)/MobileContext'

type PositionGroup = 'Offense' | 'Defense' | 'Special Teams'

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

function getPrimaryPosition(positionDepths: Record<string, number>): string {
  const keys = Object.keys(positionDepths)
  if (keys.length === 0) return 'ATH'
  // Primary is the key with depth 1, fallback to first key
  const primary = keys.find(k => positionDepths[k] === 1) ?? keys[0]
  return primary
}

function getPositionGroup(position: string): PositionGroup {
  const pos = position.toUpperCase()
  if (OFFENSE_POSITIONS.has(pos)) return 'Offense'
  if (DEFENSE_POSITIONS.has(pos)) return 'Defense'
  if (SPECIAL_TEAMS_POSITIONS.has(pos)) return 'Special Teams'
  // Fallback: if unknown, put in offense
  return 'Offense'
}

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

export default function MobileRosterPage() {
  const { players, playersLoading } = useMobile()

  // Group players by position group
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
    <div className="min-h-screen bg-[#f2f2f7] pb-8">
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Roster</h1>
      </div>

      {/* Loading */}
      {playersLoading && (
        <div>
          {[...Array(8)].map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!playersLoading && players.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <UsersEmptyIcon />
          <p className="text-sm text-gray-500">No players on roster</p>
        </div>
      )}

      {/* Player list grouped by position group */}
      {!playersLoading && players.length > 0 && (
        <div>
          {GROUP_ORDER.map(group => {
            const groupPlayers = grouped[group]
            if (groupPlayers.length === 0) return null

            return (
              <div key={group}>
                {/* Section header */}
                <div className="sticky top-0 z-10 px-4 py-2 bg-[#f2f2f7]">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {group}
                  </span>
                </div>

                {/* Players */}
                <div>
                  {groupPlayers.map(player => {
                    const primaryPos = getPrimaryPosition(player.position_depths)

                    return (
                      <div
                        key={player.id}
                        className="bg-white border-b border-gray-100 px-4 flex items-center gap-3 min-h-[56px] cursor-pointer active:bg-gray-50 transition-colors"
                      >
                        {/* Jersey number circle */}
                        <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-900 font-bold text-sm flex items-center justify-center flex-shrink-0">
                          {player.jersey_number}
                        </div>

                        {/* Name and position */}
                        <div className="flex-1 min-w-0 py-3">
                          <p className="text-base font-medium text-gray-900 truncate">
                            {player.first_name} {player.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{primaryPos}</p>
                        </div>

                        {/* Grade level */}
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
    </div>
  )
}
