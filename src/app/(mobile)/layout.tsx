'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { MobileProvider, type TeamInfo, type MobilePlayer } from './MobileContext'
import { ThemeProvider } from './ThemeContext'
import { SubscriptionProvider } from './SubscriptionContext'
import { RoleProvider } from './RoleContext'
import { MobileAuthGuard } from './MobileAuthGuard'
import './theme.css'
import { getAllQueuedGameIds } from '@/lib/utils/playQueue'
import { processQueue } from '@/lib/utils/syncEngine'

const STORAGE_KEY = 'ych-mobile-active-team'

// ---------------------------------------------------------------------------
// SVG Icon Components
// ---------------------------------------------------------------------------

function PracticeIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 4H8a1 1 0 00-1 1v14a1 1 0 001 1h8a1 1 0 001-1V5a1 1 0 00-1-1z" />
      <path d="M12 2v2M9 9h6M9 12h6M9 15h3" />
    </svg>
  )
}

function GameIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <ellipse cx="12" cy="12" rx="9" ry="5.5" />
      <path d="M12 6.5v11" />
      <path d="M9.5 9l5 0M9.5 12l5 0M9.5 15l5 0" />
    </svg>
  )
}

function MessagesIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  )
}

function PlaybookIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 3H8a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2z" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="14" cy="14" r="1.5" />
      <path d="M10 10l4 4" />
    </svg>
  )
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Tab Bar Config
// ---------------------------------------------------------------------------

interface TabConfig {
  label: string
  href: string
  Icon: React.ComponentType<{ className?: string }>
}

const TABS: TabConfig[] = [
  { label: 'Practice', href: '/m/practice', Icon: PracticeIcon },
  { label: 'Game',     href: '/m/sideline', Icon: GameIcon },
  { label: 'Messages', href: '/m/messages', Icon: MessagesIcon },
  { label: 'Playbook', href: '/m/playbook', Icon: PlaybookIcon },
  { label: 'More',     href: '/m/more',     Icon: MoreIcon },
]

// ---------------------------------------------------------------------------
// Bottom Sheet — Team Switcher
// ---------------------------------------------------------------------------

interface TeamSheetProps {
  teams: TeamInfo[]
  activeTeamId: string | null
  onSelect: (teamId: string) => void
  onClose: () => void
}

