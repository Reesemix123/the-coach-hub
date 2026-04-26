'use client'

import { EmptyState } from '@/app/(mobile)/components/EmptyState'
import { useParent } from '../ParentContext'

export default function ParentPlayerPage() {
  const { currentAthlete, loading } = useParent()

  if (loading) return null

  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-4">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {currentAthlete ? currentAthlete.name : 'Player'}
        </h1>
        {currentAthlete && (
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{currentAthlete.teamName}</p>
        )}
      </div>
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        }
        title="Player profile"
        description="Your athlete's stats, clips, and reports will appear here."
      />
    </div>
  )
}
