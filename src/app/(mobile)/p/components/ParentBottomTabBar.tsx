'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useParent } from '../ParentContext'

// ---------------------------------------------------------------------------
// Icons (inline SVGs matching coach nav style — Lucide-equivalent)
// ---------------------------------------------------------------------------

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  )
}

function MediaIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  )
}

function PlayerIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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
// Tab config
// ---------------------------------------------------------------------------

interface TabConfig {
  label: string
  href: string
  Icon: React.ComponentType<{ className?: string }>
}

const TABS: TabConfig[] = [
  { label: 'Schedule', href: '/p/schedule', Icon: CalendarIcon },
  { label: 'Messages', href: '/p/messages', Icon: MessageIcon },
  { label: 'Media',    href: '/p/media',    Icon: MediaIcon },
  { label: 'Player',   href: '/p/player',   Icon: PlayerIcon },
  { label: 'More',     href: '/p/more',     Icon: MoreIcon },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ParentBottomTabBar() {
  const pathname = usePathname()
  const { unreadCount } = useParent()

  return (
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
              {label === 'Messages' && unreadCount > 0 && (
                <span className="absolute top-1 right-[calc(50%-8px)] min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center px-1">
                  <span className="text-[10px] font-bold text-white leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                </span>
              )}
            </Link>
          )
        })}
      </div>
      <div className="pb-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
