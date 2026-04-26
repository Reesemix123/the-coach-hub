'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useParent } from '../ParentContext'
import { useRole } from '@/app/(mobile)/RoleContext'
import { useTheme } from '@/app/(mobile)/ThemeContext'

export default function ParentMorePage() {
  const router = useRouter()
  const { teams, athletes, currentTeam, currentAthlete, setCurrentTeamId, setCurrentAthleteId } = useParent()
  const { isDualRole, setActiveRole } = useRole()
  const { theme, setThemePreference } = useTheme()
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  function handleSwitchToCoach() {
    setActiveRole('coach')
    router.replace('/m/practice')
  }

  async function handleSignOut() {
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/m/auth'
  }

  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">More</h1>
        <div className="flex bg-[var(--bg-pill-inactive)] rounded-full p-0.5">
          <button
            type="button"
            onClick={() => setThemePreference('light')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              theme === 'light' ? 'bg-[var(--bg-pill-active)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-tertiary)]'
            }`}
          >Light</button>
          <button
            type="button"
            onClick={() => setThemePreference('dark')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              theme === 'dark' ? 'bg-[var(--bg-pill-active)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-tertiary)]'
            }`}
          >Dark</button>
        </div>
      </div>

      {/* Team switcher (if multiple teams) */}
      {teams.length > 1 && (
        <div className="mx-4 mb-3">
          <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">Team</p>
          <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden">
            {teams.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setCurrentTeamId(t.id)}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] last:border-b-0 active:bg-[var(--bg-card-alt)] transition-colors"
              >
                <span className="text-sm font-medium text-[var(--text-primary)]">{t.name}</span>
                {t.id === currentTeam?.id && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8CA6E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Athlete switcher (if multiple athletes) */}
      {athletes.length > 1 && (
        <div className="mx-4 mb-3">
          <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">Athlete</p>
          <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden">
            {athletes.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setCurrentAthleteId(a.id)}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] last:border-b-0 active:bg-[var(--bg-card-alt)] transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{a.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{a.teamName}</p>
                </div>
                {a.id === currentAthlete?.id && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8CA6E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Persona switcher (dual-role only) */}
      {isDualRole && (
        <div className="mx-4 mb-3">
          <button
            type="button"
            onClick={handleSwitchToCoach}
            className="w-full bg-[var(--bg-card)] rounded-xl p-4 active:bg-[var(--bg-card-alt)] transition-colors text-left flex items-center gap-3"
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

      {/* Account */}
      <div className="mx-4 mt-3">
        <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">Account</p>
        <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full text-left px-4 py-3.5 active:bg-[var(--bg-card-alt)] transition-colors"
          >
            <p className="text-sm font-medium text-red-500">Sign Out</p>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-[var(--text-tertiary)]">Youth Coach Hub</p>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">v0.1.0</p>
      </div>

      {/* Sign Out Confirmation */}
      {showSignOutConfirm && (
        <>
          <div className="fixed inset-0 bg-[var(--bg-overlay)] z-50" onClick={() => setShowSignOutConfirm(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up">
            <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-[var(--bg-pill-inactive)]" /></div>
            <div className="px-5 pb-6 text-center">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Sign Out?</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">You&apos;ll need to sign in again to access your athlete&apos;s content.</p>
              <div className="flex gap-3 mt-5">
                <button type="button" onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 bg-[var(--bg-card-alt)] text-[var(--text-primary)] rounded-xl py-3 text-sm font-semibold active:bg-[var(--bg-pill-inactive)]">
                  Cancel
                </button>
                <button type="button" onClick={handleSignOut}
                  className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-semibold active:bg-red-700">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
