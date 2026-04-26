'use client'

import { EmptyState } from '@/app/(mobile)/components/EmptyState'

export default function ParentMediaPage() {
  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-4">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Media</h1>
      </div>
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" />
          </svg>
        }
        title="No media shared yet"
        description="Game clips and reports will appear here when your coach shares them."
      />
    </div>
  )
}
