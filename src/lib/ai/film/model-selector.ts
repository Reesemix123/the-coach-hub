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

// Model IDs for Gemini
export const GEMINI_MODELS = {
  FLASH: 'gemini-2.0-flash-exp', // Fast, cost-effective
  PRO: 'gemini-2.0-flash-thinking-exp-01-21', // More capable for complex analysis
} as const;

// Tier configurations
export const TIER_CONFIGS: Record<TaggingTier, TierConfig> = {
  quick: {
    modelId: GEMINI_MODELS.FLASH,
    modelDisplayName: 'Gemini Flash',
    prompt: QUICK_TAG_PROMPT,
    fields: ['play_type', 'direction', 'result', 'yards_gained'],
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
 */
export const TOKEN_RATES = {
  [GEMINI_MODELS.FLASH]: {
    input: 0.000000075, // $0.075 per 1M input tokens
    output: 0.0000003, // $0.30 per 1M output tokens
  },
  [GEMINI_MODELS.PRO]: {
    input: 0.00000125, // $1.25 per 1M input tokens
    output: 0.000005, // $5 per 1M output tokens
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
