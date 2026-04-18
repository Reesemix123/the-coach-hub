'use client'

import { createContext, useContext } from 'react'

interface TeamInfo {
  id: string
  name: string
  level: string
}

interface MobileContextType {
  teamId: string | null
  coachName: string
  isCapacitor: boolean
  teams: TeamInfo[]
  switchTeam: (teamId: string) => void
}

const MobileContext = createContext<MobileContextType>({
  teamId: null,
  coachName: '',
  isCapacitor: false,
  teams: [],
  switchTeam: () => {},
})

export type { TeamInfo, MobileContextType }
export const useMobile = () => useContext(MobileContext)
export const MobileProvider = MobileContext.Provider
