import { describe, it, expect } from 'vitest'
import { resolvePlayState, PlayStateInput, PlayResult } from '../playState'

// Default state factory
function makeState(overrides: Partial<PlayStateInput> = {}): PlayStateInput {
  return {
    down: 1,
    distance: 10,
    yardLine: 25,
    possession: 'A',
    fieldLength: 100,
    touchbackYardLine: 20,
    kickoffYardLine: 40,
    ...overrides,
  }
}

describe('resolvePlayState', () => {
  // =========================================================================
  // Normal gains
  // =========================================================================
  describe('normal gains', () => {
    it('short gain: 1st & 10 at OWN 25, gain 4 → 2nd & 6 at OWN 29', () => {
      const result = resolvePlayState(
        makeState({ down: 1, distance: 10, yardLine: 25 }),
        { outcome: 'gain', yardsGained: 4 }
      )
      expect(result).toEqual({
        down: 2, distance: 6, yardLine: 29, possession: 'A', terminal: null,
      })
    })

    it('exact first down: 2nd & 7 at OWN 30, gain 7 → 1st & 10 at OWN 37', () => {
      const result = resolvePlayState(
        makeState({ down: 2, distance: 7, yardLine: 30 }),
        { outcome: 'gain', yardsGained: 7 }
      )
      expect(result).toEqual({
        down: 1, distance: 10, yardLine: 37, possession: 'A', terminal: null,
      })
    })

    it('long gain past first down: 1st & 10 at OWN 40, gain 25 → 1st & 10 at OPP 35', () => {
      const result = resolvePlayState(
        makeState({ down: 1, distance: 10, yardLine: 40 }),
        { outcome: 'gain', yardsGained: 25 }
      )
      expect(result).toEqual({
        down: 1, distance: 10, yardLine: 65, possession: 'A', terminal: null,
      })
    })

    it('3rd down short gain, no first down: 3rd & 8 at OWN 50, gain 3 → 4th & 5 at OPP 47', () => {
      const result = resolvePlayState(
        makeState({ down: 3, distance: 8, yardLine: 50 }),
        { outcome: 'gain', yardsGained: 3 }
      )
      expect(result).toEqual({
        down: 4, distance: 5, yardLine: 53, possession: 'A', terminal: null,
      })
    })

    it('loss of yards: 1st & 10 at OWN 30, loss of 5 → 2nd & 15 at OWN 25', () => {
      const result = resolvePlayState(
        makeState({ down: 1, distance: 10, yardLine: 30 }),
        { outcome: 'gain', yardsGained: -5 }
      )
      expect(result).toEqual({
        down: 2, distance: 15, yardLine: 25, possession: 'A', terminal: null,
      })
    })
  })

  // =========================================================================
  // 4th down
  // =========================================================================
  describe('4th down', () => {
    it('4th down conversion: 4th & 2 at OWN 45, gain 5 → 1st & 10 at 50', () => {
      const result = resolvePlayState(
        makeState({ down: 4, distance: 2, yardLine: 45 }),
        { outcome: 'gain', yardsGained: 5 }
      )
      expect(result).toEqual({
        down: 1, distance: 10, yardLine: 50, possession: 'A', terminal: null,
      })
    })

    it('4th down turnover on downs: 4th & 3 at OPP 40, gain 1 → turnover, opponent at their own 39', () => {
      const result = resolvePlayState(
        makeState({ down: 4, distance: 3, yardLine: 60 }),
        { outcome: 'gain', yardsGained: 1 }
      )
      expect(result).toEqual({
        down: 1, distance: 10, yardLine: 39, possession: 'B', terminal: 'turnover_on_downs',
      })
    })

    it('4th down incomplete pass → turnover on downs', () => {
      const result = resolvePlayState(
        makeState({ down: 4, distance: 5, yardLine: 55 }),
        { outcome: 'incomplete' }
      )
      expect(result).toEqual({
        down: 1, distance: 10, yardLine: 45, possession: 'B', terminal: 'turnover_on_downs',
      })
    })
  })

  // =========================================================================
  // Touchdown
  // =========================================================================
  describe('touchdown', () => {
    it('explicit touchdown outcome', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 95 }),
        { outcome: 'touchdown' }
      )
      expect(result.terminal).toBe('touchdown')
      expect(result.possession).toBe('B') // Other team gets ball
    })

    it('gain that reaches end zone: OPP 5, gain 5 → touchdown', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 95 }),
        { outcome: 'gain', yardsGained: 5 }
      )
      expect(result.terminal).toBe('touchdown')
      expect(result.possession).toBe('B')
      expect(result.yardLine).toBe(40) // Kickoff yard line
    })

    it('gain that exceeds end zone: OPP 3, gain 10 → touchdown', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 97 }),
        { outcome: 'gain', yardsGained: 10 }
      )
      expect(result.terminal).toBe('touchdown')
    })

    it('goal line touchdown: yard line 99, gain 1 → touchdown', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 99 }),
        { outcome: 'gain', yardsGained: 1 }
      )
      expect(result.terminal).toBe('touchdown')
    })
  })

  // =========================================================================
  // Turnover (INT / fumble)
  // =========================================================================
  describe('turnover', () => {
    it('interception at midfield: OWN 50 → opponent gets ball at their 50', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 50 }),
        { outcome: 'turnover', yardsGained: 0 }
      )
      expect(result).toEqual({
        down: 1, distance: 10, yardLine: 50, possession: 'B', terminal: null,
      })
    })

    it('fumble with return: OPP 30 (yardLine 70), opponent recovers → their 30', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 70 }),
        { outcome: 'turnover', yardsGained: 0 }
      )
      expect(result).toEqual({
        down: 1, distance: 10, yardLine: 30, possession: 'B', terminal: null,
      })
    })

    it('turnover deep in own territory: OWN 10 → opponent at their 90', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 10 }),
        { outcome: 'turnover', yardsGained: 0 }
      )
      expect(result).toEqual({
        down: 1, distance: 10, yardLine: 90, possession: 'B', terminal: null,
      })
    })
  })

  // =========================================================================
  // Incomplete pass
  // =========================================================================
  describe('incomplete pass', () => {
    it('1st down incomplete: 1st & 10 at OWN 25 → 2nd & 10 at OWN 25', () => {
      const result = resolvePlayState(
        makeState({ down: 1, distance: 10, yardLine: 25 }),
        { outcome: 'incomplete' }
      )
      expect(result).toEqual({
        down: 2, distance: 10, yardLine: 25, possession: 'A', terminal: null,
      })
    })

    it('3rd down incomplete: 3rd & 7 → 4th & 7', () => {
      const result = resolvePlayState(
        makeState({ down: 3, distance: 7, yardLine: 40 }),
        { outcome: 'incomplete' }
      )
      expect(result).toEqual({
        down: 4, distance: 7, yardLine: 40, possession: 'A', terminal: null,
      })
    })
  })

  // =========================================================================
  // Punt
  // =========================================================================
  describe('punt', () => {
    it('punt with touchback: kick 60 yards from OWN 30 → into end zone → touchback at 20', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 30 }),
        { outcome: 'punt', kickYards: 60, returnYards: 0 }
      )
      // Kick from absolute 30, lands at 90 — not touchback. Let me recalculate:
      // From OWN 30, kick 60 = lands at 90 (not past 100). Not a touchback.
      // Receiving team B: toRelative(90, 'B', 100) = 10. No return.
      expect(result.possession).toBe('B')
      expect(result.down).toBe(1)
      expect(result.yardLine).toBe(10) // Opponent's own 10
    })

    it('punt into end zone = touchback: kick 75 from OWN 20', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 20 }),
        { outcome: 'punt', kickYards: 85, returnYards: 0 }
      )
      // Kick from absolute 20, lands at 105 → past field → touchback
      expect(result.possession).toBe('B')
      expect(result.yardLine).toBe(20) // Touchback at 20
    })

    it('punt returned: kick 45 from OWN 35, returned 15', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 35 }),
        { outcome: 'punt', kickYards: 45, returnYards: 15 }
      )
      // Kick from abs 35, lands at 80. B receives at their 20 (toRelative(80,B,100)=20).
      // B returns 15: calculateBallPlacement → 80 + (-1 * 15) = 65
      // toRelative(65, B, 100) = 35
      expect(result.possession).toBe('B')
      expect(result.yardLine).toBe(35)
    })

    it('punt downed (0 return yards): kick 40 from OWN 25', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 25 }),
        { outcome: 'punt', kickYards: 40, returnYards: 0 }
      )
      // Kick from abs 25, lands at 65. B's relative: 100-65=35. No return.
      expect(result.possession).toBe('B')
      expect(result.yardLine).toBe(35)
    })
  })

  // =========================================================================
  // Kickoff
  // =========================================================================
  describe('kickoff', () => {
    it('kickoff touchback: kick 65 from OWN 40', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 25 }), // yardLine doesn't matter — kickoff uses kickoffYardLine
        { outcome: 'kickoff', kickYards: 65, returnYards: 0 }
      )
      // Kick from abs 40, lands at 105 → touchback
      expect(result.possession).toBe('B')
      expect(result.yardLine).toBe(20) // Touchback
    })

    it('kickoff returned: kick 55 from OWN 40, returned 20', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 25 }),
        { outcome: 'kickoff', kickYards: 55, returnYards: 20 }
      )
      // Kick from abs 40, lands at 95. B's relative: 100-95=5.
      // B returns 20: calculateBallPlacement → landAbs=95, B direction=-1, 95+(-1*20)=75
      // toRelative(75, B, 100) = 25
      expect(result.possession).toBe('B')
      expect(result.yardLine).toBe(25)
    })

    it('kickoff with no kick yards → touchback at default', () => {
      const result = resolvePlayState(
        makeState(),
        { outcome: 'kickoff', kickYards: 0 }
      )
      expect(result.possession).toBe('B')
      expect(result.yardLine).toBe(20) // Touchback default
    })
  })

  // =========================================================================
  // Fair catch
  // =========================================================================
  describe('fair catch', () => {
    it('fair catch on punt: kick 40 from OWN 30 → spotted at landing point', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 30 }),
        { outcome: 'fair_catch', kickYards: 40 }
      )
      // Kick from abs 30, lands at 70. B's relative: 100-70=30
      expect(result.possession).toBe('B')
      expect(result.yardLine).toBe(30)
    })
  })

  // =========================================================================
  // Touchback
  // =========================================================================
  describe('touchback', () => {
    it('explicit touchback → receiving team at touchback yard line', () => {
      const result = resolvePlayState(
        makeState(),
        { outcome: 'touchback' }
      )
      expect(result.possession).toBe('B')
      expect(result.yardLine).toBe(20)
      expect(result.down).toBe(1)
      expect(result.distance).toBe(10)
    })
  })

  // =========================================================================
  // Safety
  // =========================================================================
  describe('safety', () => {
    it('explicit safety', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 1 }),
        { outcome: 'safety' }
      )
      expect(result.terminal).toBe('safety')
      expect(result.yardLine).toBe(20)
      expect(result.possession).toBe('A') // Same team kicks after safety
    })

    it('sacked in own end zone: OWN 2, loss of 3 → safety', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 2 }),
        { outcome: 'gain', yardsGained: -3 }
      )
      expect(result.terminal).toBe('safety')
      expect(result.possession).toBe('A') // Same team kicks
    })

    it('sacked at OWN 1, loss of 1 → safety', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 1 }),
        { outcome: 'gain', yardsGained: -1 }
      )
      expect(result.terminal).toBe('safety')
    })
  })

  // =========================================================================
  // Field goal
  // =========================================================================
  describe('field goal', () => {
    it('field goal made: scoring team kicks off', () => {
      const result = resolvePlayState(
        makeState({ yardLine: 75 }),
        { outcome: 'field_goal' }
      )
      expect(result.yardLine).toBe(40) // Kickoff yard line
      expect(result.possession).toBe('A') // Same team kicks off
      expect(result.down).toBe(1)
      expect(result.distance).toBe(10)
      expect(result.terminal).toBe(null) // Scoring handled by UI
    })
  })

  // =========================================================================
  // Penalty
  // =========================================================================
  describe('penalty', () => {
    it('5-yard penalty with redown: 1st & 10 at OWN 25 → 1st & 10 at OWN 30', () => {
      const result = resolvePlayState(
        makeState({ down: 1, distance: 10, yardLine: 25 }),
        { outcome: 'penalty', penaltyYards: 5, penaltyRedown: true }
      )
      expect(result).toEqual({
        down: 1, distance: 10, yardLine: 30, possession: 'A', terminal: null,
      })
    })

    it('15-yard penalty no redown: 2nd & 8 at OWN 40 → 3rd & 8 at OPP 45', () => {
      const result = resolvePlayState(
        makeState({ down: 2, distance: 8, yardLine: 40 }),
        { outcome: 'penalty', penaltyYards: 15, penaltyRedown: false }
      )
      expect(result).toEqual({
        down: 3, distance: 8, yardLine: 55, possession: 'A', terminal: null,
      })
    })

    it('penalty backward (against offense): 1st & 10 at OWN 30, -10 yards → OWN 20', () => {
      const result = resolvePlayState(
        makeState({ down: 1, distance: 10, yardLine: 30 }),
        { outcome: 'penalty', penaltyYards: -10, penaltyRedown: true }
      )
      expect(result).toEqual({
        down: 1, distance: 10, yardLine: 20, possession: 'A', terminal: null,
      })
    })

    it('half the distance to goal: penalty would cross own goal line', () => {
      // At OWN 6, penalty -10 would put at -4. Half the distance = floor(6/2) = 3
      const result = resolvePlayState(
        makeState({ down: 1, distance: 10, yardLine: 6 }),
        { outcome: 'penalty', penaltyYards: -10, penaltyRedown: true }
      )
      expect(result.yardLine).toBe(3) // Half the distance to own goal
    })

    it('half the distance to goal: penalty would cross opponent goal line', () => {
      // At OPP 4 (yardLine 96), penalty +10 would put at 106. Half distance to goal = floor(4/2) = 2 → 98
      const result = resolvePlayState(
        makeState({ down: 1, distance: 10, yardLine: 96 }),
        { outcome: 'penalty', penaltyYards: 10, penaltyRedown: true }
      )
      expect(result.yardLine).toBe(98) // 96 + floor((100-96)/2) = 96 + 2 = 98
    })

    it('4th down penalty no redown → turnover on downs', () => {
      const result = resolvePlayState(
        makeState({ down: 4, distance: 5, yardLine: 60 }),
        { outcome: 'penalty', penaltyYards: -5, penaltyRedown: false }
      )
      expect(result.terminal).toBe('turnover_on_downs')
      expect(result.possession).toBe('B')
      expect(result.yardLine).toBe(45) // fieldLength - 55 = 45
    })
  })

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('edge cases', () => {
    it('Team B possession: gain works correctly', () => {
      const result = resolvePlayState(
        makeState({ down: 1, distance: 10, yardLine: 30, possession: 'B' }),
        { outcome: 'gain', yardsGained: 5 }
      )
      expect(result).toEqual({
        down: 2, distance: 5, yardLine: 35, possession: 'B', terminal: null,
      })
    })

    it('midfield: OWN 50, exact first down stays at midfield', () => {
      const result = resolvePlayState(
        makeState({ down: 2, distance: 10, yardLine: 50 }),
        { outcome: 'gain', yardsGained: 10 }
      )
      expect(result.yardLine).toBe(60)
      expect(result.down).toBe(1)
    })

    it('own end zone edge: OWN 1, gain 0 → down advances', () => {
      const result = resolvePlayState(
        makeState({ down: 1, distance: 10, yardLine: 1 }),
        { outcome: 'gain', yardsGained: 0 }
      )
      expect(result).toEqual({
        down: 2, distance: 10, yardLine: 1, possession: 'A', terminal: null,
      })
    })

    it('distance never goes below 1', () => {
      const result = resolvePlayState(
        makeState({ down: 1, distance: 3, yardLine: 50 }),
        { outcome: 'gain', yardsGained: 1 }
      )
      expect(result.distance).toBe(2)

      const result2 = resolvePlayState(
        makeState({ down: 1, distance: 1, yardLine: 50 }),
        { outcome: 'gain', yardsGained: 0 }
      )
      expect(result2.distance).toBe(1)
    })
  })
})
