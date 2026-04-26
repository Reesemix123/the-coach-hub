'use client'

import { EmptyState } from '@/app/(mobile)/components/EmptyState'

export default function ParentSchedulePage() {
  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-4">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Schedule</h1>
      </div>
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        }
        title="No upcoming events"
        description="Your coach hasn't added any events yet."
      />
    </div>
  )
}
