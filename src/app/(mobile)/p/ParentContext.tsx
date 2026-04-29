'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParentTeam { id: string; name: string }
interface ParentAthlete { id: string; name: string; teamId: string; teamName: string; athleteProfileId: string | null }

interface ParentContextValue {
  currentTeamId: string | null
  currentAthleteId: string | null
  currentAthleteProfileId: string | null
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
  currentTeamId: null, currentAthleteId: null, currentAthleteProfileId: null,
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

  // Fetch context data — runs once on mount. Deep-link params are resolved
  // a single time at parent-app entry; subsequent navigation must not refire
  // this effect (useSearchParams was previously causing phantom re-runs that
  // recreated the teams/athletes arrays and triggered a flicker downstream).
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
        const params = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : new URLSearchParams()
        const urlTeam = params.get('teamId')
        const urlAthlete = params.get('athleteId')
        const urlAthleteProfile = params.get('athleteProfileId')
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

        // Resolve athleteId — explicit athleteId wins, then athleteProfileId alias, then stored, then first
        let athleteId: string | null = null
        const teamAthletes = data.athletes.filter((a: ParentAthlete) => a.teamId === teamId)
        if (urlAthlete && teamAthletes.some((a: ParentAthlete) => a.id === urlAthlete)) {
          athleteId = urlAthlete
        } else if (urlAthleteProfile) {
          const match = teamAthletes.find((a: ParentAthlete) => a.athleteProfileId === urlAthleteProfile)
          if (match) athleteId = match.id
        }
        if (!athleteId && storedAthlete && teamAthletes.some((a: ParentAthlete) => a.id === storedAthlete)) {
          athleteId = storedAthlete
        }
        if (!athleteId && teamAthletes.length > 0) {
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
  }, [])

  // Poll unread count every 30s. Skip the state update when the value is
  // unchanged so the context value object stays stable and no consumers
  // re-render unnecessarily.
  useEffect(() => {
    if (!currentTeamId) return
    async function fetchUnread() {
      try {
        const res = await fetch(`/api/parent/unread-count?teamId=${currentTeamId}`)
        if (res.ok) {
          const data = await res.json()
          const total = data.total ?? 0
          setUnreadCount((prev) => (prev === total ? prev : total))
        }
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [currentTeamId])

  const currentTeam = useMemo(
    () => teams.find(t => t.id === currentTeamId) ?? null,
    [teams, currentTeamId],
  )
  const currentAthlete = useMemo(
    () => athletes.find(a => a.id === currentAthleteId) ?? null,
    [athletes, currentAthleteId],
  )
  const currentAthleteProfileId = currentAthlete?.athleteProfileId ?? null

  // Memoize the context value so consumers only re-render when something
  // actually changed (not on every parent re-render).
  const value = useMemo(
    () => ({
      currentTeamId, currentAthleteId, currentAthleteProfileId,
      setCurrentTeamId, setCurrentAthleteId,
      teams, athletes, currentTeam, currentAthlete,
      parentName, loading, unreadCount,
    }),
    [
      currentTeamId, currentAthleteId, currentAthleteProfileId,
      setCurrentTeamId, setCurrentAthleteId,
      teams, athletes, currentTeam, currentAthlete,
      parentName, loading, unreadCount,
    ],
  )

  return (
    <ParentContext.Provider value={value}>
      {children}
    </ParentContext.Provider>
  )
}

export const useParent = () => useContext(ParentContext)
