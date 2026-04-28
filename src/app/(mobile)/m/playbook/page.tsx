'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useMobile } from '@/app/(mobile)/MobileContext'
import MiniPlayDiagram from '@/components/MiniPlayDiagram'
import { FORMATION_METADATA } from '@/config/footballConfig'
import { DesktopRedirectCard } from '@/app/(mobile)/components/DesktopRedirectCard'
import { SAMPLE_PLAYS } from './sampleData'
import type { PlayDiagram, PlayAttributes as FullPlayAttributes } from '@/types/football'

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
  call_number?: number | null
  isSample?: boolean
}

type PhaseFilter = 'all' | 'offense' | 'defense' | 'specialTeams'
// TODO: Add 'redZone' | '2min' filters when plays can be tagged for situation
type TypeFilter = 'all' | 'run' | 'pass'

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
    <div className="bg-[var(--bg-card)] border-b border-[var(--border-primary)] px-4 py-3 min-h-[56px] flex items-center justify-between animate-pulse">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-36 bg-[var(--bg-pill-inactive)] rounded" />
        <div className="h-3 w-24 bg-[var(--bg-card-alt)] rounded" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="h-5 w-14 bg-[var(--bg-pill-inactive)] rounded-full" />
        <div className="h-3 w-10 bg-[var(--bg-card-alt)] rounded" />
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
      <ClipboardIcon className="text-[var(--text-tertiary)] mb-4" />
      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">No plays in your playbook</h3>
      <p className="text-sm text-[var(--text-secondary)]">
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
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
        Defense
      </span>
    )
  }
  if (odk === 'specialTeams') {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800">
        Special
      </span>
    )
  }
  const pt = playType?.toLowerCase()
  if (pt === 'run') {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
        Run
      </span>
    )
  }
  if (pt === 'pass') {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
        Pass
      </span>
    )
  }
  if (playType) {
    const label = playType.charAt(0).toUpperCase() + playType.slice(1)
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--bg-card-alt)] text-[var(--text-secondary)]">
        {label}
      </span>
    )
  }
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--bg-card-alt)] text-[var(--text-secondary)]">
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
          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] font-normal',
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
    <div className="sticky top-0 z-10 bg-[var(--bg-primary)] px-4 py-2">
      <span className="text-xs font-semibold text-[var(--text-section-header)] uppercase tracking-wider">
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Play detail bottom sheet
// ---------------------------------------------------------------------------

interface PlayDetailSheetProps {
  play: Play
  onClose: () => void
}

