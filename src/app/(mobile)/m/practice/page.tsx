'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useMobile } from '@/app/(mobile)/MobileContext'
import type { PracticePlan } from '@/types/football'
import { DesktopRedirectCard } from '@/app/(mobile)/components/DesktopRedirectCard'
import { SAMPLE_PRACTICE_PLAN } from './sampleData'
import { OnboardingChecklist } from './OnboardingChecklist'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UpcomingGame {
  id: string
  opponent: string
  date: string
  location: string | null
  start_time: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

function formatPracticeDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatGameDate(dateStr: string, startTime: string | null): string {
  const formatted = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  if (!startTime) return formatted
  const [hours, minutes] = startTime.split(':')
  const d = new Date()
  d.setHours(Number(hours), Number(minutes), 0)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${formatted} at ${time}`
}

function getDaysUntilGame(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const gameDate = new Date(dateStr + 'T00:00:00')
  gameDate.setHours(0, 0, 0, 0)
  return Math.round((gameDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlanCard({ plan, isToday, isSample }: { plan: PracticePlan; isToday: boolean; isSample?: boolean }) {
  return (
    <Link
      href={`/m/practice/${plan.id}`}
      className={`block bg-[var(--bg-card)] rounded-xl overflow-hidden active:opacity-70 transition-opacity ${
        isToday ? 'ring-2 ring-[#B8CA6E]' : ''
      }`}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {isSample && (
                <span className="inline-flex items-center bg-[var(--bg-card-alt)] text-[var(--text-tertiary)] text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0">
                  SAMPLE
                </span>
              )}
              {isToday && !isSample && (
                <span className="inline-flex items-center bg-[#B8CA6E] text-[#1c1c1e] text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0">
                  TODAY
                </span>
              )}
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{plan.title}</p>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {plan.date && (
                <span className="text-xs text-[var(--text-secondary)]">{formatPracticeDate(plan.date)}</span>
              )}
              {plan.location && (
                <>
                  <span className="text-[var(--text-tertiary)] text-xs">·</span>
                  <span className="text-xs text-[var(--text-secondary)] truncate">{plan.location}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-card-alt)] rounded-full px-2 py-0.5">
              {plan.duration_minutes} min
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function NextGameCard({ game }: { game: UpcomingGame }) {
  const daysUntil = getDaysUntilGame(game.date)

  return (
    <div className="bg-[var(--bg-card)] rounded-xl px-4 py-3.5">
      <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Next Game</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">vs. {game.opponent}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{formatGameDate(game.date, game.start_time)}</p>
          {game.location && (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">{game.location}</p>
          )}
        </div>
        <div className="shrink-0">
          {daysUntil === 0 && (
            <span className="text-xs font-semibold bg-red-100 text-red-700 rounded-full px-2.5 py-1">Game Day</span>
          )}
          {daysUntil === 1 && (
            <span className="text-xs font-semibold bg-orange-100 text-orange-700 rounded-full px-2.5 py-1">Tomorrow</span>
          )}
          {daysUntil > 1 && daysUntil <= 7 && (
            <span className="text-xs font-semibold bg-[#B8CA6E]/15 text-[#5a6e00] rounded-full px-2.5 py-1">In {daysUntil} days</span>
          )}
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl px-4 py-3.5 animate-pulse">
      <div className="h-4 bg-[var(--bg-card-alt)] rounded w-2/3 mb-2" />
      <div className="h-3 bg-[var(--bg-card-alt)] rounded w-1/3" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MobilePracticePage() {
  const { teamId } = useMobile()

  const [plans, setPlans] = useState<PracticePlan[]>([])
  const [nextGame, setNextGame] = useState<UpcomingGame | null>(null)
  const [loading, setLoading] = useState(true)
  const [pastCollapsed, setPastCollapsed] = useState(true)

  const today = getTodayString()

  useEffect(() => {
    if (!teamId) return

    async function loadData() {
      setLoading(true)

      // Try cache first for instant display
      try {
        const cached = localStorage.getItem(`ych-practice-list-${teamId}`)
        if (cached) {
          setPlans(JSON.parse(cached))
          setLoading(false)
        }
      } catch {
        // Ignore localStorage errors
      }

      const supabase = createClient()

      // Fetch practice plans and next game in parallel
      const [plansResult, gameResult] = await Promise.all([
        supabase
          .from('practice_plans')
          .select('id, team_id, title, date, duration_minutes, location, notes, is_template, template_name, created_by, created_at, updated_at')
          .eq('team_id', teamId)
          .eq('is_template', false)
          .order('date', { ascending: false }),
        supabase
          .from('games')
          .select('id, opponent, date, location, start_time')
          .eq('team_id', teamId)
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(1)
          .single(),
      ])

      if (plansResult.data) {
        setPlans(plansResult.data as PracticePlan[])
        try {
          localStorage.setItem(`ych-practice-list-${teamId}`, JSON.stringify(plansResult.data))
        } catch {
          // Ignore
        }
      }

      if (gameResult.data) {
        setNextGame(gameResult.data as UpcomingGame)
      }

      setLoading(false)
    }

    loadData()
  }, [teamId, today])

  // Partition plans
  const todayPlan = plans.find(p => p.date === today)
  const upcomingPlans = plans.filter(p => p.date > today)
  const pastPlans = plans.filter(p => p.date < today)

  // Determine if next game is within 7 days
  const showNextGame =
    nextGame !== null &&
    getDaysUntilGame(nextGame.date) >= 0 &&
    getDaysUntilGame(nextGame.date) <= 7

  if (loading && plans.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
        <div className="px-4 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Practice</h1>
        </div>
        <div className="px-4 space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (!loading && plans.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
        <div className="px-4 pt-12 pb-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Practice</h1>
        </div>
        <div className="px-4 space-y-3">
          <OnboardingChecklist />
          {showNextGame && nextGame && <NextGameCard game={nextGame} />}
          <DesktopRedirectCard
            feature="Create Practice Plans"
            description="Build practice plans on desktop — they sync here automatically."
            url={teamId ? `/football/teams/${teamId}/practice` : '/dashboard'}
            actionLabel="Open on desktop"
          />
          <PlanCard plan={SAMPLE_PRACTICE_PLAN} isToday={false} isSample />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Practice</h1>
      </div>

      <div className="px-4 space-y-3">
        <OnboardingChecklist />

        {/* Next Game card */}
        {showNextGame && nextGame && <NextGameCard game={nextGame} />}

        {/* Today's Practice */}
        {todayPlan && (
          <div>
            <PlanCard plan={todayPlan} isToday={true} />
          </div>
        )}

        {/* Upcoming */}
        {upcomingPlans.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-1 mb-2">
              Upcoming
            </p>
            <div className="space-y-2">
              {upcomingPlans.map(plan => (
                <PlanCard key={plan.id} plan={plan} isToday={false} />
              ))}
            </div>
          </div>
        )}

        {/* Past */}
        {pastPlans.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setPastCollapsed(prev => !prev)}
              className="flex items-center gap-2 px-1 mb-2 active:opacity-60"
            >
              <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                Past ({pastPlans.length})
              </p>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={`text-[var(--text-tertiary)] transition-transform ${pastCollapsed ? '' : 'rotate-180'}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {!pastCollapsed && (
              <div className="space-y-2">
                {pastPlans.map(plan => (
                  <PlanCard key={plan.id} plan={plan} isToday={false} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
