import { describe, it, expect } from 'vitest';
import {
  GEMINI_MODELS,
  TOKEN_RATES,
  calculateCost,
  getConfigForTier,
  getFieldsForTier,
  getModelIdForTier,
  getModelFallbackChain,
} from '../film/model-selector';

// ---------------------------------------------------------------------------
// calculateCost
// ---------------------------------------------------------------------------

describe('calculateCost', () => {
  it('Flash model cost is correct', () => {
    // $0.075 per 1M input = 0.000000075 per token
    // $0.30  per 1M output = 0.0000003   per token
    // 1000 input + 500 output:
    // 1000 * 0.000000075 + 500 * 0.0000003 = 0.000075 + 0.00015 = 0.000225
    const result = calculateCost(GEMINI_MODELS.FLASH, 1000, 500);
    expect(result).toBeCloseTo(0.000225, 9);
  });

  it('Pro model cost is correct', () => {
    // $1.25 per 1M input = 0.00000125 per token
    // $5.00 per 1M output = 0.000005   per token
    // 1000 input + 500 output:
    // 1000 * 0.00000125 + 500 * 0.000005 = 0.00125 + 0.0025 = 0.00375
    const result = calculateCost(GEMINI_MODELS.PRO, 1000, 500);
    expect(result).toBeCloseTo(0.00375, 9);
  });

  it('zero tokens returns 0', () => {
    expect(calculateCost(GEMINI_MODELS.FLASH, 0, 0)).toBe(0);
    expect(calculateCost(GEMINI_MODELS.PRO, 0, 0)).toBe(0);
  });

  it('large token count (1M) does not overflow', () => {
    const result = calculateCost(GEMINI_MODELS.FLASH, 1_000_000, 1_000_000);
    expect(Number.isFinite(result)).toBe(true);
    // 1M input * 0.075/1M + 1M output * 0.30/1M = $0.075 + $0.30 = $0.375
    expect(result).toBeCloseTo(0.375, 6);
  });

  it('unknown model defaults to Flash rates', () => {
    const flashResult = calculateCost(GEMINI_MODELS.FLASH, 1000, 500);
    const unknownResult = calculateCost('unknown-model-xyz', 1000, 500);
    expect(unknownResult).toBeCloseTo(flashResult, 9);
  });

  it('Flash legacy model uses the same rates as Flash', () => {
    // Flash legacy is in TOKEN_RATES with identical rates to Flash
    const flashResult = calculateCost(GEMINI_MODELS.FLASH, 2000, 800);
    const legacyResult = calculateCost(GEMINI_MODELS.FLASH_LEGACY, 2000, 800);
    expect(legacyResult).toBeCloseTo(flashResult, 9);
  });
});

// ---------------------------------------------------------------------------
// getConfigForTier
// ---------------------------------------------------------------------------

