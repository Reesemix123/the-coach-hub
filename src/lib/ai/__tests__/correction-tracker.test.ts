import { describe, it, expect, vi } from 'vitest';

// correction-tracker imports createClient from @/utils/supabase/server.
// identifyCorrections is a pure function and never calls Supabase, but we
// mock the server client so the module loads without environment errors.
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

import { identifyCorrections } from '../film/correction-tracker';
import type { FieldPrediction } from '../film/play-analyzer';

// ---------------------------------------------------------------------------
// Helper to build a FieldPrediction record concisely
// ---------------------------------------------------------------------------

function pred(value: string | number | boolean, confidence: number): FieldPrediction {
  return { value, confidence };
}

// ---------------------------------------------------------------------------
// identifyCorrections — string normalization
// ---------------------------------------------------------------------------

describe('identifyCorrections — string normalization', () => {
  it('same value different case is NOT a correction', () => {
    const predictions = { play_type: pred('Pass', 80) };
    const coachValues = { play_type: 'pass' };
    expect(identifyCorrections(predictions, coachValues)).toHaveLength(0);
  });

  it('numeric as string is NOT a correction', () => {
    // AI returns '3' as a string; coach submits the number 3.
    // Both normalize to '3' via String() + toLowerCase().
    const predictions = { yards_gained: pred('3', 90) };
    const coachValues = { yards_gained: 3 };
    expect(identifyCorrections(predictions, coachValues)).toHaveLength(0);
  });

  it('boolean as string is NOT a correction', () => {
    // AI returns 'true' as a string; coach submits the boolean true.
    // Both normalize to 'true'.
    const predictions = { motion: pred('true', 70) };
    const coachValues = { motion: true };
    expect(identifyCorrections(predictions, coachValues)).toHaveLength(0);
  });

  it('whitespace is NOT a correction', () => {
    // AI trailing space is trimmed before comparison.
    const predictions = { formation: pred('shotgun ', 85) };
    const coachValues = { formation: 'shotgun' };
    expect(identifyCorrections(predictions, coachValues)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// identifyCorrections — real corrections
// ---------------------------------------------------------------------------

describe('identifyCorrections — real corrections', () => {
  it('different values are flagged', () => {
    const predictions = { play_type: pred('pass', 80) };
    const coachValues = { play_type: 'run' };
    const corrections = identifyCorrections(predictions, coachValues);
    expect(corrections).toHaveLength(1);
    expect(corrections[0].field).toBe('play_type');
    expect(corrections[0].aiValue).toBe('pass');
    expect(corrections[0].coachValue).toBe('run');
  });

  it('AI has value, coach sets null — skips the field (null treated as no value)', () => {
    // The implementation skips coachValue === null (coach didn't set a value).
    // This means if a coach clears a field to null, the change is NOT recorded
    // as a correction. This test documents that behavior.
    const predictions = { play_type: pred('pass', 80) };
    const coachValues = { play_type: null };
    const corrections = identifyCorrections(predictions, coachValues);
    expect(corrections).toHaveLength(0);
  });

  it('AI empty string, coach has value — IS flagged as a correction', () => {
    // Empty string normalizes to '' which differs from 'pass'.
    const predictions = { play_type: pred('', 0) };
    const coachValues = { play_type: 'pass' };
    const corrections = identifyCorrections(predictions, coachValues);
    expect(corrections).toHaveLength(1);
    expect(corrections[0].coachValue).toBe('pass');
  });

  it('AI confidence is preserved on the correction record', () => {
    const predictions = { direction: pred('left', 55) };
    const coachValues = { direction: 'right' };
    const corrections = identifyCorrections(predictions, coachValues);
    expect(corrections[0].aiConfidence).toBe(55);
  });
});

// ---------------------------------------------------------------------------
// identifyCorrections — edge cases
// ---------------------------------------------------------------------------

describe('identifyCorrections — edge cases', () => {
  it('all fields match returns zero corrections', () => {
    const predictions = {
      play_type: pred('pass', 80),
      direction: pred('right', 75),
    };
    const coachValues = { play_type: 'pass', direction: 'right' };
    expect(identifyCorrections(predictions, coachValues)).toHaveLength(0);
  });

  it('all fields differ returns all as corrections', () => {
    const predictions = {
      play_type: pred('pass', 80),
      direction: pred('left', 75),
      formation: pred('shotgun', 90),
    };
    const coachValues = { play_type: 'run', direction: 'right', formation: 'i_form' };
    const corrections = identifyCorrections(predictions, coachValues);
    expect(corrections).toHaveLength(3);
  });

  it('AI field undefined (Gemini omitted it) vs coach value — NOT flagged', () => {
    // identifyCorrections iterates predictions keys, not coachValues keys.
    // If Gemini omitted a field, it is absent from predictions, so the coach's
    // value is never compared and no correction is recorded for that field.
    const predictions: Record<string, FieldPrediction | undefined> = {};
    const coachValues = { play_type: 'pass' };
    const corrections = identifyCorrections(predictions, coachValues);
    expect(corrections).toHaveLength(0);
  });

  it('prediction entry with no value property is skipped', () => {
    // The guard `!('value' in prediction)` skips non-FieldPrediction entries.
    const predictions = {
      play_type: undefined,
    } as Record<string, FieldPrediction | undefined>;
    const coachValues = { play_type: 'pass' };
    expect(identifyCorrections(predictions, coachValues)).toHaveLength(0);
  });

  it('multiple fields with mixed match/mismatch returns only mismatches', () => {
    const predictions = {
      play_type: pred('pass', 80),
      direction: pred('right', 70),
      yards_gained: pred('8', 85),
    };
    // play_type and yards_gained match; direction does not
    const coachValues = { play_type: 'pass', direction: 'left', yards_gained: 8 };
    const corrections = identifyCorrections(predictions, coachValues);
    expect(corrections).toHaveLength(1);
    expect(corrections[0].field).toBe('direction');
  });
});
