'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { MobileProvider } from './MobileContext'

// ---------------------------------------------------------------------------
// SVG Icon Components
// ---------------------------------------------------------------------------

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function PlaybookIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 3H8a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2z" />
      <path d="M10 3V1m4 2V1m-4 8h4m-4 4h2" />
    </svg>
  )
}

function SidelineIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M10 1h4M12 1v3" />
    </svg>
  )
}

function RosterIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M21 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
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
  { label: 'Home',     href: '/m/home',     Icon: HomeIcon },
  { label: 'Playbook', href: '/m/playbook', Icon: PlaybookIcon },
  { label: 'Sideline', href: '/m/sideline', Icon: SidelineIcon },
  { label: 'Roster',   href: '/m/roster',   Icon: RosterIcon },
  { label: 'More',     href: '/m/more',     Icon: MoreIcon },
]

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
    // Injected as a <style> tag so it works even when ChatWidget renders after this effect
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

  // Fetch coach profile and primary team
  useEffect(() => {
    async function loadProfileAndTeam() {
      const supabase = createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) return

      // Fetch profile — full_name or fallback to 'Coach'
      // Email should never appear as a display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single()

      setCoachName(profile?.full_name || 'Coach')
      setAvatarUrl(profile?.avatar_url ?? null)

      // Avatar initial: use first char of full_name, or first char of email prefix
      if (profile?.full_name) {
        setAvatarInitial(profile.full_name.charAt(0).toUpperCase())
      } else {
        const emailPrefix = (user.email ?? '').split('@')[0]
        setAvatarInitial(emailPrefix ? emailPrefix.charAt(0).toUpperCase() : '?')
      }

      // Fetch primary team (most recent)
      const { data: teams } = await supabase
        .from('teams')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (teams && teams.length > 0) {
        setTeamId(teams[0].id)
      }
    }

    loadProfileAndTeam()
  }, [])

  return (
    <MobileProvider value={{ teamId, coachName, isCapacitor }}>
      <div className="flex flex-col h-screen bg-[#f2f2f7]">

        {/* ------------------------------------------------------------------ */}
        {/* Header                                                               */}
        {/* ------------------------------------------------------------------ */}
        <header className="bg-white border-b border-gray-200 shrink-0">
          {/* Safe-area top padding for iOS notch */}
          <div className="pt-[env(safe-area-inset-top)]" />

          <div className="flex items-center justify-between px-4 h-14">

            {/* Left: Logo / AI Assistant button */}
            <button className="relative w-9 h-9 bg-[#1c1c1e] rounded-full flex items-center justify-center flex-shrink-0">
              <img src="/logo-darkmode.png" className="w-5 h-5 object-contain" alt="AI Assistant" />
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#B8CA6E] rounded-full flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/></svg>
              </span>
            </button>

            {/* Right: Avatar */}
            <div className="flex items-center justify-center min-w-[44px] min-h-[44px]">
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
            </div>

          </div>
        </header>

        {/* ------------------------------------------------------------------ */}
        {/* Content area                                                         */}
        {/* ------------------------------------------------------------------ */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* ------------------------------------------------------------------ */}
        {/* Bottom Tab Bar                                                       */}
        {/* ------------------------------------------------------------------ */}
        <nav className="bg-white border-t border-gray-200 shrink-0">
          <div className="flex items-stretch">
            {TABS.map(({ label, href, Icon }) => {
              const isActive = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    'flex flex-col items-center justify-center flex-1 min-h-[49px] gap-0.5 transition-colors',
                    isActive ? 'text-[#B8CA6E]' : 'text-gray-400',
                  ].join(' ')}
                >
                  <Icon />
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                </Link>
              )
            })}
          </div>
          {/* Safe-area bottom padding for iOS home indicator */}
          <div className="pb-[env(safe-area-inset-bottom)]" />
        </nav>

      </div>
    </MobileProvider>
  )
}
