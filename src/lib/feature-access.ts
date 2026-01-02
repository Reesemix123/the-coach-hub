// src/lib/feature-access.ts
// Feature access utility for tier-based feature gating
// This is a shared module that can be used both server-side and client-side

import { SubscriptionTier, SubscriptionStatus } from '@/types/admin';

// ============================================================================
// Types
// ============================================================================

export type Feature =
  // Core features (all tiers)
  | 'playbook_builder'
  | 'film_upload'
  | 'basic_tagging'
  // Tier 2+ (plus and above)
  | 'drive_analytics'
  | 'player_stats'
  | 'situational_analysis'
  // Tier 3+ (premium and above)
  | 'ol_tracking'
  | 'defensive_player_tracking'
  | 'advanced_situational'
  | 'opponent_scouting'
  // AI features (available on all tiers)
  | 'ai_play_recognition'
  | 'ai_insights';

export interface FeatureAccess {
  playbook_builder: boolean;
  film_upload: boolean;
  basic_tagging: boolean;
  drive_analytics: boolean;
  player_stats: boolean;
  situational_analysis: boolean;
  ol_tracking: boolean;
  defensive_player_tracking: boolean;
  advanced_situational: boolean;
  opponent_scouting: boolean;
  ai_play_recognition: boolean;
  ai_insights: boolean;
}

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_waived?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

// Tier hierarchy for comparison (ai_powered removed)
export const TIER_LEVELS: Record<SubscriptionTier, number> = {
  basic: 1,
  plus: 2,
  premium: 3
};

// Display names for tiers
export const TIER_DISPLAY_NAMES: Record<SubscriptionTier, string> = {
  basic: 'Basic',
  plus: 'Plus',
  premium: 'Premium'
};

// Minimum tier required for each feature
// NOTE: All features are available on all tiers. Tiers only differ by capacity limits
// (games/month, storage, retention, cameras, coaches). See tier-comparison.md for details.
export const FEATURE_MIN_TIERS: Record<Feature, SubscriptionTier> = {
  // All features available on all tiers
  playbook_builder: 'basic',
  film_upload: 'basic',
  basic_tagging: 'basic',
  drive_analytics: 'basic',
  player_stats: 'basic',
  situational_analysis: 'basic',
  ol_tracking: 'basic',
  defensive_player_tracking: 'basic',
  advanced_situational: 'basic',
  opponent_scouting: 'basic',

  // AI features - available on all tiers
  ai_play_recognition: 'basic',
  ai_insights: 'basic'
};

// Feature display names for UI
export const FEATURE_DISPLAY_NAMES: Record<Feature, string> = {
  playbook_builder: 'Playbook Builder',
  film_upload: 'Film Upload',
  basic_tagging: 'Basic Play Tagging',
  drive_analytics: 'Drive Analytics',
  player_stats: 'Player Statistics',
  situational_analysis: 'Situational Analysis',
  ol_tracking: 'O-Line Performance Tracking',
  defensive_player_tracking: 'Defensive Player Tracking',
  advanced_situational: 'Advanced Situational Analysis',
  opponent_scouting: 'Opponent Scouting Reports',
  ai_play_recognition: 'AI Play Recognition',
  ai_insights: 'AI-Generated Insights'
};

