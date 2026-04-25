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
  position_depths: Record<string, number>
  grade_level?: string | null
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
})

export type { TeamInfo, MobileContextType }
export const useMobile = () => useContext(MobileContext)
export const MobileProvider = MobileContext.Provider
