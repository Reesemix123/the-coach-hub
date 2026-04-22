import { describe, it, expect } from 'vitest'
import {
  calculateBallPlacement,
  toAbsolute,
  toRelative,
} from '../fieldPosition'

describe('calculateBallPlacement', () => {
  const FIELD = 100
  const TB_YARD = 20 // Standard touchback yard line

  describe('touchback cases', () => {
    it('touchback for Team A (receiving): placed at own 20', () => {
      const result = calculateBallPlacement({
        fieldLength: FIELD,
        landYardLine: 0, // irrelevant for touchback
        landTeam: 'B',
        returnYards: 0,
        receivingTeam: 'A',
        touchback: true,
        touchbackYardLine: TB_YARD,
      })
      expect(result).toBe(20) // absolute 20 = Team A's 20
    })

    it('touchback for Team B (receiving): placed at their 20', () => {
      const result = calculateBallPlacement({
        fieldLength: FIELD,
        landYardLine: 0,
        landTeam: 'A',
        returnYards: 0,
        receivingTeam: 'B',
        touchback: true,
        touchbackYardLine: TB_YARD,
      })
      expect(result).toBe(80) // absolute 80 = Team B's 20
    })

    it('touchback with 25-yard touchback rule', () => {
      const result = calculateBallPlacement({
        fieldLength: FIELD,
        landYardLine: 0,
        landTeam: 'A',
        returnYards: 0,
        receivingTeam: 'A',
        touchback: true,
        touchbackYardLine: 25,
      })
      expect(result).toBe(25)
    })
  })

  describe('punt scenarios', () => {
    it('punt lands at opponent 30, fair catch (0 return yards)', () => {
      // Team A punts, ball lands at Team B's 30 yard line
      const result = calculateBallPlacement({
        fieldLength: FIELD,
        landYardLine: 30,
        landTeam: 'B',
        returnYards: 0,
        receivingTeam: 'B',
        touchback: false,
        touchbackYardLine: TB_YARD,
      })
      // landAbsolute = 100 - 30 = 70
      // B attacks toward 0: direction = -1
      // newPosition = 70 + (-1 * 0) = 70
      expect(result).toBe(70)
    })

    it('punt lands at opponent 25, returned 15 yards', () => {
      // Team A punts, ball lands at Team B's 25, Team B returns 15 yards
      const result = calculateBallPlacement({
        fieldLength: FIELD,
        landYardLine: 25,
        landTeam: 'B',
        returnYards: 15,
        receivingTeam: 'B',
        touchback: false,
        touchbackYardLine: TB_YARD,
      })
      // landAbsolute = 100 - 25 = 75
      // B attacks toward 0: direction = -1
      // newPosition = 75 + (-1 * 15) = 60
      expect(result).toBe(60)
    })

    it('punt lands at own 40, returned by Team A 20 yards', () => {
      // Team B punts, ball lands at Team A's 40, Team A returns 20
      const result = calculateBallPlacement({
        fieldLength: FIELD,
        landYardLine: 40,
        landTeam: 'A',
        returnYards: 20,
        receivingTeam: 'A',
        touchback: false,
        touchbackYardLine: TB_YARD,
      })
      // landAbsolute = 40
      // A attacks toward 100: direction = +1
      // newPosition = 40 + (1 * 20) = 60
      expect(result).toBe(60)
    })
  })

  describe('kickoff scenarios', () => {
    it('kickoff lands at Team A 5, returned to 25', () => {
      // Team B kicks off, lands at Team A's 5, Team A returns 20 yards
      const result = calculateBallPlacement({
        fieldLength: FIELD,
        landYardLine: 5,
        landTeam: 'A',
        returnYards: 20,
        receivingTeam: 'A',
        touchback: false,
        touchbackYardLine: TB_YARD,
      })
      // landAbsolute = 5
      // A attacks toward 100: direction = +1
      // newPosition = 5 + (1 * 20) = 25
      expect(result).toBe(25)
    })

    it('kickoff into end zone = touchback at 25', () => {
      const result = calculateBallPlacement({
        fieldLength: FIELD,
        landYardLine: 0,
        landTeam: 'A',
        returnYards: 0,
        receivingTeam: 'A',
        touchback: true,
        touchbackYardLine: 25,
      })
      expect(result).toBe(25)
    })
  })

  describe('safety boundary cases', () => {
    it('return goes past own goal line: returns -1 (safety)', () => {
      // Team A catches at their 5 and gets tackled going backward past 0
      const result = calculateBallPlacement({
        fieldLength: FIELD,
        landYardLine: 5,
        landTeam: 'A',
        returnYards: -10, // tackled going backward
        receivingTeam: 'A',
        touchback: false,
        touchbackYardLine: TB_YARD,
      })
      // landAbsolute = 5, direction = +1, newPosition = 5 + (1 * -10) = -5
      expect(result).toBe(-1)
    })

    it('return goes past opponent goal line: returns -1 (TD handled separately)', () => {
      const result = calculateBallPlacement({
        fieldLength: FIELD,
        landYardLine: 10,
        landTeam: 'A',
        returnYards: 95,
        receivingTeam: 'A',
        touchback: false,
        touchbackYardLine: TB_YARD,
      })
      // newPosition = 10 + 95 = 105 >= 100
      expect(result).toBe(-1)
    })
  })

  describe('8-man field (80 yards)', () => {
    it('works with non-standard field length', () => {
      const result = calculateBallPlacement({
        fieldLength: 80,
        landYardLine: 20,
        landTeam: 'A',
        returnYards: 10,
        receivingTeam: 'A',
        touchback: false,
        touchbackYardLine: 15,
      })
      // landAbsolute = 20, direction = +1, newPosition = 30
      expect(result).toBe(30)
    })

    it('touchback on 80-yard field at custom yard line', () => {
      const result = calculateBallPlacement({
        fieldLength: 80,
        landYardLine: 0,
        landTeam: 'A',
        returnYards: 0,
        receivingTeam: 'B',
        touchback: true,
        touchbackYardLine: 15,
      })
      // B's 15 on 80-yard field: absolute = 80 - 15 = 65
      expect(result).toBe(65)
    })
  })
})

describe('toAbsolute', () => {
  it('Team A yardLine maps directly', () => {
    expect(toAbsolute(25, 'A', 100)).toBe(25)
    expect(toAbsolute(75, 'A', 100)).toBe(75)
  })

  it('Team B yardLine inverts', () => {
    expect(toAbsolute(25, 'B', 100)).toBe(75)
    expect(toAbsolute(75, 'B', 100)).toBe(25)
  })

  it('midfield is midfield for both teams', () => {
    expect(toAbsolute(50, 'A', 100)).toBe(50)
    expect(toAbsolute(50, 'B', 100)).toBe(50)
  })
})

describe('toRelative', () => {
  it('Team A: absolute maps directly', () => {
    expect(toRelative(25, 'A', 100)).toBe(25)
  })

  it('Team B: absolute inverts', () => {
    expect(toRelative(25, 'B', 100)).toBe(75)
    expect(toRelative(75, 'B', 100)).toBe(25)
  })

  it('toRelative is the inverse of toAbsolute', () => {
    const yl = 35
    const abs = toAbsolute(yl, 'B', 100)
    expect(toRelative(abs, 'B', 100)).toBe(yl)
  })
})
