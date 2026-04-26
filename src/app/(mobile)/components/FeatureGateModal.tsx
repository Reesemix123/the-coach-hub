'use client'

import { useEffect, useCallback, type ReactNode } from 'react'

interface FeatureGateModalProps {
  open: boolean
  onClose: () => void
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  secondaryLabel?: string
  icon?: ReactNode
}

export function FeatureGateModal({
  open,
  onClose,
  title,
  description,
  actionLabel = 'View Plans',
  actionHref,
  secondaryLabel = 'Not Now',
  icon,
}: FeatureGateModalProps) {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  // Prevent body scroll while open
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  function handleAction() {
    if (actionHref) {
      // Apple IAP compliance: open in system browser, not in-app navigation
      window.open(actionHref, '_blank', 'noopener')
    }
    onClose()
  }

  return (
    <>
      {/* Backdrop — click to close */}
      <div
        className="fixed inset-0 bg-[var(--bg-overlay)] z-50 fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="bg-[var(--bg-sheet)] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-[var(--border-secondary)]" />
          </div>

          <div className="px-5 pt-2 pb-6">
            {/* Icon */}
            {icon && (
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-pill-inactive)] flex items-center justify-center text-[var(--accent)]">
                  {icon}
                </div>
              </div>
            )}

            {/* Title */}
            <h2 className="text-lg font-bold text-[var(--text-primary)] text-center mb-2">
              {title}
            </h2>

            {/* Description */}
            <p className="text-sm text-[var(--text-secondary)] text-center mb-6 leading-relaxed">
              {description}
            </p>

            {/* Primary action */}
            {actionHref && (
              <button
                type="button"
                onClick={handleAction}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-[var(--accent)] text-[var(--accent-text)] active:opacity-80 transition-opacity mb-3"
              >
                {actionLabel}
              </button>
            )}

            {/* Secondary / dismiss */}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl font-semibold text-sm text-[var(--text-secondary)] active:bg-[var(--bg-pill-inactive)] transition-colors"
            >
              {secondaryLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
