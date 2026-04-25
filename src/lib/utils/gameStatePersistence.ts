/**
 * Game State Persistence — localStorage-based state saving/restoring
 * for the sideline tracker. Follows the SidelineIQ cache pattern.
 */

import type { GameState, LoggedPlay, UndoSnapshot, MainSegment, PendingTry, PendingBlockedTD } from '@/types/sideline'

export interface PersistedGameState {
  activeGameId: string
  opponentName: string
  game: GameState
  loggedPlays: LoggedPlay[]
  driveNumber: number
  undoSnapshot: UndoSnapshot | null
  clockHasBeenSet: boolean
  quarterLengthMinutes: number
  activeSegment: MainSegment
  pendingTry: PendingTry
  pendingBlockedTD: PendingBlockedTD
  savedAt: number
}

const KEY_PREFIX = 'ych-game-state-'
const MAX_AGE_MS = 12 * 60 * 60 * 1000 // 12 hours

export function saveGameState(gameId: string, state: PersistedGameState): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${gameId}`, JSON.stringify(state))
  } catch {
    // localStorage full or unavailable — silent fail
  }
}

export function loadGameState(gameId: string): PersistedGameState | null {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${gameId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedGameState
    if (parsed.savedAt && Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(`${KEY_PREFIX}${gameId}`)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearGameState(gameId: string): void {
  try {
    localStorage.removeItem(`${KEY_PREFIX}${gameId}`)
  } catch {
    // Silent
  }
}