describe('getConfigForTier', () => {
  it('quick tier returns Flash model', () => {
    expect(getConfigForTier('quick').modelId).toBe(GEMINI_MODELS.FLASH);
  });

  it('standard tier returns Pro model', () => {
    expect(getConfigForTier('standard').modelId).toBe(GEMINI_MODELS.PRO);
  });

  it('comprehensive tier returns Pro model', () => {
    expect(getConfigForTier('comprehensive').modelId).toBe(GEMINI_MODELS.PRO);
  });

  it('quick tier config has a non-empty prompt', () => {
    expect(getConfigForTier('quick').prompt.length).toBeGreaterThan(0);
  });

  it('each tier config has a non-empty description', () => {
    expect(getConfigForTier('quick').description.length).toBeGreaterThan(0);
    expect(getConfigForTier('standard').description.length).toBeGreaterThan(0);
    expect(getConfigForTier('comprehensive').description.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getModelIdForTier
// ---------------------------------------------------------------------------

describe('getModelIdForTier', () => {
  it('quick tier returns Flash model ID', () => {
    expect(getModelIdForTier('quick')).toBe(GEMINI_MODELS.FLASH);
  });

  it('standard tier returns Pro model ID', () => {
    expect(getModelIdForTier('standard')).toBe(GEMINI_MODELS.PRO);
  });

  it('comprehensive tier returns Pro model ID', () => {
    expect(getModelIdForTier('comprehensive')).toBe(GEMINI_MODELS.PRO);
  });
});

// ---------------------------------------------------------------------------
// getFieldsForTier
// ---------------------------------------------------------------------------

describe('getFieldsForTier', () => {
  it('quick tier returns exactly 8 fields', () => {
    // play_type, direction, result, yards_gained,
    // special_teams_unit, kick_result, kick_distance, return_yards
    expect(getFieldsForTier('quick')).toHaveLength(8);
  });

  it('standard tier returns exactly 15 fields', () => {
    // Adds formation, personnel, hash, down, distance,
    // is_touchback, is_fair_catch (5 + 2 = 7 more than quick)
    expect(getFieldsForTier('standard')).toHaveLength(15);
  });

  it('comprehensive tier returns exactly 24 fields', () => {
    // Adds field_zone, quarter, motion, play_action, run_concept, pass_concept,
    // is_muffed, punt_type, kickoff_type (6 + 3 = 9 more than standard)
    expect(getFieldsForTier('comprehensive')).toHaveLength(24);
  });

  it('standard fields are a superset of quick fields', () => {
    const quickFields = getFieldsForTier('quick');
    const standardFields = getFieldsForTier('standard');
    for (const field of quickFields) {
      expect(standardFields).toContain(field);
    }
  });

  it('comprehensive fields are a superset of standard fields', () => {
    const standardFields = getFieldsForTier('standard');
    const comprehensiveFields = getFieldsForTier('comprehensive');
    for (const field of standardFields) {
      expect(comprehensiveFields).toContain(field);
    }
  });

  it('quick fields include the core play fields', () => {
    const fields = getFieldsForTier('quick');
    expect(fields).toContain('play_type');
    expect(fields).toContain('direction');
    expect(fields).toContain('result');
    expect(fields).toContain('yards_gained');
  });

  it('standard fields include formation and personnel', () => {
    const fields = getFieldsForTier('standard');
    expect(fields).toContain('formation');
    expect(fields).toContain('personnel');
  });

  it('comprehensive fields include situational and concept fields', () => {
    const fields = getFieldsForTier('comprehensive');
    expect(fields).toContain('field_zone');
    expect(fields).toContain('quarter');
    expect(fields).toContain('run_concept');
    expect(fields).toContain('pass_concept');
  });
});

// ---------------------------------------------------------------------------
// getModelFallbackChain
// ---------------------------------------------------------------------------

describe('getModelFallbackChain', () => {
  it('quick tier starts with Flash', () => {
    expect(getModelFallbackChain('quick')[0]).toBe(GEMINI_MODELS.FLASH);
  });

  it('standard tier starts with Pro', () => {
    expect(getModelFallbackChain('standard')[0]).toBe(GEMINI_MODELS.PRO);
  });

  it('comprehensive tier starts with Pro', () => {
    expect(getModelFallbackChain('comprehensive')[0]).toBe(GEMINI_MODELS.PRO);
  });

  it('fallback chain has at least 3 models for every tier', () => {
    expect(getModelFallbackChain('quick').length).toBeGreaterThanOrEqual(3);
    expect(getModelFallbackChain('standard').length).toBeGreaterThanOrEqual(3);
    expect(getModelFallbackChain('comprehensive').length).toBeGreaterThanOrEqual(3);
  });

  it('no model appears twice in quick chain', () => {
    const chain = getModelFallbackChain('quick');
    const unique = new Set(chain);
    expect(unique.size).toBe(chain.length);
  });

  it('no model appears twice in standard chain', () => {
    const chain = getModelFallbackChain('standard');
    const unique = new Set(chain);
    expect(unique.size).toBe(chain.length);
  });

  it('no model appears twice in comprehensive chain', () => {
    const chain = getModelFallbackChain('comprehensive');
    const unique = new Set(chain);
    expect(unique.size).toBe(chain.length);
  });

  it('quick chain includes a Pro model as a final fallback', () => {
    // If all Flash variants are unavailable, the chain should fall back to Pro
    const chain = getModelFallbackChain('quick');
    expect(chain).toContain(GEMINI_MODELS.PRO);
  });

  it('standard chain includes a Flash model as a final fallback', () => {
    // If all Pro variants are unavailable, the chain should fall back to Flash
    const chain = getModelFallbackChain('standard');
    expect(chain).toContain(GEMINI_MODELS.FLASH);
  });
});
