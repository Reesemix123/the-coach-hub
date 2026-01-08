// src/lib/ai/film/model-selector.ts
// Maps tagging tiers to AI models and configurations

import type { TaggingTier } from '@/types/football';
import {
  QUICK_TAG_PROMPT,
  STANDARD_TAG_PROMPT,
  COMPREHENSIVE_TAG_PROMPT,
} from './film-prompts';

export interface TierConfig {
  modelId: string;
  modelDisplayName: string;
  prompt: string;
  fields: string[];
  description: string;
  estimatedSeconds: number;
  costPerPlay: string; // Approximate cost for display
}

// Model IDs for Gemini - Use stable versions for production
// See available models: https://ai.google.dev/gemini-api/docs/models/gemini
export const GEMINI_MODELS = {
  // Primary models (stable)
  FLASH: process.env.GEMINI_FLASH_MODEL || 'gemini-1.5-flash', // Fast, cost-effective
  PRO: process.env.GEMINI_PRO_MODEL || 'gemini-1.5-pro', // More capable for complex analysis
  // Fallback models (tried if primary fails)
  FLASH_FALLBACK: 'gemini-1.5-flash-latest',
  PRO_FALLBACK: 'gemini-1.5-pro-latest',
} as const;

// Tier configurations
export const TIER_CONFIGS: Record<TaggingTier, TierConfig> = {
  quick: {
    modelId: GEMINI_MODELS.FLASH,
    modelDisplayName: 'Gemini Flash',
    prompt: QUICK_TAG_PROMPT,
    fields: [
      'play_type',
      'direction',
      'result',
      'yards_gained',
      // Special teams fields (only returned when play_type is special_teams)
      'special_teams_unit',
      'kick_result',
      'kick_distance',
      'return_yards',
    ],
    description: 'Fast analysis for basic game logging',
    estimatedSeconds: 2,
    costPerPlay: '~$0.002',
  },
  standard: {
    modelId: GEMINI_MODELS.PRO,
    modelDisplayName: 'Gemini Pro',
    prompt: STANDARD_TAG_PROMPT,
    fields: [
      'play_type',
      'direction',
      'result',
      'yards_gained',
      'formation',
      'personnel',
      'hash',
      'down',
      'distance',
      // Special teams fields (only returned when play_type is special_teams)
      'special_teams_unit',
      'kick_result',
      'kick_distance',
      'return_yards',
      'is_touchback',
      'is_fair_catch',
    ],
    description: 'Detailed analysis for tendency tracking and game planning',
    estimatedSeconds: 4,
    costPerPlay: '~$0.006',
  },
  comprehensive: {
    modelId: GEMINI_MODELS.PRO,
    modelDisplayName: 'Gemini Pro',
    prompt: COMPREHENSIVE_TAG_PROMPT,
    fields: [
      'play_type',
      'direction',
      'result',
      'yards_gained',
      'formation',
      'personnel',
      'hash',
      'down',
      'distance',
      'field_zone',
      'quarter',
      'motion',
      'play_action',
      'run_concept',
      'pass_concept',
      // Special teams fields (only returned when play_type is special_teams)
      'special_teams_unit',
      'kick_result',
      'kick_distance',
      'return_yards',
      'is_touchback',
      'is_fair_catch',
      'is_muffed',
      'punt_type',
      'kickoff_type',
    ],
    description: 'Full analysis for deep film study',
    estimatedSeconds: 5,
    costPerPlay: '~$0.008',
  },
};

/**
 * Get the model configuration for a tagging tier
 */
export function getConfigForTier(tier: TaggingTier): TierConfig {
  return TIER_CONFIGS[tier];
}

/**
 * Get the Gemini model ID for a tagging tier
 */
export function getModelIdForTier(tier: TaggingTier): string {
  return TIER_CONFIGS[tier].modelId;
}

/**
 * Get fallback models for a tier (used when primary model fails)
 * Returns array of model IDs to try in order
 */
export function getModelFallbackChain(tier: TaggingTier): string[] {
  const primary = TIER_CONFIGS[tier].modelId;

  if (tier === 'quick') {
    return [
      primary,
      GEMINI_MODELS.FLASH_FALLBACK,
      'gemini-1.5-flash-8b', // Smaller/faster variant
      GEMINI_MODELS.PRO, // Fall back to pro if flash unavailable
    ];
  }

  // Standard and comprehensive use PRO
  return [
    primary,
    GEMINI_MODELS.PRO_FALLBACK,
    'gemini-1.5-pro-002', // Specific version
    GEMINI_MODELS.FLASH, // Fall back to flash if pro unavailable
  ];
}

/**
 * Check if an error indicates a model is unavailable (vs other errors)
 */
export function isModelUnavailableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('not found') ||
      message.includes('not supported') ||
      message.includes('does not exist') ||
      message.includes('deprecated') ||
      message.includes('404')
    );
  }
  return false;
}

/**
 * Get the fields that should be analyzed for a tier
 */
export function getFieldsForTier(tier: TaggingTier): string[] {
  return TIER_CONFIGS[tier].fields;
}

/**
 * Get the prompt template for a tier
 */
export function getPromptForTier(tier: TaggingTier): string {
  return TIER_CONFIGS[tier].prompt;
}

/**
 * Calculate estimated time for batch processing
 */
export function estimateBatchTime(tier: TaggingTier, playCount: number): {
  seconds: number;
  formatted: string;
} {
  const config = TIER_CONFIGS[tier];
  const totalSeconds = config.estimatedSeconds * playCount;

  if (totalSeconds < 60) {
    return {
      seconds: totalSeconds,
      formatted: `~${totalSeconds} seconds`,
    };
  }

  const minutes = Math.ceil(totalSeconds / 60);
  return {
    seconds: totalSeconds,
    formatted: `~${minutes} minute${minutes > 1 ? 's' : ''}`,
  };
}

/**
 * Token cost rates for Gemini models (per token)
 * These are approximate and should be updated as pricing changes
 * See: https://ai.google.dev/pricing
 */
export const TOKEN_RATES = {
  [GEMINI_MODELS.FLASH]: {
    input: 0.000000075, // $0.075 per 1M input tokens
    output: 0.0000003, // $0.30 per 1M output tokens
  },
  [GEMINI_MODELS.PRO]: {
    input: 0.00000125, // $1.25 per 1M input tokens (gemini-1.5-pro)
    output: 0.000005, // $5 per 1M output tokens (gemini-1.5-pro)
  },
  // Fallback rates for any model not explicitly listed
  'gemini-1.5-pro': {
    input: 0.00000125,
    output: 0.000005,
  },
} as const;

/**
 * Calculate cost for a request
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = TOKEN_RATES[modelId as keyof typeof TOKEN_RATES];
  if (!rates) {
    // Default to Flash rates if unknown model
    return inputTokens * 0.000000075 + outputTokens * 0.0000003;
  }
  return inputTokens * rates.input + outputTokens * rates.output;
}
