/**
 * Play State Resolution — Pure Function
 *
 * Given current game state and a play result, computes the next
 * down, distance, yard line, and possession. Returns terminal
 * flags for scoring/turnover events that the UI handles separately.
 *
 * Convention:
 *   yardLine: 0 = own goal line, fieldLength (100) = opponent's goal line
 *   yardsGained: signed — positive = forward, negative = loss
 *   possession: 'A' = home (us), 'B' = away (them)
 */

import {
  calculateBallPlacement,
  toAbsolute,
  toRelative,
} from './fieldPosition'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayStateInput {
  down: number               // 1-4
  distance: number           // yards to first down
  yardLine: number           // 0-100 possession-relative
  possession: 'A' | 'B'
  fieldLength: number        // typically 100
  touchbackYardLine: number  // typically 20
  kickoffYardLine: number    // typically 40
}

export interface PlayResult {
  outcome:
    | 'gain'
    | 'incomplete'
    | 'touchdown'
    | 'turnover'
    | 'punt'
    | 'kickoff'
    | 'fair_catch'
    | 'touchback'
    | 'field_goal'
    | 'safety'
    | 'penalty'
  yardsGained?: number       // signed: positive = forward, negative = loss
  kickYards?: number         // distance of kick/punt
  returnYards?: number       // yards gained on return
  penaltyYards?: number      // signed: positive = forward for possessing team
  penaltyRedown?: boolean    // true = replay the down
}

export type TerminalState = 'touchdown' | 'safety' | 'turnover_on_downs' | null

