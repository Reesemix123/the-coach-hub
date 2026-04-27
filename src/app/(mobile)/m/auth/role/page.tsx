'use client'

import { useRouter } from 'next/navigation'

export default function RoleSelectionPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+48px)] pb-[env(safe-area-inset-bottom)]">
      <div className="text-center mb-12">
        <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
          Welcome to Youth Coach Hub
        </p>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">
          How will you use the app?
        </h1>
      </div>

      <div className="space-y-4 max-w-md mx-auto w-full">
        {/* Coach card */}
        <button
          type="button"
          onClick={() => router.replace('/m/auth/create-team')}
          className="w-full bg-[var(--bg-card)] rounded-2xl p-5 active:bg-[var(--bg-card-alt)] transition-colors text-left flex items-center gap-4 shadow-[var(--shadow)]"
        >
          <div className="w-14 h-14 rounded-full bg-[var(--bg-pill-inactive)] flex items-center justify-center shrink-0">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-[var(--text-primary)]">I&apos;m a Coach</p>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5 leading-snug">
              Set up your team and start coaching
            </p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-tertiary)] shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* Parent card */}
        <button
          type="button"
          onClick={() => router.replace('/m/auth/parent-welcome')}
          className="w-full bg-[var(--bg-card)] rounded-2xl p-5 active:bg-[var(--bg-card-alt)] transition-colors text-left flex items-center gap-4 shadow-[var(--shadow)]"
        >
          <div className="w-14 h-14 rounded-full bg-[var(--bg-pill-inactive)] flex items-center justify-center shrink-0">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-[var(--text-primary)]">I&apos;m a Parent</p>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5 leading-snug">
              Follow your athlete&apos;s team
            </p>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text-tertiary)] shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