function TeamSheet({ teams, activeTeamId, onSelect, onClose }: TeamSheetProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Title */}
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 pb-2">
          Switch Team
        </p>

        {/* Team list */}
        <div className="max-h-[50vh] overflow-y-auto">
          {teams.map((team) => {
            const isActive = team.id === activeTeamId
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => onSelect(team.id)}
                className="w-full flex items-center justify-between px-5 py-3.5 min-h-[56px] active:bg-[var(--bg-card-alt)] transition-colors"
              >
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-base font-medium text-[var(--text-primary)] truncate">
                    {team.name}
                  </p>
                  <span className="inline-block mt-0.5 rounded-full bg-[var(--bg-card-alt)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                    {team.level}
                  </span>
                </div>
                {isActive && (
                  <svg className="w-5 h-5 text-[#B8CA6E] flex-shrink-0 ml-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        {/* Divider + Account Settings */}
        <div className="border-t border-[var(--border-primary)] mx-5" />
        <Link
          href="/m/more"
          onClick={onClose}
          className="flex items-center gap-3 px-5 py-4 min-h-[56px] active:bg-[var(--bg-card-alt)] transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span className="text-base font-medium text-[var(--text-primary)]">Account Settings</span>
        </Link>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const [isCapacitor, setIsCapacitor] = useState(false)
  const [coachName, setCoachName] = useState('')
  const [avatarInitial, setAvatarInitial] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeGameId, setActiveGameId] = useState<string | null>(null)
  const [players, setPlayers] = useState<MobilePlayer[]>([])
  const [playersLoading, setPlayersLoading] = useState(false)
  const [lineupVersion, setLineupVersion] = useState(0)
  const bumpLineupVersion = useCallback(() => setLineupVersion(v => v + 1), [])
  const [consecutiveSyncFailures, setConsecutiveSyncFailures] = useState(0)
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0)

  // Track original styles so we can restore on unmount
  const originalNavDisplay = useRef<string>('')
  const originalBannerDisplay = useRef<string>('')
  const originalMainClass = useRef<string>('')

  // Suppress desktop navigation on mount, restore on unmount
  useEffect(() => {
    const nav = document.getElementById('coach-nav')
    const banner = document.getElementById('coach-banner')
    const main = document.querySelector('main')

    if (nav) {
      originalNavDisplay.current = nav.style.display
      nav.style.display = 'none'
    }
    if (banner) {
      originalBannerDisplay.current = banner.style.display
      banner.style.display = 'none'
    }
    if (main) {
      originalMainClass.current = main.className
      main.classList.remove('pt-24')
    }

    // Hide Next.js dev indicator ("N" logo in bottom-left)
    const devIndicator = document.querySelector('nextjs-portal') as HTMLElement | null
    const devIndicatorDisplay = devIndicator?.style.display ?? ''
    if (devIndicator) devIndicator.style.display = 'none'

    // Hide floating AI Assistant chat widget (ChatWidget from root layout)
    const style = document.createElement('style')
    style.id = 'mobile-overrides'
    style.textContent = `[aria-label="Open AI Assistant"], [aria-label="Open AI Assistant"] + div { display: none !important; }`
    document.head.appendChild(style)

    return () => {
      if (nav) nav.style.display = originalNavDisplay.current
      if (banner) banner.style.display = originalBannerDisplay.current
      if (main) main.className = originalMainClass.current
      if (devIndicator) devIndicator.style.display = devIndicatorDisplay
      document.getElementById('mobile-overrides')?.remove()
    }
  }, [])

  // Detect Capacitor native shell
  useEffect(() => {
    const capacitor = (window as Window & { Capacitor?: { isNative?: boolean } }).Capacitor
    setIsCapacitor(capacitor?.isNative === true)
  }, [])

  // Fetch coach profile and all teams
  useEffect(() => {
    async function loadProfileAndTeams() {
      const supabase = createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      console.log('[MobileLayout] auth result:', { user: user?.id ?? null, email: user?.email ?? null, authError: authError?.message ?? null })
      if (authError || !user) return

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single()

      setCoachName(profile?.full_name || 'Coach')
      setAvatarUrl(profile?.avatar_url || null)

      if (profile?.full_name) {
        setAvatarInitial(profile.full_name.charAt(0).toUpperCase())
      } else {
        const emailPrefix = (user.email ?? '').split('@')[0]
        setAvatarInitial(emailPrefix ? emailPrefix.charAt(0).toUpperCase() : '?')
      }

      // Fetch ALL teams for this user (owned + memberships) — archived teams hidden
      const { data: ownedTeams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, level')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      console.log('[MobileLayout] owned teams query:', { ownedTeams, teamsError, userId: user.id })

      const allTeams: TeamInfo[] = (ownedTeams ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        level: t.level ?? '',
      }))

      // Also check team_memberships for teams this user is a member of but doesn't own
      const { data: memberships, error: membershipsError } = await supabase
        .from('team_memberships')
        .select('team_id, teams(id, name, level)')
        .eq('user_id', user.id)
        .eq('is_active', true)

      console.log('[MobileLayout] memberships query:', { memberships, membershipsError })

      if (memberships) {
        for (const m of memberships) {
          const t = m.teams as unknown as { id: string; name: string; level: string } | null
          if (t && !allTeams.some((existing) => existing.id === t.id)) {
            allTeams.push({ id: t.id, name: t.name, level: t.level ?? '' })
          }
        }
      }

      console.log('[MobileLayout] final teams array:', allTeams)
      setTeams(allTeams)

      // Resolve active team: localStorage → first team
      const stored = localStorage.getItem(STORAGE_KEY)
      const storedIsValid = stored && allTeams.some((t) => t.id === stored)

      if (storedIsValid) {
        setTeamId(stored)
      } else if (allTeams.length > 0) {
        const defaultId = allTeams[0].id
        setTeamId(defaultId)
        localStorage.setItem(STORAGE_KEY, defaultId)
      }
    }

    loadProfileAndTeams()
  }, [])

  // Switch active team — persist to localStorage and update state
  const switchTeam = useCallback((newTeamId: string) => {
    setTeamId(newTeamId)
    localStorage.setItem(STORAGE_KEY, newTeamId)
    setSheetOpen(false)
  }, [])

  // Fetch players for active team (async, non-blocking)
  const fetchPlayers = useCallback(() => {
    if (!teamId) {
      setPlayers([])
      setPlayersLoading(false)
      return
    }
    setPlayersLoading(true)
    const supabase = createClient()
    supabase
      .from('players')
      .select('id, jersey_number, first_name, last_name, position_depths, grade_level')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('jersey_number')
      .then(({ data, error }) => {
        if (!error && data) {
          setPlayers(data as MobilePlayer[])
        }
        setPlayersLoading(false)
      })
  }, [teamId])

  useEffect(() => { fetchPlayers() }, [fetchPlayers])

  // Refresh players on app focus (visibility change) — debounced to 30s
  const lastRefreshRef = useRef(Date.now())
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRefreshRef.current < 30000) return
      lastRefreshRef.current = Date.now()
      fetchPlayers()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchPlayers])

  // Orphan auto-sync: scan for unsynced queues from previous sessions
  useEffect(() => {
    const orphaned = getAllQueuedGameIds()
    if (orphaned.length === 0) return
    setConsecutiveSyncFailures(5) // Show amber dot immediately
    const supabase = createClient()
    Promise.all(
      orphaned.map(async ({ gameId, teamId: tid }) => {
        if (!tid) return
        try {
          const result = await processQueue(gameId, tid, supabase)
          if (result.synced > 0 && result.remaining === 0) {
            setConsecutiveSyncFailures(0)
          }
        } catch {}
      })
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ThemeProvider>
    <RoleProvider>
    <MobileAuthGuard>
    <MobileProvider value={{ teamId, coachName, isCapacitor, teams, switchTeam, activeGameId, setActiveGameId, players, playersLoading, lineupVersion, bumpLineupVersion, consecutiveSyncFailures, setConsecutiveSyncFailures, refreshPlayers: fetchPlayers, messagesUnreadCount, setMessagesUnreadCount }}>
    <SubscriptionProvider>
      {/* FOWT prevention: inline script sets data-theme before first paint */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function(){
          try {
            var p = localStorage.getItem('ych-theme-preference');
            var t = 'light';
            if (p === 'dark') t = 'dark';
            else if (p === 'system' || !p) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', t);
          } catch(e) {}
        })();
      ` }} />
      <div className="flex flex-col h-screen bg-[var(--bg-primary)]">

        {/* ------------------------------------------------------------------ */}
        {/* Header (hidden on auth pages)                                        */}
        {/* ------------------------------------------------------------------ */}
        {!pathname.startsWith('/m/auth') && !pathname.startsWith('/p') && (
        <header className="bg-[var(--bg-nav)] border-b border-[var(--border-primary)] shrink-0">
          {/* Safe-area top padding for iOS notch */}
          <div className="pt-[env(safe-area-inset-top)]" />

          <div className="flex items-center justify-between px-4 h-14">

            {/* Left: App logo */}
            {/* TODO: Mobile AI chat assistant — fullscreen bottom sheet using ChatContainer */}
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0">
              <img src="/logo-darkmode.png" className="w-5 h-5 object-contain" alt="Youth Coach Hub" />
            </div>

            {/* Right: Avatar — tappable, opens team switcher */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex items-center justify-center min-w-[44px] min-h-[44px]"
              aria-label="Switch team"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={coachName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-[#B8CA6E] flex items-center justify-center">
                  <span className="text-sm font-semibold text-[#1c1c1e]">
                    {avatarInitial}
                  </span>
                </div>
              )}
            </button>

          </div>
        </header>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Content area                                                         */}
        {/* ------------------------------------------------------------------ */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* ------------------------------------------------------------------ */}
        {/* Bottom Tab Bar (hidden on auth pages)                                */}
        {/* ------------------------------------------------------------------ */}
        {!pathname.startsWith('/m/auth') && !pathname.startsWith('/p') && (
        <nav className="bg-[var(--bg-nav)] border-t border-[var(--border-primary)] shrink-0">
          <div className="flex items-stretch">
            {TABS.map(({ label, href, Icon }) => {
              const isActive = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'relative flex flex-col items-center justify-center flex-1 min-h-[49px] gap-0.5 transition-colors',
                    isActive ? 'text-[#B8CA6E]' : 'text-[var(--text-tertiary)]',
                  ].join(' ')}
                >
                  <Icon />
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                  {label === 'More' && consecutiveSyncFailures >= 5 && (
                    <span className="absolute top-1.5 right-[calc(50%-4px)] w-2 h-2 bg-amber-500 rounded-full" />
                  )}
                  {label === 'Messages' && messagesUnreadCount > 0 && (
                    <span className="absolute top-1 right-[calc(50%-8px)] min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center px-1">
                      <span className="text-[10px] font-bold text-white leading-none">{messagesUnreadCount > 9 ? '9+' : messagesUnreadCount}</span>
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
          {/* Safe-area bottom padding for iOS home indicator */}
          <div className="pb-[env(safe-area-inset-bottom)]" />
        </nav>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Team Switcher Bottom Sheet                                           */}
        {/* ------------------------------------------------------------------ */}
        {sheetOpen && (
          <TeamSheet
            teams={teams}
            activeTeamId={teamId}
            onSelect={switchTeam}
            onClose={() => setSheetOpen(false)}
          />
        )}

      </div>
    </SubscriptionProvider>
    </MobileProvider>
    </MobileAuthGuard>
    </RoleProvider>
    </ThemeProvider>
  )
}
