'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useParent } from '../ParentContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Coach {
  id: string
  name: string
  role: string
}

interface ParentChild {
  player_name: string
  jersey_number: number | null
}

interface ParentEntry {
  id: string
  first_name: string
  last_name: string
  children: ParentChild[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
}

function coachRoleLabel(role: string): string {
  if (role === 'owner') return 'Head Coach'
  if (role === 'team_admin') return 'Team Admin'
  return 'Coach'
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ name, isCoach }: { name: string; isCoach?: boolean }) {
  return (
    <div className="w-10 h-10 rounded-full bg-[var(--bg-pill-inactive)] flex items-center justify-center shrink-0">
      {isCoach ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-[var(--accent)]"
        >
          <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </svg>
      ) : (
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          {initials(name)}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function CoachRow({ coach, onTap }: { coach: Coach; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)] last:border-b-0 active:bg-[var(--bg-card-alt)] transition-colors text-left"
    >
      <Avatar name={coach.name} isCoach />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {coach.name}
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          {coachRoleLabel(coach.role)}
        </p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)] shrink-0">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}

function ParentRow({
  parent,
  tappable,
  onTap,
}: {
  parent: ParentEntry
  tappable: boolean
  onTap: () => void
}) {
  const fullName = `${parent.first_name} ${parent.last_name}`.trim()
  const sortedChildren = [...parent.children].sort(
    (a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999),
  )
  const childLine =
    sortedChildren.length === 0
      ? null
      : sortedChildren
          .map((c) =>
            c.jersey_number != null ? `#${c.jersey_number} ${c.player_name}` : c.player_name,
          )
          .join(', ')

  const content = (
    <>
      <Avatar name={fullName} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {fullName}
        </p>
        {childLine && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
            {childLine}
          </p>
        )}
      </div>
      {tappable && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-tertiary)] shrink-0">
          <path d="M9 18l6-6-6-6" />
        </svg>
      )}
    </>
  )

  if (tappable) {
    return (
      <button
        type="button"
        onClick={onTap}
        className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)] last:border-b-0 active:bg-[var(--bg-card-alt)] transition-colors text-left"
      >
        {content}
      </button>
    )
  }
  return (
    <div className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)] last:border-b-0">
      {content}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden animate-pulse">
      {[...Array(rows)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)] last:border-b-0"
        >
          <div className="w-10 h-10 rounded-full bg-[var(--bg-card-alt)]" />
          <div className="flex-1">
            <div className="h-3.5 w-32 bg-[var(--bg-card-alt)] rounded mb-2" />
            <div className="h-3 w-20 bg-[var(--bg-card-alt)] rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ParentDirectoryPage() {
  const router = useRouter()
  const { currentTeamId, loading: parentLoading } = useParent()

  const [coaches, setCoaches] = useState<Coach[]>([])
  const [parents, setParents] = useState<ParentEntry[]>([])
  const [allowP2P, setAllowP2P] = useState(true)
  const [myParentId, setMyParentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!currentTeamId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)

    Promise.all([
      fetch(`/api/teams/${currentTeamId}/coaches`)
        .then((r) => (r.ok ? r.json() : { coaches: [] }))
        .catch(() => ({ coaches: [] })),
      fetch(`/api/communication/parents/roster?teamId=${currentTeamId}`)
        .then((r) => (r.ok ? r.json() : { parents: [] }))
        .catch(() => ({ parents: [] })),
      fetch(`/api/communication/settings?teamId=${currentTeamId}`)
        .then((r) => (r.ok ? r.json() : { settings: {} }))
        .catch(() => ({ settings: {} })),
      fetch('/api/communication/parents/profile')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([coachData, rosterData, settingsData, profileData]) => {
        if (cancelled) return
        setCoaches(coachData.coaches ?? [])
        const allParents: ParentEntry[] = rosterData.parents ?? []
        // Sort by last name
        allParents.sort((a, b) =>
          a.last_name.localeCompare(b.last_name) ||
          a.first_name.localeCompare(b.first_name),
        )
        setParents(allParents)
        setAllowP2P(settingsData.settings?.allow_parent_to_parent_messaging ?? true)
        setMyParentId(profileData?.id ?? null)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentTeamId])

  const otherParents = parents.filter((p) => p.id !== myParentId)

  function handleCoachTap(coach: Coach) {
    const params = new URLSearchParams({
      to: coach.id,
      type: 'coach',
      name: coach.name,
    })
    router.push(`/p/messages?${params.toString()}`)
  }

  function handleParentTap(parent: ParentEntry) {
    if (!allowP2P) return
    const fullName = `${parent.first_name} ${parent.last_name}`.trim()
    const params = new URLSearchParams({
      to: parent.id,
      type: 'parent',
      name: fullName,
    })
    router.push(`/p/messages?${params.toString()}`)
  }

  // No-team empty state
  if (!parentLoading && !currentTeamId) {
    return (
      <div className="min-h-full bg-[var(--bg-primary)] pb-8">
        <div className="px-4 pt-3 mb-2">
          <Link
            href="/p/more"
            className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
            More
          </Link>
        </div>
        <div className="px-4 mb-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Team Directory</h1>
        </div>
        <div className="mx-4 bg-[var(--bg-card)] rounded-xl p-5 text-center shadow-[var(--shadow)]">
          <p className="text-sm text-[var(--text-secondary)]">
            Once you join a team, your coaches and other parents will show up here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-8">
      {/* Header */}
      <div className="px-4 pt-3 mb-2">
        <Link
          href="/p/more"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] active:text-[var(--text-primary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          More
        </Link>
      </div>
      <div className="px-4 mb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Team Directory</h1>
      </div>

      {error ? (
        <div className="mx-4 bg-[var(--bg-card)] rounded-xl p-5 text-center shadow-[var(--shadow)]">
          <p className="text-sm text-[var(--text-secondary)]">
            Couldn&apos;t load the directory. Try again in a moment.
          </p>
        </div>
      ) : (
        <>
          {/* Coaching staff */}
          <div className="mx-4 mb-5">
            <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">
              Coaching Staff
            </p>
            {loading ? (
              <SectionSkeleton rows={2} />
            ) : coaches.length === 0 ? (
              <div className="bg-[var(--bg-card)] rounded-xl p-5 text-center shadow-[var(--shadow)]">
                <p className="text-sm text-[var(--text-secondary)]">
                  Coaching staff will appear here once added.
                </p>
              </div>
            ) : (
              <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden shadow-[var(--shadow)]">
                {coaches.map((c) => (
                  <CoachRow key={c.id} coach={c} onTap={() => handleCoachTap(c)} />
                ))}
              </div>
            )}
          </div>

          {/* Other parents */}
          <div className="mx-4 mb-5">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider">
                Other Parents
              </p>
              {!loading && otherParents.length > 0 && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  {otherParents.length}
                </p>
              )}
            </div>
            {loading ? (
              <SectionSkeleton rows={4} />
            ) : otherParents.length === 0 ? (
              <div className="bg-[var(--bg-card)] rounded-xl p-5 text-center shadow-[var(--shadow)]">
                <p className="text-sm text-[var(--text-secondary)]">
                  No other parents on this team yet.
                </p>
              </div>
            ) : (
              <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden shadow-[var(--shadow)]">
                {otherParents.map((p) => (
                  <ParentRow
                    key={p.id}
                    parent={p}
                    tappable={allowP2P}
                    onTap={() => handleParentTap(p)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
