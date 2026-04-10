// src/lib/ai/__tests__/film-prompts.test.ts
//
// Tests for prompt templates and buildPrompt() in film-prompts.ts.
// All tests are pure (no I/O, no mocks) — the exports are plain strings and
// a synchronous string-replace function.

import { describe, it, expect } from 'vitest';
import {
  QUALITY_ASSESSMENT_PROMPT,
  QUICK_TAG_PROMPT,
  STANDARD_TAG_PROMPT,
  COMPREHENSIVE_TAG_PROMPT,
  buildPrompt,
} from '../film/film-prompts';

// Full set of context fields used to resolve all placeholders in tests that
// verify no unresolved placeholders remain after buildPrompt().
const allContextFields = {
  team_level: 'high_school',
  offense_or_defense: 'offense' as const,
  quality_score: 8,
  audio_available: true,
  previous_play_context: 'Previous play was a 5-yard run',
  playbook_formations: ['Shotgun', 'I-Form'],
};

// The six placeholder strings that buildPrompt() replaces.
const ALL_PLACEHOLDER_KEYS = [
  '{team_level}',
  '{offense_or_defense}',
  '{quality_score}',
  '{audio_available}',
  '{previous_play_context}',
  '{playbook_formations}',
] as const;

// ---------------------------------------------------------------------------
// describe: buildPrompt — template substitution
// ---------------------------------------------------------------------------
describe('buildPrompt — template substitution', () => {
  it('replaces all context fields', () => {
    const result = buildPrompt(QUICK_TAG_PROMPT, allContextFields);

    // None of the placeholder tokens should survive substitution.
    for (const key of ALL_PLACEHOLDER_KEYS) {
      expect(result).not.toContain(key);
    }

    // Spot-check that actual values appear.
    expect(result).toContain('high_school');
    expect(result).toContain('offense');
    expect(result).toContain('8');
    expect(result).toContain('Yes');
  });

  it('handles missing optional context (uses defaults, no literal placeholders remain)', () => {
    // buildPrompt() provides defaults for every field so passing {} should
    // produce a fully resolved string with no bare {key} tokens.
    const result = buildPrompt(QUICK_TAG_PROMPT, {});

    for (const key of ALL_PLACEHOLDER_KEYS) {
      expect(result).not.toContain(key);
    }
  });

  it('handles undefined context fields without throwing', () => {
    expect(() =>
      buildPrompt(QUICK_TAG_PROMPT, { team_level: undefined })
    ).not.toThrow();

    // Undefined team_level falls back to the default ('High School').
    const result = buildPrompt(QUICK_TAG_PROMPT, { team_level: undefined });
    expect(result).not.toContain('{team_level}');
    expect(result).toContain('High School');
  });
});

// ---------------------------------------------------------------------------
// describe: Prompt content verification
// ---------------------------------------------------------------------------
describe('Prompt content verification', () => {
  it('quality assessment prompt mentions JSON', () => {
    expect(QUALITY_ASSESSMENT_PROMPT).toMatch(/JSON/i);
  });

  it('quick tag prompt is shorter than comprehensive tag prompt', () => {
    expect(QUICK_TAG_PROMPT.length).toBeLessThan(COMPREHENSIVE_TAG_PROMPT.length);
  });

  it('comprehensive prompt mentions all required field names', () => {
    const requiredFields = [
      'play_type',
      'formation',
      'personnel',
      'field_zone',
      'motion',
      'play_action',
      'run_concept',
      'pass_concept',
    ];

    for (const field of requiredFields) {
      expect(COMPREHENSIVE_TAG_PROMPT).toContain(field);
    }
  });

  it('quick prompt does NOT mention advanced fields (field_zone, motion, play_action)', () => {
    // These fields are standard+ only — they must not appear in the quick prompt
    // so Gemini is not asked to analyze them in that tier.
    expect(QUICK_TAG_PROMPT).not.toContain('field_zone');
    expect(QUICK_TAG_PROMPT).not.toContain('motion');
    expect(QUICK_TAG_PROMPT).not.toContain('play_action');
  });

  it('all four prompts contain a JSON return instruction', () => {
    const prompts = [
      QUALITY_ASSESSMENT_PROMPT,
      QUICK_TAG_PROMPT,
      STANDARD_TAG_PROMPT,
      COMPREHENSIVE_TAG_PROMPT,
    ];

    for (const prompt of prompts) {
      expect(prompt).toMatch(/JSON/i);
    }
  });
});

// ---------------------------------------------------------------------------
// describe: Prompt templates have no unresolved placeholders after build
// ---------------------------------------------------------------------------
describe('Prompt templates have no unresolved placeholders after build', () => {
  it('quick prompt fully resolved', () => {
    const result = buildPrompt(QUICK_TAG_PROMPT, allContextFields);

    for (const key of ALL_PLACEHOLDER_KEYS) {
      expect(result).not.toContain(key);
    }
  });

  it('standard prompt fully resolved', () => {
    const result = buildPrompt(STANDARD_TAG_PROMPT, allContextFields);

    for (const key of ALL_PLACEHOLDER_KEYS) {
      expect(result).not.toContain(key);
    }
  });

  it('comprehensive prompt fully resolved', () => {
    const result = buildPrompt(COMPREHENSIVE_TAG_PROMPT, allContextFields);

    for (const key of ALL_PLACEHOLDER_KEYS) {
      expect(result).not.toContain(key);
    }
  });
});
