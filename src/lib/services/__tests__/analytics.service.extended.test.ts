import './helpers/supabase-mock';
import { describe, it, expect } from 'vitest';
import { AnalyticsService } from '@/lib/services/analytics.service';

const service = new AnalyticsService();
const isPlaySuccessful = (service as any).isPlaySuccessful.bind(service);

// ---------------------------------------------------------------------------
// Helpers mirroring the inline helpers in analytics.service.ts getPlayerStats
// These are not exported — we test the same logic inline to document behavior.
// ---------------------------------------------------------------------------

function isPassComplete(play: {
  result?: string | null;
  is_complete?: boolean | null;
}): boolean {
  return play.result?.startsWith('pass_complete') || play.result?.startsWith('complete') || play.is_complete === true;
}

function isPassTouchdown(play: {
  play_type?: string | null;
  result?: string | null;
  is_touchdown?: boolean | null;
}): boolean {
  return (
    play.play_type === 'pass' &&
    (play.result?.includes('touchdown') === true || play.is_touchdown === true)
  );
}

function isInterception(play: {
  result?: string | null;
  is_interception?: boolean | null;
}): boolean {
  return (
    play.result === 'pass_interception' ||
    play.result === 'interception' ||
    (play.result?.includes('interception') ?? false) ||
    play.is_interception === true
  );
}

// ---------------------------------------------------------------------------
// isPlaySuccessful — nullable field handling
// ---------------------------------------------------------------------------

describe('isPlaySuccessful — nullable field handling', () => {
  it('returns false when distance is null', () => {
    expect(isPlaySuccessful(1, null, 5, false)).toBe(false);
  });

  it('returns false when distance is 0', () => {
    // distance = 0 is falsy; the guard `!distance` catches it before the ratio math
    // so the result is false (not NaN or Infinity)
    expect(isPlaySuccessful(1, 0, 5, false)).toBe(false);
  });

  it('returns false when yards_gained is null', () => {
    expect(isPlaySuccessful(1, 10, null, false)).toBe(false);
  });

  it('returns false when down is null', () => {
    expect(isPlaySuccessful(null, 10, 5, false)).toBe(false);
  });

  it('returns true when resultedInFirstDown is true regardless of nulls', () => {
    expect(isPlaySuccessful(null, null, null, true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isPlaySuccessful — down thresholds
// ---------------------------------------------------------------------------

describe('isPlaySuccessful — down thresholds', () => {
  it('1st & 10: 4 yards is successful (40%)', () => {
    expect(isPlaySuccessful(1, 10, 4, false)).toBe(true);
  });

  it('1st & 10: 3 yards is not successful', () => {
    expect(isPlaySuccessful(1, 10, 3, false)).toBe(false);
  });

  it('2nd & 10: 6 yards is successful (60%)', () => {
    expect(isPlaySuccessful(2, 10, 6, false)).toBe(true);
  });

  it('2nd & 10: 5 yards is not successful', () => {
    expect(isPlaySuccessful(2, 10, 5, false)).toBe(false);
  });

  it('3rd & 10: 10 yards is successful (100%)', () => {
    expect(isPlaySuccessful(3, 10, 10, false)).toBe(true);
  });

  it('3rd & 10: 9 yards is not successful', () => {
    expect(isPlaySuccessful(3, 10, 9, false)).toBe(false);
  });

  it('4th & 1: 1 yard is successful', () => {
    expect(isPlaySuccessful(4, 1, 1, false)).toBe(true);
  });

  it('4th & 1: 0 yards is not successful', () => {
    expect(isPlaySuccessful(4, 1, 0, false)).toBe(false);
  });

  it('down = 5 returns false', () => {
    expect(isPlaySuccessful(5, 10, 10, false)).toBe(false);
  });

  it('negative yards are not successful', () => {
    expect(isPlaySuccessful(1, 10, -3, false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Red zone classification
//
// Convention: yard_line uses a 0–100 scale where 0 = own goal line,
// 50 = midfield, 100 = opponent's goal line. Red zone means inside the
// opponent's 20-yard line, which is yard_line >= 80. This is documented
// in the tagging UI (SituationFields.tsx), all DB migration zone
// classifiers (migration 012), and advanced-analytics.service.ts.
//
// The service guard is: p.yard_line != null && p.yard_line >= 80
// ---------------------------------------------------------------------------

function isRedZone(yardLine: number | null): boolean {
  return yardLine != null && yardLine >= 80;
}

describe('Red zone classification', () => {
  it('yard_line = 80 (opponent 20) is in the red zone', () => {
    expect(isRedZone(80)).toBe(true);
  });

  it('yard_line = 100 (opponent goal line) is in the red zone', () => {
    expect(isRedZone(100)).toBe(true);
  });

  it('yard_line = 90 is in the red zone', () => {
    expect(isRedZone(90)).toBe(true);
  });

  it('yard_line = 79 is NOT in the red zone', () => {
    expect(isRedZone(79)).toBe(false);
  });

  it('yard_line = 20 (own territory) is NOT in the red zone', () => {
    expect(isRedZone(20)).toBe(false);
  });

  it('yard_line = 0 (own goal line) is NOT in the red zone', () => {
    expect(isRedZone(0)).toBe(false);
  });

  it('yard_line = null is NOT in the red zone', () => {
    expect(isRedZone(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Play type classification — inline helpers from analytics.service.ts
// ---------------------------------------------------------------------------

describe('Play type classification', () => {
  it('pass_complete_touchdown counts as a completion via startsWith check', () => {
    const play = { result: 'pass_complete_touchdown', play_type: 'pass', is_complete: null as boolean | null };
    expect(isPassComplete(play)).toBe(true);
    // Boolean fallback also works:
    expect(isPassComplete({ ...play, is_complete: true })).toBe(true);
  });

  it('interception counts as turnover, not completion', () => {
    const play = { result: 'interception', play_type: 'pass' };
    expect(isInterception(play)).toBe(true);
    expect(isPassComplete(play)).toBe(false);
  });

  it('result = null does not throw', () => {
    const play = { result: null as string | null, play_type: 'pass' };
    expect(() => isPassComplete(play)).not.toThrow();
    expect(() => isInterception(play)).not.toThrow();
    expect(() => isPassTouchdown(play)).not.toThrow();
    expect(isPassComplete(play)).toBe(false);
    expect(isInterception(play)).toBe(false);
    expect(isPassTouchdown(play)).toBe(false);
  });

  it('boolean flags work as fallback when result is ambiguous', () => {
    const play = { result: 'something_weird', is_complete: true };
    expect(isPassComplete(play)).toBe(true);
  });

  it('pass_complete result correctly identifies a completion', () => {
    expect(isPassComplete({ result: 'pass_complete' })).toBe(true);
  });

  it('pass_interception result correctly identifies an interception', () => {
    expect(isInterception({ result: 'pass_interception' })).toBe(true);
  });

  it('passing touchdown via result string and play_type', () => {
    expect(isPassTouchdown({ play_type: 'pass', result: 'pass_complete_touchdown' })).toBe(true);
  });

  it('rushing touchdown does not count as passing touchdown', () => {
    expect(isPassTouchdown({ play_type: 'run', result: 'touchdown' })).toBe(false);
  });

  it('is_interception boolean flag catches interception when result is ambiguous', () => {
    expect(isInterception({ result: 'turnover', is_interception: true })).toBe(true);
  });
});
