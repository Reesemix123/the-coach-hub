/**
 * Score Auto-Population Service
 *
 * Calculates the running score at any point in a game by walking all prior
 * tagged plays in timestamp order and accumulating scoring events.
 *
 * This is one of three eventual data sources for play metadata:
 *   - 'manual': Coach typed the value directly
 *   - 'auto':   Calculated from prior plays (this service)
 *   - 'ai':     Future Gemini OCR extraction from scoreboard camera
 *
 * The source is tracked alongside the value so the UI and database always
 * know where each score came from.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A score value paired with its data source */
export interface ScoredValue {
  value: number;
  source: 'manual' | 'auto' | 'ai';
}

/** The auto-populated score for a new play */
export interface AutoPopulatedScore {
  teamScore: ScoredValue;
  opponentScore: ScoredValue;
}

/** Minimal play instance shape needed for score calculation */
export interface PlayForScoring {
  id: string;
  timestamp_start: number;
  is_opponent_play?: boolean;
  scoring_type?: string | null;
  scoring_points?: number | null;
  opponent_scored?: boolean;
  team_score_at_snap?: number | null;
  opponent_score_at_snap?: number | null;
}

// ---------------------------------------------------------------------------
// Scoring type → points mapping (matches SCORING_TYPES in football.ts)
// ---------------------------------------------------------------------------

const SCORING_POINTS: Record<string, number> = {
  touchdown: 6,
  extra_point: 1,
  two_point_conversion: 2,
  field_goal: 3,
  safety: 2,
  defensive_touchdown: 6,
  pick_six: 6,
  fumble_return_td: 6,
  punt_return_td: 6,
  kick_return_td: 6,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the running score for a new play based on all prior plays
 * in the same game.
 *
 * Walks plays in timestamp order, starting from 0-0, and accumulates
 * scoring_points from each play. Uses the `opponent_scored` flag to
 * determine which team scored.
 *
 * @param priorPlays - All play instances in the game, in any order
 *                     (will be sorted by timestamp_start internally)
 * @param currentTimestamp - The timestamp of the new play being tagged
 *                          (only plays BEFORE this time are counted)
 * @returns Auto-populated score with source = 'auto'
 */
export function calculateRunningScore(
  priorPlays: PlayForScoring[],
  currentTimestamp: number,
): AutoPopulatedScore {
  // Sort plays chronologically
  const sorted = [...priorPlays]
    .filter(p => p.timestamp_start < currentTimestamp)
    .sort((a, b) => a.timestamp_start - b.timestamp_start);

  let teamScore = 0;
  let opponentScore = 0;

  for (const play of sorted) {
    const points = play.scoring_points ?? SCORING_POINTS[play.scoring_type ?? ''] ?? 0;

    if (points > 0) {
      if (play.opponent_scored) {
        opponentScore += points;
      } else {
        teamScore += points;
      }
    }
  }

  return {
    teamScore: { value: teamScore, source: 'auto' },
    opponentScore: { value: opponentScore, source: 'auto' },
  };
}

/**
 * Create a manual score override. Use this when the coach changes
 * an auto-populated value.
 *
 * @param value - The score the coach entered
 * @returns A ScoredValue with source = 'manual'
 */
export function manualScore(value: number): ScoredValue {
  return { value, source: 'manual' };
}

/**
 * Determine the effective score_source to store in the database.
 * If either score was manually overridden, the source is 'manual'.
 * Otherwise it's 'auto'.
 *
 * @param teamScore - The team score value + source
 * @param opponentScore - The opponent score value + source
 * @returns The database-level score_source value
 */
export function resolveScoreSource(
  teamScore: ScoredValue,
  opponentScore: ScoredValue,
): 'manual' | 'auto' | 'ai' {
  if (teamScore.source === 'manual' || opponentScore.source === 'manual') {
    return 'manual';
  }
  if (teamScore.source === 'ai' || opponentScore.source === 'ai') {
    return 'ai';
  }
  return 'auto';
}
