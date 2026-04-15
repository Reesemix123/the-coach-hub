'use client'

import { createContext, useContext } from 'react'

interface MobileContextType {
  teamId: string | null
  coachName: string
  isCapacitor: boolean
}

const MobileContext = createContext<MobileContextType>({
  teamId: null,
  coachName: '',
  isCapacitor: false,
})

export const useMobile = () => useContext(MobileContext)
export const MobileProvider = MobileContext.Provider
