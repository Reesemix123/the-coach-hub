/**
 * Shared types for the sideline tracker.
 * Extracted so the persistence utility and sideline page can both import them.
 */

export type MainSegment = 'log' | 'plays' | 'drive'
export type HashMark = 'left' | 'middle' | 'right'
export type Possession = 'us' | 'them'
export type STSubType = 'kickoff' | 'punt' | 'field_goal_pat'
export type OutcomeLabel = 'TD' | 'Turnover' | 'Incomplete' | 'Complete' | 'Sack' | 'Penalty' | 'Return' | 'Fair Catch' | 'Touchback' | 'Punted' | 'Blocked' | 'Good' | 'No Good' | 'Safety'
export type PendingTry = { scoringTeam: Possession } | null
export type PendingBlockedTD = { blockingTeam: Possession } | null

export interface GameState {
  down: number
  distance: number
  yardLine: number
  hash: HashMark
  quarter: number
  clock: string
  homeScore: number
  oppScore: number
  possession: Possession
  fieldLength: number
  touchbackYardLine: number
  kickoffYardLine: number
}

export interface LoggedPlay {
  id: string
  playCode: string | null
  playName: string | null
  playType: string | null
  formation: string | null
  down: number
  distance: number
  yardLine: number
  quarter: number
  result: string | null
  outcomeLabel: OutcomeLabel | null
  stSubType: STSubType | null
  possession: Possession
  yardsGained: number
  kickYards: number
  driveNumber: number
}

export interface UndoSnapshot {
  gameState: GameState
  driveNumber: number
  playsCount: number
}
