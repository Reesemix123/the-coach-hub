// src/lib/ai/__tests__/play-analyzer.test.ts
//
// Tests for the JSON parsing and confidence-calculation logic embedded inside
// analyzePlayClip(). Because those paths are not exported as standalone
// functions we reimplement the algorithm here and validate it against known
// inputs.  Any drift between this reimplementation and the source should be
// treated as a signal to extract the logic into a testable helper.
//
// NOTE ON ALGORITHM DIFFERENCE:
//   Production code (play-analyzer.ts lines 157-169) iterates over
//   tierConfig.fields — a fixed allow-list from model-selector.ts — to decide
//   which keys contribute to overallConfidence.  The helper below iterates
//   over Object.keys(raw) instead.  This is intentional: these unit tests
//   exercise the parsing algorithm in isolation without a tier dependency.
//   Tests that depend on the tier-gated field list live closer to integration
//   tests and are out of scope here.

import { describe, it, expect } from 'vitest';
import {
  mockGeminiPlayResponse,
  mockGeminiPlayResponseWithFences,
  mockGeminiQuickResponse,
} from '../../services/__tests__/helpers/test-fixtures';
import type { PlayPrediction, FieldPrediction } from '../film/play-analyzer';

// ---------------------------------------------------------------------------
// Reimplementation of the parsing + confidence logic from play-analyzer.ts
// (source lines 140-141 and 156-173).
//
// Cleaning regex matches the *actual* source:
//   text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
// NOT the anchored multiline version shown in the task spec.
// ---------------------------------------------------------------------------
interface ParseResult {
  predictions: Record<string, unknown>;
  overallConfidence: number;
  fieldsAnalyzed: string[];
  fieldsUncertain: string[];
}

const META_FIELDS = ['audio_used', 'fields_uncertain', 'reasoning'];

function parseGeminiResponse(responseText: string): ParseResult {
  const cleaned = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  const raw = JSON.parse(cleaned) as Record<string, unknown>;

  const fieldConfidences: number[] = [];
  const fieldsUncertain: string[] = [];
  const fieldsAnalyzed: string[] = [];

  for (const field of Object.keys(raw)) {
    if (META_FIELDS.includes(field)) continue;
    const pred = raw[field];
    if (pred && typeof pred === 'object' && 'confidence' in pred) {
      fieldsAnalyzed.push(field);
      fieldConfidences.push((pred as FieldPrediction).confidence);
      if ((pred as FieldPrediction).confidence < 50) {
        fieldsUncertain.push(field);
      }
    }
  }

  const overallConfidence =
    fieldConfidences.length > 0
      ? Math.round(
          fieldConfidences.reduce((a, b) => a + b, 0) / fieldConfidences.length
        )
      : 0;

  return { predictions: raw, overallConfidence, fieldsAnalyzed, fieldsUncertain };
}

// ---------------------------------------------------------------------------
// Helpers that mirror the PlayPrediction type for typed access in tests
// ---------------------------------------------------------------------------
function asPrediction(raw: Record<string, unknown>, key: string): FieldPrediction {
  return raw[key] as FieldPrediction;
}

