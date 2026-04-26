'use client'

import { Suspense } from 'react'
import { ParentProvider, useParent } from './ParentContext'
import { ParentBottomTabBar } from './components/ParentBottomTabBar'

// ---------------------------------------------------------------------------
// Team header (shown when parent has multiple teams)
// ---------------------------------------------------------------------------

function TeamHeader() {
  const { teams, currentTeam, setCurrentTeamId, loading } = useParent()

  if (loading || teams.length <= 1) return null

  return (
    <div className="bg-[var(--bg-nav)] border-b border-[var(--border-primary)] px-4 py-2">
      <select
        value={currentTeam?.id ?? ''}
        onChange={e => setCurrentTeamId(e.target.value)}
        className="w-full bg-transparent text-sm font-semibold text-[var(--text-primary)] appearance-none focus:outline-none"
      >
        {teams.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading spinner
// ---------------------------------------------------------------------------

function ParentLoadingState() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-3">
        <img src="/logo-darkmode.png" className="w-10 h-10 object-contain opacity-50" alt="" />
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inner layout (needs ParentContext)
// ---------------------------------------------------------------------------

function ParentLayoutInner({ children }: { children: React.ReactNode }) {
  const { loading } = useParent()

  if (loading) return <ParentLoadingState />

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
      <TeamHeader />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <ParentBottomTabBar />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layout export
// ---------------------------------------------------------------------------

export default function ParentMobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ParentLoadingState />}>
      <ParentProvider>
        <ParentLayoutInner>{children}</ParentLayoutInner>
      </ParentProvider>
    </Suspense>
  )
}
