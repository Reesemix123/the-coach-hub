/**
 * Field Position Math — Pure Functions
 *
 * Calculates ball placement after kicks, punts, and returns.
 * Used by the Sideline Game Tracker (mobile) and will eventually
 * replace the ad-hoc calculateNextYardLine in TaggingPanel.
 *
 * Convention:
 *   Team A = home team ("us"), attacks toward fieldLength (100)
 *   Team B = opponent ("them"), attacks toward 0
 *   Absolute coordinate: 0 = Team A's goal line, fieldLength = Team B's goal line
 *   Possession-relative: 0 = own goal, fieldLength = opponent's goal
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BallPlacementInput {
  /** Total field length in yards (typically 100) */
  fieldLength: number
  /** Yard line where the ball lands (relative to landTeam's goal line) */
  landYardLine: number
  /** Which team's goal line is landYardLine measured from */
  landTeam: 'A' | 'B'
  /** Yards gained by the returner after catching */
  returnYards: number
  /** Which team is receiving the kick/punt */
  receivingTeam: 'A' | 'B'
  /** Whether the play results in a touchback */
  touchback: boolean
  /** Yard line for touchback placement (typically 20 or 25) */
  touchbackYardLine: number
}

// ---------------------------------------------------------------------------
// Pure function: calculateBallPlacement
// ---------------------------------------------------------------------------

/**
 * Calculate the absolute field position after a kick/punt play.
 *
 * Returns the absolute coordinate (0 = Team A goal, fieldLength = Team B goal).
 * Returns -1 if the result is a safety (ball crosses either goal line after return).
 */
export function calculateBallPlacement({
  fieldLength,
  landYardLine,
  landTeam,
  returnYards,
  receivingTeam,
  touchback,
  touchbackYardLine,
}: BallPlacementInput): number {
  // 1. Touchback: place at touchback yard line for receiving team
  if (touchback) {
    if (receivingTeam === 'A') return touchbackYardLine
    return fieldLength - touchbackYardLine
  }

  // 2. Convert landYardLine to absolute coordinate
  const landAbsolute = landTeam === 'A'
    ? landYardLine
    : fieldLength - landYardLine

  // 3. Receiving team direction: A attacks toward fieldLength (+1), B attacks toward 0 (-1)
  const receivingTeamDirection = receivingTeam === 'A' ? 1 : -1

  // 4. Apply return yards
  const newPosition = landAbsolute + (receivingTeamDirection * returnYards)

  // 5. Safety check: ball crossed a goal line
  if (newPosition <= 0 || newPosition >= fieldLength) {
    return -1
  }

  // 6. Return absolute position
  return newPosition
}

// ---------------------------------------------------------------------------
// Coordinate bridge helpers
// ---------------------------------------------------------------------------

/**
 * Convert a possession-relative yard_line to an absolute coordinate.
 *
 * In the app: yardLine 0 = own goal, 50 = midfield, 100 = opponent goal.
 * Team A ("us") has yardLine that maps directly to absolute (own goal = 0).
 * Team B ("them") has yardLine that maps inversely (own goal = fieldLength).
 */
export function toAbsolute(
  yardLine: number,
  possessingTeam: 'A' | 'B',
  fieldLength: number
): number {
  if (possessingTeam === 'A') return yardLine
  return fieldLength - yardLine
}

/**
 * Convert an absolute coordinate back to possession-relative for a given team.
 *
 * Returns the yard_line from that team's perspective (0 = their own goal).
 */
export function toRelative(
  absolute: number,
  possessingTeam: 'A' | 'B',
  fieldLength: number
): number {
  if (possessingTeam === 'A') return absolute
  return fieldLength - absolute
}
