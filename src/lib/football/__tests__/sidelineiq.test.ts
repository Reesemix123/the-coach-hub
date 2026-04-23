import { describe, it, expect } from 'vitest'
import {
  deriveSituationKey,
  getSuggestions,
  type GameStateForSuggestions,
  type LoggedPlayForSuggestions,
  type GamePlanPlayForSuggestions,
  type SituationalSuggestionMap,
} from '../sidelineiq'

function makeState(overrides: Partial<GameStateForSuggestions> = {}): GameStateForSuggestions {
  return {
    down: 1,
    distance: 10,
    yardLine: 25,
    possession: 'us',
    quarter: 1,
    homeScore: 0,
    oppScore: 0,
    ...overrides,
  }
}

function makeGamePlanPlay(overrides: Partial<GamePlanPlayForSuggestions> & { odk?: string; playType?: string } = {}): GamePlanPlayForSuggestions {
  const { odk = 'offense', playType = 'Run', ...rest } = overrides
  return {
    play_code: 'PWR-R',
    call_number: 21,
    situation: null,
    playbook_plays: {
      play_code: 'PWR-R',
      play_name: 'Power Right',
      attributes: { odk, playType, formation: 'I-Form' },
    },
    ...rest,
  }
}

// Score divisor used in sidelineiq.ts
const DIVISOR = 125

describe('deriveSituationKey', () => {
  it('1st & 10 at OWN 25, offense', () => {
    expect(deriveSituationKey(makeState())).toBe('1_long_own_territory_offense')
  })

  it('3rd & 2 at midfield, offense', () => {
    expect(deriveSituationKey(makeState({ down: 3, distance: 2, yardLine: 50 }))).toBe('3_short_midfield_offense')
  })

  it('2nd & 8 at OPP 35, offense', () => {
    expect(deriveSituationKey(makeState({ down: 2, distance: 8, yardLine: 65 }))).toBe('2_long_midfield_offense')
  })

  it('1st & goal at the 3, offense → goal_line overrides distance', () => {
    expect(deriveSituationKey(makeState({ down: 1, distance: 3, yardLine: 97 }))).toBe('1_goal_line_red_zone_offense')
  })

  it('3rd & 7 at OPP 15, defense', () => {
    expect(deriveSituationKey(makeState({ down: 3, distance: 7, yardLine: 85, possession: 'them' }))).toBe('3_medium_scoring_defense')
  })

  it('4th & 1 at OWN 35, offense', () => {
    expect(deriveSituationKey(makeState({ down: 4, distance: 1, yardLine: 35 }))).toBe('4_short_own_territory_offense')
  })
})

