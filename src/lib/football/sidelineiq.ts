/**
 * SidelineIQ — Local Suggestion Engine
 *
 * Pure function that ranks plays for the current game situation.
 * Uses pre-game Gemini analysis (cached in localStorage) + in-game
 * performance re-weighting via projectPlaySuccess/projectDefensivePlaySuccess.
 */

import type { OpponentProfile, OpponentOffensiveProfile } from '@/types/football'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuggestedPlay {
  playCode: string
  callNumber?: number
  playName: string
  playType: string       // 'run' | 'pass' | 'rpo' | 'defense' | 'special_teams'
  reason: string         // max 6 words
  rationale?: string     // one-sentence AI reasoning (from analyze API)
  confidence: number     // 0-1
  source: 'ai' | 'situational' | 'performance'
}

export interface SituationalSuggestionMap {
  [situationKey: string]: {
    offense: SuggestedPlay[]
    defense: SuggestedPlay[]
    specialTeams: SuggestedPlay[]
  }
}

export interface GameStateForSuggestions {
  down: number
  distance: number
  yardLine: number
  possession: 'us' | 'them'
  quarter: number
  homeScore: number
  oppScore: number
}

export interface LoggedPlayForSuggestions {
  playCode: string | null
  playType: string | null
  yardsGained: number
  possession: 'us' | 'them'
  outcomeLabel: string | null
}

export interface GamePlanPlayForSuggestions {
  play_code: string
  call_number: number
  situation: string | null
  playbook_plays: {
    play_code: string
    play_name: string
    attributes: Record<string, unknown>
  }
}

// ---------------------------------------------------------------------------
// Situation key derivation
// ---------------------------------------------------------------------------

export function deriveSituationKey(state: GameStateForSuggestions): string {
  const { down, distance, yardLine, possession } = state

  // Distance buckets
  let distBucket: string
  if (distance <= 3) distBucket = 'short'
  else if (distance <= 7) distBucket = 'medium'
  else distBucket = 'long'

  // Field zones
  let fieldZone: string
  if (yardLine >= 93) {
    fieldZone = 'red_zone'
    distBucket = 'goal_line' // Override distance bucket at goal line
  } else if (yardLine >= 80) {
    fieldZone = 'scoring'
  } else if (yardLine >= 40) {
    fieldZone = 'midfield'
  } else {
    fieldZone = 'own_territory'
  }

  const possLabel = possession === 'us' ? 'offense' : 'defense'

  return `${down}_${distBucket}_${fieldZone}_${possLabel}`
}

// ---------------------------------------------------------------------------
// In-game performance stats
// ---------------------------------------------------------------------------

function computeInGameStats(
  loggedPlays: LoggedPlayForSuggestions[]
): Map<string, { calls: number; totalYards: number; avgYards: number }> {
  const raw = new Map<string, { calls: number; totalYards: number }>()

  for (const play of loggedPlays) {
    if (!play.playCode) continue
    const s = raw.get(play.playCode) || { calls: 0, totalYards: 0 }
    s.calls++
    s.totalYards += play.yardsGained
    raw.set(play.playCode, s)
  }

  const result = new Map<string, { calls: number; totalYards: number; avgYards: number }>()
  for (const [code, s] of raw) {
    result.set(code, { ...s, avgYards: s.totalYards / s.calls })
  }
  return result
}

// Quarter multiplier for in-game data trust
function getQuarterMultiplier(quarter: number): number {
  if (quarter <= 1) return 0.5
  if (quarter === 2) return 0.75
  if (quarter === 3) return 1.0
  return 1.25 // Q4+
}

// Normalization divisor — keeps confidence in a useful 0-1 range
const SCORE_DIVISOR = 125

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

const CACHE_PREFIX = 'sidelineiq-'

export function getCachedSuggestions(gameId: string): SituationalSuggestionMap | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${gameId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Check age — expire after 24 hours
    if (parsed._generatedAt && Date.now() - parsed._generatedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(`${CACHE_PREFIX}${gameId}`)
      return null
    }
    return parsed.suggestions ?? null
  } catch {
    return null
  }
}