function PlayDetailSheet({ play, onClose }: PlayDetailSheetProps) {
  const { formation, direction, odk, playType, personnel, runConcept, passConcept } = play.attributes as PlayAttributes & { runConcept?: string; passConcept?: string }
  const [diagram, setDiagram] = useState<PlayDiagram | null>(null)
  const [comments, setComments] = useState<string | null>(null)
  const [diagramLoading, setDiagramLoading] = useState(true)

  // Coach notes inline editing
  const [coachNotes, setCoachNotes] = useState('')
  const [savedNotes, setSavedNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const notesChanged = coachNotes !== savedNotes
  const NOTES_MAX = 500

  // Fetch diagram + comments + coach_notes on-demand when sheet opens
  useEffect(() => {
    async function fetchPlayDetail() {
      const supabase = createClient()
      const { data } = await supabase
        .from('playbook_plays')
        .select('diagram, comments, coach_notes')
        .eq('id', play.id)
        .single()

      if (data?.diagram) {
        setDiagram(data.diagram as PlayDiagram)
      }
      if (data?.comments) {
        setComments(data.comments as string)
      }
      const notes = (data?.coach_notes as string) ?? ''
      setCoachNotes(notes)
      setSavedNotes(notes)
      setDiagramLoading(false)
    }

    fetchPlayDetail()
  }, [play.id])

  async function handleSaveNotes() {
    if (!notesChanged || notesSaving) return
    setNotesSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('playbook_plays')
      .update({ coach_notes: coachNotes || null })
      .eq('id', play.id)

    setNotesSaving(false)
    if (!error) {
      setSavedNotes(coachNotes)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 1500)
    }
  }

  // Look up formation metadata from footballConfig
  const formationMeta = formation
    ? (FORMATION_METADATA as Record<string, { usage?: string; runPercent?: number; passPercent?: number; personnel?: string; strengths?: string }>)[formation] ?? null
    : null

  // Use personnel from attributes first, fall back to formation metadata
  const displayPersonnel = personnel || formationMeta?.personnel || null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up max-h-[85vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pb-6">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">{play.play_name}</h3>
              {play.call_number != null && (
                <p className="text-base font-bold text-[#B8CA6E] mt-0.5">
                  Play #{play.call_number}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 -mt-1 text-[var(--text-tertiary)]"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Diagram */}
          {diagramLoading ? (
            <div className="mt-4 flex items-center justify-center rounded-xl bg-[var(--bg-card-alt)] h-[220px]">
              <div className="w-6 h-6 border-2 border-[var(--border-secondary)] border-t-[#B8CA6E] rounded-full animate-spin" />
            </div>
          ) : diagram ? (
            <div className="mt-4 flex justify-center rounded-xl bg-[var(--bg-card-alt)] overflow-hidden">
              <MiniPlayDiagram
                diagram={diagram}
                attributes={play.attributes as unknown as FullPlayAttributes}
                width={340}
                height={220}
                showLabels
              />
            </div>
          ) : null}

          {/* Formation info card */}
          {(formationMeta || displayPersonnel) && (
            <div className="mt-4 rounded-xl bg-[var(--bg-card-alt)] p-3">
              {formation && (
                <p className="text-sm font-semibold text-[var(--text-primary)]">{formation}</p>
              )}
              {formationMeta?.usage && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{formationMeta.usage}</p>
              )}
              {displayPersonnel && (
                <p className="text-xs text-[var(--text-secondary)] mt-1">{displayPersonnel}</p>
              )}
              {formationMeta && formationMeta.runPercent != null && formationMeta.passPercent != null && (
                <div className="flex gap-2 mt-2">
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                    Run {formationMeta.runPercent}%
                  </span>
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                    Pass {formationMeta.passPercent}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Strengths */}
          {formationMeta?.strengths && (
            <div className="flex items-start gap-2 mt-3 px-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <p className="text-sm text-green-700">{formationMeta.strengths}</p>
            </div>
          )}

          {/* Details grid */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {direction && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Direction</p>
                <p className="text-sm text-[var(--text-primary)] mt-0.5 capitalize">{direction}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Type</p>
              <div className="mt-1">
                <PlayTypeBadge odk={odk} playType={playType} />
              </div>
            </div>
            {runConcept && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Run Concept</p>
                <p className="text-sm text-[var(--text-primary)] mt-0.5">{runConcept}</p>
              </div>
            )}
            {passConcept && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Pass Concept</p>
                <p className="text-sm text-[var(--text-primary)] mt-0.5">{passConcept}</p>
              </div>
            )}
          </div>

          {/* Coach Notes — inline editable */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Coach Notes</p>
            <textarea
              value={coachNotes}
              onChange={(e) => {
                if (e.target.value.length <= NOTES_MAX) {
                  setCoachNotes(e.target.value)
                }
              }}
              placeholder="Add notes about this play..."
              rows={2}
              className="mt-1 w-full rounded-lg border border-[var(--border-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B8CA6E] focus:border-transparent resize-none"
              style={{ minHeight: '60px' }}
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-[var(--text-tertiary)]">{coachNotes.length}/{NOTES_MAX}</span>
              <div className="flex items-center gap-2">
                {notesSaved && (
                  <span className="text-xs text-green-600 font-medium">Saved</span>
                )}
                {notesChanged && !notesSaved && (
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={notesSaving}
                    className="rounded-lg bg-[#B8CA6E] text-[#1c1c1e] px-3 py-1.5 text-xs font-semibold min-h-[32px] transition-colors disabled:opacity-50"
                  >
                    {notesSaving ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Import/extraction notes (read-only, if present) */}
          {comments && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Notes</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{comments}</p>
            </div>
          )}

          <p className="text-xs text-[var(--text-tertiary)] mt-4">{play.play_code}</p>
        </div>
      </div>
    </>
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
  onTap: () => void
}

function PlayRow({ play, aiMode, isSuggested, isTopPick, onTap }: PlayRowProps) {
  const { formation, direction, odk, playType } = play.attributes

  const subtitle = [formation, direction].filter(Boolean).join(' · ')

  const rowBase =
    'bg-[var(--bg-card)] border-b border-[var(--border-primary)] px-4 py-3 min-h-[56px] flex items-center justify-between transition-opacity active:bg-[var(--bg-card-alt)] cursor-pointer'

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
    <button type="button" onClick={onTap} className={`${rowClass} w-full text-left`}>
      {/* Left: name + subtitle */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-medium text-[var(--text-primary)] leading-snug">
            {play.play_name}
          </span>
          {play.isSample && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[var(--bg-card-alt)] text-[var(--text-tertiary)]">
              SAMPLE
            </span>
          )}
          {aiMode && isTopPick && (
            <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-[#B8CA6E] text-[#1c1c1e]">
              TOP PICK
            </span>
          )}
        </div>
        {subtitle ? (
          <span className="text-sm text-[var(--text-secondary)] truncate">{subtitle}</span>
        ) : null}
        {aiMode && (isTopPick || isSuggested) && (
          <span className="text-xs text-[#B8CA6E] mt-0.5">
            {isTopPick ? '68% success rate' : isSuggested ? 'Suggested' : null}
          </span>
        )}
      </div>

      {/* Right: badge + play # */}
      <div className="flex flex-col items-end shrink-0">
        <PlayTypeBadge odk={odk} playType={playType} />
        {play.call_number != null && (
          <span className="text-xs text-[var(--text-tertiary)] mt-1">Play #{play.call_number}</span>
        )}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MobilePlaybookPage() {
  const { teamId } = useMobile()

  // Mark this team as "playbook viewed" for the coach onboarding checklist.
  useEffect(() => {
    if (!teamId) return
    try {
      localStorage.setItem(`ych-coach-viewed-playbook-${teamId}`, '1')
    } catch {}
  }, [teamId])

  const [plays, setPlays] = useState<Play[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [aiMode, setAiMode] = useState(false)
  const [selectedPlay, setSelectedPlay] = useState<Play | null>(null)

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchPlays = useCallback(async () => {
    if (!teamId) {
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    // Fetch plays
    const { data: playsData, error: playsError } = await supabase
      .from('playbook_plays')
      .select('id, play_code, play_name, attributes, is_archived')
      .eq('team_id', teamId)
      .eq('is_archived', false)
      .order('play_code', { ascending: true })

    if (playsError || !playsData) {
      setIsLoading(false)
      return
    }

    // Fetch the latest game plan for this team to get wristband call_numbers
    const { data: gamePlans } = await supabase
      .from('game_plans')
      .select('id')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(1)

    let callNumberMap: Record<string, number> = {}

    if (gamePlans && gamePlans.length > 0) {
      const { data: gppData } = await supabase
        .from('game_plan_plays')
        .select('play_code, call_number')
        .eq('game_plan_id', gamePlans[0].id)

      if (gppData) {
        for (const gpp of gppData) {
          callNumberMap[gpp.play_code] = gpp.call_number
        }
      }
    }

    // Merge call_number into plays
    const mergedPlays: Play[] = playsData.map((p) => ({
      ...(p as Play),
      call_number: callNumberMap[p.play_code] ?? null,
    }))

    setPlays(mergedPlays)
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

      // Type filter — case-insensitive match against playType
      if (typeFilter === 'run') {
        if (play.attributes.playType?.toLowerCase() !== 'run') return false
      } else if (typeFilter === 'pass') {
        if (play.attributes.playType?.toLowerCase() !== 'pass') return false
      }

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
            onTap={() => setSelectedPlay(play)}
          />
        ))}
      </div>
    )
  }

  const hasResults =
    grouped.offensePlays.length > 0 ||
    grouped.defensePlays.length > 0 ||
    grouped.specialPlays.length > 0

  const isTrulyEmpty = plays.length === 0

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-full bg-[var(--bg-primary)] pb-4">

      {/* ------------------------------------------------------------------ */}
      {/* Search bar + AI button row                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-2 px-4 mt-4">
        {/* Search input */}
        <div className="flex-1 flex items-center gap-2 rounded-xl bg-[var(--bg-card)] px-4 py-3">
          <SearchIcon className="text-[var(--text-tertiary)] shrink-0" />
          <input
            type="search"
            placeholder="Search plays..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-gray-400 text-base focus:outline-none min-w-0"
          />
        </div>

        {/* AI toggle button */}
        <button
          type="button"
          onClick={() => setAiMode((prev) => !prev)}
          aria-label="AI suggestions"
          className={[
            'rounded-full p-3 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors shrink-0',
            aiMode ? 'bg-[#B8CA6E]' : 'bg-[var(--bg-card)]',
          ].join(' ')}
        >
          <SparkleIcon className={aiMode ? 'text-[#1c1c1e]' : 'text-[var(--text-tertiary)]'} />
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
            <p className="text-xs text-[var(--text-secondary)]">Based on your playbook tendencies</p>
          </div>
          <button
            type="button"
            onClick={() => setAiMode(false)}
            aria-label="Dismiss AI suggestions"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 -mt-1 text-[var(--text-tertiary)]"
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
        {/* TODO: Add Red Zone and 2-Min filters when plays can be tagged for situation */}
        {(
          [
            { key: 'all', label: 'All' },
            { key: 'run', label: 'Run' },
            { key: 'pass', label: 'Pass' },
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
        ) : isTrulyEmpty ? (
          <div className="px-4 space-y-3">
            <DesktopRedirectCard
              feature="Create Your Playbook"
              description="Build plays and formations on desktop — they sync here automatically."
              url={teamId ? `/football/teams/${teamId}/playbook` : '/dashboard'}
              actionLabel="Open on desktop"
            />
            {SAMPLE_PLAYS.map(play => (
              <PlayRow
                key={play.id}
                play={play}
                aiMode={false}
                isSuggested={false}
                isTopPick={false}
                onTap={() => setSelectedPlay(play)}
              />
            ))}
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <p className="text-sm font-medium text-[var(--text-secondary)]">No matching plays</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Try adjusting your filters or search.</p>
          </div>
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
        <div className="fixed bottom-[calc(49px+env(safe-area-inset-bottom))] left-0 right-0 bg-[var(--bg-card)] border-t border-[var(--border-primary)] px-4 py-3 flex items-center gap-3 z-20">
          <LightbulbIcon className="text-[#B8CA6E] shrink-0" />
          <p className="text-sm text-[var(--text-secondary)]">
            Opponent tends to blitz on 3rd &amp; long
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Play detail bottom sheet                                             */}
      {/* ------------------------------------------------------------------ */}
      {selectedPlay && (
        <PlayDetailSheet play={selectedPlay} onClose={() => setSelectedPlay(null)} />
      )}

    </div>
  )
}
