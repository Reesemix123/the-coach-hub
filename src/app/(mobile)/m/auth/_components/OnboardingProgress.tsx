'use client'

/**
 * Three-dot progress indicator used across the parent onboarding flow.
 * Active step is wider and uses the accent color; completed steps are thin
 * and tertiary; future steps are thin and muted.
 */
export function OnboardingProgress({
  step,
  total = 3,
}: {
  step: number
  total?: number
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-6" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => {
        const isCurrent = i + 1 === step
        const isComplete = i + 1 < step
        return (
          <div
            key={i}
            className={`h-1 rounded-full transition-all ${
              isCurrent
                ? 'w-8 bg-[var(--accent)]'
                : isComplete
                ? 'w-4 bg-[var(--text-tertiary)]'
                : 'w-4 bg-[var(--bg-pill-inactive)]'
            }`}
          />
        )
      })}
    </div>
  )
}