// Feature descriptions for upgrade prompts
export const FEATURE_DESCRIPTIONS: Record<Feature, string> = {
  playbook_builder: 'Create and manage your digital playbook',
  film_upload: 'Upload game film for analysis',
  basic_tagging: 'Tag plays with down, distance, and result',
  drive_analytics: 'Track drive efficiency, points per drive, and red zone performance',
  player_stats: 'Individual player statistics and performance tracking',
  situational_analysis: 'Analyze performance by down, distance, and field position',
  ol_tracking: 'Track offensive line block win rates and assignments',
  defensive_player_tracking: 'Track tackles, pressures, and coverage grades',
  advanced_situational: 'Motion effectiveness, play action, and blitz analysis',
  opponent_scouting: 'Generate opponent scouting reports and tendencies',
  ai_play_recognition: 'Automatic play recognition from game film',
  ai_insights: 'AI-generated coaching insights and recommendations'
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check if a subscription status allows feature access
 * Active, trialing, and past_due (grace period) all allow access
 * Waived billing also allows full access
 */
export function statusAllowsAccess(status: SubscriptionStatus, billingWaived?: boolean): boolean {
  if (billingWaived) return true;
  return ['active', 'trialing', 'past_due', 'waived'].includes(status);
}

/**
 * Check if a specific feature is accessible based on tier and status
 */
export function canAccessFeature(
  feature: Feature,
  subscription: SubscriptionInfo
): boolean {
  // First check if subscription status allows any access
  if (!statusAllowsAccess(subscription.status, subscription.billing_waived)) {
    return false;
  }

  // Then check if tier is high enough for this feature
  const minTier = FEATURE_MIN_TIERS[feature];
  const currentLevel = TIER_LEVELS[subscription.tier];
  const requiredLevel = TIER_LEVELS[minTier];

  return currentLevel >= requiredLevel;
}

/**
 * Get the minimum tier required for a feature
 */
export function getMinTierForFeature(feature: Feature): SubscriptionTier {
  return FEATURE_MIN_TIERS[feature];
}

/**
 * Get all features available for a tier (regardless of subscription status)
 */
export function getFeaturesForTier(tier: SubscriptionTier): Feature[] {
  const tierLevel = TIER_LEVELS[tier];

  return (Object.entries(FEATURE_MIN_TIERS) as [Feature, SubscriptionTier][])
    .filter(([_, minTier]) => TIER_LEVELS[minTier] <= tierLevel)
    .map(([feature]) => feature);
}

/**
 * Get all features NOT available for a tier (locked features)
 */
export function getLockedFeaturesForTier(tier: SubscriptionTier): Feature[] {
  const tierLevel = TIER_LEVELS[tier];

  return (Object.entries(FEATURE_MIN_TIERS) as [Feature, SubscriptionTier][])
    .filter(([_, minTier]) => TIER_LEVELS[minTier] > tierLevel)
    .map(([feature]) => feature);
}

/**
 * Compute full feature access object based on tier and status
 */
export function computeFeatureAccess(subscription: SubscriptionInfo): FeatureAccess {
  const hasAccess = statusAllowsAccess(subscription.status, subscription.billing_waived);
  const tierLevel = hasAccess ? TIER_LEVELS[subscription.tier] : 0;

  // All features are available on all tiers (tier level >= 1)
  // Tiers only differ by capacity limits (games, storage, retention, cameras, coaches)
  return {
    playbook_builder: tierLevel >= 1,
    film_upload: tierLevel >= 1,
    basic_tagging: tierLevel >= 1,
    drive_analytics: tierLevel >= 1,
    player_stats: tierLevel >= 1,
    situational_analysis: tierLevel >= 1,
    ol_tracking: tierLevel >= 1,
    defensive_player_tracking: tierLevel >= 1,
    advanced_situational: tierLevel >= 1,
    opponent_scouting: tierLevel >= 1,
    ai_play_recognition: tierLevel >= 1,
    ai_insights: tierLevel >= 1
  };
}

/**
 * Get the upgrade path - which tier to recommend for a locked feature
 */
export function getUpgradeTierForFeature(
  feature: Feature,
  currentTier: SubscriptionTier
): SubscriptionTier | null {
  const minTier = FEATURE_MIN_TIERS[feature];
  const currentLevel = TIER_LEVELS[currentTier];
  const requiredLevel = TIER_LEVELS[minTier];

  if (currentLevel >= requiredLevel) {
    return null; // No upgrade needed
  }

  return minTier;
}

/**
 * Compare two tiers and determine if an upgrade is available
 */
export function isUpgrade(fromTier: SubscriptionTier, toTier: SubscriptionTier): boolean {
  return TIER_LEVELS[toTier] > TIER_LEVELS[fromTier];
}

/**
 * Get all tiers higher than the current tier (possible upgrades)
 */
export function getUpgradeTiers(currentTier: SubscriptionTier): SubscriptionTier[] {
  const currentLevel = TIER_LEVELS[currentTier];
  const allTiers: SubscriptionTier[] = ['basic', 'plus', 'premium'];

  return allTiers.filter(tier => TIER_LEVELS[tier] > currentLevel);
}

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * Get a user-friendly message for why a feature is locked
 */
export function getLockedFeatureMessage(feature: Feature, currentTier: SubscriptionTier): string {
  const minTier = FEATURE_MIN_TIERS[feature];
  const minTierName = TIER_DISPLAY_NAMES[minTier];
  const featureName = FEATURE_DISPLAY_NAMES[feature];

  return `${featureName} requires ${minTierName} or higher. Upgrade your subscription to unlock this feature.`;
}

/**
 * Get a status message for display in UI
 */
export function getStatusMessage(status: SubscriptionStatus, billingWaived?: boolean): string {
  if (billingWaived) {
    return 'Billing waived - Full access granted';
  }

  switch (status) {
    case 'active':
      return 'Active subscription';
    case 'trialing':
      return 'Free trial active';
    case 'past_due':
      return 'Payment past due - Please update your payment method';
    case 'canceled':
      return 'Subscription canceled - Features limited';
    case 'waived':
      return 'Billing waived - Full access granted';
    case 'none':
    default:
      return 'No active subscription';
  }
}

/**
 * Determine if the user should see an upgrade prompt
 */
export function shouldShowUpgradePrompt(
  status: SubscriptionStatus,
  billingWaived?: boolean
): boolean {
  if (billingWaived) return false;
  return ['none', 'canceled'].includes(status);
}

/**
 * Determine if the user should see a payment warning
 */
export function shouldShowPaymentWarning(status: SubscriptionStatus): boolean {
  return status === 'past_due';
}