describe('getSuggestions', () => {
  const gamePlanPlays: GamePlanPlayForSuggestions[] = [
    makeGamePlanPlay({ play_code: 'PWR-R', call_number: 21, playType: 'Run' }),
    makeGamePlanPlay({ play_code: 'SLNT-R', call_number: 31, playType: 'Pass' }),
    makeGamePlanPlay({ play_code: 'STR-L', call_number: 17, playType: 'Run' }),
    makeGamePlanPlay({ play_code: 'CURL-FLT', call_number: 52, playType: 'Pass' }),
    makeGamePlanPlay({ play_code: 'COV2', call_number: 71, odk: 'defense' }),
    makeGamePlanPlay({ play_code: 'BLTZ-M', call_number: 88, odk: 'defense' }),
  ]

  describe('base situational scoring', () => {
    it('pass plays score higher at 1st & 10 (long distance)', () => {
      // 1st & 10, OWN 25, Q1 — distance >= 8 favors pass
      const result = getSuggestions(makeState(), [], gamePlanPlays, null)
      expect(result.length).toBeGreaterThan(0)
      // Pass plays get +20 (distance >= 8 && isPass), run plays get base 50
      // SLNT-R/CURL-FLT: 70/125 = 0.56, PWR-R/STR-L: 50/125 = 0.4
      expect(result[0].playType).toBe('pass')
      expect(result[0].confidence).toBeCloseTo(70 / DIVISOR)
    })

    it('run plays score higher at 3rd & 2 (short distance)', () => {
      // 3rd & 2, midfield — distance <= 3 favors run
      const result = getSuggestions(makeState({ down: 3, distance: 2, yardLine: 50 }), [], gamePlanPlays, null)
      // Run: base 50 + 20 (short & run) = 70. Pass: base 50.
      expect(result[0].playType).toBe('run')
      expect(result[0].confidence).toBeCloseTo(70 / DIVISOR)
    })

    it('returns only offense plays when possession is us', () => {
      const result = getSuggestions(makeState({ possession: 'us' }), [], gamePlanPlays, null)
      expect(result.length).toBe(4) // 4 offensive plays
      expect(result.every(p => p.playType !== 'defense')).toBe(true)
    })

    it('returns only defense plays when possession is them', () => {
      const result = getSuggestions(makeState({ possession: 'them' }), [], gamePlanPlays, null)
      expect(result.length).toBe(2) // 2 defensive plays
    })

    it('all plays have source "situational" with no cache or in-game data', () => {
      const result = getSuggestions(makeState(), [], gamePlanPlays, null)
      expect(result.every(p => p.source === 'situational')).toBe(true)
    })
  })

  describe('Gemini cache bonus', () => {
    it('Gemini top pick gets +25 opponent tendency bonus', () => {
      // 3rd & 2 at midfield, Q1 — both run plays have same base (70)
      const cache: SituationalSuggestionMap = {
        '3_short_midfield_offense': {
          offense: [
            { playCode: 'PWR-R', callNumber: 21, playName: 'Power Right', playType: 'run', reason: 'Exploits weak run D', confidence: 0.7, source: 'ai' },
            { playCode: 'STR-L', callNumber: 17, playName: 'Stretch Left', playType: 'run', reason: 'Outside zone', confidence: 0.6, source: 'ai' },
          ],
          defense: [],
          specialTeams: [],
        },
      }
      const state = makeState({ down: 3, distance: 2, yardLine: 50 })
      const result = getSuggestions(state, [], gamePlanPlays, cache)

      // PWR-R: base 70 + gemini rank 0 (+25) = 95. 95/125 = 0.76
      // STR-L: base 70 + gemini rank 1 (+20) = 90. 90/125 = 0.72
      expect(result[0].playCode).toBe('PWR-R')
      expect(result[0].confidence).toBeCloseTo(95 / DIVISOR)
      expect(result[0].source).toBe('ai')
      expect(result[0].reason).toBe('Exploits weak run D')

      expect(result[1].playCode).toBe('STR-L')
      expect(result[1].confidence).toBeCloseTo(90 / DIVISOR)
    })
  })

  describe('in-game performance as primary signal', () => {
    it('Q1: in-game dampened (×0.5), Gemini wins', () => {
      // 3rd & 2 at midfield, Q1
      const cache: SituationalSuggestionMap = {
        '3_short_midfield_offense': {
          offense: [
            { playCode: 'PWR-R', callNumber: 21, playName: 'Power Right', playType: 'run', reason: 'Exploits weak run D', confidence: 0.7, source: 'ai' },
          ],
          defense: [],
          specialTeams: [],
        },
      }
      // STR-L called 2x, avg 5 yards > distance 2 → +30 raw, ×0.5 Q1 = +15
      const loggedPlays: LoggedPlayForSuggestions[] = [
        { playCode: 'STR-L', playType: 'run', yardsGained: 6, possession: 'us', outcomeLabel: null },
        { playCode: 'STR-L', playType: 'run', yardsGained: 4, possession: 'us', outcomeLabel: null },
      ]
      const state = makeState({ down: 3, distance: 2, yardLine: 50, quarter: 1 })
      const result = getSuggestions(state, loggedPlays, gamePlanPlays, cache)

      // PWR-R: base 70 + gemini 25 + no in-game 0 = 95. 95/125 = 0.76
      // STR-L: base 70 + no gemini 0 + in-game 15 = 85. 85/125 = 0.68
      expect(result[0].playCode).toBe('PWR-R')
      expect(result[0].confidence).toBeCloseTo(95 / DIVISOR)
      expect(result[1].playCode).toBe('STR-L')
      expect(result[1].confidence).toBeCloseTo(85 / DIVISOR)
    })

    it('Q3: in-game overtakes Gemini (×1.0)', () => {
      // 3rd & 2 at midfield, Q3
      const cache: SituationalSuggestionMap = {
        '3_short_midfield_offense': {
          offense: [
            { playCode: 'PWR-R', callNumber: 21, playName: 'Power Right', playType: 'run', reason: 'Exploits weak run D', confidence: 0.7, source: 'ai' },
          ],
          defense: [],
          specialTeams: [],
        },
      }
      // STR-L called 2x, avg 5 yards > distance 2 → +30 raw, ×1.0 Q3 = +30
      const loggedPlays: LoggedPlayForSuggestions[] = [
        { playCode: 'STR-L', playType: 'run', yardsGained: 6, possession: 'us', outcomeLabel: null },
        { playCode: 'STR-L', playType: 'run', yardsGained: 4, possession: 'us', outcomeLabel: null },
      ]
      const state = makeState({ down: 3, distance: 2, yardLine: 50, quarter: 3 })
      const result = getSuggestions(state, loggedPlays, gamePlanPlays, cache)

      // PWR-R: base 70 + gemini 25 + no in-game 0 = 95. 95/125 = 0.76
      // STR-L: base 70 + no gemini 0 + in-game 30 = 100. 100/125 = 0.80
      expect(result[0].playCode).toBe('STR-L')
      expect(result[0].confidence).toBeCloseTo(100 / DIVISOR)
      expect(result[0].source).toBe('performance')
      expect(result[1].playCode).toBe('PWR-R')
      expect(result[1].confidence).toBeCloseTo(95 / DIVISOR)
    })

    it('Q4: maximum in-game trust (×1.25)', () => {
      // 3rd & 2 at midfield, Q4
      const loggedPlays: LoggedPlayForSuggestions[] = [
        { playCode: 'STR-L', playType: 'run', yardsGained: 6, possession: 'us', outcomeLabel: null },
        { playCode: 'STR-L', playType: 'run', yardsGained: 4, possession: 'us', outcomeLabel: null },
        { playCode: 'STR-L', playType: 'run', yardsGained: 3, possession: 'us', outcomeLabel: null },
      ]
      const state = makeState({ down: 3, distance: 2, yardLine: 50, quarter: 4 })
      const result = getSuggestions(state, loggedPlays, gamePlanPlays, null)

      // STR-L: base 70 + in-game 30×1.25 = 70 + 37.5 = 107.5. 107.5/125 = 0.86
      expect(result[0].playCode).toBe('STR-L')
      expect(result[0].confidence).toBeCloseTo(107.5 / DIVISOR)
      expect(result[0].source).toBe('performance')
    })

    it('positive yards but below distance gets +20 (not +30)', () => {
      // 1st & 10 at OWN 25, Q3 — avg yards 3 > 0 but < distance 10
      const loggedPlays: LoggedPlayForSuggestions[] = [
        { playCode: 'PWR-R', playType: 'run', yardsGained: 3, possession: 'us', outcomeLabel: null },
        { playCode: 'PWR-R', playType: 'run', yardsGained: 3, possession: 'us', outcomeLabel: null },
      ]
      const state = makeState({ quarter: 3 })
      const result = getSuggestions(state, loggedPlays, gamePlanPlays, null)

      // PWR-R: base 50 + in-game 20×1.0 = 70. 70/125 = 0.56
      const pwr = result.find(p => p.playCode === 'PWR-R')!
      expect(pwr.confidence).toBeCloseTo(70 / DIVISOR)
    })

    it('negative avg yards penalizes play', () => {
      // 1st & 10 at OWN 25, Q2
      const loggedPlays: LoggedPlayForSuggestions[] = [
        { playCode: 'PWR-R', playType: 'run', yardsGained: -2, possession: 'us', outcomeLabel: null },
        { playCode: 'PWR-R', playType: 'run', yardsGained: -1, possession: 'us', outcomeLabel: null },
      ]
      const state = makeState({ quarter: 2 })
      const result = getSuggestions(state, loggedPlays, gamePlanPlays, null)

      // PWR-R: base 50 + in-game (-15)×0.75 = 50 - 11.25 = 38.75. 38.75/125 = 0.31
      const pwr = result.find(p => p.playCode === 'PWR-R')!
      expect(pwr.confidence).toBeCloseTo(38.75 / DIVISOR)
      // Should be ranked below un-called plays
      const uncalledPass = result.find(p => p.playCode === 'SLNT-R')!
      expect(uncalledPass.confidence).toBeGreaterThan(pwr.confidence)
    })

    it('never-called plays get zero in-game adjustment', () => {
      const state = makeState({ quarter: 4 })
      const loggedPlays: LoggedPlayForSuggestions[] = [
        { playCode: 'PWR-R', playType: 'run', yardsGained: 5, possession: 'us', outcomeLabel: null },
      ]
      const result = getSuggestions(state, loggedPlays, gamePlanPlays, null)

      // SLNT-R (never called): base 70 + 0 = 70. 70/125 = 0.56
      const slnt = result.find(p => p.playCode === 'SLNT-R')!
      expect(slnt.confidence).toBeCloseTo(70 / DIVISOR)
      expect(slnt.source).toBe('situational')
    })
  })

  describe('empty fallback', () => {
    it('returns empty array when no game plan plays', () => {
      const result = getSuggestions(makeState(), [], [], null)
      expect(result).toEqual([])
    })
  })

  describe('situation key edge cases', () => {
    it('goal line overrides distance bucket', () => {
      const key = deriveSituationKey(makeState({ down: 1, distance: 10, yardLine: 95 }))
      expect(key).toContain('goal_line')
      expect(key).toContain('red_zone')
    })

    it('4th down key', () => {
      const key = deriveSituationKey(makeState({ down: 4, distance: 1, yardLine: 50 }))
      expect(key).toBe('4_short_midfield_offense')
    })

    it('backed up own territory', () => {
      const key = deriveSituationKey(makeState({ down: 1, distance: 10, yardLine: 5 }))
      expect(key).toBe('1_long_own_territory_offense')
    })

    it('scoring territory', () => {
      const key = deriveSituationKey(makeState({ down: 2, distance: 5, yardLine: 85 }))
      expect(key).toBe('2_medium_scoring_offense')
    })
  })
})
