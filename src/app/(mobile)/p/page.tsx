'use client'

import { useRouter } from 'next/navigation'
import { useRole } from '../RoleContext'

/**
 * Parent placeholder — shown until parent mobile tabs are built in Phase 3b.
 * Includes persona switcher for dual-role users.
 */
export default function ParentPlaceholderPage() {
  const router = useRouter()
  const { isDualRole, setActiveRole, parentAthletes } = useRole()

  function handleSwitchToCoach() {
    setActiveRole('coach')
    router.replace('/m/practice')
  }

  const athleteNames = parentAthletes.map(a => a.name).join(', ') || 'your athlete'

  return (
    <div className="flex flex-col items-center px-6 pt-[env(safe-area-inset-top)]">
      <div className="flex flex-col items-center pt-20 pb-8">
        <img
          src="/logo-darkmode.png"
          className="w-14 h-14 object-contain mb-4"
          alt="Youth Coach Hub"
        />
        <h1 className="text-xl font-bold text-[var(--text-primary)] text-center">
          Parent Experience
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2 text-center max-w-[280px] leading-relaxed">
          The mobile parent experience is coming soon. In the meantime, visit the web app for full access to {athleteNames}&apos;s content.
        </p>

        {/* Link to web parent dashboard */}
        <button
          type="button"
          onClick={() => window.open('/parent', '_blank', 'noopener')}
          className="mt-6 px-6 py-3 rounded-xl font-semibold text-sm bg-[var(--accent)] text-[var(--accent-text)] active:opacity-80 transition-opacity"
        >
          Open Web Dashboard
        </button>
      </div>

      {/* Dual-role switcher */}
      {isDualRole && (
        <div className="w-full max-w-sm mt-8">
          <button
            type="button"
            onClick={handleSwitchToCoach}
            className="w-full bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-primary)] active:bg-[var(--bg-card-alt)] transition-colors text-left flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--bg-pill-inactive)] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <polyline points="17 11 19 13 23 9" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Switch to Coach View</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Manage your team</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)]">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
