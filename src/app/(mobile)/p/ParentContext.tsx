'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParentTeam { id: string; name: string }
interface ParentAthlete { id: string; name: string; teamId: string; teamName: string }

interface ParentContextValue {
  currentTeamId: string | null
  currentAthleteId: string | null
  setCurrentTeamId: (id: string) => void
  setCurrentAthleteId: (id: string) => void
  teams: ParentTeam[]
  athletes: ParentAthlete[]
  currentTeam: ParentTeam | null
  currentAthlete: ParentAthlete | null
  parentName: string
  loading: boolean
  unreadCount: number
}

const TEAM_KEY = 'ych-parent-team'
const ATHLETE_KEY = 'ych-parent-athlete'

const defaults: ParentContextValue = {
  currentTeamId: null, currentAthleteId: null,
  setCurrentTeamId: () => {}, setCurrentAthleteId: () => {},
  teams: [], athletes: [],
  currentTeam: null, currentAthlete: null,
  parentName: '', loading: true, unreadCount: 0,
}

const ParentContext = createContext<ParentContextValue>(defaults)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ParentProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()

  const [teams, setTeams] = useState<ParentTeam[]>([])
  const [athletes, setAthletes] = useState<ParentAthlete[]>([])
  const [parentName, setParentName] = useState('')
  const [currentTeamId, setCurrentTeamIdState] = useState<string | null>(null)
  const [currentAthleteId, setCurrentAthleteIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  // Persist selections
  const setCurrentTeamId = useCallback((id: string) => {
    setCurrentTeamIdState(id)
    try { localStorage.setItem(TEAM_KEY, id) } catch {}
    // Auto-select first athlete on this team
    setAthletes(prev => {
      const onTeam = prev.filter(a => a.teamId === id)
      if (onTeam.length > 0) {
        setCurrentAthleteIdState(onTeam[0].id)
        try { localStorage.setItem(ATHLETE_KEY, onTeam[0].id) } catch {}
      }
      return prev
    })
  }, [])

  const setCurrentAthleteId = useCallback((id: string) => {
    setCurrentAthleteIdState(id)
    try { localStorage.setItem(ATHLETE_KEY, id) } catch {}
  }, [])

  // Fetch context data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/mobile/parent/context')
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()

        setTeams(data.teams)
        setAthletes(data.athletes)
        setParentName(data.parentName)

        // Deep-link priority: URL params → localStorage → defaults
        const urlTeam = searchParams.get('teamId')
        const urlAthlete = searchParams.get('athleteId')
        const storedTeam = localStorage.getItem(TEAM_KEY)
        const storedAthlete = localStorage.getItem(ATHLETE_KEY)

        // Resolve teamId
        let teamId: string | null = null
        if (urlTeam && data.teams.some((t: ParentTeam) => t.id === urlTeam)) {
          teamId = urlTeam
        } else if (storedTeam && data.teams.some((t: ParentTeam) => t.id === storedTeam)) {
          teamId = storedTeam
        } else if (data.teams.length > 0) {
          teamId = data.teams[0].id
        }
        if (teamId) {
          setCurrentTeamIdState(teamId)
          try { localStorage.setItem(TEAM_KEY, teamId) } catch {}
        }

        // Resolve athleteId
        let athleteId: string | null = null
        const teamAthletes = data.athletes.filter((a: ParentAthlete) => a.teamId === teamId)
        if (urlAthlete && teamAthletes.some((a: ParentAthlete) => a.id === urlAthlete)) {
          athleteId = urlAthlete
        } else if (storedAthlete && teamAthletes.some((a: ParentAthlete) => a.id === storedAthlete)) {
          athleteId = storedAthlete
        } else if (teamAthletes.length > 0) {
          athleteId = teamAthletes[0].id
        }
        if (athleteId) {
          setCurrentAthleteIdState(athleteId)
          try { localStorage.setItem(ATHLETE_KEY, athleteId) } catch {}
        }
      } catch (err) {
        console.error('[ParentContext] fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [searchParams])

  // Poll unread count every 30s
  useEffect(() => {
    if (!currentTeamId) return
    async function fetchUnread() {
      try {
        const res = await fetch(`/api/parent/unread-count?teamId=${currentTeamId}`)
        if (res.ok) {
          const data = await res.json()
          setUnreadCount(data.total ?? 0)
        }
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [currentTeamId])

  const currentTeam = teams.find(t => t.id === currentTeamId) ?? null
  const currentAthlete = athletes.find(a => a.id === currentAthleteId) ?? null

  return (
    <ParentContext.Provider value={{
      currentTeamId, currentAthleteId,
      setCurrentTeamId, setCurrentAthleteId,
      teams, athletes, currentTeam, currentAthlete,
      parentName, loading, unreadCount,
    }}>
      {children}
    </ParentContext.Provider>
  )
}

export const useParent = () => useContext(ParentContext)
