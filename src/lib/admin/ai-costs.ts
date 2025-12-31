// src/lib/admin/ai-costs.ts
// Centralized AI cost constants for admin reporting
// This file is the single source of truth for cost calculations in the admin console

/**
 * AI Chat costs (text-based interactions with AI Assistant)
 * Uses the ai_usage table with usage_type='text_action'
 */
export const AI_CHAT_COST = {
  COST_PER_ACTION: 0.01, // $0.01 per AI chat action
};

/**
 * AI Film Tagging costs (Gemini-based video analysis)
 * Uses the ai_tag_predictions table which tracks actual token usage
 *
 * Note: These are approximate display values. Actual costs are calculated
 * from Gemini token usage stored in ai_tag_predictions.cost_usd
 */
export const AI_FILM_TAGGING_COST = {
  // Approximate cost per play by tier (for display purposes)
  QUICK_PER_PLAY: 0.002,        // ~$0.002/play using Gemini Flash
  STANDARD_PER_PLAY: 0.006,     // ~$0.006/play using Gemini Pro
  COMPREHENSIVE_PER_PLAY: 0.008, // ~$0.008/play using Gemini Pro
};

/**
 * Gemini API token rates (as of Dec 2024)
 * These rates are also defined in src/lib/ai/film/model-selector.ts
 * for runtime cost calculation
 */
export const GEMINI_TOKEN_RATES = {
  'gemini-2.0-flash-exp': {
    input: 0.000000075,  // $0.075 per 1M input tokens
    output: 0.0000003,   // $0.30 per 1M output tokens
  },
  'gemini-2.0-flash-thinking-exp-01-21': {
    input: 0.00000125,   // $1.25 per 1M input tokens
    output: 0.000005,    // $5 per 1M output tokens
  },
};

/**
 * Helper function to format costs for display
 */
export function formatCost(value: number, precision: number = 2): string {
  return `$${value.toFixed(precision)}`;
}

/**
 * Helper function to calculate cost per play estimate
 */
export function estimateCostPerPlay(tier: 'quick' | 'standard' | 'comprehensive'): number {
  switch (tier) {
    case 'quick':
      return AI_FILM_TAGGING_COST.QUICK_PER_PLAY;
    case 'standard':
      return AI_FILM_TAGGING_COST.STANDARD_PER_PLAY;
    case 'comprehensive':
      return AI_FILM_TAGGING_COST.COMPREHENSIVE_PER_PLAY;
    default:
      return 0;
  }
}
