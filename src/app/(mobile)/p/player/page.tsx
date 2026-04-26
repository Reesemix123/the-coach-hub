'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParent } from '../ParentContext'
import { EmptyState } from '@/app/(mobile)/components/EmptyState'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AthleteProfile {
  id: string
  firstName: string
  lastName: string
  photoUrl: string | null
  graduationYear: number | null
}

interface AthleteSeason {
  id: string
  year: number
  sport: string
  teamName: string
  position: string | null
  jerseyNumber: string | null
}

interface ReportItem {
  id: string
  seasonId: string
  gameId: string | null
  opponent: string | null
  gameDate: string | null
  reportType: string
  statsSnapshot: Record<string, unknown> | null
  aiNarrativeParent: string | null
  publishedAt: string | null
  createdAt: string
  locked: boolean
}

interface ProfileResponse {
  profile: AthleteProfile
  seasons: AthleteSeason[]
}

interface ReportsResponse {
  reports: ReportItem[]
  locked: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  return new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Position-aware stat aggregation across published reports for the season.
// Returns top-line (games, grade) plus a list of stat cards driven by which
// sub-objects in stats_snapshot are populated. Only positive framings.
interface StatCard {
  label: string
  value: string
}

interface AggregatedStats {
  gamesPlayed: number
  avgGrade: number | null
  cards: StatCard[]
}

function aggregateStats(reports: ReportItem[]): AggregatedStats {
  const snapshots = reports
    .map((r) => r.statsSnapshot)
    .filter((s): s is Record<string, unknown> => s != null)

  if (snapshots.length === 0) {
    return { gamesPlayed: 0, avgGrade: null, cards: [] }
  }

  const grades = snapshots
    .map((s) => s.position_grade as number | undefined)
    .filter((g): g is number => typeof g === 'number')
  const avgGrade = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : null
  const unit = snapshots[0]?.unit as string | undefined

  const cards: StatCard[] = []

  // Passing — surface only when this athlete actually threw passes
  const passAttempts = snapshots.reduce((sum, s) => {
    const p = s.as_passer as { attempts?: number } | undefined
    return sum + (p?.attempts ?? 0)
  }, 0)
  if (passAttempts > 0) {
    const completions = snapshots.reduce((sum, s) => {
      const p = s.as_passer as { completions?: number } | undefined
      return sum + (p?.completions ?? 0)
    }, 0)
    const passYards = snapshots.reduce((sum, s) => {
      const p = s.as_passer as { yards?: number } | undefined
      return sum + (p?.yards ?? 0)
    }, 0)
    const passTds = snapshots.reduce((sum, s) => {
      const p = s.as_passer as { touchdowns?: number } | undefined
      return sum + (p?.touchdowns ?? 0)
    }, 0)
    cards.push({ label: 'Comp/Att', value: `${completions}/${passAttempts}` })
    cards.push({ label: 'Pass Yds', value: String(passYards) })
    cards.push({ label: 'Pass TD', value: String(passTds) })
  }

  // Rushing
  const carries = snapshots.reduce((sum, s) => {
    const c = s.as_ball_carrier as { carries?: number } | undefined
    return sum + (c?.carries ?? 0)
  }, 0)
  if (carries > 0) {
    const rushYards = snapshots.reduce((sum, s) => {
      const c = s.as_ball_carrier as { yards?: number } | undefined
      return sum + (c?.yards ?? 0)
    }, 0)
    const rushTds = snapshots.reduce((sum, s) => {
      const c = s.as_ball_carrier as { touchdowns?: number } | undefined
      return sum + (c?.touchdowns ?? 0)
    }, 0)
    cards.push({ label: 'Carries', value: String(carries) })
    cards.push({ label: 'Rush Yds', value: String(rushYards) })
    cards.push({ label: 'Rush TD', value: String(rushTds) })
  }

  // Receiving
  const targets = snapshots.reduce((sum, s) => {
    const r = s.as_receiver as { targets?: number } | undefined
    return sum + (r?.targets ?? 0)
  }, 0)
  if (targets > 0) {
    const receptions = snapshots.reduce((sum, s) => {
      const r = s.as_receiver as { receptions?: number } | undefined
      return sum + (r?.receptions ?? 0)
    }, 0)
    const recYards = snapshots.reduce((sum, s) => {
      const r = s.as_receiver as { yards?: number } | undefined
      return sum + (r?.yards ?? 0)
    }, 0)
    const recTds = snapshots.reduce((sum, s) => {
      const r = s.as_receiver as { touchdowns?: number } | undefined
      return sum + (r?.touchdowns ?? 0)
    }, 0)
    cards.push({ label: 'Targets', value: String(targets) })
    cards.push({ label: 'Rec', value: String(receptions) })
    cards.push({ label: 'Rec Yds', value: String(recYards) })
    cards.push({ label: 'Rec TD', value: String(recTds) })
  }

  // O-line — snaps + block win %, no pressures-allowed (negative frame)
  if (unit === 'offense_oline') {
    const totalHeld = snapshots.reduce((sum, s) => {
      const br = s.block_results as { held?: number } | undefined
      return sum + (br?.held ?? 0)
    }, 0)
    const totalSnaps = snapshots.reduce((sum, s) => {
      const br = s.block_results as
        | { held?: number; pushed_back?: number; beaten?: number; penalty?: number }
        | undefined
      return (
        sum +
        (br?.held ?? 0) +
        (br?.pushed_back ?? 0) +
        (br?.beaten ?? 0) +
        (br?.penalty ?? 0)
      )
    }, 0)
    if (totalSnaps > 0) {
      cards.push({ label: 'Snaps', value: String(totalSnaps) })
      cards.push({
        label: 'Block Win %',
        value: `${Math.round((totalHeld / totalSnaps) * 100)}%`,
      })
    }
  }

  // Defense — total tackles, takeaways, sacks (positive only)
  if (unit === 'defense') {
    const tackles = snapshots.reduce((sum, s) => {
      const t = s.tackles as { primary?: number; assist?: number } | undefined
      return sum + (t?.primary ?? 0) + (t?.assist ?? 0)
    }, 0)
    const takeaways = snapshots.reduce(
      (sum, s) => sum + ((s.turnovers_created as number) ?? 0),
      0,
    )
    const sacks = snapshots.reduce((sum, s) => sum + ((s.sacks as number) ?? 0), 0)
    cards.push({ label: 'Tackles', value: String(tackles) })
    cards.push({ label: 'Takeaways', value: String(takeaways) })
    if (sacks > 0) cards.push({ label: 'Sacks', value: String(sacks) })
  }

  // Special teams — kicker + returner
  if (unit === 'special_teams') {
    const kMade = snapshots.reduce((sum, s) => {
      const k = s.as_kicker as { made?: number } | undefined
      return sum + (k?.made ?? 0)
    }, 0)
    const kAtt = snapshots.reduce((sum, s) => {
      const k = s.as_kicker as { attempts?: number } | undefined
      return sum + (k?.attempts ?? 0)
    }, 0)
    if (kAtt > 0) cards.push({ label: 'FG', value: `${kMade}/${kAtt}` })

    const longestPunt = snapshots.reduce((max, s) => {
      const k = s.as_kicker as { longest_punt?: number } | undefined
      return Math.max(max, k?.longest_punt ?? 0)
    }, 0)
    if (longestPunt > 0) cards.push({ label: 'Longest Punt', value: `${longestPunt} yd` })

    const retYards = snapshots.reduce((sum, s) => {
      const r = s.as_returner as { yards?: number } | undefined
      return sum + (r?.yards ?? 0)
    }, 0)
    const retTds = snapshots.reduce((sum, s) => {
      const r = s.as_returner as { touchdowns?: number } | undefined
      return sum + (r?.touchdowns ?? 0)
    }, 0)
    if (retYards > 0) cards.push({ label: 'Return Yds', value: String(retYards) })
    if (retTds > 0) cards.push({ label: 'Return TD', value: String(retTds) })
  }

  return { gamesPlayed: snapshots.length, avgGrade, cards }
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero({
  profile,
  selectedSeason,
}: {
  profile: AthleteProfile
  selectedSeason: AthleteSeason | null
}) {
  return (
    <div className="px-4 pt-6 pb-5">
      <div className="bg-gradient-to-b from-[var(--bg-card)] to-[var(--bg-card-alt)] rounded-2xl p-6 shadow-[var(--shadow)]">
        <div className="flex flex-col items-center text-center">
          {/* Avatar */}
          {profile.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt=""
              className="w-24 h-24 rounded-full object-cover ring-4 ring-[var(--bg-card)] shadow-md"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[var(--bg-pill-inactive)] flex items-center justify-center ring-4 ring-[var(--bg-card)] shadow-md">
              <span className="text-2xl font-bold text-[var(--text-secondary)]">
                {initials(profile.firstName, profile.lastName)}
              </span>
            </div>
          )}

          {/* Name */}
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-3">
            {profile.firstName} {profile.lastName}
          </h1>

          {/* Subtitle: team · position · #jersey from selected season */}
          {selectedSeason && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {[
                selectedSeason.teamName,
                selectedSeason.position,
                selectedSeason.jerseyNumber ? `#${selectedSeason.jerseyNumber}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          {/* Graduation pill */}
          {profile.graduationYear && (
            <span className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-pill-inactive)] text-xs font-semibold text-[var(--text-secondary)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
              Class of {profile.graduationYear}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Season pills
// ---------------------------------------------------------------------------

function SeasonPills({
  seasons,
  selectedId,
  onSelect,
}: {
  seasons: AthleteSeason[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (seasons.length === 0) return null
  return (
    <div className="px-4 mb-3">
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [&::-webkit-scrollbar]:hidden">
        {seasons.map((s) => {
          const active = s.id === selectedId
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                active
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                  : 'bg-[var(--bg-pill-inactive)] text-[var(--text-secondary)] active:opacity-70'
              }`}
            >
              {s.year} {titleCase(s.sport)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat grid
// ---------------------------------------------------------------------------

function StatGrid({ stats }: { stats: AggregatedStats }) {
  if (stats.gamesPlayed === 0) {
    return (
      <div className="px-4 mb-5">
        <div className="bg-[var(--bg-card)] rounded-xl p-5 text-center shadow-[var(--shadow)]">
          <p className="text-sm text-[var(--text-secondary)]">
            Stats will appear as your coach shares game reports.
          </p>
        </div>
      </div>
    )
  }

  const topLine: StatCard[] = [
    { label: 'Games', value: String(stats.gamesPlayed) },
  ]
  if (stats.avgGrade != null) {
    topLine.push({ label: 'Avg Grade', value: stats.avgGrade.toFixed(1) })
  }
  const allCards = [...topLine, ...stats.cards]

  return (
    <div className="px-4 mb-5">
      <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">
        Season Stats
      </p>
      <div className="grid grid-cols-3 gap-2">
        {allCards.map((card) => (
          <div
            key={card.label}
            className="bg-[var(--bg-card)] rounded-xl p-3 shadow-[var(--shadow)] flex flex-col"
          >
            <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{card.value}</p>
            <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mt-0.5">
              {card.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function ReportCard({ report }: { report: ReportItem }) {
  const [expanded, setExpanded] = useState(false)
  const grade = (report.statsSnapshot?.position_grade as number | undefined) ?? null
  const narrative = report.aiNarrativeParent
  const excerpt = narrative ? narrative.slice(0, 140) + (narrative.length > 140 ? '…' : '') : null

  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className="w-full text-left bg-[var(--bg-card)] rounded-xl p-3.5 shadow-[var(--shadow)] active:opacity-80 transition-opacity"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {report.opponent ? `vs ${report.opponent}` : titleCase(report.reportType.replace('_', ' '))}
          </p>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
            {fmtDate(report.gameDate ?? report.publishedAt ?? report.createdAt)}
          </p>
        </div>
        {grade != null && (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[var(--bg-pill-inactive)] text-xs font-bold text-[var(--text-primary)] tabular-nums">
            {grade.toFixed(1)}
          </span>
        )}
      </div>

      {/* Narrative — collapsed excerpt or expanded full */}
      {report.locked ? (
        <div className="mt-2.5 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
          Subscribe to read your coach&apos;s notes
        </div>
      ) : narrative ? (
        <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed whitespace-pre-wrap">
          {expanded ? narrative : excerpt}
        </p>
      ) : null}
    </button>
  )
}

function ReportsList({ reports }: { reports: ReportItem[] }) {
  if (reports.length === 0) {
    return (
      <div className="px-4 mb-5">
        <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">
          Reports
        </p>
        <div className="bg-[var(--bg-card)] rounded-xl p-5 text-center shadow-[var(--shadow)]">
          <p className="text-sm text-[var(--text-secondary)]">
            Game reports will appear here as your coach shares them.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="px-4 mb-5">
      <p className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-2">
        Reports
      </p>
      <div className="space-y-2">
        {reports.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function HeroSkeleton() {
  return (
    <div className="px-4 pt-6 pb-5">
      <div className="bg-[var(--bg-card)] rounded-2xl p-6 shadow-[var(--shadow)] animate-pulse">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-[var(--bg-card-alt)]" />
          <div className="h-6 w-40 bg-[var(--bg-card-alt)] rounded mt-3" />
          <div className="h-4 w-32 bg-[var(--bg-card-alt)] rounded mt-2" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ParentPlayerPage() {
  const { currentAthleteProfileId, loading: parentLoading } = useParent()

  const [profile, setProfile] = useState<AthleteProfile | null>(null)
  const [seasons, setSeasons] = useState<AthleteSeason[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState(false)

  const [reports, setReports] = useState<ReportItem[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)

  // Fetch profile + seasons when athlete changes
  useEffect(() => {
    if (!currentAthleteProfileId) {
      setProfile(null)
      setSeasons([])
      setSelectedSeasonId(null)
      setProfileLoading(false)
      return
    }
    let cancelled = false
    setProfileLoading(true)
    setProfileError(false)
    fetch(`/api/parent/athletes/${currentAthleteProfileId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data: ProfileResponse) => {
        if (cancelled) return
        setProfile(data.profile)
        setSeasons(data.seasons)
        setSelectedSeasonId(data.seasons[0]?.id ?? null)
        setProfileLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setProfileError(true)
        setProfileLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentAthleteProfileId])

  // Fetch reports when selected season changes
  useEffect(() => {
    if (!currentAthleteProfileId || !selectedSeasonId) {
      setReports([])
      return
    }
    let cancelled = false
    setReportsLoading(true)
    fetch(
      `/api/parent/athletes/${currentAthleteProfileId}/reports?seasonId=${selectedSeasonId}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data: ReportsResponse) => {
        if (cancelled) return
        setReports(data.reports ?? [])
        setReportsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setReports([])
        setReportsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentAthleteProfileId, selectedSeasonId])

  const selectedSeason = useMemo(
    () => seasons.find((s) => s.id === selectedSeasonId) ?? null,
    [seasons, selectedSeasonId],
  )

  const stats = useMemo(() => aggregateStats(reports), [reports])

  // Empty state — no athlete profile linked yet
  if (!parentLoading && !currentAthleteProfileId) {
    return (
      <div className="min-h-full bg-[var(--bg-primary)] pb-4">
        <div className="px-4 pt-6 pb-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Player</h1>
        </div>
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          }
          title="No athlete profile yet"
          description="Once your coach adds your athlete to a roster, their profile will appear here."
        />
      </div>
    )
  }

  if (parentLoading || profileLoading) {
    return (
      <div className="min-h-full bg-[var(--bg-primary)] pb-4">
        <HeroSkeleton />
      </div>
    )
  }

  if (profileError || !profile) {
    return (
      <div className="min-h-full bg-[var(--bg-primary)] pb-4">
        <div className="px-4 pt-6 pb-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Player</h1>
        </div>
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          }
          title="Couldn't load profile"
          description="Pull down to retry, or check back in a moment."
        />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-6">
      <Hero profile={profile} selectedSeason={selectedSeason} />
      <SeasonPills
        seasons={seasons}
        selectedId={selectedSeasonId}
        onSelect={setSelectedSeasonId}
      />
      {reportsLoading ? (
        <div className="px-4 mb-5">
          <div className="bg-[var(--bg-card)] rounded-xl h-24 animate-pulse" />
        </div>
      ) : (
        <>
          <StatGrid stats={stats} />
          <ReportsList reports={reports} />
        </>
      )}
    </div>
  )
}
