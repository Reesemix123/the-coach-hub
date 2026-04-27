'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useRole } from '@/app/(mobile)/RoleContext'
import { OnboardingProgress } from '../_components/OnboardingProgress'

const COPPA_CONSENT_TEXT =
  "I, as the parent or legal guardian, consent to my child's personal information (name, graduation year, profile photo, and performance data) being collected and stored on Youth Coach Hub. This information will be used to create an athlete profile that tracks clips, reports, and season history. I understand I can request deletion of this data at any time by contacting support."

const ATHLETE_PROFILE_KEY = 'ych-athlete-profile-id'

export default function AthleteSetupPage() {
  const router = useRouter()
  const { isParent, parentAthleteProfiles, loading: roleLoading, refetch } = useRole()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [graduationYear, setGraduationYear] = useState<string>('')
  const [coppaConsent, setCoppaConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const coppaThreshold = currentYear + 5

  // Skip-ahead: if missing parent profile, go to step 1.
  // If at least one athlete profile exists, jump to step 3.
  useEffect(() => {
    if (roleLoading) return
    if (!isParent) {
      router.replace('/m/auth/parent-setup')
      return
    }
    if (parentAthleteProfiles.length > 0) {
      try {
        sessionStorage.setItem(ATHLETE_PROFILE_KEY, parentAthleteProfiles[0].id)
      } catch {}
      router.replace('/m/auth/join-team')
    }
  }, [roleLoading, isParent, parentAthleteProfiles, router])

  const gradYearNum = graduationYear ? parseInt(graduationYear, 10) : null
  const needsCoppa = gradYearNum != null && gradYearNum <= coppaThreshold

  // Year picker options
  const yearOptions = useMemo(
    () => Array.from({ length: 9 }, (_, i) => currentYear + i),
    [currentYear],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your athlete’s name.')
      return
    }
    if (gradYearNum != null && (gradYearNum < currentYear || gradYearNum > currentYear + 8)) {
      setError(`Graduation year must be between ${currentYear} and ${currentYear + 8}.`)
      return
    }
    if (needsCoppa && !coppaConsent) {
      setError('Please review and accept the consent statement to continue.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/parent/athletes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          graduationYear: gradYearNum ?? undefined,
          coppaConsent: needsCoppa ? true : undefined,
          coppaConsentText: needsCoppa ? COPPA_CONSENT_TEXT : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `${res.status}`)
      }
      const data = (await res.json()) as { athleteProfileId: string }
      try {
        sessionStorage.setItem(ATHLETE_PROFILE_KEY, data.athleteProfileId)
      } catch {}
      await refetch()
      router.replace('/m/auth/join-team')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+12px)] mb-2">
        <Link
          href="/m/auth/parent-setup"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Back
        </Link>
      </div>

      <div className="px-6 pt-4">
        <OnboardingProgress step={2} />

        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">
          Add your athlete
        </h1>
        <p className="text-sm text-[var(--text-secondary)] text-center mb-8 leading-relaxed">
          Just the basics — you can add a photo later.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Athlete first name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Athlete last name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Graduation year <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
            </label>
            <select
              value={graduationYear}
              onChange={(e) => setGraduationYear(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm appearance-none"
            >
              <option value="">Select year</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* COPPA consent — required when graduation year suggests athlete is under 13 */}
          {needsCoppa && (
            <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-primary)]">
              <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">
                Parental Consent
              </p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={coppaConsent}
                  onChange={(e) => setCoppaConsent(e.target.checked)}
                  className="w-5 h-5 mt-0.5 shrink-0 accent-[var(--accent)]"
                />
                <span className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {COPPA_CONSENT_TEXT}
                </span>
              </label>
            </div>
          )}

          {error && (
            <p className="text-sm text-[var(--status-error)] text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || (needsCoppa && !coppaConsent)}
            className="w-full py-3.5 rounded-xl font-semibold text-sm bg-[var(--accent)] text-[var(--accent-text)] active:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {submitting && (
              <div className="w-4 h-4 border-2 border-[var(--accent-text)] border-t-transparent rounded-full animate-spin" />
            )}
            Continue
          </button>
        </form>
      </div>
    </div>
  )
}
