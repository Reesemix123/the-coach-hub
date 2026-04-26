'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'

// Must match the server-side text in /api/parent/sms-consent for audit consistency.
const SMS_CONSENT_TEXT =
  'I agree to receive text messages from Youth Coach Hub, including game alerts, coaching updates, and team notifications. Message & data rates may apply. Reply STOP at any time to opt out.'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParentProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  notification_preference: 'sms' | 'email' | 'both'
  sms_consent: boolean
  sms_consent_at: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskPhone(phone: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return phone
  return `(•••) •••-${digits.slice(-4)}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

function Toggle({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <div
      className={`relative w-[44px] h-[26px] rounded-full transition-colors shrink-0 ${
        disabled
          ? 'bg-[var(--bg-pill-inactive)] opacity-50'
          : on
          ? 'bg-[var(--accent)]'
          : 'bg-[var(--bg-pill-inactive)]'
      }`}
    >
      <div
        className={`absolute top-[2px] w-[22px] h-[22px] bg-white rounded-full shadow-md transition-transform ${
          on ? 'translate-x-[20px]' : 'translate-x-[2px]'
        }`}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confirm sheet — bottom-sheet with primary + cancel actions
// ---------------------------------------------------------------------------

function ConfirmSheet({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  confirmTone,
  onConfirm,
  busy,
  icon,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: ReactNode
  confirmLabel: string
  confirmTone: 'primary' | 'destructive'
  onConfirm: () => void
  busy?: boolean
  icon?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, busy, onClose])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-[var(--bg-overlay)] z-50"
        onClick={() => {
          if (!busy) onClose()
        }}
        aria-hidden
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="bg-[var(--bg-sheet)] rounded-t-2xl pb-[env(safe-area-inset-bottom)] max-h-[85vh] overflow-y-auto">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-[var(--border-secondary)]" />
          </div>
          <div className="px-5 pt-2 pb-6">
            {icon && (
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-pill-inactive)] flex items-center justify-center text-[var(--accent)]">
                  {icon}
                </div>
              </div>
            )}
            <h2 className="text-lg font-bold text-[var(--text-primary)] text-center mb-2">
              {title}
            </h2>
            <div className="text-sm text-[var(--text-secondary)] text-center mb-6 leading-relaxed">
              {description}
            </div>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`w-full py-3 rounded-xl font-semibold text-sm mb-3 disabled:opacity-50 active:opacity-80 transition-opacity ${
                confirmTone === 'destructive'
                  ? 'bg-red-500 text-white'
                  : 'bg-[var(--accent)] text-[var(--accent-text)]'
              }`}
            >
              {busy ? 'Working…' : confirmLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="w-full py-3 rounded-xl font-semibold text-sm text-[var(--text-secondary)] active:bg-[var(--bg-pill-inactive)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SettingsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="mx-4">
        <div className="h-3 w-20 bg-[var(--bg-card-alt)] rounded mb-2" />
        <div className="bg-[var(--bg-card)] rounded-xl">
          <div className="h-14 border-b border-[var(--border-primary)]" />
          <div className="h-14" />
        </div>
      </div>
      <div className="mx-4">
        <div className="h-3 w-28 bg-[var(--bg-card-alt)] rounded mb-2" />
        <div className="bg-[var(--bg-card)] rounded-xl">
          <div className="h-16 border-b border-[var(--border-primary)]" />
          <div className="h-16" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ParentSettingsPage() {
  const [profile, setProfile] = useState<ParentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [consentSheet, setConsentSheet] = useState<'reenable' | 'withdraw' | null>(null)
  const [sheetBusy, setSheetBusy] = useState(false)

  // Fetch profile
  useEffect(() => {
    let cancelled = false
    fetch('/api/communication/parents/profile')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data: ParentProfile) => {
        if (cancelled) return
        setProfile(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const emailOn =
    profile?.notification_preference === 'email' ||
    profile?.notification_preference === 'both'
  const smsOn =
    profile?.notification_preference === 'sms' ||
    profile?.notification_preference === 'both'
  const smsLocked = !profile || !profile.sms_consent || !profile.phone

  async function patchPreference(newPref: 'sms' | 'email' | 'both') {
    if (!profile) return
    const prev = profile.notification_preference
    if (prev === newPref) return
    setProfile({ ...profile, notification_preference: newPref })
    setSaveError(null)
    setWarning(null)
    try {
      const res = await fetch('/api/communication/parents/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_preference: newPref }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
    } catch {
      // Revert
      setProfile((p) => (p ? { ...p, notification_preference: prev } : p))
      setSaveError("Couldn't save change — try again.")
    }
  }

  function handleEmailToggle() {
    if (!profile) return
    if (emailOn) {
      if (!smsOn) {
        setWarning('At least one channel must stay on.')
        return
      }
      patchPreference('sms')
    } else {
      patchPreference(smsOn ? 'both' : 'email')
    }
  }

  function handleSmsToggle() {
    if (!profile || smsLocked) return
    if (smsOn) {
      if (!emailOn) {
        setWarning('At least one channel must stay on.')
        return
      }
      patchPreference('email')
    } else {
      patchPreference(emailOn ? 'both' : 'sms')
    }
  }

  async function handleWithdrawSms() {
    if (!profile) return
    setSheetBusy(true)
    try {
      const res = await fetch('/api/parent/sms-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw' }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setProfile((p) =>
        p
          ? {
              ...p,
              sms_consent: false,
              sms_consent_at: null,
              notification_preference: data.notification_preference ?? 'email',
            }
          : p,
      )
      setConsentSheet(null)
    } catch {
      setSaveError("Couldn't update SMS consent — try again.")
    } finally {
      setSheetBusy(false)
    }
  }

  async function handleReenableSms() {
    if (!profile) return
    setSheetBusy(true)
    try {
      const res = await fetch('/api/parent/sms-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'consent' }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setProfile((p) =>
        p
          ? {
              ...p,
              sms_consent: true,
              notification_preference: data.notification_preference ?? 'both',
              sms_consent_at: new Date().toISOString(),
            }
          : p,
      )
      setConsentSheet(null)
    } catch {
      setSaveError("Couldn't update SMS consent — try again.")
    } finally {
      setSheetBusy(false)
    }
  }

  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-8">
      {/* Header */}
      <div className="px-4 pt-3 mb-2">
        <Link
          href="/p/more"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          More
        </Link>
      </div>
      <div className="px-4 mb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
      </div>

      {loading ? (
        <SettingsSkeleton />
      ) : loadError || !profile ? (
        <div className="mx-4 bg-[var(--bg-card)] rounded-xl p-5 text-center shadow-[var(--shadow)]">
          <p className="text-sm text-[var(--text-secondary)]">
            Couldn&apos;t load your settings. Pull down to retry, or check back in a moment.
          </p>
        </div>
      ) : (
        <>
          {/* Account */}
          <div className="mx-4 mb-5">
            <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">
              Account
            </p>
            <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden shadow-[var(--shadow)]">
              <div className="px-4 py-3 border-b border-[var(--border-primary)]">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">
                  Email
                </p>
                <p className="text-sm text-[var(--text-primary)] mt-0.5 break-all">
                  {profile.email}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">
                  Phone
                </p>
                <p className="text-sm text-[var(--text-primary)] mt-0.5">
                  {profile.phone ? maskPhone(profile.phone) : 'No phone on file'}
                </p>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="mx-4 mb-2">
            <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">
              Notifications
            </p>
            <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden shadow-[var(--shadow)]">
              {/* Email row */}
              <button
                type="button"
                onClick={handleEmailToggle}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 border-b border-[var(--border-primary)] active:bg-[var(--bg-card-alt)] transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">Email</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Game alerts and weekly recaps
                  </p>
                </div>
                <Toggle on={emailOn} />
              </button>

              {/* SMS row */}
              <button
                type="button"
                onClick={handleSmsToggle}
                disabled={smsLocked}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 active:bg-[var(--bg-card-alt)] transition-colors text-left disabled:active:bg-transparent"
              >
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      smsLocked ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    Text messages
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {!profile.phone
                      ? 'Add a phone number to enable SMS'
                      : !profile.sms_consent
                      ? `Turned off${
                          profile.sms_consent_at ? ` ${fmtDate(profile.sms_consent_at)}` : ''
                        }`
                      : 'Quick alerts to your phone'}
                  </p>
                </div>
                <Toggle on={smsOn} disabled={smsLocked} />
              </button>
            </div>

            {warning && (
              <p className="text-xs text-amber-500 mt-2 px-2">{warning}</p>
            )}
            {saveError && (
              <p className="text-xs text-red-500 mt-2 px-2">{saveError}</p>
            )}
          </div>

          {/* SMS consent management */}
          <div className="mx-4 mt-3">
            {profile.sms_consent ? (
              <button
                type="button"
                onClick={() => setConsentSheet('withdraw')}
                className="text-sm text-red-500 active:opacity-70 px-2 py-2"
              >
                Opt out of SMS notifications
              </button>
            ) : profile.phone ? (
              <button
                type="button"
                onClick={() => setConsentSheet('reenable')}
                className="text-sm text-[var(--accent)] active:opacity-70 px-2 py-2 font-semibold"
              >
                Re-enable SMS notifications
              </button>
            ) : null}
          </div>
        </>
      )}

      {/* Withdraw confirm */}
      <ConfirmSheet
        open={consentSheet === 'withdraw'}
        onClose={() => setConsentSheet(null)}
        title="Opt out of SMS?"
        description="You'll no longer get text alerts for game changes, schedule updates, or coach messages. Email notifications will continue."
        confirmLabel="Opt Out"
        confirmTone="destructive"
        onConfirm={handleWithdrawSms}
        busy={sheetBusy}
      />

      {/* Re-enable confirm with full TCPA text */}
      <ConfirmSheet
        open={consentSheet === 'reenable'}
        onClose={() => setConsentSheet(null)}
        title="Enable SMS notifications"
        description={
          <span className="text-left block">{SMS_CONSENT_TEXT}</span>
        }
        confirmLabel="I Agree"
        confirmTone="primary"
        onConfirm={handleReenableSms}
        busy={sheetBusy}
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        }
      />
    </div>
  )
}
