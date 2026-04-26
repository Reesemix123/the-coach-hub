'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useMobile } from '@/app/(mobile)/MobileContext'
import { SAMPLE_PRACTICE_PLAN } from '../sampleData'
import type {
  PracticePlanWithDetails,
  PracticePeriodWithDrills,
  PracticeDrill,
  LivePracticeSession,
} from '@/types/football'

// ---------------------------------------------------------------------------
// Alarm & Vibration Utilities
// ---------------------------------------------------------------------------

function playAlarm() {
  try {
    const ctx = new AudioContext()
    for (const [freq, delay] of [[880, 0], [1100, 0.15]] as [number, number][]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + 0.3)
    }
  } catch {
    // AudioContext not available
  }
}

function vibrateDevice() {
  try {
    navigator.vibrate([200, 100, 200])
  } catch {
    // Vibration API not available
  }
}

// ---------------------------------------------------------------------------
// Period type color map
// ---------------------------------------------------------------------------

const PERIOD_COLORS: Record<string, { bg: string; text: string; banner: string }> = {
  warmup: { bg: 'bg-yellow-100', text: 'text-yellow-800', banner: 'bg-yellow-50' },
  drill: { bg: 'bg-blue-100', text: 'text-blue-800', banner: 'bg-blue-50' },
  team: { bg: 'bg-purple-100', text: 'text-purple-800', banner: 'bg-purple-50' },
  special_teams: { bg: 'bg-green-100', text: 'text-green-800', banner: 'bg-green-50' },
  conditioning: { bg: 'bg-red-100', text: 'text-red-800', banner: 'bg-red-50' },
  other: { bg: 'bg-[var(--bg-card-alt)]', text: 'text-gray-800', banner: 'bg-[var(--bg-card-alt)]' },
}

function getPeriodColors(periodType: string) {
  return PERIOD_COLORS[periodType] ?? PERIOD_COLORS.other
}

// ---------------------------------------------------------------------------
// DrillRow — individual drill item in expanded view
// ---------------------------------------------------------------------------

