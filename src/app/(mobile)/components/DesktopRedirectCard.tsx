'use client'

import type { ReactNode } from 'react'

interface DesktopRedirectCardProps {
  feature: string
  description: string
  url: string
  actionLabel?: string
  icon?: ReactNode
}

export function DesktopRedirectCard({
  feature,
  description,
  url,
  actionLabel = 'Open on desktop',
  icon,
}: DesktopRedirectCardProps) {
  function handleTap() {
    window.open(url, '_blank', 'noopener')
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      className="w-full bg-[var(--bg-card)] rounded-2xl p-5 shadow-[var(--shadow)] border border-[var(--border-primary)] active:bg-[var(--bg-card-alt)] transition-colors text-left"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-pill-inactive)] flex items-center justify-center text-[var(--text-tertiary)] flex-shrink-0">
          {icon || (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">
            {feature}
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2">
            {description}
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)]">
            {actionLabel}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </span>
        </div>
      </div>
    </button>
  )
}
