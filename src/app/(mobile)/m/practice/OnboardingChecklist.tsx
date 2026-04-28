'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMobile } from '@/app/(mobile)/MobileContext'

// localStorage keys
const dismissKey = (teamId: string) => `ych-onboarding-dismissed-${teamId}`
const playbookKey = (teamId: string) => `ych-coach-viewed-playbook-${teamId}`
const gameKey = (teamId: string) => `ych-coach-viewed-game-${teamId}`
const practiceBuilderKey = (teamId: string) => `ych-coach-tapped-practice-builder-${teamId}`

interface Counts {
  playerCount: number
  parentCount: number
  eventCount: number
}

type ItemKey =
  | 'players'
  | 'parents'
  | 'schedule'
  | 'playbook'
  | 'practiceBuilder'
  | 'game'

interface ItemConfig {
  key: ItemKey
  title: string
  subtitle: string
  isComplete: boolean
  isExternal: boolean
  onTap: () => void
}

export function OnboardingChecklist() {
  const router = useRouter()
  const { teamId, players } = useMobile()

  const [counts, setCounts] = useState<Counts | null>(null)
  const [dismissed, setDismissed] = useState(false)
  // Bump on tap-to-complete actions so the row's checkmark refreshes
  // without a full re-fetch.
  const [localCompletionTick, setLocalCompletionTick] = useState(0)

  // Hydrate dismissal flag and counts on mount
  useEffect(() => {
    if (!teamId) return

    try {
      if (localStorage.getItem(dismissKey(teamId)) === '1') {
        setDismissed(true)
        return
      }
    } catch {}

    let cancelled = false
    fetch(`/api/teams/${teamId}/onboarding-status`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data: Counts) => {
        if (!cancelled) setCounts(data)
      })
      .catch(() => {
        // Soft-fail — checklist disappears if we can't load counts. Player count
        // from MobileContext keeps working below as a fallback signal.
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  // localStorage-backed completion checks for the discover items
  const localFlags = useMemo(() => {
    if (!teamId) {
      return { viewedPlaybook: false, viewedGame: false, tappedPracticeBuilder: false }
    }
    try {
      return {
        viewedPlaybook: localStorage.getItem(playbookKey(teamId)) === '1',
        viewedGame: localStorage.getItem(gameKey(teamId)) === '1',
        tappedPracticeBuilder: localStorage.getItem(practiceBuilderKey(teamId)) === '1',
      }
    } catch {
      return { viewedPlaybook: false, viewedGame: false, tappedPracticeBuilder: false }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, localCompletionTick])

  if (!teamId || dismissed) return null

  // Player count comes from MobileContext (already loaded). Other counts
  // come from the onboarding-status fetch — gate on those being available.
  const playerCount = players.length
  const parentCount = counts?.parentCount ?? 0
  const eventCount = counts?.eventCount ?? 0

  // Don't render until we have counts (prevents a flicker where everything
  // looks incomplete for a beat).
  if (!counts) return null

  function handleDismiss() {
    if (!teamId) return
    try {
      localStorage.setItem(dismissKey(teamId), '1')
    } catch {}
    setDismissed(true)
  }

  function openDesktopUrl(path: string) {
    window.open(path, '_blank', 'noopener')
  }

  function tapPracticeBuilder() {
    if (!teamId) return
    try {
      localStorage.setItem(practiceBuilderKey(teamId), '1')
    } catch {}
    setLocalCompletionTick((t) => t + 1)
    openDesktopUrl(`/football/teams/${teamId}/practice`)
  }

  const items: ItemConfig[] = [
    {
      key: 'players',
      title: 'Add your players',
      subtitle: 'Build your roster',
      isComplete: playerCount > 0,
      isExternal: false,
      onTap: () => router.push('/m/roster'),
    },
    {
      key: 'parents',
      title: 'Invite parents',
      subtitle: 'Send your families a link to join',
      isComplete: parentCount > 0,
      isExternal: true,
      onTap: () => openDesktopUrl(`/football/teams/${teamId}/communication/parents`),
    },
    {
      key: 'schedule',
      title: 'Add a schedule',
      subtitle: 'Practices, games, and team events',
      isComplete: eventCount > 0,
      isExternal: true,
      onTap: () => openDesktopUrl(`/football/teams/${teamId}/schedule`),
    },
    {
      key: 'playbook',
      title: 'Explore your playbook',
      subtitle: 'See your sample plays — then build your own',
      isComplete: localFlags.viewedPlaybook,
      isExternal: false,
      onTap: () => router.push('/m/playbook'),
    },
    {
      key: 'practiceBuilder',
      title: 'Set up practice plans',
      subtitle: 'Build drills and practice schedules for your team',
      isComplete: localFlags.tappedPracticeBuilder,
      isExternal: true,
      onTap: tapPracticeBuilder,
    },
    {
      key: 'game',
      title: 'Explore game day tools',
      subtitle:
        'Get real-time play suggestions, capture live stats, and power your post-game reports — all from the sideline.',
      isComplete: localFlags.viewedGame,
      isExternal: false,
      onTap: () => router.push('/m/sideline'),
    },
  ]

  const completedCount = items.filter((i) => i.isComplete).length
  const total = items.length

  // Auto-graduate when everything is done
  if (completedCount === total) return null

  const progressPct = Math.round((completedCount / total) * 100)

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl px-4 pt-4 pb-2 shadow-[var(--shadow)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Get started</p>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
            {completedCount} of {total} complete
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss onboarding checklist"
          className="w-8 h-8 -mr-1 flex items-center justify-center rounded-full text-[var(--text-tertiary)] active:bg-[var(--bg-card-alt)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-[var(--bg-pill-inactive)] overflow-hidden mb-3">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Items */}
      <ul>
        {items.map((item, i) => (
          <li
            key={item.key}
            className={i < items.length - 1 ? 'border-b border-[var(--border-primary)]' : ''}
          >
            <button
              type="button"
              onClick={item.onTap}
              className="w-full flex items-center gap-3 py-3 text-left active:bg-[var(--bg-card-alt)] transition-colors -mx-2 px-2 rounded-lg"
            >
              {/* Checkmark / open ring */}
              {item.isComplete ? (
                <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-text)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-[var(--text-tertiary)] shrink-0" />
              )}

              {/* Title + subtitle */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    item.isComplete ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  {item.title}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5 leading-snug">
                  {item.subtitle}
                </p>
              </div>

              {/* Trailing icon — chevron for in-app, external link for desktop */}
              <div className="shrink-0 text-[var(--text-tertiary)]">
                {item.isExternal ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
