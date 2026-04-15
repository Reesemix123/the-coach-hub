'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useMobile } from '@/app/(mobile)/MobileContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayAttributes {
  odk: 'offense' | 'defense' | 'specialTeams'
  formation?: string
  playType?: string
  direction?: string
  personnel?: string
}

interface Play {
  id: string
  play_code: string
  play_name: string
  attributes: PlayAttributes
  is_archived: boolean
}

type PhaseFilter = 'all' | 'offense' | 'defense' | 'specialTeams'
type TypeFilter = 'all' | 'run' | 'pass' | 'redZone' | '2min'

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z" />
    </svg>
  )
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3 min-h-[56px] flex items-center justify-between animate-pulse">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-36 bg-gray-200 rounded" />
        <div className="h-3 w-24 bg-gray-100 rounded" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="h-5 w-14 bg-gray-200 rounded-full" />
        <div className="h-3 w-10 bg-gray-100 rounded" />
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div>
      {[...Array(8)].map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <ClipboardIcon className="text-gray-300 mb-4" />
      <h3 className="text-base font-semibold text-gray-900 mb-1">No plays in your playbook</h3>
      <p className="text-sm text-gray-500">
        Add plays from the desktop playbook to get started.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Play type badge
// ---------------------------------------------------------------------------

function PlayTypeBadge({ odk, playType }: { odk: string; playType?: string }) {
  if (odk === 'defense') {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
        Defense
      </span>
    )
  }
  if (odk === 'specialTeams') {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
        Special
      </span>
    )
  }
  if (playType === 'run') {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
        Run
      </span>
    )
  }
  if (playType === 'pass') {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
        Pass
      </span>
    )
  }
  if (playType) {
    const label = playType.charAt(0).toUpperCase() + playType.slice(1)
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
        {label}
      </span>
    )
  }
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
      Offense
    </span>
  )
}

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={[
        'rounded-full px-4 py-2 text-sm min-w-fit whitespace-nowrap transition-colors min-h-[36px]',
        active
          ? 'bg-[#B8CA6E] text-[#1c1c1e] font-semibold'
          : 'bg-white text-gray-600 font-normal',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="sticky top-0 z-10 bg-[#f2f2f7] px-4 py-2">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Play row
// ---------------------------------------------------------------------------

interface PlayRowProps {
  play: Play
  aiMode: boolean
  isSuggested: boolean
  isTopPick: boolean
}

function PlayRow({ play, aiMode, isSuggested, isTopPick }: PlayRowProps) {
  const { formation, direction, odk, playType } = play.attributes

  const subtitle = [formation, direction].filter(Boolean).join(' · ')

  const rowBase =
    'bg-white border-b border-gray-100 px-4 py-3 min-h-[56px] flex items-center justify-between transition-opacity'

  let rowClass = rowBase
  if (aiMode) {
    if (isTopPick) {
      rowClass = `${rowBase} border-l-4 border-[#B8CA6E] bg-[#B8CA6E]/5`
    } else if (isSuggested) {
      rowClass = `${rowBase} border-l-4 border-[#B8CA6E]/40 bg-[#B8CA6E]/[0.02]`
    } else {
      rowClass = `${rowBase} opacity-40`
    }
  }

  return (
    <div className={rowClass}>
      {/* Left: name + subtitle */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-medium text-gray-900 leading-snug">
            {play.play_name}
          </span>
          {aiMode && isTopPick && (
            <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-[#B8CA6E] text-[#1c1c1e]">
              TOP PICK
            </span>
          )}
        </div>
        {subtitle ? (
          <span className="text-sm text-gray-500 truncate">{subtitle}</span>
        ) : null}
        {aiMode && (isTopPick || isSuggested) && (
          <span className="text-xs text-[#B8CA6E] mt-0.5">
            {isTopPick ? '68% success rate' : isSuggested ? 'Suggested' : null}
          </span>
        )}
      </div>

      {/* Right: badge + play code */}
      <div className="flex flex-col items-end shrink-0">
        <PlayTypeBadge odk={odk} playType={playType} />
        <span className="text-xs text-gray-400 mt-1">{play.play_code}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MobilePlaybookPage() {
  const { teamId } = useMobile()

  const [plays, setPlays] = useState<Play[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [aiMode, setAiMode] = useState(false)

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchPlays = useCallback(async () => {
    if (!teamId) {
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    const { data, error } = await supabase
      .from('playbook_plays')
      .select('id, play_code, play_name, attributes, is_archived')
      .eq('team_id', teamId)
      .eq('is_archived', false)
      .order('play_code', { ascending: true })

    if (!error && data) {
      setPlays(data as Play[])
    }

    setIsLoading(false)
  }, [teamId])

  useEffect(() => {
    fetchPlays()
  }, [fetchPlays])

  // -------------------------------------------------------------------------
  // Filtering logic
  // -------------------------------------------------------------------------

  const filteredPlays = useMemo(() => {
    return plays.filter((play) => {
      // Search filter
      const q = searchQuery.trim().toLowerCase()
      if (q) {
        const inName = play.play_name.toLowerCase().includes(q)
        const inCode = play.play_code.toLowerCase().includes(q)
        if (!inName && !inCode) return false
      }

      // Phase filter
      if (phaseFilter !== 'all') {
        if (play.attributes.odk !== phaseFilter) return false
      }

      // Type filter — Red Zone and 2-Min are aspirational: show all plays
      if (typeFilter === 'run') {
        if (play.attributes.playType !== 'run') return false
      } else if (typeFilter === 'pass') {
        if (play.attributes.playType !== 'pass') return false
      }
      // 'redZone' and '2min' show all qualifying plays (no extra filter)

      return true
    })
  }, [plays, searchQuery, phaseFilter, typeFilter])

  // -------------------------------------------------------------------------
  // Grouping
  // -------------------------------------------------------------------------

  const grouped = useMemo(() => {
    const offensePlays = filteredPlays.filter((p) => p.attributes.odk === 'offense')
    const defensePlays = filteredPlays.filter((p) => p.attributes.odk === 'defense')
    const specialPlays = filteredPlays.filter((p) => p.attributes.odk === 'specialTeams')
    return { offensePlays, defensePlays, specialPlays }
  }, [filteredPlays])

  // -------------------------------------------------------------------------
  // AI suggestion scaffold: first 4 filtered plays, first one is top pick
  // -------------------------------------------------------------------------

  const suggestedIds = useMemo(() => {
    return filteredPlays.slice(0, 4).map((p) => p.id)
  }, [filteredPlays])

  const topPickId = suggestedIds[0] ?? null

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  function renderGroup(label: string, groupPlays: Play[]) {
    if (groupPlays.length === 0) return null
    return (
      <div key={label}>
        <SectionHeader label={label} />
        {groupPlays.map((play) => (
          <PlayRow
            key={play.id}
            play={play}
            aiMode={aiMode}
            isSuggested={suggestedIds.includes(play.id)}
            isTopPick={play.id === topPickId}
          />
        ))}
      </div>
    )
  }

  const hasResults =
    grouped.offensePlays.length > 0 ||
    grouped.defensePlays.length > 0 ||
    grouped.specialPlays.length > 0

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-full bg-[#f2f2f7] pb-4">

      {/* ------------------------------------------------------------------ */}
      {/* Search bar + AI button row                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-2 px-4 mt-4">
        {/* Search input */}
        <div className="flex-1 flex items-center gap-2 rounded-xl bg-white px-4 py-3">
          <SearchIcon className="text-gray-400 shrink-0" />
          <input
            type="search"
            placeholder="Search plays..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 text-base focus:outline-none min-w-0"
          />
        </div>

        {/* AI toggle button */}
        <button
          type="button"
          onClick={() => setAiMode((prev) => !prev)}
          aria-label="AI suggestions"
          className={[
            'rounded-full p-3 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors shrink-0',
            aiMode ? 'bg-[#B8CA6E]' : 'bg-white',
          ].join(' ')}
        >
          <SparkleIcon className={aiMode ? 'text-[#1c1c1e]' : 'text-gray-400'} />
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* AI suggestion banner                                                 */}
      {/* ------------------------------------------------------------------ */}
      {aiMode && (
        <div className="mx-4 mt-3 bg-[#B8CA6E]/10 border border-[#B8CA6E]/30 rounded-xl p-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#B8CA6E] leading-none mb-1">
              AI Suggestions
            </p>
            <p className="text-xs text-gray-500">Based on your playbook tendencies</p>
          </div>
          <button
            type="button"
            onClick={() => setAiMode(false)}
            aria-label="Dismiss AI suggestions"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 -mt-1 text-gray-400"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Phase filter row                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex gap-2 px-4 mt-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            { key: 'all', label: 'All' },
            { key: 'offense', label: 'Offense' },
            { key: 'defense', label: 'Defense' },
            { key: 'specialTeams', label: 'Special Teams' },
          ] as { key: PhaseFilter; label: string }[]
        ).map(({ key, label }) => (
          <FilterChip
            key={key}
            label={label}
            active={phaseFilter === key}
            onPress={() => setPhaseFilter(key)}
          />
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Type filter row                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex gap-2 px-4 mt-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            { key: 'all', label: 'All' },
            { key: 'run', label: 'Run' },
            { key: 'pass', label: 'Pass' },
            { key: 'redZone', label: 'Red Zone' },
            { key: '2min', label: '2-Min' },
          ] as { key: TypeFilter; label: string }[]
        ).map(({ key, label }) => (
          <FilterChip
            key={key}
            label={label}
            active={typeFilter === key}
            onPress={() => setTypeFilter(key)}
          />
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Play list                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="mt-3">
        {isLoading ? (
          <LoadingState />
        ) : !hasResults ? (
          <EmptyState />
        ) : (
          <>
            {renderGroup('Offense', grouped.offensePlays)}
            {renderGroup('Defense', grouped.defensePlays)}
            {renderGroup('Special Teams', grouped.specialPlays)}
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* AI insight bar (fixed above tab bar when AI mode active)            */}
      {/* ------------------------------------------------------------------ */}
      {aiMode && (
        <div className="fixed bottom-[calc(49px+env(safe-area-inset-bottom))] left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 z-20">
          <LightbulbIcon className="text-[#B8CA6E] shrink-0" />
          <p className="text-sm text-gray-600">
            Opponent tends to blitz on 3rd &amp; long
          </p>
        </div>
      )}

    </div>
  )
}
