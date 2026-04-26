'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useMobile } from '@/app/(mobile)/MobileContext'

interface UpcomingGame {
  id: string
  opponent: string
  date: string
  location: string | null
  start_time: string | null
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatGameDate(dateStr: string, startTime: string | null): string {
  const date = new Date(dateStr + 'T00:00:00')
  const formatted = date.toLocaleDateString('en-US', {
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

function getDaysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const gameDate = new Date(dateStr + 'T00:00:00')
  gameDate.setHours(0, 0, 0, 0)
  const diff = gameDate.getTime() - today.getTime()
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

function DaysUntilLabel({ days }: { days: number }) {
  if (days === 0) return <span className="rounded-full bg-[#B8CA6E]/10 text-[#B8CA6E] px-3 py-1 text-xs font-semibold">Today</span>
  if (days === 1) return <span className="rounded-full bg-[#B8CA6E]/10 text-[#B8CA6E] px-3 py-1 text-xs font-semibold">Tomorrow</span>
  return <span className="rounded-full bg-[#B8CA6E]/10 text-[#B8CA6E] px-3 py-1 text-xs font-semibold">In {days} days</span>
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-[var(--bg-card)] p-4 animate-pulse ${className ?? ''}`}>
      <div className="h-3 bg-[var(--bg-card-alt)] rounded w-1/3 mb-3" />
      <div className="h-5 bg-[var(--bg-card-alt)] rounded w-2/3 mb-2" />
      <div className="h-4 bg-[var(--bg-card-alt)] rounded w-1/2" />
    </div>
  )
}

function SkeletonGridCard() {
  return (
    <div className="rounded-2xl bg-[var(--bg-card)] p-4 min-h-[100px] flex flex-col items-center justify-center gap-2 animate-pulse">
      <div className="w-6 h-6 bg-[var(--bg-card-alt)] rounded" />
      <div className="h-3 bg-[var(--bg-card-alt)] rounded w-14" />
    </div>
  )
}

// SVG icons

function ClipboardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function PracticeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-tertiary)]">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

export default function MobileHomePage() {
  const { teamId, coachName } = useMobile()
  const [game, setGame] = useState<UpcomingGame | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [noGame, setNoGame] = useState(false)

  const firstName = coachName.split(' ')[0] || 'Coach'

  useEffect(() => {
    if (!teamId) {
      setIsLoading(false)
      setNoGame(true)
      return
    }

    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    supabase
      .from('games')
      .select('id, opponent, date, location, start_time')
      .eq('team_id', teamId)
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(1)
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          setNoGame(true)
        } else {
          setGame(data[0] as UpcomingGame)
        }
        setIsLoading(false)
      })
  }, [teamId])

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-8">
      {/* Greeting */}
      <div className="px-4 pt-12 pb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Here&apos;s your team overview</p>
      </div>

      {/* Next Game Card */}
      <div className="px-4 mb-6">
        {isLoading ? (
          <SkeletonCard />
        ) : noGame || !game ? (
          <div className="rounded-2xl bg-[var(--bg-card)] p-6 flex flex-col items-center justify-center gap-3 text-center">
            <CalendarIcon />
            <p className="text-sm text-[var(--text-secondary)]">No upcoming games scheduled</p>
          </div>
        ) : (
          <div className="relative rounded-2xl bg-[var(--bg-card)] p-4 border-l-4 border-[#B8CA6E]">
            <div className="absolute top-4 right-4">
              <DaysUntilLabel days={getDaysUntil(game.date)} />
            </div>
            <p className="text-xs font-semibold text-[#B8CA6E] uppercase tracking-wider mb-2">
              Next Game
            </p>
            <p className="text-lg font-semibold text-[var(--text-primary)] pr-24">{game.opponent}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {formatGameDate(game.date, game.start_time)}
            </p>
            {game.location && (
              <p className="text-sm text-[var(--text-secondary)]">{game.location}</p>
            )}
          </div>
        )}
      </div>

      {/* Quick Access Grid */}
      <div className="px-4">
        <h2 className="text-sm font-semibold text-[var(--text-section-header)] uppercase tracking-wider mb-3">
          Quick Access
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            <SkeletonGridCard />
            <SkeletonGridCard />
            <SkeletonGridCard />
            <SkeletonGridCard />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/m/playbook"
              className="rounded-2xl bg-[var(--bg-card)] p-4 min-h-[100px] flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <ClipboardIcon />
              <span className="text-sm font-medium text-[var(--text-primary)]">Playbook</span>
            </Link>

            <Link
              href="/m/roster"
              className="rounded-2xl bg-[var(--bg-card)] p-4 min-h-[100px] flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <UsersIcon />
              <span className="text-sm font-medium text-[var(--text-primary)]">Roster</span>
            </Link>

            <Link
              href="/m/practice"
              className="rounded-2xl bg-[var(--bg-card)] p-4 min-h-[100px] flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <PracticeIcon />
              <span className="text-sm font-medium text-[var(--text-primary)]">Practice</span>
            </Link>

            <Link
              href="/m/messages"
              className="rounded-2xl bg-[var(--bg-card)] p-4 min-h-[100px] flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <ChatIcon />
              <span className="text-sm font-medium text-[var(--text-primary)]">Messages</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
