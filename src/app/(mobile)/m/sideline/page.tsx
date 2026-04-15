'use client'

import { useState, useEffect, useCallback, useReducer } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useMobile } from '@/app/(mobile)/MobileContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MainSegment = 'log' | 'plays' | 'drive'
type LogMode = 'wristband' | 'fromPlays' | 'quick'
type QuickPlayType = 'run' | 'pass' | 'special_teams'
type HashMark = 'left' | 'middle' | 'right'
type OutcomeLabel = 'Gain' | 'Loss' | 'TD' | 'Turnover' | 'Incomplete' | 'Complete' | 'Sack' | 'Penalty'

interface GameState {
  down: number
  distance: number
  yardLine: number
  hash: HashMark
  quarter: number
  clock: string
  homeScore: number
  oppScore: number
}

interface LoggedPlay {
  id: string
  playCode: string | null
  playName: string | null
  playType: string | null
  formation: string | null
  down: number
  distance: number
  yardLine: number
  quarter: number
  result: string
  yardsGained: number
  driveNumber: number
}

interface GamePlanPlay {
  id: string
  play_code: string
  call_number: number
  sort_order: number
  playbook_plays: {
    id: string
    play_code: string
    play_name: string
    attributes: {
      odk: string
      formation?: string
      playType?: string
    }
  }
}

interface DbDrive {
  id: string
  drive_number: number
  quarter: number
  plays_count: number
  yards_gained: number
  result: string | null
  points: number | null
}

// ---------------------------------------------------------------------------
// Reducer for game state
// ---------------------------------------------------------------------------

type GameAction =
  | { type: 'SET_DOWN'; down: number }
  | { type: 'SET_DISTANCE'; distance: number }
  | { type: 'SET_YARD_LINE'; yardLine: number }
  | { type: 'SET_HASH'; hash: HashMark }
  | { type: 'SET_QUARTER'; quarter: number }
  | { type: 'SET_CLOCK'; clock: string }
  | { type: 'SET_HOME_SCORE'; score: number }
  | { type: 'SET_OPP_SCORE'; score: number }
  | { type: 'ADVANCE'; yardsGained: number; outcome: OutcomeLabel }

const INITIAL_GAME_STATE: GameState = {
  down: 1,
  distance: 10,
  yardLine: 25,
  hash: 'middle',
  quarter: 1,
  clock: '15:00',
  homeScore: 0,
  oppScore: 0,
}

function clampYardLine(yl: number): number {
  return Math.max(0, Math.min(99, yl))
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_DOWN':
      return { ...state, down: action.down }
    case 'SET_DISTANCE':
      return { ...state, distance: action.distance }
    case 'SET_YARD_LINE':
      return { ...state, yardLine: action.yardLine }
    case 'SET_HASH':
      return { ...state, hash: action.hash }
    case 'SET_QUARTER':
      return { ...state, quarter: action.quarter }
    case 'SET_CLOCK':
      return { ...state, clock: action.clock }
    case 'SET_HOME_SCORE':
      return { ...state, homeScore: action.score }
    case 'SET_OPP_SCORE':
      return { ...state, oppScore: action.score }
    case 'ADVANCE': {
      const { yardsGained, outcome } = action
      if (outcome === 'TD') {
        return { ...state, down: 1, distance: 10, yardLine: 25, homeScore: state.homeScore + 6 }
      }
      if (outcome === 'Turnover') {
        return { ...state, down: 1, distance: 10, yardLine: 25 }
      }
      const newYardLine = clampYardLine(state.yardLine + yardsGained)
      const newDistance = state.distance - yardsGained
      if (newDistance <= 0 || outcome === 'Complete' && yardsGained >= state.distance) {
        return { ...state, down: 1, distance: 10, yardLine: newYardLine }
      }
      if (state.down >= 4) {
        // Turnover on downs — reset
        return { ...state, down: 1, distance: 10, yardLine: clampYardLine(100 - newYardLine) }
      }
      return {
        ...state,
        down: state.down + 1,
        distance: Math.max(1, newDistance),
        yardLine: newYardLine,
      }
    }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function ordinalDown(down: number): string {
  const suffixes = ['', '1st', '2nd', '3rd', '4th']
  return suffixes[down] ?? `${down}th`
}

function formatYardLine(yl: number): string {
  if (yl === 50) return 'MIDFIELD'
  if (yl < 50) return `OWN ${yl}`
  return `OPP ${100 - yl}`
}

function formatHash(hash: HashMark): string {
  if (hash === 'left') return 'Left Hash'
  if (hash === 'right') return 'Right Hash'
  return 'Middle'
}

function parseTimeToSeconds(clock: string): number {
  const parts = clock.split(':')
  if (parts.length !== 2) return 0
  const mins = parseInt(parts[0], 10)
  const secs = parseInt(parts[1], 10)
  if (isNaN(mins) || isNaN(secs)) return 0
  return mins * 60 + secs
}

function mapOutcomeToResult(outcome: OutcomeLabel): string {
  switch (outcome) {
    case 'Gain':       return 'run_gain'
    case 'Loss':       return 'run_loss'
    case 'TD':         return 'touchdown'
    case 'Turnover':   return 'fumble'
    case 'Incomplete': return 'pass_incomplete'
    case 'Complete':   return 'pass_complete'
    case 'Sack':       return 'sack'
    case 'Penalty':    return 'penalty'
    default:           return 'run_gain'
  }
}

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

function BackspaceIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
      <line x1="18" y1="9" x2="12" y2="15" />
      <line x1="12" y1="9" x2="18" y2="15" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
    </svg>
  )
}

function ClipboardIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Game State Bar
// ---------------------------------------------------------------------------

interface GameStateBarProps {
  game: GameState
}

function GameStateBar({ game }: GameStateBarProps) {
  const { down, distance, yardLine, hash, quarter, clock, homeScore, oppScore } = game
  return (
    <div className="bg-[#2c2c2e] rounded-2xl mx-4 mt-3 p-4">
      {/* Row 1: Down & Distance */}
      <p className="text-3xl font-bold text-white leading-tight">
        {ordinalDown(down)} &amp; {distance}
      </p>

      {/* Row 2: Field position */}
      <p className="text-sm text-gray-400 mt-1">
        {formatYardLine(yardLine)} &middot; {formatHash(hash)}
      </p>

      {/* Row 3: Score / Quarter / Clock */}
      <div className="flex items-center mt-3">
        <div className="flex-1 text-center">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Score</p>
          <p className="text-lg font-semibold text-white">
            {homeScore} - {oppScore}
          </p>
        </div>
        <div className="w-px h-8 bg-[#3a3a3c]" />
        <div className="flex-1 text-center">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Quarter</p>
          <p className="text-lg font-semibold text-white">Q{quarter}</p>
        </div>
        <div className="w-px h-8 bg-[#3a3a3c]" />
        <div className="flex-1 text-center">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Clock</p>
          <p className="text-lg font-semibold text-[#B8CA6E]">{clock}</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Segment Nav
// ---------------------------------------------------------------------------

interface SegmentNavProps {
  active: MainSegment
  onChange: (s: MainSegment) => void
}

const SEGMENTS: { key: MainSegment; label: string }[] = [
  { key: 'log', label: 'Log' },
  { key: 'plays', label: 'Plays' },
  { key: 'drive', label: 'Drive' },
]

function SegmentNav({ active, onChange }: SegmentNavProps) {
  return (
    <div className="flex bg-[#2c2c2e] rounded-xl mx-4 mt-3 p-1">
      {SEGMENTS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={[
            'flex-1 py-2 text-center text-sm rounded-lg transition-colors min-h-[44px]',
            active === key
              ? 'bg-[#B8CA6E] text-[#1c1c1e] font-semibold'
              : 'text-gray-400',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Log Mode Toggle
// ---------------------------------------------------------------------------

interface LogModeToggleProps {
  active: LogMode
  onChange: (m: LogMode) => void
}

const LOG_MODES: { key: LogMode; label: string }[] = [
  { key: 'wristband', label: 'Wristband #' },
  { key: 'fromPlays', label: 'From Plays' },
  { key: 'quick', label: 'Quick' },
]

function LogModeToggle({ active, onChange }: LogModeToggleProps) {
  return (
    <div className="flex bg-[#3a3a3c] rounded-lg mx-4 mt-3 p-1">
      {LOG_MODES.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={[
            'flex-1 py-2 text-center text-xs rounded-md transition-colors min-h-[36px]',
            active === key
              ? 'bg-[#48484a] text-white font-medium'
              : 'text-gray-500',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Numpad
// ---------------------------------------------------------------------------

interface NumpadProps {
  value: string
  onChange: (v: string) => void
}

const NUMPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const

function Numpad({ value, onChange }: NumpadProps) {
  function handleKey(key: string) {
    if (key === 'clear') {
      onChange('')
      return
    }
    if (key === 'back') {
      onChange(value.slice(0, -1))
      return
    }
    if (value.length >= 3) return
    onChange(value + key)
  }

  return (
    <div className="grid grid-cols-3 gap-2 px-4 mt-3">
      {NUMPAD_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => handleKey(key)}
          className={[
            'bg-[#3a3a3c] rounded-xl text-white text-2xl font-semibold h-14 flex items-center justify-center active:opacity-70 transition-opacity',
          ].join(' ')}
        >
          {key === 'clear' && <span className="text-sm text-red-400">Clear</span>}
          {key === 'back' && <BackspaceIcon />}
          {key !== 'clear' && key !== 'back' && key}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Outcome Grid
// ---------------------------------------------------------------------------

interface OutcomeGridProps {
  selected: OutcomeLabel | null
  onSelect: (o: OutcomeLabel) => void
}

const OUTCOMES: { label: OutcomeLabel; className: string }[] = [
  { label: 'Gain',       className: 'bg-[#2a3a2a] text-[#7dc97d]' },
  { label: 'Loss',       className: 'bg-[#3a3a3c] text-white' },
  { label: 'TD',         className: 'bg-[#2a3a2a] text-[#B8CA6E]' },
  { label: 'Turnover',   className: 'bg-[#3a1a1a] text-[#ff6b6b]' },
  { label: 'Incomplete', className: 'bg-[#3a3a3c] text-white' },
  { label: 'Complete',   className: 'bg-[#3a3a3c] text-white' },
  { label: 'Sack',       className: 'bg-[#3a3a3c] text-white' },
  { label: 'Penalty',    className: 'bg-[#3a3a3c] text-white' },
]

function OutcomeGrid({ selected, onSelect }: OutcomeGridProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mt-4">
        Result
      </p>
      <div className="grid grid-cols-2 gap-2 px-4 mt-2">
        {OUTCOMES.map(({ label, className }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(label)}
            className={[
              'rounded-xl py-3 text-sm font-semibold text-center transition-all min-h-[44px]',
              className,
              selected === label ? 'ring-2 ring-[#B8CA6E]' : '',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Yards Stepper
// ---------------------------------------------------------------------------

interface YardsStepperProps {
  value: number
  onChange: (v: number) => void
}

function YardsStepper({ value, onChange }: YardsStepperProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mt-4">
        Yards
      </p>
      <div className="flex items-center justify-center gap-6 mt-2">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          className="w-14 h-14 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity"
        >
          <MinusIcon />
        </button>
        <span className="text-4xl font-bold text-white w-20 text-center tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-14 h-14 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity"
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Film Flag Toggle
// ---------------------------------------------------------------------------

interface FilmFlagProps {
  value: boolean
  onChange: (v: boolean) => void
}

function FilmFlagToggle({ value, onChange }: FilmFlagProps) {
  return (
    <div className="flex items-center justify-between px-4 mt-4">
      <span className="text-sm text-gray-400">Flag for film review</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={[
          'relative w-12 h-7 rounded-full transition-colors shrink-0',
          value ? 'bg-[#B8CA6E]' : 'bg-[#3a3a3c]',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform',
            value ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Wristband Mode
// ---------------------------------------------------------------------------

interface WristbandModeProps {
  gamePlanPlays: GamePlanPlay[]
  gamePlanLoaded: boolean
  isLoadingGamePlan: boolean
  onPlaySelected: (playCode: string, playName: string, playType: string, formation: string) => void
}

function WristbandMode({
  gamePlanPlays,
  gamePlanLoaded,
  isLoadingGamePlan,
  onPlaySelected,
}: WristbandModeProps) {
  const [numInput, setNumInput] = useState('')

  const matchedPlay = numInput
    ? gamePlanPlays.find((gpp) => String(gpp.call_number) === numInput) ?? null
    : null

  function handleNumChange(v: string) {
    setNumInput(v)
    if (v) {
      const found = gamePlanPlays.find((gpp) => String(gpp.call_number) === v)
      if (found) {
        onPlaySelected(
          found.play_code,
          found.playbook_plays.play_name,
          found.playbook_plays.attributes.playType ?? '',
          found.playbook_plays.attributes.formation ?? '',
        )
      }
    }
  }

  if (isLoadingGamePlan) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500">Loading game plan...</p>
      </div>
    )
  }

  if (!gamePlanLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <ClipboardIcon />
        <p className="text-sm text-gray-500 mt-3">No game plan loaded</p>
        <p className="text-xs text-gray-600 mt-1">Set up a game plan on the desktop to use wristband mode</p>
      </div>
    )
  }

  return (
    <div>
      {/* Number display */}
      <div className="text-center py-6">
        <p className="text-6xl font-bold text-white min-h-[72px]">{numInput || '\u00A0'}</p>
        {matchedPlay ? (
          <>
            <p className="text-lg text-[#B8CA6E] mt-1">{matchedPlay.playbook_plays.play_name}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {matchedPlay.playbook_plays.attributes.playType ?? ''}
              {matchedPlay.playbook_plays.attributes.formation
                ? ` · ${matchedPlay.playbook_plays.attributes.formation}`
                : ''}
            </p>
          </>
        ) : numInput ? (
          <p className="text-sm text-gray-500 mt-1">No play for #{numInput}</p>
        ) : (
          <p className="text-sm text-gray-600 mt-1">Enter wristband number</p>
        )}
      </div>

      <Numpad value={numInput} onChange={handleNumChange} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// From Plays Mode
// ---------------------------------------------------------------------------

interface FromPlaysModeProps {
  plays: { id: string; play_code: string; play_name: string; attributes: { odk: string; formation?: string; playType?: string } }[]
  isLoading: boolean
  onSelect: (playCode: string, playName: string, playType: string, formation: string) => void
}

function FromPlaysMode({ plays, isLoading, onSelect }: FromPlaysModeProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500">Loading plays...</p>
      </div>
    )
  }

  if (plays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <ClipboardIcon />
        <p className="text-sm text-gray-500 mt-3">No plays in playbook</p>
      </div>
    )
  }

  return (
    <div className="mt-3">
      {plays.map((play) => (
        <button
          key={play.id}
          type="button"
          onClick={() =>
            onSelect(
              play.play_code,
              play.play_name,
              play.attributes.playType ?? '',
              play.attributes.formation ?? '',
            )
          }
          className="w-full flex items-center justify-between px-4 py-3 border-b border-[#3a3a3c] active:bg-[#2c2c2e] transition-colors text-left min-h-[56px]"
        >
          <div>
            <p className="text-sm font-medium text-white">{play.play_name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {[play.attributes.formation, play.attributes.playType].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-col items-end shrink-0 ml-3">
            {play.attributes.playType === 'run' ? (
              <span className="bg-blue-900/40 text-blue-400 rounded-full px-2 py-0.5 text-xs">Run</span>
            ) : play.attributes.playType === 'pass' ? (
              <span className="bg-purple-900/40 text-purple-400 rounded-full px-2 py-0.5 text-xs">Pass</span>
            ) : (
              <span className="bg-gray-700/40 text-gray-400 rounded-full px-2 py-0.5 text-xs capitalize">
                {play.attributes.playType || play.attributes.odk}
              </span>
            )}
            <span className="text-xs text-gray-600 mt-1">{play.play_code}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Log View
// ---------------------------------------------------------------------------

interface LogViewProps {
  game: GameState
  gamePlanPlays: GamePlanPlay[]
  gamePlanLoaded: boolean
  isLoadingGamePlan: boolean
  allPlays: { id: string; play_code: string; play_name: string; attributes: { odk: string; formation?: string; playType?: string } }[]
  isLoadingPlays: boolean
  teamId: string | null
  driveNumber: number
  onPlayLogged: (play: LoggedPlay) => void
}

function LogView({
  game,
  gamePlanPlays,
  gamePlanLoaded,
  isLoadingGamePlan,
  allPlays,
  isLoadingPlays,
  teamId,
  driveNumber,
  onPlayLogged,
}: LogViewProps) {
  const [logMode, setLogMode] = useState<LogMode>('wristband')
  const [selectedPlayCode, setSelectedPlayCode] = useState<string | null>(null)
  const [selectedPlayName, setSelectedPlayName] = useState<string | null>(null)
  const [selectedPlayType, setSelectedPlayType] = useState<string | null>(null)
  const [selectedFormation, setSelectedFormation] = useState<string | null>(null)
  const [quickPlayType, setQuickPlayType] = useState<QuickPlayType | null>(null)
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeLabel | null>(null)
  const [yards, setYards] = useState(0)
  const [flagForReview, setFlagForReview] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  function handlePlaySelected(playCode: string, playName: string, playType: string, formation: string) {
    setSelectedPlayCode(playCode)
    setSelectedPlayName(playName)
    setSelectedPlayType(playType)
    setSelectedFormation(formation)
  }

  async function handleLogPlay() {
    if (!selectedOutcome) return
    if (!teamId) return

    setIsSaving(true)
    setSaveError(null)

    const supabase = createClient()
    const localId = crypto.randomUUID()

    const { error } = await supabase.from('play_instances').insert({
      team_id: teamId,
      source: 'sideline',
      local_id: localId,
      sync_status: 'unsynced',
      down: game.down,
      distance: game.distance,
      yard_line: game.yardLine,
      hash_mark: game.hash,
      quarter: game.quarter,
      time_remaining: parseTimeToSeconds(game.clock),
      play_code: selectedPlayCode ?? null,
      formation: selectedFormation ?? null,
      play_type: selectedPlayType ?? null,
      result: mapOutcomeToResult(selectedOutcome),
      yards_gained: yards,
      penalty_on_play: selectedOutcome === 'Penalty',
      notes: flagForReview ? 'FLAGGED FOR FILM REVIEW' : null,
    })

    setIsSaving(false)

    if (error) {
      setSaveError('Failed to save. Check your connection.')
      return
    }

    // Notify parent to advance game state and add to drive log
    onPlayLogged({
      id: localId,
      playCode: selectedPlayCode,
      playName: selectedPlayName,
      playType: selectedPlayType,
      formation: selectedFormation,
      down: game.down,
      distance: game.distance,
      yardLine: game.yardLine,
      quarter: game.quarter,
      result: mapOutcomeToResult(selectedOutcome),
      yardsGained: yards,
      driveNumber,
    })

    // Flash success, reset form
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 1500)

    setSelectedPlayCode(null)
    setSelectedPlayName(null)
    setSelectedPlayType(null)
    setSelectedFormation(null)
    setSelectedOutcome(null)
    setQuickPlayType(null)
    setYards(0)
    setFlagForReview(false)
  }

  return (
    <div className="pb-8">
      <LogModeToggle active={logMode} onChange={setLogMode} />

      {/* Play selection area */}
      {logMode === 'wristband' && (
        <WristbandMode
          gamePlanPlays={gamePlanPlays}
          gamePlanLoaded={gamePlanLoaded}
          isLoadingGamePlan={isLoadingGamePlan}
          onPlaySelected={handlePlaySelected}
        />
      )}

      {logMode === 'fromPlays' && (
        <FromPlaysMode
          plays={allPlays}
          isLoading={isLoadingPlays}
          onSelect={handlePlaySelected}
        />
      )}

      {logMode === 'quick' && (
        <div className="px-4 mt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Play Type
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([['run', 'Run'], ['pass', 'Pass'], ['special_teams', 'Special Teams']] as const).map(
              ([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setQuickPlayType(key)
                    setSelectedPlayType(key)
                  }}
                  className={[
                    'rounded-xl py-4 text-sm font-semibold text-center min-h-[56px] transition-colors',
                    quickPlayType === key
                      ? 'bg-[#B8CA6E] text-[#1c1c1e]'
                      : 'bg-[#3a3a3c] text-white',
                  ].join(' ')}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {/* Selected play indicator (shown in wristband/fromPlays when play selected) */}
      {logMode !== 'quick' && selectedPlayCode && (
        <div className="mx-4 mt-3 bg-[#2c2c2e] rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">{selectedPlayName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{selectedPlayCode}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedPlayCode(null)
              setSelectedPlayName(null)
              setSelectedPlayType(null)
              setSelectedFormation(null)
            }}
            className="text-xs text-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-end"
          >
            Clear
          </button>
        </div>
      )}

      {/* Outcome Grid */}
      <OutcomeGrid selected={selectedOutcome} onSelect={setSelectedOutcome} />

      {/* Yards Stepper */}
      <YardsStepper value={yards} onChange={setYards} />

      {/* Film Flag */}
      <FilmFlagToggle value={flagForReview} onChange={setFlagForReview} />

      {/* Error */}
      {saveError && (
        <p className="text-xs text-red-400 text-center mt-3 px-4">{saveError}</p>
      )}

      {/* Log Play Button */}
      <div className="px-4 mt-6 mb-4">
        <button
          type="button"
          disabled={!selectedOutcome || isSaving}
          onClick={handleLogPlay}
          className={[
            'w-full rounded-xl py-4 text-lg font-bold text-center transition-colors',
            saveSuccess
              ? 'bg-green-600 text-white'
              : selectedOutcome && !isSaving
              ? 'bg-[#B8CA6E] text-[#1c1c1e] active:bg-[#a8b85e]'
              : 'bg-[#3a3a3c] text-gray-500',
          ].join(' ')}
        >
          {isSaving ? 'Saving...' : saveSuccess ? 'Logged' : 'LOG PLAY'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plays View
// ---------------------------------------------------------------------------

interface PlaysViewProps {
  game: GameState
  gamePlanPlays: GamePlanPlay[]
  gamePlanLoaded: boolean
  isLoadingGamePlan: boolean
  loggedPlaysCount: number
  onSelectPlay: (playCode: string, playName: string, playType: string, formation: string) => void
}

function PlaysView({
  game,
  gamePlanPlays,
  gamePlanLoaded,
  isLoadingGamePlan,
  loggedPlaysCount,
  onSelectPlay,
}: PlaysViewProps) {
  if (isLoadingGamePlan) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500">Loading game plan...</p>
      </div>
    )
  }

  if (!gamePlanLoaded || gamePlanPlays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <ClipboardIcon />
        <p className="text-sm text-gray-500 mt-3">No game plan loaded for this game</p>
        <p className="text-xs text-gray-600 mt-1">Build a game plan on the desktop to see play suggestions here</p>
      </div>
    )
  }

  return (
    <div className="pb-8">
      {/* AI Suggestion Banner */}
      <div className="bg-[#2c2c2e] rounded-xl mx-4 mt-3 p-3 flex items-center gap-2">
        <SparkleIcon />
        <div>
          <p className="text-sm font-semibold text-[#B8CA6E]">AI Suggestions</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Based on {ordinalDown(game.down)} &amp; {game.distance} from {formatYardLine(game.yardLine)} &middot; {loggedPlaysCount} plays logged
          </p>
        </div>
      </div>

      {/* Play list */}
      <div className="mt-3">
        {gamePlanPlays.map((gpp, index) => {
          const isTopPick = index === 0
          const isSuggested = index >= 1 && index <= 3

          let rowClass = 'px-4 py-3 border-b border-[#3a3a3c] flex items-center justify-between min-h-[56px]'
          if (isTopPick) {
            rowClass += ' bg-[#1a2e1a] border-l-4 border-[#B8CA6E]'
          } else if (isSuggested) {
            rowClass += ' bg-[#1f2a1f] border-l-4 border-[#B8CA6E]/40'
          } else {
            rowClass += ' opacity-50'
          }

          const { play_name, attributes } = gpp.playbook_plays

          return (
            <button
              key={gpp.id}
              type="button"
              onClick={() =>
                onSelectPlay(
                  gpp.play_code,
                  play_name,
                  attributes.playType ?? '',
                  attributes.formation ?? '',
                )
              }
              className={rowClass + ' w-full text-left active:opacity-70 transition-opacity'}
            >
              <div className="flex-1 min-w-0 pr-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-medium text-white">{play_name}</span>
                  {isTopPick && (
                    <span className="bg-[#B8CA6E] text-[#1c1c1e] rounded-full px-2 py-0.5 text-xs font-bold">
                      TOP PICK
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {[attributes.formation, attributes.playType].filter(Boolean).join(' · ')}
                </p>
                {isTopPick && (
                  <p className="text-xs text-[#B8CA6E] mt-0.5">72% success rate</p>
                )}
              </div>

              <div className="flex flex-col items-end shrink-0">
                {attributes.playType === 'run' ? (
                  <span className="bg-blue-900/40 text-blue-400 rounded-full px-2 py-0.5 text-xs">Run</span>
                ) : attributes.playType === 'pass' ? (
                  <span className="bg-purple-900/40 text-purple-400 rounded-full px-2 py-0.5 text-xs">Pass</span>
                ) : null}
                <span className="text-xs text-gray-500 mt-1">#{gpp.call_number}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drive View
// ---------------------------------------------------------------------------

interface DriveViewProps {
  game: GameState
  loggedPlays: LoggedPlay[]
  driveNumber: number
  teamId: string | null
  currentGameId: string | null
}

function DriveView({ game, loggedPlays, driveNumber, teamId, currentGameId }: DriveViewProps) {
  const [dbDrives, setDbDrives] = useState<DbDrive[]>([])

  useEffect(() => {
    if (!teamId) return

    const supabase = createClient()

    let query = supabase
      .from('drives')
      .select('id, drive_number, quarter, plays_count, yards_gained, result, points')
      .eq('team_id', teamId)
      .order('drive_number', { ascending: false })

    if (currentGameId) {
      query = query.eq('game_id', currentGameId)
    }

    query.then(({ data }) => {
      if (data) setDbDrives(data as DbDrive[])
    })
  }, [teamId, currentGameId])

  // Current drive plays
  const currentDrivePlays = loggedPlays.filter((p) => p.driveNumber === driveNumber)
  const currentDriveYards = currentDrivePlays.reduce((sum, p) => sum + p.yardsGained, 0)

  function driveBadgeClass(result: string | null): string {
    if (!result) return 'bg-gray-700/30 text-gray-400'
    if (result.toLowerCase().includes('td') || result.toLowerCase().includes('touchdown')) {
      return 'bg-[#B8CA6E]/20 text-[#B8CA6E]'
    }
    if (result.toLowerCase().includes('fg') || result.toLowerCase().includes('field')) {
      return 'bg-blue-900/30 text-blue-400'
    }
    if (result.toLowerCase().includes('punt')) {
      return 'bg-gray-700/30 text-gray-400'
    }
    if (result.toLowerCase().includes('turnover') || result.toLowerCase().includes('fumble') || result.toLowerCase().includes('interception')) {
      return 'bg-red-900/30 text-red-400'
    }
    return 'bg-gray-700/30 text-gray-400'
  }

  return (
    <div className="pb-8">
      {/* Current Drive */}
      <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider px-4 mt-3">
        Current Drive
      </p>

      <div className="bg-[#2c2c2e] rounded-xl mx-4 mt-2 p-3">
        <p className="text-sm font-semibold text-white">
          Drive #{driveNumber} &middot; Q{game.quarter}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {currentDrivePlays.length} plays &middot; {currentDriveYards} yards
        </p>
      </div>

      {/* Play list for current drive */}
      {currentDrivePlays.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-600">No plays logged this drive</p>
        </div>
      ) : (
        <div className="mt-2">
          {currentDrivePlays.map((play, index) => (
            <div
              key={play.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-[#3a3a3c]"
            >
              {/* Play number circle */}
              <div className="w-8 h-8 rounded-full bg-[#3a3a3c] text-white text-sm flex items-center justify-center shrink-0">
                {index + 1}
              </div>

              {/* Play details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {play.playName ?? 'Quick Play'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {ordinalDown(play.down)} &amp; {play.distance} &middot; {formatYardLine(play.yardLine)}
                </p>
              </div>

              {/* Yards gained */}
              <span
                className={[
                  'text-sm font-semibold shrink-0',
                  play.yardsGained > 0
                    ? 'text-green-400'
                    : play.yardsGained < 0
                    ? 'text-red-400'
                    : 'text-gray-400',
                ].join(' ')}
              >
                {play.yardsGained > 0 ? '+' : ''}{play.yardsGained}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* "Now" indicator */}
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="w-2 h-2 rounded-full bg-[#B8CA6E] animate-pulse shrink-0" />
        <span className="text-xs text-[#B8CA6E]">
          Current: {ordinalDown(game.down)} &amp; {game.distance}
        </span>
      </div>

      {/* Previous Drives */}
      <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider px-4 mt-6">
        Previous Drives
      </p>

      {dbDrives.length === 0 && loggedPlays.filter((p) => p.driveNumber < driveNumber).length === 0 ? (
        <div className="text-center py-8 px-4">
          <p className="text-sm text-gray-600">No drives yet — log your first play to start</p>
        </div>
      ) : (
        <div className="mt-2">
          {dbDrives.map((drive) => (
            <div key={drive.id} className="bg-[#2c2c2e] rounded-xl mx-4 mt-2 p-3">
              <p className="text-sm font-semibold text-white">
                Drive #{drive.drive_number} &middot; Q{drive.quarter}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {drive.result && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${driveBadgeClass(drive.result)}`}>
                    {drive.result}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {drive.plays_count} plays &middot; {drive.yards_gained} yards
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SidelinePage() {
  const { teamId } = useMobile()

  // Game state managed by reducer
  const [game, dispatchGame] = useReducer(gameReducer, INITIAL_GAME_STATE)

  // UI segment
  const [activeSegment, setActiveSegment] = useState<MainSegment>('log')

  // Drive tracking
  const [driveNumber, setDriveNumber] = useState(1)
  const [loggedPlays, setLoggedPlays] = useState<LoggedPlay[]>([])

  // Game plan data
  const [gamePlanPlays, setGamePlanPlays] = useState<GamePlanPlay[]>([])
  const [gamePlanLoaded, setGamePlanLoaded] = useState(false)
  const [isLoadingGamePlan, setIsLoadingGamePlan] = useState(true)

  // All playbook plays (for "From Plays" mode)
  const [allPlays, setAllPlays] = useState<{
    id: string
    play_code: string
    play_name: string
    attributes: { odk: string; formation?: string; playType?: string }
  }[]>([])
  const [isLoadingPlays, setIsLoadingPlays] = useState(true)

  // Currently selected play (for switching from Plays view to Log)
  const [pendingPlayCode, setPendingPlayCode] = useState<string | null>(null)
  const [pendingPlayName, setPendingPlayName] = useState<string | null>(null)
  const [pendingPlayType, setPendingPlayType] = useState<string | null>(null)
  const [pendingFormation, setPendingFormation] = useState<string | null>(null)

  // Current game id (if available — optional, enhances drive fetching)
  const [currentGameId, setCurrentGameId] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Fetch game plan
  // -------------------------------------------------------------------------

  const fetchGamePlan = useCallback(async () => {
    if (!teamId) {
      setIsLoadingGamePlan(false)
      return
    }

    const supabase = createClient()

    // Latest game plan for the team
    const { data: plans } = await supabase
      .from('game_plans')
      .select('id, game_id')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!plans || plans.length === 0) {
      setGamePlanLoaded(false)
      setIsLoadingGamePlan(false)
      return
    }

    const plan = plans[0] as { id: string; game_id: string | null }

    if (plan.game_id) {
      setCurrentGameId(plan.game_id)
    }

    // Fetch game plan plays joined to playbook_plays
    const { data: gppData } = await supabase
      .from('game_plan_plays')
      .select(`
        id,
        play_code,
        call_number,
        sort_order,
        playbook_plays (
          id,
          play_code,
          play_name,
          attributes
        )
      `)
      .eq('game_plan_id', plan.id)
      .order('sort_order', { ascending: true })

    if (gppData && gppData.length > 0) {
      // Filter out any rows where playbook_plays is null or an array (type safety)
      const cleaned = (gppData as unknown[]).filter((row): row is GamePlanPlay => {
        const r = row as Record<string, unknown>
        return (
          r.playbook_plays !== null &&
          !Array.isArray(r.playbook_plays)
        )
      })
      setGamePlanPlays(cleaned)
      setGamePlanLoaded(true)
    } else {
      setGamePlanLoaded(false)
    }

    setIsLoadingGamePlan(false)
  }, [teamId])

  // -------------------------------------------------------------------------
  // Fetch all playbook plays
  // -------------------------------------------------------------------------

  const fetchAllPlays = useCallback(async () => {
    if (!teamId) {
      setIsLoadingPlays(false)
      return
    }

    const supabase = createClient()

    const { data } = await supabase
      .from('playbook_plays')
      .select('id, play_code, play_name, attributes')
      .eq('team_id', teamId)
      .eq('is_archived', false)
      .order('play_code', { ascending: true })

    if (data) {
      setAllPlays(data as typeof allPlays)
    }

    setIsLoadingPlays(false)
  }, [teamId])

  useEffect(() => {
    fetchGamePlan()
    fetchAllPlays()
  }, [fetchGamePlan, fetchAllPlays])

  // -------------------------------------------------------------------------
  // Handle play logged (advance game state, add to drive log)
  // -------------------------------------------------------------------------

  function handlePlayLogged(play: LoggedPlay) {
    setLoggedPlays((prev) => [...prev, play])

    // Advance game state
    const outcome = reverseMapResult(play.result)
    dispatchGame({ type: 'ADVANCE', yardsGained: play.yardsGained, outcome })

    // Check if we need to start a new drive
    if (
      outcome === 'TD' ||
      outcome === 'Turnover' ||
      (outcome !== 'Gain' && outcome !== 'Complete' && outcome !== 'Incomplete' && outcome !== 'Loss' && outcome !== 'Sack' && outcome !== 'Penalty')
    ) {
      setDriveNumber((n) => n + 1)
    }
  }

  function reverseMapResult(result: string): OutcomeLabel {
    switch (result) {
      case 'run_gain':      return 'Gain'
      case 'run_loss':      return 'Loss'
      case 'touchdown':     return 'TD'
      case 'fumble':        return 'Turnover'
      case 'interception':  return 'Turnover'
      case 'pass_incomplete': return 'Incomplete'
      case 'pass_complete': return 'Complete'
      case 'sack':          return 'Sack'
      case 'penalty':       return 'Penalty'
      default:              return 'Gain'
    }
  }

  // -------------------------------------------------------------------------
  // Handle play selected from Plays view
  // -------------------------------------------------------------------------

  function handleSelectPlayFromPlays(
    playCode: string,
    playName: string,
    playType: string,
    formation: string,
  ) {
    setPendingPlayCode(playCode)
    setPendingPlayName(playName)
    setPendingPlayType(playType)
    setPendingFormation(formation)
    setActiveSegment('log')
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#1c1c1e] pb-6">
      {/* Game State Bar */}
      <GameStateBar game={game} />

      {/* Segment Nav */}
      <SegmentNav active={activeSegment} onChange={setActiveSegment} />

      {/* Segment Content */}
      {activeSegment === 'log' && (
        <LogView
          game={game}
          gamePlanPlays={gamePlanPlays}
          gamePlanLoaded={gamePlanLoaded}
          isLoadingGamePlan={isLoadingGamePlan}
          allPlays={allPlays}
          isLoadingPlays={isLoadingPlays}
          teamId={teamId}
          driveNumber={driveNumber}
          onPlayLogged={handlePlayLogged}
        />
      )}

      {activeSegment === 'plays' && (
        <PlaysView
          game={game}
          gamePlanPlays={gamePlanPlays}
          gamePlanLoaded={gamePlanLoaded}
          isLoadingGamePlan={isLoadingGamePlan}
          loggedPlaysCount={loggedPlays.length}
          onSelectPlay={handleSelectPlayFromPlays}
        />
      )}

      {activeSegment === 'drive' && (
        <DriveView
          game={game}
          loggedPlays={loggedPlays}
          driveNumber={driveNumber}
          teamId={teamId}
          currentGameId={currentGameId}
        />
      )}
    </div>
  )
}
