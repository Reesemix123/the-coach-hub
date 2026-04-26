'use client'

/**
 * Parent mobile layout — minimal placeholder for /p/ routes.
 * ThemeProvider and RoleContext come from the parent (mobile) layout.
 * Header/nav are hidden via pathname check in the parent layout.
 * SubscriptionContext wired in Phase 3b when parent tabs are built.
 */
export default function ParentMobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {children}
    </div>
  )
}