function DrillRow({ drill }: { drill: PracticeDrill }) {
  return (
    <div className="py-2.5 border-b border-gray-50 last:border-b-0">
      <p className="text-sm font-medium text-[var(--text-primary)]">{drill.drill_name}</p>
      {drill.description && (
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{drill.description}</p>
      )}
      <div className="flex gap-1.5 mt-1.5 flex-wrap">
        {drill.position_group && drill.position_group !== 'All' && (
          <span className="text-[10px] bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 font-medium">
            {drill.position_group}
          </span>
        )}
        {drill.equipment_needed && (
          <span className="text-[10px] bg-[var(--bg-card-alt)] text-[var(--text-secondary)] rounded-full px-2 py-0.5">
            {drill.equipment_needed}
          </span>
        )}
        {drill.play_codes &&
          drill.play_codes.map(code => (
            <span
              key={code}
              className="text-[10px] bg-purple-50 text-purple-700 rounded-full px-2 py-0.5 font-medium"
            >
              {code}
            </span>
          ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PeriodCard — manages its own expanded state (must NOT be inside .map inline)
// ---------------------------------------------------------------------------

interface PeriodCardProps {
  period: PracticePeriodWithDrills
  index: number
  isActive: boolean
  activePeriodRef: React.RefCallback<HTMLDivElement>
}

function PeriodCard({ period, isActive, activePeriodRef }: PeriodCardProps) {
  const [expanded, setExpanded] = useState(false)
  const colors = getPeriodColors(period.period_type)

  return (
    <div
      ref={isActive ? activePeriodRef : undefined}
      className={`bg-[var(--bg-card)] rounded-xl overflow-hidden transition-all ${
        isActive ? 'ring-2 ring-[#B8CA6E] shadow-md' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left active:bg-[var(--bg-card-alt)]"
      >
        <span
          className={`text-xs font-semibold rounded-full px-2 py-0.5 shrink-0 ${colors.bg} ${colors.text}`}
        >
          {period.period_type.replace('_', ' ')}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{period.name}</p>
        </div>
        <span className="text-xs text-[var(--text-secondary)] shrink-0">{period.duration_minutes}m</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-[var(--text-tertiary)] shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-[var(--border-primary)]">
          {period.notes && (
            <p className="text-xs text-[var(--text-secondary)] py-2 border-b border-gray-50">{period.notes}</p>
          )}
          {period.drills.length > 0 ? (
            period.drills.map(drill => <DrillRow key={drill.id} drill={drill} />)
          ) : (
            <p className="text-xs text-[var(--text-tertiary)] py-2 italic">No drills listed for this period</p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TimerBanner — sticky live session banner
// ---------------------------------------------------------------------------

interface TimerBannerProps {
  session: LivePracticeSession
  currentPeriod: PracticePeriodWithDrills
  timerDisplay: string
  timerPulse: boolean
  showUpNext: boolean
  upNextName: string
  onTogglePause: () => void
  onNextPeriod: () => void
  onEndRequest: () => void
}

function TimerBanner({
  session,
  currentPeriod,
  timerDisplay,
  timerPulse,
  showUpNext,
  upNextName,
  onTogglePause,
  onNextPeriod,
  onEndRequest,
}: TimerBannerProps) {
  const [expanded, setExpanded] = useState(false)
  const colors = getPeriodColors(currentPeriod.period_type)

  return (
    <div className={`sticky top-0 z-30 ${colors.banner} border-b border-[var(--border-primary)] transition-all`}>
      {/* Compact row — tap to expand */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full px-4 py-3 flex items-center gap-3"
      >
        <span
          className={`text-xs font-semibold rounded-full px-2 py-0.5 ${colors.bg} ${colors.text}`}
        >
          {currentPeriod.period_type.replace('_', ' ')}
        </span>
        <span className="text-sm font-medium text-[var(--text-primary)] flex-1 text-left truncate">
          {showUpNext ? `Up Next: ${upNextName}` : currentPeriod.name}
        </span>
        <span
          className={`text-2xl font-bold tabular-nums text-[var(--text-primary)] ${timerPulse ? 'animate-pulse' : ''}`}
        >
          {timerDisplay}
        </span>
        {session.status === 'paused' && (
          <span className="text-xs text-[var(--text-secondary)] font-medium">PAUSED</span>
        )}
      </button>

      {/* Controls row */}
      <div className="px-4 pb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePause}
          className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] active:bg-[var(--bg-card-alt)]"
        >
          {session.status === 'paused' ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          type="button"
          onClick={onNextPeriod}
          className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] active:bg-[var(--bg-card-alt)]"
        >
          Next ⏭
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onEndRequest}
          className="text-xs text-red-500 font-medium active:text-red-700"
        >
          End
        </button>
      </div>

      {/* Expanded — drill list for current period */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-[var(--border-primary)]/50">
          {currentPeriod.drills.map(drill => (
            <div key={drill.id} className="py-2 border-b border-[var(--border-primary)] last:border-b-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">{drill.drill_name}</p>
              {drill.description && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{drill.description}</p>
              )}
              <div className="flex gap-1.5 mt-1">
                {drill.position_group && (
                  <span className="text-[10px] bg-[var(--bg-card-alt)] text-[var(--text-secondary)] rounded-full px-2 py-0.5">
                    {drill.position_group}
                  </span>
                )}
                {drill.equipment_needed && (
                  <span className="text-[10px] bg-[var(--bg-card-alt)] text-[var(--text-secondary)] rounded-full px-2 py-0.5">
                    {drill.equipment_needed}
                  </span>
                )}
              </div>
            </div>
          ))}
          {currentPeriod.drills.length === 0 && (
            <p className="text-xs text-[var(--text-tertiary)] py-2 italic">No drills listed</p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EndConfirmSheet — bottom sheet for "End Practice?" confirmation
// ---------------------------------------------------------------------------

interface EndConfirmSheetProps {
  onCancel: () => void
  onConfirm: () => void
}

function EndConfirmSheet({ onCancel, onConfirm }: EndConfirmSheetProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onCancel} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[var(--bg-pill-inactive)]" />
        </div>
        <div className="px-5 pb-6 text-center">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">End Practice?</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">This will stop the timer for all coaches.</p>
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-[var(--bg-card-alt)] text-[var(--text-primary)] rounded-xl py-3 text-sm font-semibold"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-semibold"
            >
              End Practice
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PracticePlanViewerPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.planId as string
  const { teamId } = useMobile()

  const [plan, setPlan] = useState<PracticePlanWithDetails | null>(null)
  const [loading, setLoading] = useState(true)

  // Live session state
  const [session, setSession] = useState<LivePracticeSession | null>(null)
  const [showUpNext, setShowUpNext] = useState(false)
  const [upNextName, setUpNextName] = useState('')
  const [showComplete, setShowComplete] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [timerDisplay, setTimerDisplay] = useState('0:00')
  const [timerPulse, setTimerPulse] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const activePeriodRef = useRef<HTMLDivElement | null>(null)

  // Stable ref callback so PeriodCard doesn't re-render on every parent render
  const setActivePeriodRef: React.RefCallback<HTMLDivElement> = useCallback((el) => {
    activePeriodRef.current = el
  }, [])

  // ------------------------------------------------------------------
  // Load plan (localStorage cache → DB)
  // ------------------------------------------------------------------

  const isSample = planId === 'sample'

  useEffect(() => {
    async function loadPlan() {
      // Sample plan — load from static data, skip DB
      if (planId === 'sample') {
        setPlan(SAMPLE_PRACTICE_PLAN)
        setLoading(false)
        return
      }

      // Serve from cache immediately for perceived speed
      try {
        const cached = localStorage.getItem(`ych-practice-plan-${planId}`)
        if (cached) {
          setPlan(JSON.parse(cached) as PracticePlanWithDetails)
          setLoading(false)
        }
      } catch {
        // Ignore localStorage errors
      }

      const supabase = createClient()

      const { data: planData } = await supabase
        .from('practice_plans')
        .select('*')
        .eq('id', planId)
        .single()

      if (!planData) {
        setLoading(false)
        return
      }

      const { data: periods } = await supabase
        .from('practice_periods')
        .select('*')
        .eq('practice_plan_id', planId)
        .order('period_order', { ascending: true })

      const periodsWithDrills: PracticePeriodWithDrills[] = await Promise.all(
        (periods ?? []).map(async period => {
          const { data: drills } = await supabase
            .from('practice_drills')
            .select('*')
            .eq('period_id', period.id)
            .order('drill_order', { ascending: true })
          return { ...period, drills: drills ?? [] } as PracticePeriodWithDrills
        })
      )

      const fullPlan: PracticePlanWithDetails = {
        ...(planData as PracticePlanWithDetails),
        periods: periodsWithDrills,
      }

      setPlan(fullPlan)
      setLoading(false)

      try {
        localStorage.setItem(`ych-practice-plan-${planId}`, JSON.stringify(fullPlan))
      } catch {
        // Ignore
      }
    }

    loadPlan()
  }, [planId])

  // ------------------------------------------------------------------
  // Check for active session + Realtime subscription
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!planId || !teamId) return

    const supabase = createClient()

    // Check for any non-completed session for this plan
    supabase
      .from('live_practice_sessions')
      .select('*')
      .eq('practice_plan_id', planId)
      .neq('status', 'completed')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setSession(data as LivePracticeSession)
      })

    // Realtime — keep session in sync across coaches
    const channel = supabase
      .channel(`practice-${planId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_practice_sessions',
          filter: `practice_plan_id=eq.${planId}`,
        },
        payload => {
          if (payload.new) setSession(payload.new as LivePracticeSession)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [planId, teamId])

  // ------------------------------------------------------------------
  // Timer display update interval (runs at 4 Hz for smooth countdown)
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!session || session.status === 'completed' || !plan) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    function updateTimer() {
      if (!session || !plan) return
      const period = plan.periods[session.current_period_index]
      if (!period) return

      let remaining: number
      if (session.status === 'paused' && session.pause_remaining_seconds != null) {
        remaining = session.pause_remaining_seconds
      } else if (session.timer_started_at) {
        const elapsed =
          (Date.now() - new Date(session.timer_started_at).getTime()) / 1000
        remaining = period.duration_minutes * 60 - elapsed
      } else {
        remaining = period.duration_minutes * 60
      }

      if (remaining <= 0) {
        remaining = 0
        handlePeriodEnd()
      }

      const clamped = Math.max(0, remaining)
      const mins = Math.floor(clamped / 60)
      const secs = Math.floor(clamped % 60)
      setTimerDisplay(`${mins}:${String(secs).padStart(2, '0')}`)
    }

    updateTimer()
    timerRef.current = setInterval(updateTimer, 250)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    // handlePeriodEnd is stable via useCallback; session fields listed individually
    // to avoid stale closure over the whole session object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    session?.status,
    session?.timer_started_at,
    session?.current_period_index,
    session?.pause_remaining_seconds,
    plan,
  ])

  // ------------------------------------------------------------------
  // Wake Lock — keep screen on during active practice
  // ------------------------------------------------------------------

  useEffect(() => {
    if (session && session.status !== 'completed') {
      navigator.wakeLock
        ?.request('screen')
        .then(lock => {
          wakeLockRef.current = lock
        })
        .catch(() => {
          // Wake Lock not supported or permission denied
        })
    }
    return () => {
      wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [session?.status])

  // ------------------------------------------------------------------
  // Auto-scroll to active period card
  // ------------------------------------------------------------------

  useEffect(() => {
    if (session && activePeriodRef.current) {
      activePeriodRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [session?.current_period_index])

  // ------------------------------------------------------------------
  // Period end handler — alarm, advance or complete
  // ------------------------------------------------------------------

  const handlePeriodEnd = useCallback(async () => {
    if (!session || !plan || !teamId) return
    const nextIndex = session.current_period_index + 1

    playAlarm()
    vibrateDevice()
    setTimerPulse(true)
    setTimeout(() => setTimerPulse(false), 1000)

    if (nextIndex >= plan.periods.length) {
      // Practice complete
      const supabase = createClient()
      await supabase
        .from('live_practice_sessions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', session.id)
      setShowComplete(true)
      return
    }

    // Show "Up Next" overlay for 5 seconds, then advance
    setUpNextName(plan.periods[nextIndex].name)
    setShowUpNext(true)
    setTimeout(async () => {
      setShowUpNext(false)
      const supabase = createClient()
      await supabase
        .from('live_practice_sessions')
        .update({
          current_period_index: nextIndex,
          timer_started_at: new Date().toISOString(),
          pause_remaining_seconds: null,
          status: 'running',
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id)
    }, 5000)
  }, [session, plan, teamId])

  // ------------------------------------------------------------------
  // Start practice
  // ------------------------------------------------------------------

  async function handleStartPractice() {
    if (!planId || !teamId) return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('live_practice_sessions')
      .insert({
        practice_plan_id: planId,
        team_id: teamId,
        current_period_index: 0,
        timer_started_at: new Date().toISOString(),
        status: 'running',
        started_by: user?.id ?? null,
      })
      .select()
      .single()

    if (error) {
      // Race condition — another coach started it; join their session
      const { data: existing } = await supabase
        .from('live_practice_sessions')
        .select('*')
        .eq('practice_plan_id', planId)
        .neq('status', 'completed')
        .single()
      if (existing) setSession(existing as LivePracticeSession)
      return
    }

    setSession(data as LivePracticeSession)
  }

  // ------------------------------------------------------------------
  // Pause / Resume
  // ------------------------------------------------------------------

  async function handleTogglePause() {
    if (!session || !plan) return
    const supabase = createClient()
    const period = plan.periods[session.current_period_index]

    if (session.status === 'running' && session.timer_started_at) {
      const elapsed =
        (Date.now() - new Date(session.timer_started_at).getTime()) / 1000
      const remaining = Math.max(0, period.duration_minutes * 60 - elapsed)
      await supabase
        .from('live_practice_sessions')
        .update({
          status: 'paused',
          pause_remaining_seconds: Math.round(remaining),
          timer_started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id)
    } else {
      // Resume — back-calculate timer_started_at from remaining seconds
      const remaining =
        session.pause_remaining_seconds ?? period.duration_minutes * 60
      const elapsedMs = (period.duration_minutes * 60 - remaining) * 1000
      const newStart = new Date(Date.now() - elapsedMs)
      await supabase
        .from('live_practice_sessions')
        .update({
          status: 'running',
          timer_started_at: newStart.toISOString(),
          pause_remaining_seconds: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id)
    }
  }

  // ------------------------------------------------------------------
  // Skip to next period
  // ------------------------------------------------------------------

  async function handleNextPeriod() {
    if (!session || !plan) return
    const nextIndex = session.current_period_index + 1

    if (nextIndex >= plan.periods.length) {
      const supabase = createClient()
      await supabase
        .from('live_practice_sessions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', session.id)
      setShowComplete(true)
      return
    }

    playAlarm()
    vibrateDevice()

    const supabase = createClient()
    await supabase
      .from('live_practice_sessions')
      .update({
        current_period_index: nextIndex,
        timer_started_at: new Date().toISOString(),
        pause_remaining_seconds: null,
        status: 'running',
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id)
  }

  // ------------------------------------------------------------------
  // End practice
  // ------------------------------------------------------------------

  async function handleEndPractice() {
    if (!session) return
    const supabase = createClient()
    await supabase
      .from('live_practice_sessions')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', session.id)
    setSession(null)
    setShowEndConfirm(false)
  }

  // ------------------------------------------------------------------
  // Derived values
  // ------------------------------------------------------------------

  const todayString = new Date().toISOString().split('T')[0]
  const isToday = plan?.date ? plan.date === todayString : true
  const canStart = isToday && !session && !showComplete && !isSample

  const currentPeriod =
    session && plan && session.status !== 'completed'
      ? plan.periods[session.current_period_index] ?? null
      : null

  // ------------------------------------------------------------------
  // Loading skeleton
  // ------------------------------------------------------------------

  if (loading && !plan) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
        <div className="px-4 pt-12 pb-4">
          <div className="h-8 w-48 bg-[var(--bg-pill-inactive)] rounded animate-pulse mb-2" />
          <div className="h-4 w-32 bg-[var(--bg-pill-inactive)] rounded animate-pulse" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="mx-4 mb-3 bg-[var(--bg-card)] rounded-xl p-4 animate-pulse">
            <div className="h-5 w-40 bg-[var(--bg-card-alt)] rounded mb-2" />
            <div className="h-4 w-24 bg-[var(--bg-card-alt)] rounded" />
          </div>
        ))}
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Not found
  // ------------------------------------------------------------------

  if (!plan) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <p className="text-sm text-[var(--text-secondary)]">Practice plan not found</p>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      {/* Live Timer Banner (sticky, only when session is active) */}
      {session && session.status !== 'completed' && currentPeriod && (
        <TimerBanner
          session={session}
          currentPeriod={currentPeriod}
          timerDisplay={timerDisplay}
          timerPulse={timerPulse}
          showUpNext={showUpNext}
          upNextName={upNextName}
          onTogglePause={handleTogglePause}
          onNextPeriod={handleNextPeriod}
          onEndRequest={() => setShowEndConfirm(true)}
        />
      )}

      {/* Practice Complete banner */}
      {showComplete && (
        <div className="sticky top-0 z-30 bg-[#B8CA6E] px-4 py-4 text-center">
          <p className="text-lg font-bold text-[#1c1c1e]">Practice Complete</p>
          <p className="text-sm text-[#1c1c1e]/70 mt-1">
            {plan.duration_minutes} min practice finished
          </p>
          <button
            type="button"
            onClick={() => {
              setShowComplete(false)
              setSession(null)
              router.push('/m/practice')
            }}
            className="mt-3 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-xl px-6 py-2 text-sm font-semibold"
          >
            Done
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-12 pb-2">
        <button
          type="button"
          onClick={() => router.push('/m/practice')}
          className="text-sm text-[var(--text-secondary)] mb-2 flex items-center gap-1 active:text-[var(--text-primary)]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Practice Plans
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{plan.title}</h1>
          {isSample && (
            <span className="inline-flex items-center bg-[var(--bg-card-alt)] text-[var(--text-tertiary)] text-[10px] font-semibold rounded-full px-2 py-0.5">
              SAMPLE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {plan.date && (
            <span className="text-sm text-[var(--text-secondary)]">
              {new Date(plan.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
          <span className="text-sm text-[var(--text-secondary)]">{plan.duration_minutes} min</span>
          {plan.location && <span className="text-sm text-[var(--text-secondary)]">{plan.location}</span>}
        </div>
      </div>

      {/* Period cards */}
      <div className="px-4 mt-3 space-y-3">
        {plan.periods.map((period, index) => {
          const isActive =
            session != null &&
            session.current_period_index === index &&
            session.status !== 'completed'

          return (
            <PeriodCard
              key={period.id}
              period={period}
              index={index}
              isActive={isActive}
              activePeriodRef={setActivePeriodRef}
            />
          )
        })}
      </div>

      {/* Notes */}
      {plan.notes && (
        <div className="px-4 mt-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            Notes
          </p>
          <div className="bg-[var(--bg-card)] rounded-xl p-4">
            <p className="text-sm text-[var(--text-primary)]">{plan.notes}</p>
          </div>
        </div>
      )}

      {/* Start Practice button (fixed above tab bar) */}
      {canStart && (
        <div className="fixed bottom-[calc(49px+env(safe-area-inset-bottom))] left-0 right-0 px-4 py-3 bg-gradient-to-t from-[#f2f2f7] via-[#f2f2f7] to-transparent">
          <button
            type="button"
            onClick={handleStartPractice}
            className="w-full bg-[#B8CA6E] text-[#1c1c1e] rounded-xl py-3.5 text-sm font-bold active:bg-[#a8b85e] transition-colors"
          >
            Start Practice
          </button>
        </div>
      )}

      {/* End Practice confirmation sheet */}
      {showEndConfirm && (
        <EndConfirmSheet
          onCancel={() => setShowEndConfirm(false)}
          onConfirm={handleEndPractice}
        />
      )}
    </div>
  )
}