export interface PlayStateResult {
  down: number
  distance: number
  yardLine: number
  possession: 'A' | 'B'
  terminal: TerminalState
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flip(possession: 'A' | 'B'): 'A' | 'B' {
  return possession === 'A' ? 'B' : 'A'
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Apply half-the-distance-to-the-goal rule for penalties.
 * If penalty would move ball past a goal line, move half the distance instead.
 */
function applyPenaltyYards(
  yardLine: number,
  penaltyYards: number,
  fieldLength: number
): number {
  const projected = yardLine + penaltyYards
  if (projected <= 0) {
    // Would cross own goal line — half the distance to own goal
    return Math.max(1, Math.floor(yardLine / 2))
  }
  if (projected >= fieldLength) {
    // Would cross opponent goal line — half the distance to opponent goal
    const distToGoal = fieldLength - yardLine
    return yardLine + Math.floor(distToGoal / 2)
  }
  return projected
}

// ---------------------------------------------------------------------------
// resolvePlayState
// ---------------------------------------------------------------------------

export function resolvePlayState(
  state: PlayStateInput,
  play: PlayResult
): PlayStateResult {
  const { down, distance, yardLine, possession, fieldLength, touchbackYardLine, kickoffYardLine } = state
  const opp = flip(possession)

  switch (play.outcome) {
    // ----- Explicit touchdown -----
    case 'touchdown': {
      return {
        down: 1,
        distance: 10,
        yardLine: kickoffYardLine, // Scoring team kicks off
        possession: opp,
        terminal: 'touchdown',
      }
    }

    // ----- Explicit safety -----
    case 'safety': {
      // Defense scores 2, gets a free kick. Kicking team kicks from own 20.
      return {
        down: 1,
        distance: 10,
        yardLine: 20, // Safety free kick from own 20
        possession, // Same team kicks (they were tackled in own end zone)
        terminal: 'safety',
      }
    }

    // ----- Turnover (INT / fumble) -----
    case 'turnover': {
      const yards = play.yardsGained ?? 0
      const spotAbsolute = toAbsolute(yardLine + yards, possession, fieldLength)
      // Clamp to valid field
      const clampedAbsolute = clamp(spotAbsolute, 1, fieldLength - 1)
      const newYl = toRelative(clampedAbsolute, opp, fieldLength)
      return {
        down: 1,
        distance: 10,
        yardLine: clamp(newYl, 1, fieldLength - 1),
        possession: opp,
        terminal: null,
      }
    }

    // ----- Incomplete pass -----
    case 'incomplete': {
      // Ball stays at same spot, down advances
      if (down >= 4) {
        // Turnover on downs
        return {
          down: 1,
          distance: 10,
          yardLine: fieldLength - yardLine,
          possession: opp,
          terminal: 'turnover_on_downs',
        }
      }
      return {
        down: down + 1,
        distance,
        yardLine,
        possession,
        terminal: null,
      }
    }

    // ----- Normal gain (run or complete pass) -----
    case 'gain': {
      const yards = play.yardsGained ?? 0
      const newYardLine = yardLine + yards

      // Touchdown check
      if (newYardLine >= fieldLength) {
        return {
          down: 1,
          distance: 10,
          yardLine: kickoffYardLine,
          possession: opp,
          terminal: 'touchdown',
        }
      }

      // Safety check (tackled going backward into own end zone)
      if (newYardLine <= 0) {
        return {
          down: 1,
          distance: 10,
          yardLine: 20,
          possession,
          terminal: 'safety',
        }
      }

      const clampedYl = clamp(newYardLine, 1, fieldLength - 1)

      // First down check
      if (yards >= distance) {
        return {
          down: 1,
          distance: 10,
          yardLine: clampedYl,
          possession,
          terminal: null,
        }
      }

      // 4th down, no conversion → turnover on downs
      if (down >= 4) {
        return {
          down: 1,
          distance: 10,
          yardLine: fieldLength - clampedYl,
          possession: opp,
          terminal: 'turnover_on_downs',
        }
      }

      // Normal advancement
      return {
        down: down + 1,
        distance: Math.max(1, distance - yards),
        yardLine: clampedYl,
        possession,
        terminal: null,
      }
    }

    // ----- Punt -----
    case 'punt': {
      const kd = play.kickYards ?? 0
      const ret = play.returnYards ?? 0
      const receivingTeam = opp

      if (kd <= 0) {
        // No kick distance — just flip possession at current spot (shouldn't happen, but safe)
        return {
          down: 1,
          distance: 10,
          yardLine: fieldLength - yardLine,
          possession: opp,
          terminal: null,
        }
      }

      // Compute landing position
      const kickerAbsolute = toAbsolute(yardLine, possession, fieldLength)
      const direction = possession === 'A' ? 1 : -1
      const landAbsolute = kickerAbsolute + (direction * kd)

      // Touchback detection
      const isTouchback = landAbsolute <= 0 || landAbsolute >= fieldLength

      const absolute = calculateBallPlacement({
        fieldLength,
        landYardLine: isTouchback ? 0 : toRelative(landAbsolute, receivingTeam, fieldLength),
        landTeam: receivingTeam,
        returnYards: ret,
        receivingTeam,
        touchback: isTouchback,
        touchbackYardLine,
      })

      if (absolute === -1) {
        // Safety on return (returner tackled in own end zone)
        return {
          down: 1,
          distance: 10,
          yardLine: 20,
          possession, // Punting team kicks after safety
          terminal: 'safety',
        }
      }

      const newYl = toRelative(absolute, receivingTeam, fieldLength)
      return {
        down: 1,
        distance: 10,
        yardLine: clamp(newYl, 1, fieldLength - 1),
        possession: opp,
        terminal: null,
      }
    }

    // ----- Kickoff -----
    case 'kickoff': {
      const kd = play.kickYards ?? 0
      const ret = play.returnYards ?? 0
      const receivingTeam = opp

      if (kd <= 0) {
        return {
          down: 1,
          distance: 10,
          yardLine: touchbackYardLine,
          possession: opp,
          terminal: null,
        }
      }

      const kickerAbsolute = toAbsolute(kickoffYardLine, possession, fieldLength)
      const direction = possession === 'A' ? 1 : -1
      const landAbsolute = kickerAbsolute + (direction * kd)
      const isTouchback = landAbsolute <= 0 || landAbsolute >= fieldLength

      const absolute = calculateBallPlacement({
        fieldLength,
        landYardLine: isTouchback ? 0 : toRelative(landAbsolute, receivingTeam, fieldLength),
        landTeam: receivingTeam,
        returnYards: ret,
        receivingTeam,
        touchback: isTouchback,
        touchbackYardLine,
      })

      if (absolute === -1) {
        return {
          down: 1,
          distance: 10,
          yardLine: 20,
          possession,
          terminal: 'safety',
        }
      }

      const newYl = toRelative(absolute, receivingTeam, fieldLength)
      return {
        down: 1,
        distance: 10,
        yardLine: clamp(newYl, 1, fieldLength - 1),
        possession: opp,
        terminal: null,
      }
    }

    // ----- Fair catch -----
    case 'fair_catch': {
      const kd = play.kickYards ?? 0
      const receivingTeam = opp

      if (kd <= 0) {
        return {
          down: 1,
          distance: 10,
          yardLine: fieldLength - yardLine,
          possession: opp,
          terminal: null,
        }
      }

      const kickerAbsolute = toAbsolute(yardLine, possession, fieldLength)
      const direction = possession === 'A' ? 1 : -1
      const landAbsolute = kickerAbsolute + (direction * kd)

      // Clamp land position to field
      const clampedLand = clamp(landAbsolute, 1, fieldLength - 1)
      const newYl = toRelative(clampedLand, receivingTeam, fieldLength)

      return {
        down: 1,
        distance: 10,
        yardLine: clamp(newYl, 1, fieldLength - 1),
        possession: opp,
        terminal: null,
      }
    }

    // ----- Touchback -----
    case 'touchback': {
      return {
        down: 1,
        distance: 10,
        yardLine: touchbackYardLine,
        possession: opp,
        terminal: null,
      }
    }

    // ----- Field goal made -----
    case 'field_goal': {
      // Scoring handled by UI. State resets for kickoff by the scoring team.
      return {
        down: 1,
        distance: 10,
        yardLine: kickoffYardLine,
        possession, // Scoring team kicks off (same possession)
        terminal: null, // UI handles scoring
      }
    }

    // ----- Penalty -----
    case 'penalty': {
      const penYards = play.penaltyYards ?? 0
      const redown = play.penaltyRedown ?? false
      const newYl = applyPenaltyYards(yardLine, penYards, fieldLength)

      if (redown) {
        // Replay the down — same down, same distance, adjusted yard line
        return {
          down,
          distance,
          yardLine: newYl,
          possession,
          terminal: null,
        }
      }

      // Penalty without redown — advance down like an incomplete
      if (down >= 4) {
        return {
          down: 1,
          distance: 10,
          yardLine: fieldLength - newYl,
          possession: opp,
          terminal: 'turnover_on_downs',
        }
      }

      return {
        down: down + 1,
        distance,
        yardLine: newYl,
        possession,
        terminal: null,
      }
    }

    default:
      // Unknown outcome — return state unchanged
      return { down, distance, yardLine, possession, terminal: null }
  }
}
