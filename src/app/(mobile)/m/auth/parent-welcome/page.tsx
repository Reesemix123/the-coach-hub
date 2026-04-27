'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useRole } from '@/app/(mobile)/RoleContext'

export default function ParentWelcomePage() {
  const router = useRouter()
  const { isParent, parentAthleteProfiles } = useRole()
  const [signingOut, setSigningOut] = useState(false)

  // Smart-route the "I have a join code" link to the first step the user
  // hasn't already completed. Handles users who started on web (already have
  // parent_profile + maybe athlete_profile) and signed in on mobile.
  function handleHaveJoinCode() {
    if (isParent && parentAthleteProfiles.length > 0) {
      router.replace('/m/auth/join-team')
    } else if (isParent) {
      router.replace('/m/auth/athlete-setup')
    } else {
      router.replace('/m/auth/parent-setup')
    }
  }

  async function handleSignInInstead() {
    // The user just created an account on this device. To "sign in instead",
    // we sign them out and return to the auth page so they can sign in to
    // their now-properly-set-up account after following the invite link.
    setSigningOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
      const supabase = createClient()
      await supabase.auth.signOut()
    } finally {
      router.replace('/m/auth')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+12px)] mb-2">
        <Link
          href="/m/auth/role"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Back
        </Link>
      </div>

      <div className="px-6 pt-4 max-w-md mx-auto w-full">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">
          Welcome, parent!
        </h1>
        <p className="text-sm text-[var(--text-secondary)] text-center mb-8 leading-relaxed">
          Here&apos;s how to get connected to your athlete&apos;s team.
        </p>

        {/* Card A — Have an invite */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-5 shadow-[var(--shadow)] mb-3">
          <p className="text-base font-bold text-[var(--text-primary)] mb-1">
            Have an invite from your coach?
          </p>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
            Open the text message or email your coach sent you and tap the link to set up your account. Once you&apos;re set up, sign in here.
          </p>
          <button
            type="button"
            onClick={handleSignInInstead}
            disabled={signingOut}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-[var(--accent)] text-[var(--accent-text)] active:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {signingOut && (
              <div className="w-4 h-4 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
            )}
            Sign In Instead
          </button>
        </div>

        {/* Card B — Haven't been invited yet */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-5 shadow-[var(--shadow)] mb-3">
          <p className="text-base font-bold text-[var(--text-primary)] mb-1">
            Haven&apos;t been invited yet?
          </p>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
            Set up your athlete in the app. Then enter the 6-character code your coach gives you to join the team.
          </p>
          <button
            type="button"
            onClick={() => router.replace('/m/auth/parent-setup')}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-[var(--accent)] text-[var(--accent-text)] active:opacity-80 transition-opacity"
          >
            Set Up My Account
          </button>
        </div>

        {/* Smart-route shortcut for users who started on web */}
        <button
          type="button"
          onClick={handleHaveJoinCode}
          className="w-full text-center py-2 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)] transition-colors mb-4"
        >
          I already have a join code
        </button>

        {/* Continue to App — drops the parent into /p with empty states */}
        <button
          type="button"
          onClick={() => router.replace('/p')}
          className="w-full py-3 text-sm text-[var(--text-tertiary)] active:text-[var(--text-secondary)] transition-colors"
        >
          Continue to App
        </button>
      </div>
    </div>
  )
}
