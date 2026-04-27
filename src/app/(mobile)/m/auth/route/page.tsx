'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRole } from '@/app/(mobile)/RoleContext'

/**
 * Post-auth persona router.
 * Determines where to send the user based on their roles.
 */
export default function PersonaRouterPage() {
  const router = useRouter()
  const { isCoach, isParent, coachTeams, loading } = useRole()

  useEffect(() => {
    if (loading) return

    if (isCoach && coachTeams.length > 0) {
      // Coach with teams → coach home
      router.replace('/m/practice')
    } else if (isCoach && coachTeams.length === 0) {
      // Coach with no teams (shouldn't happen if isCoach means "has teams", but safety)
      router.replace('/m/auth/create-team')
    } else if (isParent && !isCoach) {
      // Parent only → parent experience
      router.replace('/p')
    } else {
      // No roles yet (fresh signup or stuck account) → role-selection onboarding
      router.replace('/m/auth/role')
    }
  }, [loading, isCoach, isParent, coachTeams, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-3">
        <img src="/logo-darkmode.png" className="w-12 h-12 object-contain opacity-50" alt="" />
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--text-tertiary)] mt-2">Setting up your experience...</p>
      </div>
    </div>
  )
}
