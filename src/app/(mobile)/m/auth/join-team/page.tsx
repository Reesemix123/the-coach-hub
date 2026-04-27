'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useRole } from '@/app/(mobile)/RoleContext'
import { OnboardingProgress } from '../_components/OnboardingProgress'

const ATHLETE_PROFILE_KEY = 'ych-athlete-profile-id'
const CODE_LENGTH = 6

interface SuccessInfo {
  teamName: string
  playerName: string
}

interface LimitInfo {
  teamName: string
  planTier: string
  maxParents: number
  upgradeUrl: string
}

type View = 'idle' | 'success' | 'limit'

export default function JoinTeamPage() {
  const router = useRouter()
  const { isParent, parentAthleteProfiles, loading: roleLoading } = useRole()

  const [athleteProfileId, setAthleteProfileId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('idle')
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null)
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null)

  // Resolve athleteProfileId — sessionStorage first, RoleContext fallback
  useEffect(() => {
    if (roleLoading) return
    if (!isParent) {
      router.replace('/m/auth/parent-setup')
      return
    }

    let resolved: string | null = null
    try {
      resolved = sessionStorage.getItem(ATHLETE_PROFILE_KEY)
    } catch {}

    if (!resolved && parentAthleteProfiles.length > 0) {
      resolved = parentAthleteProfiles[0].id
      try {
        sessionStorage.setItem(ATHLETE_PROFILE_KEY, resolved)
      } catch {}
    }

    if (!resolved) {
      router.replace('/m/auth/athlete-setup')
      return
    }

    setAthleteProfileId(resolved)
  }, [roleLoading, isParent, parentAthleteProfiles, router])

  function handleCodeChange(value: string) {
    // Strip non-alphanumerics, uppercase, cap at length
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)
    setCode(cleaned)
    if (error) setError(null)
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!athleteProfileId || code.length !== CODE_LENGTH) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/parent/athletes/${athleteProfileId}/link-roster`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ joinCode: code }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSuccessInfo({
          teamName: data.teamName,
          playerName: data.playerName,
        })
        setView('success')
        try {
          sessionStorage.removeItem(ATHLETE_PROFILE_KEY)
        } catch {}
      } else if (data?.code === 'PARENT_LIMIT_REACHED') {
        setLimitInfo({
          teamName: data.teamName,
          planTier: data.planTier,
          maxParents: data.maxParents,
          upgradeUrl: data.upgradeUrl,
        })
        setView('limit')
      } else if (res.status === 404) {
        setError('Code not found — check with your coach.')
      } else if (res.status === 409) {
        setError(data?.error ?? 'You’re already linked to this team.')
      } else {
        setError(data?.error ?? 'Something went wrong. Try again.')
      }
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- Success view ----------
  if (view === 'success' && successInfo) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="w-20 h-20 rounded-full bg-[var(--accent)]/15 flex items-center justify-center mb-6">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--accent)]">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">You&apos;re in!</h1>
        <p className="text-sm text-[var(--text-secondary)] text-center mb-1 leading-relaxed">
          {successInfo.playerName}
        </p>
        <p className="text-base font-semibold text-[var(--text-primary)] text-center mb-10">
          {successInfo.teamName}
        </p>
        <button
          type="button"
          onClick={() => router.replace('/p/schedule')}
          className="w-full max-w-sm py-3.5 rounded-xl font-semibold text-sm bg-[var(--accent)] text-[var(--accent-text)] active:opacity-80 transition-opacity"
        >
          Continue
        </button>
      </div>
    )
  }

  // ---------- Plan-limit view ----------
  if (view === 'limit' && limitInfo) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="w-20 h-20 rounded-full bg-[var(--bg-pill-inactive)] flex items-center justify-center mb-6">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-secondary)]">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">
          Your spot is on the way
        </h1>
        <p className="text-sm text-[var(--text-secondary)] text-center mb-8 leading-relaxed max-w-sm">
          Your coach&apos;s current plan has reached the maximum number of parents on{' '}
          <span className="font-semibold text-[var(--text-primary)]">{limitInfo.teamName}</span>.
          We&apos;ve let your coach know — once they upgrade, you&apos;ll be able to join. Check back soon!
        </p>
        <button
          type="button"
          onClick={() => {
            setView('idle')
            setLimitInfo(null)
            handleSubmit()
          }}
          disabled={submitting}
          className="w-full max-w-sm py-3.5 rounded-xl font-semibold text-sm bg-[var(--accent)] text-[var(--accent-text)] active:opacity-80 transition-opacity disabled:opacity-50 mb-3"
        >
          Try Again
        </button>
        <button
          type="button"
          onClick={() => router.replace('/p')}
          className="w-full max-w-sm py-3.5 rounded-xl font-semibold text-sm text-[var(--text-secondary)] active:bg-[var(--bg-pill-inactive)] transition-colors"
        >
          Continue to App
        </button>
      </div>
    )
  }

  // ---------- Idle (entry) view ----------
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+12px)] mb-2">
        <Link
          href="/m/auth/athlete-setup"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Back
        </Link>
      </div>

      <div className="px-6 pt-4">
        <OnboardingProgress step={3} />

        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">
          Enter your code
        </h1>
        <p className="text-sm text-[var(--text-secondary)] text-center mb-10 leading-relaxed">
          Ask your coach for the 6-character code that links you to your athlete on the team.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="••••••"
              maxLength={CODE_LENGTH}
              className="w-full text-center text-3xl font-mono font-bold tracking-[0.4em] py-5 rounded-xl bg-[var(--bg-input)] border-2 border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] uppercase"
              autoFocus
            />
            <p className="text-xs text-[var(--text-tertiary)] text-center mt-2">
              Letters and numbers, no spaces
            </p>
          </div>

          {error && (
            <p className="text-sm text-[var(--status-error)] text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || code.length !== CODE_LENGTH || !athleteProfileId}
            className="w-full py-3.5 rounded-xl font-semibold text-sm bg-[var(--accent)] text-[var(--accent-text)] active:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && (
              <div className="w-4 h-4 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
            )}
            Join Team
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.replace('/p')}
          className="w-full mt-6 py-3 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)] transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
