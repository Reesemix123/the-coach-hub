'use client'

import { useState, useEffect, useCallback, useReducer, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useMobile } from '@/app/(mobile)/MobileContext'
import { calculateBallPlacement, toAbsolute, toRelative } from '@/lib/football/fieldPosition'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MainSegment = 'log' | 'plays' | 'drive'
type LogMode = 'wristband' | 'fromPlays' | 'quick'
type QuickPlayType = 'run' | 'pass' | 'special_teams'
type STSubType = 'kickoff' | 'punt' | 'field_goal_pat'
type HashMark = 'left' | 'middle' | 'right'
type OutcomeLabel = 'TD' | 'Turnover' | 'Incomplete' | 'Complete' | 'Sack' | 'Penalty' | 'Return' | 'Fair Catch' | 'Touchback' | 'Punted' | 'Blocked' | 'Good' | 'No Good'
type TryType = 'pat' | '2pt'
type PendingTry = { scoringTeam: Possession } | null
type PendingBlockedTD = { blockingTeam: Possession } | null

type Possession = 'us' | 'them'

interface GameState {
  down: number
  distance: number
  yardLine: number
  hash: HashMark
  quarter: number
  clock: string
  homeScore: number
  oppScore: number
  possession: Possession
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
  outcomeLabel: OutcomeLabel | null
  stSubType: STSubType | null
  possession: Possession
  yardsGained: number
  kickYards: number
  driveNumber: number
}