export function setCachedSuggestions(gameId: string, suggestions: SituationalSuggestionMap): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${gameId}`, JSON.stringify({
      suggestions,
      _generatedAt: Date.now(),
    }))
  } catch {
    // localStorage full or unavailable — silent fail
  }
}

// ---------------------------------------------------------------------------
// Main suggestion function
//
// Scoring hierarchy (all signals combined for every play):
//   1. BASE — situational football logic (0-100 points)
//   2. GEMINI — opponent tendency bonus (0-25 points)
//   3. IN-GAME — performance re-weight, primary signal (+30 to -15 raw,
//      scaled by quarter multiplier: Q1×0.5 → Q4×1.25)
//
// Early in the game Gemini carries more weight; as real data accumulates
// in-game performance becomes the dominant signal.
// ---------------------------------------------------------------------------

export function getSuggestions(
  state: GameStateForSuggestions,
  loggedPlays: LoggedPlayForSuggestions[],
  gamePlanPlays: GamePlanPlayForSuggestions[],
  cache: SituationalSuggestionMap | null,
  _opponentProfile?: OpponentProfile | OpponentOffensiveProfile | null,
): SuggestedPlay[] {
  const { down, distance, yardLine, possession, quarter } = state
  const situationKey = deriveSituationKey(state)

  // Filter to current side
  const sidePlays = gamePlanPlays.filter(gpp => {
    const odk = (gpp.playbook_plays.attributes.odk as string)?.toLowerCase()
    if (possession === 'us') return odk === 'offense'
    return odk === 'defense'
  })

  if (sidePlays.length === 0) return []

  // Build in-game stats
  const inGameStats = computeInGameStats(loggedPlays)
  const qMult = getQuarterMultiplier(quarter)

  // Build Gemini lookup for this situation
  const geminiRanks = new Map<string, { rank: number; reason: string }>()
  if (cache) {
    const cached = cache[situationKey]
    if (cached) {
      const side = possession === 'us' ? 'offense' : 'defense'
      const cachedPlays = side === 'offense' ? cached.offense : cached.defense
      if (cachedPlays) {
        cachedPlays.forEach((p, i) => {
          geminiRanks.set(p.playCode, { rank: i, reason: p.reason })
        })
      }
    }
  }

  // Score every game plan play with all three signals
  const scored = sidePlays.map(gpp => {
    const attrs = gpp.playbook_plays.attributes
    const pt = (attrs.playType as string)?.toLowerCase() ?? ''
    const isRun = pt === 'run' || pt === 'draw'
    const isPass = pt === 'pass' || pt === 'screen' || pt === 'play action' || pt === 'rpo'

    // --- 1. BASE: situational football logic (0-100, clamped) ---
    let base = 50
    if (possession === 'us') {
      if (distance <= 3 && isRun) base += 20
      if (distance >= 8 && isPass) base += 20
      if (yardLine >= 93 && isRun) base += 25
      if (yardLine >= 80 && isRun) base += 10
      if (down >= 3 && distance >= 8 && isPass) base += 15
      if (down === 4 && distance <= 2 && isRun) base += 30
    } else {
      const front = (attrs.front as string)?.toLowerCase() ?? ''
      const coverage = (attrs.coverage as string)?.toLowerCase() ?? ''
      if (distance <= 3 && (front.includes('4-4') || front.includes('goal'))) base += 20
      if (distance >= 8 && (coverage.includes('zone') || front.includes('nickel'))) base += 20
    }
    base = Math.min(100, base)

    // --- 2. GEMINI: opponent tendency bonus (0-25) ---
    let geminiBonus = 0
    let reason = ''
    const gemini = geminiRanks.get(gpp.play_code)
    if (gemini) {
      geminiBonus = gemini.rank === 0 ? 25 : gemini.rank === 1 ? 20 : gemini.rank === 2 ? 15 : 10
      reason = gemini.reason
    }

    // --- 3. IN-GAME: performance adjustment × quarter multiplier ---
    let inGameRaw = 0
    const stats = inGameStats.get(gpp.play_code)
    if (stats && stats.calls > 0) {
      if (stats.avgYards > distance) {
        inGameRaw = 30
      } else if (stats.avgYards > 0) {
        inGameRaw = 20
      } else {
        inGameRaw = -15
      }
    }
    const inGameAdj = inGameRaw * qMult

    // --- Combined score ---
    const totalScore = base + geminiBonus + inGameAdj

    // Determine reason
    if (!reason) {
      if (distance <= 3 && isRun) reason = 'Short yardage power'
      else if (distance >= 8 && isPass) reason = 'Long distance passing'
      else if (yardLine >= 93) reason = 'Goal line situation'
      else if (down >= 3 && distance >= 8) reason = 'Must-convert down'
      else reason = 'Situational pick'
    }

    // Determine source — whichever signal contributes most
    let source: 'ai' | 'situational' | 'performance' = 'situational'
    if (gemini && geminiBonus >= Math.abs(inGameAdj)) source = 'ai'
    if (stats && stats.calls > 0 && Math.abs(inGameAdj) > geminiBonus) source = 'performance'

    return {
      playCode: gpp.play_code,
      callNumber: gpp.call_number,
      playName: gpp.playbook_plays.play_name,
      playType: pt || (possession === 'them' ? 'defense' : 'offense'),
      reason,
      confidence: Math.min(1, Math.max(0, totalScore / SCORE_DIVISOR)),
      source,
    }
  })

  return scored.sort((a, b) => b.confidence - a.confidence).slice(0, 6)
}
