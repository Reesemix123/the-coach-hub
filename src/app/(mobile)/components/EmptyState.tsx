'use client'

import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}: EmptyStateProps) {
  const hasAction = actionLabel && (onAction || actionHref)

  function handleAction() {
    if (onAction) {
      onAction()
    } else if (actionHref) {
      window.open(actionHref, '_blank', 'noopener')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      {/* Icon */}
      <div className="w-14 h-14 rounded-full bg-[var(--bg-pill-inactive)] flex items-center justify-center text-[var(--text-tertiary)] mb-4">
        {icon}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-[var(--text-primary)] text-center mb-1">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-[var(--text-secondary)] text-center max-w-[260px] leading-relaxed mb-5">
          {description}
        </p>
      )}

      {/* Action button */}
      {hasAction && (
        <button
          type="button"
          onClick={handleAction}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[var(--accent)] text-[var(--accent-text)] active:opacity-80 transition-opacity"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