interface GamePlanPlay {
  id: string
  play_code: string
  call_number: number
  sort_order: number
  situation: string | null
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

interface ScheduledGame {
  id: string
  opponent: string | null
  date: string
  location: string | null
  start_time: string | null
}

// ---------------------------------------------------------------------------
// Reducer for game state
// ---------------------------------------------------------------------------

interface UndoSnapshot {
  gameState: GameState
  driveNumber: number
  playsCount: number
}

type GameAction =
  | { type: 'SET_DOWN'; down: number }
  | { type: 'SET_DISTANCE'; distance: number }
  | { type: 'SET_YARD_LINE'; yardLine: number }
  | { type: 'SET_HASH'; hash: HashMark }
  | { type: 'SET_QUARTER'; quarter: number }
  | { type: 'SET_CLOCK'; clock: string }
  | { type: 'SET_HOME_SCORE'; score: number }
  | { type: 'SET_OPP_SCORE'; score: number }
  | { type: 'SET_POSSESSION'; possession: Possession }
  | { type: 'ADVANCE'; yardsGained: number; outcome: OutcomeLabel; possession: Possession; stSubType?: STSubType | null; kickYards?: number }
  | { type: 'RESTORE'; state: GameState }

// TODO: PRE-LAUNCH - pull from team league settings (kickoff_yard_line)
const KICKOFF_YARD_LINE = 40

const INITIAL_GAME_STATE: GameState = {
  down: 1,
  distance: 10,
  yardLine: 25,
  hash: 'middle',
  quarter: 1,
  clock: '15:00',
  homeScore: 0,
  oppScore: 0,
  possession: 'us',
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
    case 'SET_POSSESSION':
      return { ...state, possession: action.possession }
    case 'ADVANCE': {
      const { yardsGained, outcome, possession, stSubType: actionStSubType, kickYards: actionKickYards } = action
      const flip: Possession = possession === 'us' ? 'them' : 'us'
      const scoreKey = possession === 'us' ? 'homeScore' : 'oppScore'
      // TODO: PRE-LAUNCH - pull from team league settings (field_length)
      const fieldLength = 100
      // TODO: PRE-LAUNCH - pull from team league settings (touchback_yard_line)
      const touchbackYardLine = 20

      // Map possession to team designation: 'us' = 'A' (home), 'them' = 'B' (opponent)
      const possTeam = possession === 'us' ? 'A' as const : 'B' as const
      const oppTeam = possession === 'us' ? 'B' as const : 'A' as const

      // TD: score 6 for possessing team, flip possession (other team kicks off)
      if (outcome === 'TD') {
        return { ...state, down: 1, distance: 10, yardLine: 25, [scoreKey]: state[scoreKey] + 6, possession: flip }
      }
      // Return that goes for a TD (yards reach end zone)
      if (outcome === 'Return' && yardsGained > 0 && (state.yardLine + yardsGained) >= fieldLength) {
        return { ...state, down: 1, distance: 10, yardLine: 25, [scoreKey]: state[scoreKey] + 6, possession: flip }
      }
      // FG Good: always 3 points (PAT/2pt handled separately via TrySheet)
      if (outcome === 'Good') {
        return { ...state, down: 1, distance: 10, yardLine: 25, [scoreKey]: state[scoreKey] + 3, possession: flip }
      }
      // Turnover: flip possession, mirror field position
      if (outcome === 'Turnover' || outcome === 'Blocked') {
        return { ...state, down: 1, distance: 10, yardLine: clampYardLine(fieldLength - state.yardLine), possession: flip }
      }
      // Touchback / Fair Catch: use calculateBallPlacement for proper field position
      if (outcome === 'Touchback') {
        const isTouchback = true
        // Receiving team is the opponent of whoever is kicking (possessing team kicks)
        const receivingTeam = oppTeam
        const absolute = calculateBallPlacement({
          fieldLength,
          landYardLine: 0,
          landTeam: receivingTeam,
          returnYards: 0,
          receivingTeam,
          touchback: isTouchback,
          touchbackYardLine,
        })
        const newYl = toRelative(absolute, receivingTeam, fieldLength)
        return { ...state, down: 1, distance: 10, yardLine: clampYardLine(newYl), possession: flip }
      }
      if (outcome === 'Fair Catch') {
        // Fair catch: ball spotted where caught. kickYards determines land spot from kicker's position.
        const kd = actionKickYards ?? 0
        if (kd > 0) {
          // Kickoffs from OWN 40, punts from current yard line
          const kickerYardLine = actionStSubType === 'kickoff' ? KICKOFF_YARD_LINE : state.yardLine
          const kickerAbsolute = toAbsolute(kickerYardLine, possTeam, fieldLength)
          const landAbsolute = possTeam === 'A' ? kickerAbsolute + kd : kickerAbsolute - kd
          const receivingTeam = oppTeam
          const newYl = toRelative(Math.max(1, Math.min(fieldLength - 1, landAbsolute)), receivingTeam, fieldLength)
          return { ...state, down: 1, distance: 10, yardLine: clampYardLine(newYl), possession: flip }
        }
        // No kick distance: simple mirror
        return { ...state, down: 1, distance: 10, yardLine: clampYardLine(fieldLength - state.yardLine), possession: flip }
      }
      // No Good: no score, flip possession (missed FG = other team gets ball)
      if (outcome === 'No Good') {
        return { ...state, down: 1, distance: 10, yardLine: clampYardLine(fieldLength - state.yardLine), possession: flip }
      }
      // Return (punt or kickoff): use calculateBallPlacement
      // Receiving team is ALWAYS the opponent of the kicking team
      if (outcome === 'Return') {
        const kd = actionKickYards ?? 0
        const receivingTeam = oppTeam

        if (kd > 0) {
          // Kickoffs originate from OWN 40 (NFHS default), punts from current yard line
          const kickerYardLine = actionStSubType === 'kickoff' ? KICKOFF_YARD_LINE : state.yardLine
          const kickerAbsolute = toAbsolute(kickerYardLine, possTeam, fieldLength)
          const landAbsolute = possTeam === 'A' ? kickerAbsolute + kd : kickerAbsolute - kd

          // Check for touchback (kick into end zone)
          const isTouchback = landAbsolute <= 0 || landAbsolute >= fieldLength

          const absolute = calculateBallPlacement({
            fieldLength,
            landYardLine: isTouchback ? 0 : (receivingTeam === 'A' ? landAbsolute : fieldLength - landAbsolute),
            landTeam: receivingTeam,
            returnYards: yardsGained,
            receivingTeam,
            touchback: isTouchback,
            touchbackYardLine,
          })

          if (absolute === -1) {
            console.warn('[Sideline] Safety detected — defaulting to yard line 1')
            return { ...state, down: 1, distance: 10, yardLine: 1, possession: flip }
          }

          const newYl = toRelative(absolute, receivingTeam, fieldLength)
          // Both punt and kickoff returns flip possession (receiving team gets ball)
          return { ...state, down: 1, distance: 10, yardLine: clampYardLine(newYl), possession: flip }
        }

        // No kick distance: fall back to simple advancement with flip
        const newYl = clampYardLine(state.yardLine + yardsGained)
        return { ...state, down: 1, distance: 10, yardLine: clampYardLine(fieldLength - newYl), possession: flip }
      }
      // Normal play advancement
      const newYardLine = clampYardLine(state.yardLine + yardsGained)
      const newDistance = state.distance - yardsGained
      if (newDistance <= 0 || outcome === 'Complete' && yardsGained >= state.distance) {
        return { ...state, down: 1, distance: 10, yardLine: newYardLine }
      }
      if (state.down >= 4) {
        // Turnover on downs — flip possession
        return { ...state, down: 1, distance: 10, yardLine: clampYardLine(100 - newYardLine), possession: flip }
      }
      return {
        ...state,
        down: state.down + 1,
        distance: Math.max(1, newDistance),
        yardLine: newYardLine,
      }
    }
    case 'RESTORE':
      return action.state
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

function formatYardLine(yl: number, possession: Possession = 'us'): string {
  if (yl === 50) return 'MIDFIELD'
  if (possession === 'us') {
    if (yl < 50) return `OWN ${yl}`
    return `OPP ${100 - yl}`
  }
  // Their ball: flip OWN/OPP from our perspective
  if (yl < 50) return `OPP ${yl}`
  return `OWN ${100 - yl}`
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

function mapOutcomeToResult(outcome: OutcomeLabel | null, playType: string | null, yards: number): string {
  if (outcome) {
    switch (outcome) {
      case 'TD':         return 'touchdown'
      case 'Turnover':   return 'fumble'
      case 'Incomplete': return 'pass_incomplete'
      case 'Complete':   return 'pass_complete'
      case 'Sack':       return 'sack'
      case 'Penalty':    return 'penalty'
      case 'Return':     return 'run_gain'
      case 'Fair Catch':  return 'run_no_gain'
      case 'Touchback':  return 'run_no_gain'
      case 'Punted':     return 'run_gain'
      case 'Blocked':    return 'fumble'
      case 'Good':       return 'run_gain'
      case 'No Good':    return 'run_no_gain'
    }
  }
  const pt = playType?.toLowerCase()
  if (pt === 'pass') return yards >= 0 ? 'pass_complete' : 'pass_incomplete'
  return yards >= 0 ? 'run_gain' : 'run_loss'
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
// Game Selection Screen
// ---------------------------------------------------------------------------

interface GameSelectionScreenProps {
  teamId: string | null
  onSelectGame: (gameId: string, opponent: string) => void
}

function GameSelectionScreen({ teamId, onSelectGame }: GameSelectionScreenProps) {
  const [games, setGames] = useState<ScheduledGame[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showQuickGame, setShowQuickGame] = useState(false)
  const [quickOpponent, setQuickOpponent] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (!teamId) {
      setIsLoading(false)
      return
    }

    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    supabase
      .from('games')
      .select('id, opponent, date, location, start_time')
      .eq('team_id', teamId)
      .eq('game_type', 'team')
      .gte('date', today)
      .order('date', { ascending: true })
      .then(({ data }) => {
        if (data) setGames(data as ScheduledGame[])
        setIsLoading(false)
      })
  }, [teamId])

  function formatGameDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  async function handleCreateQuickGame() {
    if (!teamId || !quickOpponent.trim()) return
    setIsCreating(true)
    setCreateError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setCreateError('Not authenticated')
      setIsCreating(false)
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const { data: newGame, error } = await supabase
      .from('games')
      .insert({
        team_id: teamId,
        user_id: user.id,
        name: `vs ${quickOpponent.trim()}`,
        opponent: quickOpponent.trim(),
        date: today,
        game_type: 'team',
      })
      .select('id, opponent')
      .single()

    setIsCreating(false)

    if (error || !newGame) {
      setCreateError(error?.message ?? 'Failed to create game')
      return
    }

    onSelectGame(newGame.id, newGame.opponent ?? quickOpponent.trim())
  }

  return (
    <div className="min-h-screen bg-[#1c1c1e] flex flex-col items-center px-4 pt-12 pb-8">
      {/* Logo */}
      <img src="/logo-darkmode.png" alt="Youth Coach Hub" className="h-12 w-auto mb-6 opacity-60" />

      <h2 className="text-2xl font-bold text-white">Ready to Track?</h2>
      <p className="text-sm text-gray-500 mt-1 mb-8">Select a game to begin</p>

      {/* Upcoming games */}
      <div className="w-full max-w-md">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-600 border-t-[#B8CA6E] rounded-full animate-spin" />
          </div>
        ) : games.length > 0 ? (
          <div className="flex flex-col gap-2">
            {games.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelectGame(g.id, g.opponent ?? 'Opponent')}
                className="w-full bg-[#2c2c2e] rounded-xl px-4 py-4 flex items-center justify-between min-h-[64px] active:bg-[#3a3a3c] transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white truncate">
                    vs {g.opponent ?? 'TBD'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{formatGameDate(g.date)}</span>
                    {g.location && (
                      <span className="text-xs text-gray-600">{g.location}</span>
                    )}
                  </div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 shrink-0">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-600">No upcoming games scheduled</p>
          </div>
        )}

        {/* Quick Game button */}
        <button
          type="button"
          onClick={() => setShowQuickGame(true)}
          className="w-full mt-4 bg-[#B8CA6E] text-[#1c1c1e] rounded-xl py-4 text-base font-bold text-center min-h-[56px] active:bg-[#a8b85e] transition-colors"
        >
          Quick Game
        </button>
        <p className="text-xs text-gray-600 text-center mt-2">
          Start tracking without a scheduled game
        </p>
      </div>

      {/* Quick Game bottom sheet */}
      {showQuickGame && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowQuickGame(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#2c2c2e] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#48484a]" />
            </div>
            <div className="px-5 pb-6">
              <h3 className="text-lg font-bold text-white">Quick Game</h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-4">Enter opponent name to start</p>

              <input
                type="text"
                value={quickOpponent}
                onChange={(e) => setQuickOpponent(e.target.value)}
                placeholder="Opponent name"
                autoFocus
                className="w-full bg-[#3a3a3c] text-white placeholder-gray-500 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#B8CA6E]"
              />

              {createError && (
                <p className="text-xs text-red-400 mt-2">{createError}</p>
              )}

              <button
                type="button"
                onClick={handleCreateQuickGame}
                disabled={!quickOpponent.trim() || isCreating}
                className={[
                  'w-full mt-4 rounded-xl py-4 text-base font-bold text-center min-h-[56px] transition-colors',
                  quickOpponent.trim() && !isCreating
                    ? 'bg-[#B8CA6E] text-[#1c1c1e] active:bg-[#a8b85e]'
                    : 'bg-[#3a3a3c] text-gray-500',
                ].join(' ')}
              >
                {isCreating ? 'Creating...' : 'Start Game'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Game State Bar
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Clock Entry Sheet
// ---------------------------------------------------------------------------

interface ClockSheetProps {
  currentClock: string
  onDone: (clock: string) => void
  onClose: () => void
}

function parseClockToMinsSecs(clock: string): [number, number] {
  const parts = clock.split(':')
  return [parseInt(parts[0] || '0', 10), parseInt(parts[1] || '0', 10)]
}

function formatClockFromMinsSecs(mins: number, secs: number): string {
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function ClockSheet({ currentClock, onDone, onClose }: ClockSheetProps) {
  const [initMins, initSecs] = parseClockToMinsSecs(currentClock)
  const [mins, setMins] = useState(initMins)
  const [secs, setSecs] = useState(initSecs)
  const [mode, setMode] = useState<'stepper' | 'keypad'>('stepper')
  const [raw, setRaw] = useState('')

  // Sync steppers → keypad display when switching modes
  function switchToKeypad() {
    setRaw(`${mins}${String(secs).padStart(2, '0')}`)
    setMode('keypad')
  }

  function switchToStepper() {
    // Parse raw digits back into mins/secs
    if (raw.length > 0) {
      const padded = raw.padStart(4, '0')
      setMins(Math.min(15, parseInt(padded.slice(0, 2), 10)))
      setSecs(Math.min(59, parseInt(padded.slice(2, 4), 10)))
    }
    setMode('stepper')
  }

  // Keypad display: right-to-left fill into MM:SS
  const keypadPadded = raw.padStart(4, '0')
  const keypadDisplay = `${keypadPadded.slice(0, 2)}:${keypadPadded.slice(2, 4)}`

  function handleKey(key: string) {
    if (key === 'clear') { setRaw(''); return }
    if (key === 'back') { setRaw((r) => r.slice(0, -1)); return }
    if (raw.length >= 4) return
    setRaw((r) => r + key)
  }

  // Resolve final clock value from current mode
  function getClockValue(): string {
    if (mode === 'keypad') {
      const m = Math.min(15, parseInt(keypadPadded.slice(0, 2), 10))
      const s = Math.min(59, parseInt(keypadPadded.slice(2, 4), 10))
      return formatClockFromMinsSecs(m, s)
    }
    return formatClockFromMinsSecs(mins, secs)
  }

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#2c2c2e] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#48484a]" />
        </div>
        <div className="px-5 pb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Game Clock</p>

          {/* Mode toggle pill */}
          <div className="flex bg-[#3a3a3c] rounded-full p-1 w-fit mx-auto">
            <button
              type="button"
              onClick={() => switchToStepper()}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                mode === 'stepper' ? 'bg-[#B8CA6E] text-[#1c1c1e]' : 'text-gray-400'
              }`}
            >
              Steppers
            </button>
            <button
              type="button"
              onClick={() => switchToKeypad()}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                mode === 'keypad' ? 'bg-[#B8CA6E] text-[#1c1c1e]' : 'text-gray-400'
              }`}
            >
              Keypad
            </button>
          </div>

          {/* Large time display */}
          <p className="text-5xl font-bold text-white text-center py-4 tabular-nums">
            {mode === 'keypad' ? keypadDisplay : formatClockFromMinsSecs(mins, secs)}
          </p>

          <div className="h-[320px] flex flex-col justify-center">
          {mode === 'stepper' ? (
            /* Stepper mode */
            <div className="flex flex-col gap-8">
              {/* Minutes */}
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">MIN</span>
                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    onClick={() => setMins((m) => Math.max(0, m - 1))}
                    className="w-12 h-12 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity"
                  >
                    <MinusIcon />
                  </button>
                  <span className="text-2xl font-bold text-white w-10 text-center tabular-nums">{mins}</span>
                  <button
                    type="button"
                    onClick={() => setMins((m) => Math.min(15, m + 1))}
                    className="w-12 h-12 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity"
                  >
                    <PlusIcon />
                  </button>
                </div>
              </div>

              {/* Seconds */}
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">SEC</span>
                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    onClick={() => setSecs((s) => (s <= 0 ? 55 : s - 5))}
                    className="w-12 h-12 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity"
                  >
                    <MinusIcon />
                  </button>
                  <span className="text-2xl font-bold text-white w-10 text-center tabular-nums">{String(secs).padStart(2, '0')}</span>
                  <button
                    type="button"
                    onClick={() => setSecs((s) => (s >= 55 ? 0 : s + 5))}
                    className="w-12 h-12 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity"
                  >
                    <PlusIcon />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Keypad mode */
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKey(key)}
                  className="bg-[#3a3a3c] rounded-xl text-white text-2xl font-semibold h-14 flex items-center justify-center active:opacity-70 transition-opacity"
                >
                  {key === 'clear' ? <span className="text-sm text-red-400">Clear</span> : key === 'back' ? <BackspaceIcon /> : key}
                </button>
              ))}
            </div>
          )}
          </div>

          {/* Bottom buttons */}
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm font-semibold text-gray-500 min-h-[48px] active:text-gray-300 transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => onDone(getClockValue())}
              className="flex-1 bg-[#B8CA6E] text-[#1c1c1e] rounded-xl py-3 text-base font-bold min-h-[48px] active:bg-[#a8b85e] transition-colors"
            >
              Set Clock
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Score Entry Sheet
// ---------------------------------------------------------------------------

interface ScoreSheetProps {
  homeScore: number
  oppScore: number
  opponentName: string
  onDone: (home: number, opp: number) => void
  onClose: () => void
}

function ScoreSheet({ homeScore, oppScore, opponentName, onDone, onClose }: ScoreSheetProps) {
  const [home, setHome] = useState(homeScore)
  const [opp, setOpp] = useState(oppScore)

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#2c2c2e] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#48484a]" />
        </div>
        <div className="px-5 pb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Score</p>

          {/* Our score */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-white">Us</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setHome(Math.max(0, home - 1))}
                className="w-12 h-12 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity"
              >
                <MinusIcon />
              </button>
              <span className="text-3xl font-bold text-white w-14 text-center tabular-nums">{home}</span>
              <button
                type="button"
                onClick={() => setHome(home + 1)}
                className="w-12 h-12 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity"
              >
                <PlusIcon />
              </button>
            </div>
          </div>

          {/* Opponent score */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-white truncate max-w-[80px]">{opponentName}</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setOpp(Math.max(0, opp - 1))}
                className="w-12 h-12 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity"
              >
                <MinusIcon />
              </button>
              <span className="text-3xl font-bold text-white w-14 text-center tabular-nums">{opp}</span>
              <button
                type="button"
                onClick={() => setOpp(opp + 1)}
                className="w-12 h-12 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity"
              >
                <PlusIcon />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onDone(home, opp)}
            className="w-full mt-2 bg-[#B8CA6E] text-[#1c1c1e] rounded-xl py-3 text-base font-bold min-h-[48px] active:bg-[#a8b85e] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Game State Bar (interactive)
// ---------------------------------------------------------------------------

function formatQuarterLabel(q: number): string {
  if (q <= 4) return `Q${q}`
  return 'OT'
}

function nextQuarter(q: number): number {
  if (q >= 5) return 1
  return q + 1
}

interface GameStateBarProps {
  game: GameState
  opponentName: string
  onMenuOpen: () => void
  dispatch: React.Dispatch<GameAction>
  clockHasBeenSet: boolean
  onClockSet: () => void
  activeSTSubType?: STSubType | null
}

function GameStateBar({ game, opponentName, onMenuOpen, dispatch, clockHasBeenSet, onClockSet, activeSTSubType }: GameStateBarProps) {
  const { down, distance, yardLine, hash, quarter, clock, homeScore, oppScore, possession } = game
  const [showClock, setShowClock] = useState(false)
  const [showScore, setShowScore] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjDown, setAdjDown] = useState(down)
  const [adjDistance, setAdjDistance] = useState(distance)
  const [adjYardLine, setAdjYardLine] = useState(yardLine < 50 ? yardLine : 100 - yardLine)
  const [adjOwnOpp, setAdjOwnOpp] = useState<'own' | 'opp'>(yardLine < 50 ? 'own' : 'opp')
  const [adjHash, setAdjHash] = useState<HashMark>(hash)

  function openAdjust() {
    setAdjDown(down)
    setAdjDistance(distance)
    setAdjYardLine(yardLine <= 50 ? yardLine : 100 - yardLine)
    setAdjOwnOpp(yardLine <= 50 ? 'own' : 'opp')
    setAdjHash(hash)
    setShowAdjust(true)
  }

  function confirmAdjust() {
    const yl = adjOwnOpp === 'own' ? adjYardLine : 100 - adjYardLine
    dispatch({ type: 'SET_DOWN', down: adjDown })
    dispatch({ type: 'SET_DISTANCE', distance: adjDistance })
    dispatch({ type: 'SET_YARD_LINE', yardLine: Math.max(1, Math.min(99, yl)) })
    dispatch({ type: 'SET_HASH', hash: adjHash })
    setShowAdjust(false)
  }

  return (
    <>
      <div className="bg-[#2c2c2e] rounded-2xl mx-4 mt-3 p-4">
        {/* Row 0: Opponent + Menu */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#B8CA6E] uppercase tracking-wider">
            vs {opponentName}
          </p>
          <button
            type="button"
            onClick={onMenuOpen}
            className="text-gray-500 bg-[#3a3a3c] rounded-lg px-2 py-1 min-h-[28px] active:bg-[#48484a] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        </div>

        {/* Row 1: Down & Distance + Adjust */}
        <div className="flex items-center gap-2">
          <p className="text-3xl font-bold text-white leading-tight">
            {ordinalDown(down)} &amp; {distance}
          </p>
          <button
            type="button"
            onClick={openAdjust}
            className="text-[10px] text-gray-500 bg-[#3a3a3c] rounded-full px-2 py-0.5 min-h-[22px] active:bg-[#48484a] transition-colors"
          >
            Adjust
          </button>
        </div>

        {/* Row 2: Field position + possession */}
        <div className="flex items-center gap-2 mt-1">
          <p className="text-sm text-gray-400">
            {activeSTSubType === 'kickoff' ? formatYardLine(KICKOFF_YARD_LINE, possession) : formatYardLine(yardLine, possession)} &middot; {formatHash(hash)}
          </p>
          <div className="flex bg-[#3a3a3c] rounded-full p-0.5">
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_POSSESSION', possession: 'us' })}
              className={[
                'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors min-h-[22px]',
                possession === 'us' ? 'bg-[#B8CA6E] text-[#1c1c1e]' : 'text-gray-500',
              ].join(' ')}
            >
              Our Ball
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_POSSESSION', possession: 'them' })}
              className={[
                'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors min-h-[22px]',
                possession === 'them' ? 'bg-[#B8CA6E] text-[#1c1c1e]' : 'text-gray-500',
              ].join(' ')}
            >
              Their Ball
            </button>
          </div>
        </div>

        {/* Row 3: Score / Quarter / Clock — all tappable */}
        <div className="flex items-center mt-3">
          {/* Score — tappable */}
          <button
            type="button"
            onClick={() => setShowScore(true)}
            className="flex-1 text-center min-h-[44px] active:opacity-70 transition-opacity"
          >
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Score</p>
            <p className="text-lg font-semibold text-white">
              {homeScore} - {oppScore}
            </p>
          </button>
          <div className="w-px h-8 bg-[#3a3a3c]" />
          {/* Quarter — tap to cycle */}
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_QUARTER', quarter: nextQuarter(quarter) })}
            className="flex-1 text-center min-h-[44px] active:opacity-70 transition-opacity"
          >
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Quarter</p>
            <p className="text-lg font-semibold text-white">{formatQuarterLabel(quarter)}</p>
          </button>
          <div className="w-px h-8 bg-[#3a3a3c]" />
          {/* Clock — tappable */}
          <button
            type="button"
            onClick={() => setShowClock(true)}
            className="flex-1 text-center min-h-[44px] active:opacity-70 transition-opacity"
          >
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Clock</p>
            <p className={`text-lg font-semibold tabular-nums ${clockHasBeenSet ? 'text-[#B8CA6E]' : 'text-gray-500'}`}>{clock}</p>
          </button>
        </div>
      </div>

      {/* Clock entry sheet */}
      {showClock && (
        <ClockSheet
          currentClock={clock}
          onDone={(newClock) => {
            dispatch({ type: 'SET_CLOCK', clock: newClock })
            onClockSet()
            setShowClock(false)
          }}
          onClose={() => setShowClock(false)}
        />
      )}

      {/* Score entry sheet */}
      {showScore && (
        <ScoreSheet
          homeScore={homeScore}
          oppScore={oppScore}
          opponentName={opponentName}
          onDone={(home, opp) => {
            dispatch({ type: 'SET_HOME_SCORE', score: home })
            dispatch({ type: 'SET_OPP_SCORE', score: opp })
            setShowScore(false)
          }}
          onClose={() => setShowScore(false)}
        />
      )}

      {/* Adjust sheet */}
      {showAdjust && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowAdjust(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#2c2c2e] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up max-h-[85vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#48484a]" />
            </div>
            <div className="px-5 pb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Adjust Game State</p>

              {/* Down */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Down</p>
              <div className="flex bg-[#3a3a3c] rounded-full p-1 mb-4">
                {[1, 2, 3, 4].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setAdjDown(d)}
                    className={[
                      'flex-1 py-2 rounded-full text-sm font-semibold text-center transition-colors min-h-[36px]',
                      adjDown === d ? 'bg-[#B8CA6E] text-[#1c1c1e]' : 'text-gray-400',
                    ].join(' ')}
                  >
                    {ordinalDown(d)}
                  </button>
                ))}
              </div>

              {/* Distance */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Distance</p>
              <div className="flex items-center justify-center gap-5 mb-4">
                <button type="button" onClick={() => setAdjDistance(Math.max(1, adjDistance - 1))} className="w-11 h-11 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70"><MinusIcon /></button>
                <TappableNumber value={adjDistance} onChange={(v) => setAdjDistance(Math.max(1, Math.min(99, v)))} />
                <button type="button" onClick={() => setAdjDistance(Math.min(99, adjDistance + 1))} className="w-11 h-11 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70"><PlusIcon /></button>
              </div>

              {/* Yard Line */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Yard Line</p>
              <div className="flex bg-[#3a3a3c] rounded-full p-1 w-fit mx-auto mb-2">
                <button
                  type="button"
                  onClick={() => setAdjOwnOpp('own')}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${adjOwnOpp === 'own' ? 'bg-[#B8CA6E] text-[#1c1c1e]' : 'text-gray-400'}`}
                >OWN</button>
                <button
                  type="button"
                  onClick={() => setAdjOwnOpp('opp')}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${adjOwnOpp === 'opp' ? 'bg-[#B8CA6E] text-[#1c1c1e]' : 'text-gray-400'}`}
                >OPP</button>
              </div>
              <div className="flex items-center justify-center gap-5 mb-4">
                <button type="button" onClick={() => setAdjYardLine(Math.max(1, adjYardLine - 1))} className="w-11 h-11 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70"><MinusIcon /></button>
                <TappableNumber value={adjYardLine} onChange={(v) => setAdjYardLine(Math.max(1, Math.min(50, v)))} />
                <button type="button" onClick={() => setAdjYardLine(Math.min(50, adjYardLine + 1))} className="w-11 h-11 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70"><PlusIcon /></button>
              </div>

              {/* Hash */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Hash</p>
              <div className="flex bg-[#3a3a3c] rounded-full p-1 mb-5">
                {(['left', 'middle', 'right'] as HashMark[]).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setAdjHash(h)}
                    className={[
                      'flex-1 py-2 rounded-full text-sm font-semibold text-center transition-colors min-h-[36px] capitalize',
                      adjHash === h ? 'bg-[#B8CA6E] text-[#1c1c1e]' : 'text-gray-400',
                    ].join(' ')}
                  >
                    {h}
                  </button>
                ))}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAdjust(false)} className="flex-1 text-sm font-semibold text-gray-500 min-h-[48px] active:text-gray-300 transition-colors">Cancel</button>
                <button type="button" onClick={confirmAdjust} className="flex-1 bg-[#B8CA6E] text-[#1c1c1e] rounded-xl py-3 text-base font-bold min-h-[48px] active:bg-[#a8b85e] transition-colors">Set</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
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
// Tappable Number (tap to type, shared by inline steppers)
// ---------------------------------------------------------------------------

function TappableNumber({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  function handleStartEdit() {
    setEditValue(String(value))
    setEditing(true)
  }

  function handleCommit() {
    const parsed = parseInt(editValue, 10)
    if (!isNaN(parsed)) {
      onChange(Math.max(0, Math.min(99, parsed)))
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="number"
        inputMode="numeric"
        autoFocus
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCommit() }}
        min={0}
        max={99}
        className="text-3xl font-bold text-white w-16 text-center tabular-nums bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className="text-3xl font-bold text-white w-16 text-center tabular-nums min-h-[48px]"
    >
      {value}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Outcome Grid
// ---------------------------------------------------------------------------

interface OutcomeGridProps {
  selected: OutcomeLabel | null
  onSelect: (o: OutcomeLabel) => void
  playType: QuickPlayType | null
  stSubType: STSubType | null
  onSTSubTypeChange: (st: STSubType) => void
  onAutoYards?: (yards: number) => void
  yardLine: number
  possession: Possession
}

const RUN_OUTCOMES: { label: OutcomeLabel; className: string }[] = [
  { label: 'TD',       className: 'bg-[#2a3a2a] text-[#B8CA6E]' },
  { label: 'Turnover', className: 'bg-[#3a1a1a] text-[#ff6b6b]' },
  { label: 'Penalty',  className: 'bg-[#3a3a3c] text-white' },
]

const PASS_OUTCOMES: { label: OutcomeLabel; className: string }[] = [
  { label: 'TD',         className: 'bg-[#2a3a2a] text-[#B8CA6E]' },
  { label: 'Turnover',   className: 'bg-[#3a1a1a] text-[#ff6b6b]' },
  { label: 'Complete',   className: 'bg-[#3a3a3c] text-white' },
  { label: 'Incomplete', className: 'bg-[#3a3a3c] text-white' },
  { label: 'Sack',       className: 'bg-[#3a3a3c] text-white' },
  { label: 'Penalty',    className: 'bg-[#3a3a3c] text-white' },
]

const ST_OUTCOMES: Record<STSubType, { label: OutcomeLabel; className: string; autoYards?: number }[]> = {
  kickoff: [
    { label: 'Touchback', className: 'bg-[#3a3a3c] text-white', autoYards: 0 },
    { label: 'TD',        className: 'bg-[#2a3a2a] text-[#B8CA6E]' },
    { label: 'Penalty',   className: 'bg-[#3a3a3c] text-white' },
  ],
  punt: [
    { label: 'Fair Catch',  className: 'bg-[#3a3a3c] text-white', autoYards: 0 },
    { label: 'Touchback',  className: 'bg-[#3a3a3c] text-white', autoYards: 0 },
    { label: 'Blocked',    className: 'bg-[#3a1a1a] text-[#ff6b6b]' },
    { label: 'TD',         className: 'bg-[#2a3a2a] text-[#B8CA6E]' },
    { label: 'Penalty',    className: 'bg-[#3a3a3c] text-white' },
  ],
  field_goal_pat: [
    { label: 'Good',    className: 'bg-[#2a3a2a] text-[#B8CA6E]' },
    { label: 'No Good', className: 'bg-[#3a3a3c] text-white', autoYards: 0 },
    { label: 'Blocked', className: 'bg-[#3a1a1a] text-[#ff6b6b]', autoYards: 0 },
    { label: 'Penalty', className: 'bg-[#3a3a3c] text-white' },
  ],
}

const ST_TYPE_OPTIONS: { key: STSubType; label: string }[] = [
  { key: 'kickoff', label: 'Kickoff' },
  { key: 'punt', label: 'Punt' },
  { key: 'field_goal_pat', label: 'FG / PAT' },
]

function OutcomeGrid({ selected, onSelect, playType, stSubType, onSTSubTypeChange, onAutoYards, yardLine, possession }: OutcomeGridProps) {
  if (!playType) {
    return (
      <div className="px-4 mt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Result</p>
        <p className="text-xs text-gray-600 mt-2">Select a play type above</p>
      </div>
    )
  }

  // Special teams: show ST type selector first, then type-specific results
  if (playType === 'special_teams') {
    return (
      <div>
        {/* ST Type selector */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mt-4">
          Special Teams Type
        </p>
        <div className="grid grid-cols-3 gap-2 px-4 mt-2">
          {ST_TYPE_OPTIONS.map(({ key, label }) => {
            // Possession-aware labels for kickoff and punt
            let displayLabel = label
            if (key === 'kickoff') displayLabel = possession === 'us' ? 'Kickoff' : 'Kick Return'
            else if (key === 'punt') displayLabel = possession === 'us' ? 'Punt' : 'Punt Return'

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSTSubTypeChange(key)}
                className={[
                  'rounded-xl py-3 text-sm font-semibold text-center min-h-[44px] transition-colors',
                  stSubType === key ? 'bg-[#B8CA6E] text-[#1c1c1e]' : 'bg-[#3a3a3c] text-white',
                ].join(' ')}
              >
                {displayLabel}
              </button>
            )
          })}
        </div>

        {/* ST Result buttons */}
        {stSubType ? (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mt-4">
              Result
            </p>
            <div className="grid grid-cols-2 gap-2 px-4 mt-2">
              {ST_OUTCOMES[stSubType].map(({ label, className, autoYards }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onSelect(label)
                    if (autoYards != null && onAutoYards) onAutoYards(autoYards)
                    if (label === 'TD' && onAutoYards) onAutoYards(Math.max(1, 100 - yardLine))
                  }}
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
          </>
        ) : (
          <div className="px-4 mt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Result</p>
            <p className="text-xs text-gray-600 mt-2">Select play type above</p>
          </div>
        )}
      </div>
    )
  }

  // Run or Pass
  const outcomes = playType === 'pass' ? PASS_OUTCOMES : RUN_OUTCOMES

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mt-4">
        Result
      </p>
      <div className="grid grid-cols-2 gap-2 px-4 mt-2">
        {outcomes.map(({ label, className }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              onSelect(label)
              if (label === 'TD' && onAutoYards) onAutoYards(Math.max(1, 100 - yardLine))
            }}
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
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  function handleStartEdit() {
    setEditValue(String(value))
    setEditing(true)
  }

  function handleCommit() {
    const parsed = parseInt(editValue, 10)
    if (!isNaN(parsed)) {
      onChange(Math.max(0, Math.min(99, parsed)))
    }
    setEditing(false)
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mt-4">
        Yards
      </p>
      <div className="flex items-center justify-center gap-6 mt-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-14 h-14 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity"
        >
          <MinusIcon />
        </button>
        {editing ? (
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCommit() }}
            min={0}
            max={99}
            className="text-4xl font-bold text-white w-20 text-center tabular-nums bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        ) : (
          <button
            type="button"
            onClick={handleStartEdit}
            className="text-4xl font-bold text-white w-20 text-center tabular-nums min-h-[56px]"
          >
            {value}
          </button>
        )}
        <button
          type="button"
          onClick={() => onChange(Math.min(99, value + 1))}
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

interface PlayAttributes {
  odk: string
  formation?: string
  playType?: string
  personnel?: string
  runConcept?: string
  passConcept?: string
  direction?: string
  front?: string
  coverage?: string
  blitzType?: string
  pressLevel?: string
  [key: string]: unknown
}

interface FromPlaysModeProps {
  plays: { id: string; play_code: string; play_name: string; attributes: PlayAttributes }[]
  isLoading: boolean
  onSelect: (playCode: string, playName: string, playType: string, formation: string, attributes: PlayAttributes) => void
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
              play.attributes,
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
  activeGameId: string | null
  driveNumber: number
  onPlayLogged: (play: LoggedPlay) => void
  onSTSubTypeChange: (st: STSubType | null) => void
}

function LogView({
  game,
  gamePlanPlays,
  gamePlanLoaded,
  isLoadingGamePlan,
  allPlays,
  isLoadingPlays,
  teamId,
  activeGameId,
  driveNumber,
  onPlayLogged,
  onSTSubTypeChange,
}: LogViewProps) {
  const [logMode, setLogMode] = useState<LogMode>('wristband')
  const [selectedPlayCode, setSelectedPlayCode] = useState<string | null>(null)
  const [selectedPlayName, setSelectedPlayName] = useState<string | null>(null)
  const [selectedPlayType, setSelectedPlayType] = useState<string | null>(null)
  const [selectedFormation, setSelectedFormation] = useState<string | null>(null)
  const [quickPlayType, setQuickPlayType] = useState<QuickPlayType | null>(null)
  const [stSubType, _setStSubType] = useState<STSubType | null>(null)
  function setStSubType(st: STSubType | null) {
    _setStSubType(st)
    onSTSubTypeChange(st)
  }
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeLabel | null>(null)
  const [yards, setYards] = useState(0)
  const [kickYards, setKickYards] = useState(0)
  const [tdAutoYards, setTdAutoYards] = useState(false)
  const [flagForReview, setFlagForReview] = useState(false)

  // Enrichment state
  const [enrichmentStep, setEnrichmentStep] = useState(0) // 0 = hidden, 1 = step 1, 2 = step 2
  const [enrichmentTotalSteps, setEnrichmentTotalSteps] = useState(0)
  const [enrichmentContext, setEnrichmentContext] = useState<{
    possession: Possession
    logMode: LogMode
    playType: string | null
    odk: string | null
    lastPlayId: string | null
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [selectedPlayAttrs, setSelectedPlayAttrs] = useState<PlayAttributes | null>(null)

  function handlePlaySelected(playCode: string, playName: string, playType: string, formation: string, attributes?: PlayAttributes) {
    setSelectedPlayCode(playCode)
    setSelectedPlayName(playName)
    setSelectedPlayType(playType)
    setSelectedFormation(formation)
    setSelectedPlayAttrs(attributes ?? null)
  }

  async function handleLogPlay() {
    const effectivePlayType = logMode === 'quick' ? quickPlayType : selectedPlayType
    const isPuntOrKick = stSubType === 'punt' || stSubType === 'kickoff'

    // For punt/kick: kickYards > 0 is sufficient to log (return with yards inferred)
    // For other plays: need explicit outcome or non-zero yards
    if (isPuntOrKick) {
      if (kickYards === 0 && !selectedOutcome) return
    } else {
      if (!selectedOutcome && yards === 0) return
    }
    if (!teamId) return

    // Infer 'Return' outcome for punt/kick when coach entered yards but no explicit result
    const effectiveOutcome: OutcomeLabel | null = isPuntOrKick && !selectedOutcome && kickYards > 0
      ? 'Return'
      : selectedOutcome

    setIsSaving(true)
    setSaveError(null)

    const supabase = createClient()
    const localId = crypto.randomUUID()
    const resolvedResult = mapOutcomeToResult(effectiveOutcome, effectivePlayType, yards)

    const effectiveYards = yards

    const insertPayload: Record<string, unknown> = {
      team_id: teamId,
      game_id: activeGameId,
      timestamp_start: Date.now(),
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
      play_type: effectivePlayType ?? null,
      is_opponent_play: game.possession === 'them',
      result: resolvedResult,
      yards_gained: effectiveYards,
      penalty_on_play: selectedOutcome === 'Penalty',
      notes: flagForReview ? 'FLAGGED FOR FILM REVIEW' : null,
    }

    // Add kick distance and return yards for punt/kickoff plays
    if (isPuntOrKick && kickYards > 0) {
      insertPayload.kick_distance = kickYards
      insertPayload.return_yards = yards
    }

    const { error } = await supabase.from('play_instances').insert(insertPayload)

    setIsSaving(false)

    if (error) {
      console.error('[Sideline] Insert error:', JSON.stringify(error, null, 2))
      console.error('[Sideline] Insert payload:', JSON.stringify(insertPayload, null, 2))
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
      result: resolvedResult,
      outcomeLabel: effectiveOutcome,
      stSubType,
      possession: game.possession,
      yardsGained: yards,
      kickYards,
      driveNumber,
    })

    // Trigger enrichment for non-ST plays
    const isSTPlay = effectivePlayType === 'special_teams' || stSubType != null
    if (!isSTPlay) {
      const effectiveOdk = selectedPlayAttrs?.odk ?? null
      const effPlayType = effectivePlayType ?? quickPlayType

      // Determine steps based on enrichment matrix
      let totalSteps = 0
      if (game.possession === 'us') {
        totalSteps = 1 // Step 1: their defensive response
      } else if (game.possession === 'them' && logMode === 'quick') {
        totalSteps = 2 // Step 1: their offensive tendency, Step 2: our defensive response
      } else if (game.possession === 'them') {
        totalSteps = 1 // Step 1: their offensive tendency (defense already known from play)
      }

      if (totalSteps > 0) {
        setEnrichmentContext({
          possession: game.possession,
          logMode,
          playType: effPlayType,
          odk: effectiveOdk,
          lastPlayId: localId,
        })
        setEnrichmentStep(1)
        setEnrichmentTotalSteps(totalSteps)
      }

      // Write known attributes from From Plays selection to DB
      if (selectedPlayAttrs && localId) {
        const supabaseUpdate = createClient()
        const enrichmentFields: Record<string, unknown> = {}
        if (game.possession === 'us' && selectedPlayAttrs.odk === 'offense') {
          if (selectedPlayAttrs.personnel) enrichmentFields.personnel = selectedPlayAttrs.personnel
          if (selectedPlayAttrs.runConcept) enrichmentFields.run_concept = selectedPlayAttrs.runConcept
          if (selectedPlayAttrs.passConcept) enrichmentFields.pass_concept = selectedPlayAttrs.passConcept
          if (selectedPlayAttrs.direction) enrichmentFields.direction = selectedPlayAttrs.direction
        } else if (game.possession === 'them' && selectedPlayAttrs.odk === 'defense') {
          if (selectedPlayAttrs.front) enrichmentFields.play_concept = selectedPlayAttrs.front
          if (selectedPlayAttrs.coverage) enrichmentFields.play_concept = (enrichmentFields.play_concept ? enrichmentFields.play_concept + ' ' : '') + selectedPlayAttrs.coverage
        }
        if (Object.keys(enrichmentFields).length > 0) {
          supabaseUpdate.from('play_instances').update(enrichmentFields).eq('local_id', localId).then(() => {})
        }
      }
    }

    // Flash success, reset form
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 1500)

    setSelectedPlayCode(null)
    setSelectedPlayName(null)
    setSelectedPlayType(null)
    setSelectedFormation(null)
    setSelectedPlayAttrs(null)
    setSelectedOutcome(null)
    setQuickPlayType(null)
    setStSubType(null)
    setYards(0)
    setKickYards(0)
    setTdAutoYards(false)
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
          plays={allPlays as { id: string; play_code: string; play_name: string; attributes: PlayAttributes }[]}
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
            {([
              ['run', game.possession === 'them' ? 'Run Def' : 'Run'],
              ['pass', game.possession === 'them' ? 'Pass Def' : 'Pass'],
              ['special_teams', 'Special Teams'],
            ] as [QuickPlayType, string][]).map(
              ([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setQuickPlayType(key)
                    setSelectedPlayType(key)
                    setStSubType(null)
                    setSelectedOutcome(null)
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

      {/* Outcome Grid — hidden in wristband mode when no game plan loaded */}
      {logMode === 'wristband' && !gamePlanLoaded ? null : (
        <OutcomeGrid
          selected={selectedOutcome}
          onSelect={(o) => {
            setSelectedOutcome(o)
            if (o !== 'TD') setTdAutoYards(false)
          }}
          playType={logMode === 'quick' ? quickPlayType : (selectedPlayType?.toLowerCase() as QuickPlayType | null) ?? 'run'}
          stSubType={stSubType}
          onSTSubTypeChange={(st) => { setStSubType(st); setSelectedOutcome(null) }}
          onAutoYards={(y) => { setYards(y); setTdAutoYards(y > 0) }}
          yardLine={game.yardLine}
          possession={game.possession}
        />
      )}

      {/* Yards Stepper(s) */}
      {logMode === 'wristband' && !gamePlanLoaded ? null : (
        <div>
          {(stSubType === 'punt' || stSubType === 'kickoff') ? (
            <>
              {/* Kickoff: show fixed starting position, punt: show kick distance stepper */}
              {stSubType === 'kickoff' ? (
                <div className="px-4 mt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Kickoff From</p>
                  <p className="text-sm text-[#B8CA6E] font-semibold mt-1">{formatYardLine(KICKOFF_YARD_LINE, game.possession)}</p>
                </div>
              ) : null}

              {/* Kick/Punt distance */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mt-4">
                {stSubType === 'kickoff' ? 'Kick Distance' : 'Punt Distance'}
              </p>
              <div className="flex items-center justify-center gap-6 mt-2">
                <button type="button" onClick={() => setKickYards(Math.max(0, kickYards - 1))} className="w-12 h-12 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity">
                  <MinusIcon />
                </button>
                <TappableNumber value={kickYards} onChange={setKickYards} />
                <button type="button" onClick={() => setKickYards(Math.min(99, kickYards + 1))} className="w-12 h-12 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity">
                  <PlusIcon />
                </button>
              </div>

              {/* Return yards */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 mt-4">
                Return Yards
              </p>
              <div className="flex items-center justify-center gap-6 mt-2">
                <button type="button" onClick={() => setYards(Math.max(0, yards - 1))} className="w-12 h-12 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity">
                  <MinusIcon />
                </button>
                <TappableNumber value={yards} onChange={setYards} />
                <button type="button" onClick={() => setYards(Math.min(99, yards + 1))} className="w-12 h-12 rounded-full bg-[#3a3a3c] text-white flex items-center justify-center active:opacity-70 transition-opacity">
                  <PlusIcon />
                </button>
              </div>
            </>
          ) : (
            <>
              <YardsStepper
                value={yards}
                onChange={(v) => { setYards(v); setTdAutoYards(false) }}
              />
              {tdAutoYards && (
                <p className="text-[10px] text-[#B8CA6E] text-center mt-1">Auto-calculated to end zone</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Film Flag */}
      {logMode === 'wristband' && !gamePlanLoaded ? null : (
        <FilmFlagToggle value={flagForReview} onChange={setFlagForReview} />
      )}

      {/* Error */}
      {saveError && (
        <p className="text-xs text-red-400 text-center mt-3 px-4">{saveError}</p>
      )}

      {/* Log Play Button */}
      <div className="px-4 mt-6 mb-4">
        <button
          type="button"
          disabled={(() => {
            const isPK = stSubType === 'punt' || stSubType === 'kickoff'
            if (isPK) return (kickYards === 0 && !selectedOutcome) || isSaving
            return (!selectedOutcome && yards === 0) || isSaving
          })()}
          onClick={handleLogPlay}
          className={[
            'w-full rounded-xl py-4 text-lg font-bold text-center transition-colors',
            saveSuccess
              ? 'bg-green-600 text-white'
              : !isSaving && (() => {
                  const isPK = stSubType === 'punt' || stSubType === 'kickoff'
                  if (isPK) return kickYards > 0 || !!selectedOutcome
                  return !!selectedOutcome || yards !== 0
                })()
              ? 'bg-[#B8CA6E] text-[#1c1c1e] active:bg-[#a8b85e]'
              : 'bg-[#3a3a3c] text-gray-500',
          ].join(' ')}
        >
          {isSaving ? 'Saving...' : saveSuccess ? 'Logged' : 'LOG PLAY'}
        </button>
      </div>

      {/* Enrichment shelf — persistent non-blocking panel */}
      {enrichmentStep > 0 && enrichmentContext && (
        <div className="mx-4 mt-3 mb-2 bg-[#2c2c2e] rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              {enrichmentContext.possession === 'us' ? 'Their Defense' : enrichmentStep === 1 ? 'Their Offense' : 'Our Defense'}
              {enrichmentTotalSteps > 1 && ` (${enrichmentStep} of ${enrichmentTotalSteps})`}
            </p>
            <button
              type="button"
              onClick={() => {
                if (enrichmentStep < enrichmentTotalSteps) {
                  setEnrichmentStep(enrichmentStep + 1)
                } else {
                  setEnrichmentStep(0)
                  setEnrichmentContext(null)
                }
              }}
              className="text-xs text-gray-500 min-h-[32px] min-w-[32px] flex items-center justify-center active:text-gray-300"
            >
              Skip
            </button>
          </div>

          {/* Step 1: OUR BALL — Their coverage */}
          {enrichmentContext.possession === 'us' && enrichmentStep === 1 && (
            <div className="flex gap-2 flex-wrap">
              {['Man', 'Zone', 'Blitz', 'Zone Blitz'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    // Save coverage to DB
                    if (enrichmentContext.lastPlayId) {
                      const sb = createClient()
                      sb.from('play_instances').update({ facing_blitz: opt.includes('Blitz') }).eq('local_id', enrichmentContext.lastPlayId).then(() => {})
                    }
                    setEnrichmentStep(0)
                    setEnrichmentContext(null)
                  }}
                  className="bg-[#3a3a3c] text-white rounded-lg px-3 py-2 text-xs font-semibold min-h-[36px] active:bg-[#48484a] transition-colors"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Step 1: THEIR BALL — Their offensive tendency */}
          {enrichmentContext.possession === 'them' && enrichmentStep === 1 && (
            <div className="flex gap-2 flex-wrap">
              {enrichmentContext.playType?.toLowerCase() === 'run'
                ? ['Left', 'Middle', 'Right'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        if (enrichmentContext.lastPlayId) {
                          const sb = createClient()
                          sb.from('play_instances').update({ direction: opt.toLowerCase() }).eq('local_id', enrichmentContext.lastPlayId).then(() => {})
                        }
                        if (enrichmentStep < enrichmentTotalSteps) setEnrichmentStep(2)
                        else { setEnrichmentStep(0); setEnrichmentContext(null) }
                      }}
                      className="bg-[#3a3a3c] text-white rounded-lg px-3 py-2 text-xs font-semibold min-h-[36px] active:bg-[#48484a] transition-colors"
                    >
                      {opt}
                    </button>
                  ))
                : ['Left Short', 'Left Deep', 'Middle', 'Right Short', 'Right Deep'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        if (enrichmentContext.lastPlayId) {
                          const sb = createClient()
                          sb.from('play_instances').update({ pass_location: opt.toLowerCase().split(' ')[0] }).eq('local_id', enrichmentContext.lastPlayId).then(() => {})
                        }
                        if (enrichmentStep < enrichmentTotalSteps) setEnrichmentStep(2)
                        else { setEnrichmentStep(0); setEnrichmentContext(null) }
                      }}
                      className="bg-[#3a3a3c] text-white rounded-lg px-3 py-2 text-xs font-semibold min-h-[36px] active:bg-[#48484a] transition-colors"
                    >
                      {opt}
                    </button>
                  ))
              }
            </div>
          )}

          {/* Step 2: THEIR BALL + Quick — Our defensive response */}
          {enrichmentContext.possession === 'them' && enrichmentStep === 2 && (
            <div>
              <p className="text-[10px] text-gray-600 mb-1.5">Front</p>
              <div className="flex gap-2 flex-wrap mb-2">
                {['4-3', '3-4', 'Nickel', 'Dime'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      if (enrichmentContext.lastPlayId) {
                        const sb = createClient()
                        sb.from('play_instances').update({ play_concept: opt }).eq('local_id', enrichmentContext.lastPlayId).then(() => {})
                      }
                    }}
                    className="bg-[#3a3a3c] text-white rounded-lg px-3 py-2 text-xs font-semibold min-h-[36px] active:bg-[#48484a] transition-colors"
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mb-1.5">Coverage</p>
              <div className="flex gap-2 flex-wrap">
                {['Man', 'Zone', 'Blitz', 'Zone Blitz'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      if (enrichmentContext.lastPlayId) {
                        const sb = createClient()
                        sb.from('play_instances').update({ facing_blitz: opt.includes('Blitz') }).eq('local_id', enrichmentContext.lastPlayId).then(() => {})
                      }
                      setEnrichmentStep(0)
                      setEnrichmentContext(null)
                    }}
                    className="bg-[#3a3a3c] text-white rounded-lg px-3 py-2 text-xs font-semibold min-h-[36px] active:bg-[#48484a] transition-colors"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ---------------------------------------------------------------------------
// Plays View
// ---------------------------------------------------------------------------

interface SituationInfo {
  key: string
  label: string
  situationIds: string[]
  description: string
}

interface PlaysViewProps {
  game: GameState
  gamePlanPlays: GamePlanPlay[]
  gamePlanLoaded: boolean
  isLoadingGamePlan: boolean
  loggedPlaysCount: number
  onSelectPlay: (playCode: string, playName: string, playType: string, formation: string) => void
}

function scorePlay(gpp: GamePlanPlay, game: GameState): number {
  const pt = gpp.playbook_plays.attributes.playType?.toLowerCase() ?? ''
  const isPass = pt === 'pass'
  const isRun = pt === 'run'
  let score = 0

  // Long distance favors passing
  if (game.distance >= 8 && isPass) score += 3
  // Short distance favors running
  if (game.distance <= 3 && isRun) score += 3
  // Red zone favors running
  if (game.yardLine >= 80 && isRun) score += 2
  // Late-game long distance favors passing
  if (game.quarter >= 4 && game.distance >= 5 && isPass) score += 2
  // Medium distance slight pass preference
  if (game.distance >= 4 && game.distance <= 7 && isPass) score += 1
  // Goal line heavy run preference
  if (game.yardLine >= 95 && isRun) score += 3

  return score
}

function detectSituation(game: GameState, loggedPlaysCount: number): SituationInfo | null {
  if (game.yardLine >= 95) {
    return { key: 'goal_line', label: 'Goal Line', situationIds: ['goal_line'], description: 'Goal line stand. Power runs and sneaks.' }
  }
  if (game.yardLine >= 80) {
    return { key: 'red_zone', label: 'Red Zone', situationIds: ['red_zone'], description: 'Red zone. Condensed field, exploit coverage gaps.' }
  }
  if (game.yardLine <= 10) {
    return { key: 'backed_up', label: 'Backed Up', situationIds: ['backed_up'], description: 'Backed up. Safe calls, field position first.' }
  }
  if ((game.quarter === 2 || game.quarter >= 4) && parseTimeToSeconds(game.clock) <= 120) {
    return { key: '2_minute', label: '2-Minute', situationIds: ['2_minute'], description: 'Two-minute drill. Spread formation, sideline routes.' }
  }
  if (game.down === 1 && game.distance === 10 && loggedPlaysCount <= 15 && game.quarter === 1) {
    return { key: 'first_15', label: 'First 15', situationIds: ['first_15', 'opening_script'], description: 'Opening script. Execute your game plan.' }
  }
  return null
}

function PlayRow({
  gpp,
  isTopPick,
  isSuggested,
  isSituationPlay,
  hint,
  game,
  onSelect,
}: {
  gpp: GamePlanPlay
  isTopPick?: boolean
  isSuggested?: boolean
  isSituationPlay?: boolean
  hint?: string
  game: GameState
  onSelect: () => void
}) {
  const { play_name, attributes } = gpp.playbook_plays
  const pt = attributes.playType?.toLowerCase()

  let rowClass = 'w-full text-left px-4 py-3 border-b border-[#3a3a3c] flex items-center justify-between min-h-[56px] transition-opacity active:opacity-70'
  if (isSituationPlay) {
    rowClass += ' bg-[#1a2a3a] border-l-4 border-[#B8CA6E]'
  } else if (isTopPick) {
    rowClass += ' bg-[#253515] border-l-4 border-[#B8CA6E]'
  } else if (isSuggested) {
    rowClass += ' bg-[#1e2a1e] border-l-2 border-[#6a8a30]'
  } else {
    rowClass += ' bg-[#2c2c2e] opacity-50'
  }

  return (
    <button type="button" onClick={onSelect} className={rowClass}>
      <div className="flex-1 min-w-0 pr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-medium text-white">{play_name}</span>
          {isTopPick && (
            <span className="bg-[#B8CA6E] text-[#1c1c1e] rounded-full px-2 py-0.5 text-xs font-bold">TOP PICK</span>
          )}
          {isSuggested && (
            <span className="bg-[#6a8a30]/30 text-[#a8c060] rounded-full px-2 py-0.5 text-xs font-medium">SUGGESTED</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {[attributes.formation, attributes.playType].filter(Boolean).join(' · ')}
        </p>
        {hint && <p className="text-xs text-[#B8CA6E] mt-0.5">{hint}</p>}
      </div>
      <div className="flex flex-col items-end shrink-0">
        {pt === 'run' ? (
          <span className="bg-green-900/40 text-green-400 rounded-full px-2 py-0.5 text-xs">Run</span>
        ) : pt === 'pass' ? (
          <span className="bg-blue-900/40 text-blue-400 rounded-full px-2 py-0.5 text-xs">Pass</span>
        ) : (
          <span className="bg-gray-700/40 text-gray-400 rounded-full px-2 py-0.5 text-xs capitalize">
            {attributes.playType || attributes.odk}
          </span>
        )}
        {gpp.call_number != null && (
          <span className="text-xs text-gray-500 mt-1">Play #{gpp.call_number}</span>
        )}
      </div>
    </button>
  )
}

function PlaysView({
  game,
  gamePlanPlays,
  gamePlanLoaded,
  isLoadingGamePlan,
  loggedPlaysCount,
  onSelectPlay,
}: PlaysViewProps) {
  const situation = useMemo(
    () => detectSituation(game, loggedPlaysCount),
    [game.down, game.distance, game.yardLine, game.quarter, game.clock, loggedPlaysCount]
  )

  // Plays tagged for the current situation
  const situationPlays = useMemo(() => {
    if (!situation) return []
    return gamePlanPlays.filter(
      (gpp) => gpp.situation && situation.situationIds.includes(gpp.situation)
    )
  }, [gamePlanPlays, situation])

  // Exclude situation plays from AI ranking, then score and sort
  const situationPlayIds = useMemo(() => new Set(situationPlays.map((p) => p.id)), [situationPlays])

  const rankedPlays = useMemo(() => {
    const remaining = gamePlanPlays.filter((gpp) => !situationPlayIds.has(gpp.id))
    return remaining
      .map((gpp) => ({ gpp, score: scorePlay(gpp, game) }))
      .sort((a, b) => b.score - a.score)
  }, [gamePlanPlays, situationPlayIds, game.down, game.distance, game.yardLine, game.quarter])

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
        <p className="text-sm text-gray-500 mt-3">No game plan for this game</p>
        <p className="text-xs text-gray-600 mt-1">Set one up on desktop to see suggestions here</p>
      </div>
    )
  }

  const situationText = `${ordinalDown(game.down)} & ${game.distance} · ${formatYardLine(game.yardLine, game.possession)} · Q${game.quarter}`

  const selectPlay = (gpp: GamePlanPlay) =>
    onSelectPlay(
      gpp.play_code,
      gpp.playbook_plays.play_name,
      gpp.playbook_plays.attributes.playType ?? '',
      gpp.playbook_plays.attributes.formation ?? '',
    )

  return (
    <div className="pb-8">
      {/* Situation banner or AI banner */}
      {situation ? (
        <div className="bg-[#B8CA6E]/15 border border-[#B8CA6E]/25 rounded-xl mx-4 mt-3 p-3">
          <p className="text-sm font-bold text-[#B8CA6E]">{situation.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{situation.description}</p>
          <p className="text-xs text-gray-500 mt-1">
            {situationText} &middot; {loggedPlaysCount} play{loggedPlaysCount !== 1 ? 's' : ''} logged
          </p>
        </div>
      ) : (
        <div className="bg-[#B8CA6E]/10 border border-[#B8CA6E]/20 rounded-xl mx-4 mt-3 p-3">
          <div className="flex items-center gap-2 mb-1">
            <SparkleIcon />
            <p className="text-sm font-semibold text-[#B8CA6E]">AI Suggestions</p>
          </div>
          <p className="text-xs text-gray-400">
            {situationText} &middot; {loggedPlaysCount} play{loggedPlaysCount !== 1 ? 's' : ''} logged
          </p>
        </div>
      )}

      {/* Situation plays section */}
      {situation && (
        <div className="mt-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 pb-1.5">
            {situation.label} Plays
          </p>
          {situationPlays.length > 0 ? (
            situationPlays.map((gpp) => (
              <PlayRow
                key={gpp.id}
                gpp={gpp}
                isSituationPlay
                game={game}
                onSelect={() => selectPlay(gpp)}
              />
            ))
          ) : (
            <p className="text-xs text-gray-600 px-4 py-3">
              No plays tagged for this situation yet — tag them in your desktop game plan
            </p>
          )}
        </div>
      )}

      {/* AI suggestions section */}
      <div className="mt-3">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 pb-1.5">
          AI Suggestions
        </p>
        {rankedPlays.map(({ gpp, score }: { gpp: GamePlanPlay; score: number }, index: number) => {
          const isTopPick = index === 0 && score > 0
          const isSuggested = (index === 1 || index === 2) && score > 0
          const pt = gpp.playbook_plays.attributes.playType?.toLowerCase()

          let hint = ''
          if (isTopPick) {
            if (game.distance <= 3 && pt === 'run') hint = 'Short yardage — power run situation'
            else if (game.distance >= 8 && pt === 'pass') hint = 'Long distance — passing situation'
            else if (game.yardLine >= 80 && pt === 'run') hint = 'Red zone — ground game'
            else if (game.quarter >= 4 && pt === 'pass') hint = '4th quarter — stretch the field'
            else hint = 'Best match for this situation'
          }

          return (
            <PlayRow
              key={gpp.id}
              gpp={gpp}
              isTopPick={isTopPick}
              isSuggested={isSuggested}
              hint={isTopPick ? hint : undefined}
              game={game}
              onSelect={() => selectPlay(gpp)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drive View
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Swipeable Play Row (swipe left to reveal delete)
// ---------------------------------------------------------------------------

function SwipeablePlayRow({
  play,
  index,
  onDelete,
}: {
  play: LoggedPlay
  index: number
  onDelete: () => void
}) {
  const [offsetX, setOffsetX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const startXRef = useRef(0)
  const DELETE_THRESHOLD = -70

  function handleTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX
    setSwiping(true)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!swiping) return
    const dx = e.touches[0].clientX - startXRef.current
    // Only allow swipe left
    setOffsetX(Math.min(0, Math.max(-100, dx)))
  }

  function handleTouchEnd() {
    setSwiping(false)
    if (offsetX <= DELETE_THRESHOLD) {
      setOffsetX(-100) // Lock open
    } else {
      setOffsetX(0) // Snap back
    }
  }

  return (
    <div className="relative overflow-hidden">
      {/* Delete action behind the row */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          type="button"
          onClick={onDelete}
          className="bg-red-600 text-white text-xs font-semibold h-full px-5 flex items-center active:bg-red-700"
        >
          Delete
        </button>
      </div>
      {/* Swipeable row */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${offsetX}px)`, transition: swiping ? 'none' : 'transform 0.2s ease-out' }}
        className="relative bg-[#1c1c1e] flex items-center gap-3 px-4 py-3 border-b border-[#3a3a3c]"
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
            {ordinalDown(play.down)} &amp; {play.distance} &middot; {formatYardLine(play.yardLine, play.possession)}
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5">
            {formatYardLine(play.yardLine, play.possession)} &rarr; {formatYardLine(Math.min(99, play.yardLine + play.yardsGained), play.possession)}
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
  onDeletePlay: (playId: string) => void
  onUndo: () => void
  canUndo: boolean
}

function DriveView({ game, loggedPlays, driveNumber, teamId, currentGameId, onDeletePlay, onUndo, canUndo }: DriveViewProps) {
  const [dbDrives, setDbDrives] = useState<DbDrive[]>([])
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [expandedDrive, setExpandedDrive] = useState<number | null>(null)

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
        {currentDrivePlays.length > 0 && (
          <p className="text-xs text-gray-600 mt-0.5">
            {formatYardLine(currentDrivePlays[0].yardLine, currentDrivePlays[0].possession)} &rarr; {formatYardLine(game.yardLine, game.possession)}
          </p>
        )}
      </div>

      {/* Play list for current drive */}
      {currentDrivePlays.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-gray-600">No plays logged this drive</p>
        </div>
      ) : (
        <div className="mt-2">
          {currentDrivePlays.map((play, index) => {
            const isLastPlay = index === currentDrivePlays.length - 1
            return (
              <div key={play.id}>
                <SwipeablePlayRow
                  play={play}
                  index={index}
                  onDelete={() => setDeleteConfirmId(play.id)}
                />
                {isLastPlay && canUndo && (
                  <button
                    type="button"
                    onClick={onUndo}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 active:text-white transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7v6h6" /><path d="M3 13a9 9 0 103-7.7L3 7" />
                    </svg>
                    Undo last play
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirmId && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setDeleteConfirmId(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#2c2c2e] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#48484a]" />
            </div>
            <div className="px-5 pb-6 text-center">
              <p className="text-sm text-white font-semibold">Remove this play from the drive?</p>
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 bg-[#3a3a3c] text-white rounded-xl py-3 text-sm font-semibold min-h-[48px] active:bg-[#48484a] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeletePlay(deleteConfirmId)
                    setDeleteConfirmId(null)
                  }}
                  className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-semibold min-h-[48px] active:bg-red-700 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </>
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

      {(() => {
        // Build local previous drives from logged plays
        const previousDriveNumbers = Array.from(
          new Set(loggedPlays.filter((p) => p.driveNumber < driveNumber).map((p) => p.driveNumber))
        ).sort((a, b) => b - a) // Most recent first

        const hasLocalDrives = previousDriveNumbers.length > 0
        const hasDbDrives = dbDrives.length > 0

        if (!hasLocalDrives && !hasDbDrives) {
          return (
            <div className="text-center py-8 px-4">
              <p className="text-sm text-gray-600">No drives yet — log your first play to start</p>
            </div>
          )
        }

        return (
          <div className="mt-2">
            {/* Local previous drives (from this session) — expandable */}
            {previousDriveNumbers.map((dn) => {
              const drivePlays = loggedPlays.filter((p) => p.driveNumber === dn)
              const totalYards = drivePlays.reduce((sum, p) => sum + p.yardsGained, 0)
              const lastPlay = drivePlays[drivePlays.length - 1]
              const driveResult = lastPlay?.outcomeLabel ?? null
              const isExpanded = expandedDrive === dn

              return (
                <div key={`local-drive-${dn}`} className="mx-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setExpandedDrive(isExpanded ? null : dn)}
                    className="w-full bg-[#2c2c2e] rounded-xl p-3 text-left active:bg-[#3a3a3c] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Drive #{dn} &middot; Q{drivePlays[0]?.quarter ?? game.quarter}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {driveResult && (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${driveBadgeClass(driveResult)}`}>
                              {driveResult}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            {drivePlays.length} plays &middot; {totalYards} yards
                          </span>
                        </div>
                      </div>
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={`text-gray-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="bg-[#252527] rounded-b-xl mx-1 -mt-1 pt-2 pb-1">
                      {drivePlays.map((play, idx) => (
                        <div key={play.id} className="flex items-center gap-3 px-3 py-2 border-b border-[#3a3a3c] last:border-b-0">
                          <div className="w-6 h-6 rounded-full bg-[#3a3a3c] text-white text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white truncate">
                              {play.playName ?? 'Quick Play'}
                            </p>
                            <p className="text-[10px] text-gray-600">
                              {formatYardLine(play.yardLine, play.possession)} &rarr; {formatYardLine(Math.min(99, play.yardLine + play.yardsGained), play.possession)}
                            </p>
                          </div>
                          <span className={[
                            'text-xs font-semibold shrink-0',
                            play.yardsGained > 0 ? 'text-green-400' : play.yardsGained < 0 ? 'text-red-400' : 'text-gray-400',
                          ].join(' ')}>
                            {play.yardsGained > 0 ? '+' : ''}{play.yardsGained}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {/* DB previous drives (from prior sessions) */}
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
        )
      })()}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SidelinePage() {
  const { teamId } = useMobile()

  // Active game selection
  const [activeGameId, setActiveGameId] = useState<string | null>(null)
  const [opponentName, setOpponentName] = useState('')
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [clockHasBeenSet, setClockHasBeenSet] = useState(false)
  const [pendingTry, setPendingTry] = useState<PendingTry>(null)
  const [pendingBlockedTD, setPendingBlockedTD] = useState<PendingBlockedTD>(null)
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null)
  const [showGameMenu, setShowGameMenu] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [activeSTSubType, setActiveSTSubType] = useState<STSubType | null>(null)

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
  const [isLoadingGamePlan, setIsLoadingGamePlan] = useState(false)

  // All playbook plays (for "From Plays" mode)
  const [allPlays, setAllPlays] = useState<{
    id: string
    play_code: string
    play_name: string
    attributes: { odk: string; formation?: string; playType?: string }
  }[]>([])
  const [isLoadingPlays, setIsLoadingPlays] = useState(false)

  // Currently selected play (for switching from Plays view to Log)
  const [pendingPlayCode, setPendingPlayCode] = useState<string | null>(null)
  const [pendingPlayName, setPendingPlayName] = useState<string | null>(null)
  const [pendingPlayType, setPendingPlayType] = useState<string | null>(null)
  const [pendingFormation, setPendingFormation] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Activate a game
  // -------------------------------------------------------------------------

  function handleSelectGame(gameId: string, opponent: string) {
    setActiveGameId(gameId)
    setOpponentName(opponent)
    // Reset game state for fresh tracking
    dispatchGame({ type: 'SET_DOWN', down: 1 })
    dispatchGame({ type: 'SET_DISTANCE', distance: 10 })
    dispatchGame({ type: 'SET_YARD_LINE', yardLine: 25 })
    setDriveNumber(1)
    setLoggedPlays([])
    setActiveSegment('log')
  }

  function handleEndGame() {
    setShowEndConfirm(false)
    setActiveGameId(null)
    setOpponentName('')
    setClockHasBeenSet(false)
    setGamePlanPlays([])
    setGamePlanLoaded(false)
  }

  // -------------------------------------------------------------------------
  // Fetch game plan (runs when activeGameId changes)
  // -------------------------------------------------------------------------

  const fetchGamePlan = useCallback(async () => {
    if (!teamId || !activeGameId) {
      setIsLoadingGamePlan(false)
      return
    }

    setIsLoadingGamePlan(true)
    const supabase = createClient()

    // First try: game plan linked to this specific game
    let planId: string | null = null

    const { data: gamePlans } = await supabase
      .from('game_plans')
      .select('id')
      .eq('team_id', teamId)
      .eq('game_id', activeGameId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (gamePlans && gamePlans.length > 0) {
      planId = gamePlans[0].id
    }

    // Fallback: latest game plan for the team (any game or no game)
    if (!planId) {
      const { data: fallbackPlans } = await supabase
        .from('game_plans')
        .select('id')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (fallbackPlans && fallbackPlans.length > 0) {
        planId = fallbackPlans[0].id
      }
    }

    if (!planId) {
      setGamePlanLoaded(false)
      setIsLoadingGamePlan(false)
      return
    }

    // Fetch game plan plays joined to playbook_plays
    const { data: gppData } = await supabase
      .from('game_plan_plays')
      .select(`
        id,
        play_code,
        call_number,
        sort_order,
        situation,
        playbook_plays (
          id,
          play_code,
          play_name,
          attributes
        )
      `)
      .eq('game_plan_id', planId)
      .order('sort_order', { ascending: true })

    if (gppData && gppData.length > 0) {
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
  }, [teamId, activeGameId])

  // -------------------------------------------------------------------------
  // Fetch all playbook plays
  // -------------------------------------------------------------------------

  const fetchAllPlays = useCallback(async () => {
    if (!teamId || !activeGameId) {
      setIsLoadingPlays(false)
      return
    }

    setIsLoadingPlays(true)
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
  }, [teamId, activeGameId])

  useEffect(() => {
    fetchGamePlan()
    fetchAllPlays()
  }, [fetchGamePlan, fetchAllPlays])

  // -------------------------------------------------------------------------
  // Handle play logged (advance game state, add to drive log)
  // -------------------------------------------------------------------------

  function handlePlayLogged(play: LoggedPlay) {
    // Save snapshot for undo BEFORE any state changes
    setUndoSnapshot({
      gameState: { ...game },
      driveNumber,
      playsCount: loggedPlays.length,
    })

    setLoggedPlays((prev) => [...prev, play])

    // Use original outcomeLabel directly — avoids the lossy mapOutcomeToResult → reverseMapResult roundtrip
    const outcome = play.outcomeLabel ?? reverseMapResult(play.result)
    // Use possession captured at tap time in LogView, not parent's game.possession (avoids stale closure)
    const currentPossession = play.possession

    dispatchGame({
      type: 'ADVANCE',
      yardsGained: play.yardsGained,
      outcome,
      possession: currentPossession,
      stSubType: play.stSubType,
      kickYards: play.kickYards,
    })

    // Check if we need to start a new drive (possession changes)
    const isReturnTD = outcome === 'Return' && play.yardsGained > 0 && (play.yardLine + play.yardsGained) >= 100
    const isKickReturn = outcome === 'Return' && (play.stSubType === 'punt' || play.stSubType === 'kickoff')
    if (
      outcome === 'TD' ||
      outcome === 'Turnover' ||
      outcome === 'Blocked' ||
      outcome === 'Touchback' ||
      outcome === 'Fair Catch' ||
      outcome === 'Good' ||
      outcome === 'No Good' ||
      isReturnTD ||
      isKickReturn
    ) {
      setDriveNumber((n) => n + 1)
    }

    // Post-TD: prompt for PAT/2pt try (TD scored by whoever had possession)
    if (outcome === 'TD' || isReturnTD) {
      setPendingTry({ scoringTeam: currentPossession })
    }

    // Blocked kick: prompt for return TD option
    if (outcome === 'Blocked') {
      // The blocking team now has possession (reducer already flipped)
      const blockingTeam: Possession = currentPossession === 'us' ? 'them' : 'us'
      setPendingBlockedTD({ blockingTeam })
    }
  }

  function reverseMapResult(result: string): OutcomeLabel {
    switch (result) {
      case 'touchdown':       return 'TD'
      case 'fumble':          return 'Turnover'
      case 'interception':    return 'Turnover'
      case 'pass_incomplete': return 'Incomplete'
      case 'pass_complete':   return 'Complete'
      case 'sack':            return 'Sack'
      case 'penalty':         return 'Penalty'
      default:                return 'Complete' // run_gain/run_loss don't have explicit outcomes anymore
    }
  }

  // -------------------------------------------------------------------------
  // Undo last play
  // -------------------------------------------------------------------------

  function handleUndo() {
    if (!undoSnapshot) return
    // Restore game state
    dispatchGame({ type: 'RESTORE', state: undoSnapshot.gameState })
    // Restore drive number
    setDriveNumber(undoSnapshot.driveNumber)
    // Remove the last logged play(s) added since snapshot
    setLoggedPlays((prev) => prev.slice(0, undoSnapshot.playsCount))
    // Clear any pending prompts
    setPendingTry(null)
    setPendingBlockedTD(null)
    // Clear undo — only one level
    setUndoSnapshot(null)
  }

  // -------------------------------------------------------------------------
  // Reset game
  // -------------------------------------------------------------------------

  function handleResetGame() {
    dispatchGame({ type: 'RESTORE', state: INITIAL_GAME_STATE })
    setDriveNumber(1)
    setLoggedPlays([])
    setClockHasBeenSet(false)
    setPendingTry(null)
    setPendingBlockedTD(null)
    setUndoSnapshot(null)
    setShowResetConfirm(false)
    setShowGameMenu(false)
  }

  // -------------------------------------------------------------------------
  // Post-TD try resolution
  // -------------------------------------------------------------------------

  function handleTryResult(tryType: TryType, good: boolean) {
    if (pendingTry && good) {
      const points = tryType === 'pat' ? 1 : 2
      const scoreKey = pendingTry.scoringTeam === 'us' ? 'homeScore' : 'oppScore'
      if (scoreKey === 'homeScore') {
        dispatchGame({ type: 'SET_HOME_SCORE', score: game[scoreKey] + points })
      } else {
        dispatchGame({ type: 'SET_OPP_SCORE', score: game[scoreKey] + points })
      }
    }
    setPendingTry(null)
  }

  // -------------------------------------------------------------------------
  // Blocked kick return TD resolution
  // -------------------------------------------------------------------------

  function handleBlockedTDResult(returnedForTD: boolean) {
    if (pendingBlockedTD && returnedForTD) {
      // Score 6 for the blocking team (who now has possession)
      const scoreKey = pendingBlockedTD.blockingTeam === 'us' ? 'homeScore' : 'oppScore'
      if (scoreKey === 'homeScore') {
        dispatchGame({ type: 'SET_HOME_SCORE', score: game[scoreKey] + 6 })
      } else {
        dispatchGame({ type: 'SET_OPP_SCORE', score: game[scoreKey] + 6 })
      }
      // Flip possession again (scoring team kicks off) and reset field
      const flip: Possession = pendingBlockedTD.blockingTeam === 'us' ? 'them' : 'us'
      dispatchGame({ type: 'SET_POSSESSION', possession: flip })
      dispatchGame({ type: 'SET_YARD_LINE', yardLine: 25 })
      setDriveNumber((n) => n + 1)

      // Show try prompt for the blocked kick return TD
      setPendingBlockedTD(null)
      setPendingTry({ scoringTeam: pendingBlockedTD.blockingTeam })
      return
    }
    setPendingBlockedTD(null)
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

  // Show game selection when no active game
  if (!activeGameId) {
    return <GameSelectionScreen teamId={teamId} onSelectGame={handleSelectGame} />
  }

  return (
    <div className="min-h-screen bg-[#1c1c1e] pb-6">
      {/* Game State Bar */}
      <GameStateBar
        game={game}
        opponentName={opponentName}
        onMenuOpen={() => setShowGameMenu(true)}
        dispatch={dispatchGame}
        clockHasBeenSet={clockHasBeenSet}
        onClockSet={() => setClockHasBeenSet(true)}
        activeSTSubType={activeSTSubType}
      />

      {/* End Game Confirmation */}
      {showEndConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowEndConfirm(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#2c2c2e] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#48484a]" />
            </div>
            <div className="px-5 pb-6 text-center">
              <h3 className="text-lg font-bold text-white">End Game?</h3>
              <p className="text-sm text-gray-500 mt-1">
                {loggedPlays.length} play{loggedPlays.length !== 1 ? 's' : ''} logged vs {opponentName}
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEndConfirm(false)}
                  className="flex-1 bg-[#3a3a3c] text-white rounded-xl py-3 text-sm font-semibold min-h-[48px] active:bg-[#48484a] transition-colors"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={handleEndGame}
                  className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-semibold min-h-[48px] active:bg-red-700 transition-colors"
                >
                  End Game
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Game Menu */}
      {showGameMenu && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowGameMenu(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#2c2c2e] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#48484a]" />
            </div>
            <div className="px-5 pb-6">
              <button
                type="button"
                onClick={() => { setShowGameMenu(false); setShowEndConfirm(true) }}
                className="w-full bg-[#3a3a3c] text-white rounded-xl py-3.5 text-sm font-semibold text-center min-h-[48px] active:bg-[#48484a] transition-colors"
              >
                End Game
              </button>
              <button
                type="button"
                onClick={() => { setShowGameMenu(false); setShowResetConfirm(true) }}
                className="w-full mt-2 bg-[#3a3a3c] text-red-400 rounded-xl py-3.5 text-sm font-semibold text-center min-h-[48px] active:bg-[#48484a] transition-colors"
              >
                Reset Game
              </button>
              <button
                type="button"
                onClick={() => setShowGameMenu(false)}
                className="w-full mt-2 text-sm font-semibold text-gray-500 min-h-[44px] active:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Reset Game Confirmation */}
      {showResetConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowResetConfirm(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#2c2c2e] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#48484a]" />
            </div>
            <div className="px-5 pb-6 text-center">
              <h3 className="text-lg font-bold text-white">Reset Game?</h3>
              <p className="text-sm text-gray-500 mt-2">
                This will clear all score, possession, and drive data for this session. Plays already synced cannot be undone.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 bg-[#3a3a3c] text-white rounded-xl py-3 text-sm font-semibold min-h-[48px] active:bg-[#48484a] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetGame}
                  className="flex-1 bg-red-600 text-white rounded-xl py-3 text-sm font-semibold min-h-[48px] active:bg-red-700 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Post-TD Try Sheet */}
      {pendingTry && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#2c2c2e] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#48484a]" />
            </div>
            <div className="px-5 pb-6">
              <h3 className="text-lg font-bold text-white text-center">Extra Point</h3>
              <p className="text-xs text-gray-500 text-center mt-1">
                {pendingTry.scoringTeam === 'us' ? 'Our' : 'Opponent'} touchdown
              </p>

              {/* PAT row */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-2">PAT (Kick)</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTryResult('pat', true)}
                  className="bg-[#2a3a2a] text-[#B8CA6E] rounded-xl py-3 text-sm font-semibold text-center min-h-[48px] active:opacity-70"
                >
                  Good (+1)
                </button>
                <button
                  type="button"
                  onClick={() => handleTryResult('pat', false)}
                  className="bg-[#3a3a3c] text-white rounded-xl py-3 text-sm font-semibold text-center min-h-[48px] active:opacity-70"
                >
                  No Good
                </button>
              </div>

              {/* 2-pt row */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-2">2-Point Conversion</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTryResult('2pt', true)}
                  className="bg-[#2a3a2a] text-[#B8CA6E] rounded-xl py-3 text-sm font-semibold text-center min-h-[48px] active:opacity-70"
                >
                  Good (+2)
                </button>
                <button
                  type="button"
                  onClick={() => handleTryResult('2pt', false)}
                  className="bg-[#3a3a3c] text-white rounded-xl py-3 text-sm font-semibold text-center min-h-[48px] active:opacity-70"
                >
                  No Good
                </button>
              </div>

              {/* Skip */}
              <button
                type="button"
                onClick={() => setPendingTry(null)}
                className="w-full mt-4 text-sm font-semibold text-gray-500 min-h-[44px] active:text-gray-300 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </>
      )}

      {/* Blocked Kick Return TD Prompt */}
      {pendingBlockedTD && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#2c2c2e] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#48484a]" />
            </div>
            <div className="px-5 pb-6 text-center">
              <h3 className="text-lg font-bold text-white">Blocked Kick</h3>
              <p className="text-sm text-gray-500 mt-1">Was it returned for a touchdown?</p>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => handleBlockedTDResult(false)}
                  className="flex-1 bg-[#3a3a3c] text-white rounded-xl py-3 text-sm font-semibold min-h-[48px] active:bg-[#48484a] transition-colors"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => handleBlockedTDResult(true)}
                  className="flex-1 bg-[#2a3a2a] text-[#B8CA6E] rounded-xl py-3 text-sm font-semibold min-h-[48px] active:opacity-70 transition-colors"
                >
                  Yes — TD
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
          activeGameId={activeGameId}
          driveNumber={driveNumber}
          onPlayLogged={handlePlayLogged}
          onSTSubTypeChange={setActiveSTSubType}
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
          currentGameId={activeGameId}
          onDeletePlay={(playId) => setLoggedPlays((prev) => prev.filter((p) => p.id !== playId))}
          onUndo={handleUndo}
          canUndo={undoSnapshot !== null}
        />
      )}
    </div>
  )
}
