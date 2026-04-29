'use client'

import { createContext, useContext } from 'react'

interface TeamInfo {
  id: string
  name: string
  level: string
}

export interface MobilePlayer {
  id: string
  jersey_number: string
  first_name: string
  last_name: string
  // Legacy depth assignments — preserved for read-only fallback during the
  // Phase 2 consumer migration. New writes target player_scheme_assignments.
  position_depths: Record<string, number>
  // New canonical position identity (Phase 1 of position architecture).
  primary_position_category_id: string | null
  grade_level?: string | null
}

export interface PositionCategoryRow {
  id: string
  code: string
  name: string
  unit: string                  // 'offense' | 'defense' | 'special_teams' | 'flex'
  sort_order: number
}

interface MobileContextType {
  teamId: string | null
  coachName: string
  isCapacitor: boolean
  teams: TeamInfo[]
  switchTeam: (teamId: string) => void
  // Game state (set by sideline tracker, readable by all tabs)
  activeGameId: string | null
  setActiveGameId: (gameId: string | null) => void
  // Shared roster (fetched once, used by roster tab + sideline tracker)
  players: MobilePlayer[]
  playersLoading: boolean
  // 12 position categories — fetched once on app boot, shared everywhere
  positionCategories: PositionCategoryRow[]
  // Lineup version counter — bumped by Roster tab on depth changes
  lineupVersion: number
  bumpLineupVersion: () => void
  consecutiveSyncFailures: number
  setConsecutiveSyncFailures: (n: number) => void
  refreshPlayers: () => void
  messagesUnreadCount: number
  setMessagesUnreadCount: (n: number) => void
}

const MobileContext = createContext<MobileContextType>({
  teamId: null,
  coachName: '',
  isCapacitor: false,
  teams: [],
  switchTeam: () => {},
  activeGameId: null,
  setActiveGameId: () => {},
  players: [],
  playersLoading: false,
  positionCategories: [],
  lineupVersion: 0,
  bumpLineupVersion: () => {},
  consecutiveSyncFailures: 0,
  setConsecutiveSyncFailures: () => {},
  refreshPlayers: () => {},
  messagesUnreadCount: 0,
  setMessagesUnreadCount: () => {},
})

export type { TeamInfo, MobileContextType }
export const useMobile = () => useContext(MobileContext)
export const MobileProvider = MobileContext.Provider
