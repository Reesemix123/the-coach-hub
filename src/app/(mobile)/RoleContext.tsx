'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoachTeam {
  id: string
  name: string
  level: string
}

interface ParentAthlete {
  id: string
  name: string
  teamName: string
}

interface ParentAthleteProfile {
  id: string
  firstName: string
  lastName: string
}

interface RoleContextValue {
  isCoach: boolean
  isParent: boolean
  isDualRole: boolean
  activeRole: 'coach' | 'parent'
  setActiveRole: (role: 'coach' | 'parent') => void
  coachTeams: CoachTeam[]
  parentAthletes: ParentAthlete[]
  parentAthleteProfiles: ParentAthleteProfile[]
  loading: boolean
  refetch: () => Promise<void>
}

const STORAGE_KEY = 'ych-active-role'

const defaults: RoleContextValue = {
  isCoach: false,
  isParent: false,
  isDualRole: false,
  activeRole: 'coach',
  setActiveRole: () => {},
  coachTeams: [],
  parentAthletes: [],
  parentAthleteProfiles: [],
  loading: true,
  refetch: async () => {},
}

const RoleContext = createContext<RoleContextValue>(defaults)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function RoleProvider({ children }: { children: ReactNode }) {
  const [isCoach, setIsCoach] = useState(false)
  const [isParent, setIsParent] = useState(false)
  const [coachTeams, setCoachTeams] = useState<CoachTeam[]>([])
  const [parentAthletes, setParentAthletes] = useState<ParentAthlete[]>([])
  const [parentAthleteProfiles, setParentAthleteProfiles] = useState<ParentAthleteProfile[]>([])
  const [activeRole, setActiveRoleState] = useState<'coach' | 'parent'>('coach')
  const [loading, setLoading] = useState(true)

  const fetchRole = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mobile/role')
      if (!res.ok) throw new Error('Failed to fetch role')
      const data = await res.json()

      setIsCoach(data.isCoach)
      setIsParent(data.isParent)
      setCoachTeams(data.coachTeams)
      setParentAthletes(data.parentAthletes)
      setParentAthleteProfiles(data.parentAthleteProfiles ?? [])

      // Resolve active role: localStorage → coach default → parent fallback
      const stored = localStorage.getItem(STORAGE_KEY) as 'coach' | 'parent' | null
      if (stored === 'parent' && data.isParent) {
        setActiveRoleState('parent')
      } else if (stored === 'coach' && data.isCoach) {
        setActiveRoleState('coach')
      } else if (data.isCoach) {
        setActiveRoleState('coach')
      } else if (data.isParent) {
        setActiveRoleState('parent')
      }
      // else: new signup with no roles — stays 'coach' (handled by router)
    } catch (err) {
      console.error('[RoleContext] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRole() }, [fetchRole])

  const setActiveRole = useCallback((role: 'coach' | 'parent') => {
    setActiveRoleState(role)
    try { localStorage.setItem(STORAGE_KEY, role) } catch {}
  }, [])

  const isDualRole = isCoach && isParent

  return (
    <RoleContext.Provider
      value={{
        isCoach, isParent, isDualRole,
        activeRole, setActiveRole,
        coachTeams, parentAthletes, parentAthleteProfiles,
        loading, refetch: fetchRole,
      }}
    >
      {children}
    </RoleContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useRole = () => useContext(RoleContext)