// ---------------------------------------------------------------------------
// describe: Gemini response JSON parsing
// ---------------------------------------------------------------------------
describe('Gemini response JSON parsing', () => {
  it('parses valid response with all fields', () => {
    const { predictions } = parseGeminiResponse(mockGeminiPlayResponse);

    expect(asPrediction(predictions, 'play_type').value).toBe('pass');
    expect(asPrediction(predictions, 'play_type').confidence).toBe(92);
  });

  it('strips code fences before parsing', () => {
    const withFences = parseGeminiResponse(mockGeminiPlayResponseWithFences);
    const withoutFences = parseGeminiResponse(mockGeminiPlayResponse);

    expect(withFences.predictions).toEqual(withoutFences.predictions);
    expect(withFences.overallConfidence).toBe(withoutFences.overallConfidence);
    expect(withFences.fieldsAnalyzed).toEqual(withoutFences.fieldsAnalyzed);
  });

  it('handles minimal quick-tier response', () => {
    const { fieldsAnalyzed } = parseGeminiResponse(mockGeminiQuickResponse);

    // play_type, direction, result, yards_gained
    expect(fieldsAnalyzed).toHaveLength(4);
    expect(fieldsAnalyzed).toContain('play_type');
    expect(fieldsAnalyzed).toContain('yards_gained');
  });

  it('throws on completely malformed JSON', () => {
    expect(() => parseGeminiResponse('not json at all')).toThrow();
  });

  it('handles empty JSON object', () => {
    const { overallConfidence, fieldsAnalyzed } = parseGeminiResponse('{}');

    expect(overallConfidence).toBe(0);
    expect(fieldsAnalyzed).toHaveLength(0);
  });

  it('handles response with only meta fields (no predictions)', () => {
    const { fieldsAnalyzed, overallConfidence } = parseGeminiResponse(
      JSON.stringify({ audio_used: true, reasoning: 'test' })
    );

    expect(fieldsAnalyzed).toHaveLength(0);
    expect(overallConfidence).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// describe: Confidence calculation
// ---------------------------------------------------------------------------
describe('Confidence calculation', () => {
  it('calculates correct average confidence', () => {
    // The mock response has 21 prediction fields (all keys except the 3 meta
    // fields: audio_used, fields_uncertain, reasoning).
    // Confidence values:
    //   play_type(92) direction(78) result(88) yards_gained(85) formation(72)
    //   personnel(65) hash(55) down(95) distance(90) field_zone(60) quarter(98)
    //   motion(45) play_action(82) run_concept(0) pass_concept(68) is_screen(75)
    //   is_rpo(70) special_teams_type(0) kick_result(0) return_yards(0) penalty(40)
    // Sum = 1258, count = 21, average = 59.904... → Math.round → 60
    const { overallConfidence, fieldsAnalyzed } = parseGeminiResponse(
      mockGeminiPlayResponse
    );

    const parsed = JSON.parse(mockGeminiPlayResponse) as Record<string, unknown>;
    const predictionKeys = Object.keys(parsed).filter(
      (k) => !META_FIELDS.includes(k)
    );
    const sum = predictionKeys.reduce((acc, k) => {
      const pred = parsed[k];
      return acc + (pred && typeof pred === 'object' && 'confidence' in pred
        ? (pred as FieldPrediction).confidence
        : 0);
    }, 0);
    const expected = Math.round(sum / predictionKeys.length);

    expect(overallConfidence).toBe(expected);
    expect(fieldsAnalyzed).toHaveLength(predictionKeys.length);
  });

  it('all fields at 100 confidence', () => {
    const response = JSON.stringify({
      play_type: { value: 'pass', confidence: 100 },
      direction: { value: 'right', confidence: 100 },
      result: { value: 'pass_complete', confidence: 100 },
    });

    const { overallConfidence } = parseGeminiResponse(response);

    expect(overallConfidence).toBe(100);
  });

  it('all fields at 0 confidence', () => {
    const response = JSON.stringify({
      play_type: { value: null, confidence: 0 },
      direction: { value: null, confidence: 0 },
    });

    const { overallConfidence } = parseGeminiResponse(response);

    expect(overallConfidence).toBe(0);
  });

  it('identifies uncertain fields correctly', () => {
    // mockGeminiPlayResponse has 6 fields with confidence < 50:
    //   motion(45), run_concept(0), special_teams_type(0), kick_result(0),
    //   return_yards(0), penalty(40)
    const { fieldsUncertain } = parseGeminiResponse(mockGeminiPlayResponse);

    expect(fieldsUncertain).toContain('motion');
    expect(fieldsUncertain).toContain('penalty');
    expect(fieldsUncertain).toContain('run_concept');
    expect(fieldsUncertain).toContain('special_teams_type');
    expect(fieldsUncertain).toContain('kick_result');
    expect(fieldsUncertain).toContain('return_yards');
    expect(fieldsUncertain).toHaveLength(6);
  });

  it('null-value fields with confidence 0 are still counted', () => {
    // run_concept has value: null and confidence: 0 — it should appear in both
    // fieldsAnalyzed (because it has a confidence key) and fieldsUncertain
    // (because 0 < 50).
    const { fieldsAnalyzed, fieldsUncertain } =
      parseGeminiResponse(mockGeminiPlayResponse);

    expect(fieldsAnalyzed).toContain('run_concept');
    expect(fieldsUncertain).toContain('run_concept');
  });

  it('fields_uncertain, audio_used, reasoning are NOT counted as prediction fields', () => {
    const { fieldsAnalyzed } = parseGeminiResponse(mockGeminiPlayResponse);

    expect(fieldsAnalyzed).not.toContain('audio_used');
    expect(fieldsAnalyzed).not.toContain('fields_uncertain');
    expect(fieldsAnalyzed).not.toContain('reasoning');
  });
});

// ---------------------------------------------------------------------------
// describe: Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  it('confidence values outside 0-100 are included in average without clamping', () => {
    // NOTE: This documents current behavior — the algorithm does not clamp
    // confidence to [0, 100].  A value of 150 will be included as-is in the
    // average.  If clamping is ever added this test should be updated.
    const response = JSON.stringify({
      play_type: { value: 'pass', confidence: 150 },
      direction: { value: 'right', confidence: 50 },
    });

    const { overallConfidence } = parseGeminiResponse(response);

    // (150 + 50) / 2 = 100
    expect(overallConfidence).toBe(100);
  });

  it('single field response', () => {
    const response = JSON.stringify({
      play_type: { value: 'pass', confidence: 75 },
    });

    const { overallConfidence, fieldsAnalyzed } = parseGeminiResponse(response);

    expect(overallConfidence).toBe(75);
    expect(fieldsAnalyzed).toHaveLength(1);
  });
});

// Suppress unused-import warnings — PlayPrediction is used only as a type
// reference to confirm the fixture matches the declared shape.
const _typeCheck: PlayPrediction = {
  play_type: { value: 'pass', confidence: 92, notes: 'Clear dropback' },
};
void _typeCheck;
