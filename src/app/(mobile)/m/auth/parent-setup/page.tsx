'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useRole } from '@/app/(mobile)/RoleContext'
import { OnboardingProgress } from '../_components/OnboardingProgress'

const SMS_CONSENT_TEXT =
  'I agree to receive text messages from Youth Coach Hub, including game alerts, coaching updates, and team notifications. Message & data rates may apply. Reply STOP at any time to opt out.'

export default function ParentSetupPage() {
  const router = useRouter()
  const { isParent, parentAthleteProfiles, loading: roleLoading, refetch } = useRole()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Skip-ahead: if a profile already exists, jump to the right step
  useEffect(() => {
    if (roleLoading) return
    if (isParent && parentAthleteProfiles.length > 0) {
      router.replace('/m/auth/join-team')
    } else if (isParent) {
      router.replace('/m/auth/athlete-setup')
    }
  }, [roleLoading, isParent, parentAthleteProfiles, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your full name.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/parent/profile/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          smsConsent: phone.trim() ? smsConsent : false,
          smsConsentText: phone.trim() ? SMS_CONSENT_TEXT : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `${res.status}`)
      }
      await refetch()
      router.replace('/m/auth/athlete-setup')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+12px)] mb-2">
        <Link
          href="/m/auth/parent-welcome"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Back
        </Link>
      </div>

      <div className="px-6 pt-4">
        <OnboardingProgress step={1} />

        <h1 className="text-2xl font-bold text-[var(--text-primary)] text-center mb-2">
          Tell us about you
        </h1>
        <p className="text-sm text-[var(--text-secondary)] text-center mb-8 leading-relaxed">
          We&apos;ll use this to keep you in the loop on your athlete&apos;s team.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              First name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
              className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Last name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              required
              className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Phone number <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              autoComplete="tel"
              className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
            />
            <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
              Required for text alerts about practices and game changes.
            </p>
          </div>

          {/* SMS consent — only when phone is provided */}
          {phone.trim() && (
            <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-primary)]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                  className="w-5 h-5 mt-0.5 shrink-0 accent-[var(--accent)]"
                />
                <span className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {SMS_CONSENT_TEXT}
                </span>
              </label>
            </div>
          )}

          {error && (
            <p className="text-sm text-[var(--status-error)] text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
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
