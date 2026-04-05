/**
 * Communication Plan Helper Utilities
 * Pure functions for plan tier logic — no database calls
 */

import type { PlanTier } from '@/types/communication';
import { PLAN_TIER_LIMITS } from '@/types/communication';

// Tier ordering for comparisons and upgrade paths
const TIER_ORDER: PlanTier[] = ['sideline', 'rookie', 'varsity', 'all_conference', 'all_state'];

const FREE_TIERS: PlanTier[] = ['sideline', 'rookie'];
const PAID_TIERS: PlanTier[] = ['varsity', 'all_conference', 'all_state'];

/** Video sharing limits per tier (0 = no video sharing for free tiers) */
const TIER_VIDEO_LIMITS: Record<PlanTier, number> = {
  sideline: 0,
  rookie: 0,
  varsity: 10,
  all_conference: 10,
  all_state: 10,
};

/** Whether the tier includes AI-generated reports */
const TIER_INCLUDES_REPORTS: Record<PlanTier, boolean> = {
  sideline: false,
  rookie: false,
  varsity: true,
  all_conference: true,
  all_state: true,
};

/** Returns true if the tier requires Stripe payment */
export function isPaidCommHubPlan(tier: PlanTier): boolean {
  return PAID_TIERS.includes(tier);
}

/** Returns true if the tier is free (sideline or rookie) */
export function isFreeCommHubPlan(tier: PlanTier): boolean {
  return FREE_TIERS.includes(tier);
}

/** Get the next upgrade tier, or null if already at max */
export function getNextTier(currentTier: PlanTier): PlanTier | null {
  const idx = TIER_ORDER.indexOf(currentTier);
  if (idx === -1 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

/** Get the first paid tier (for upgrade prompts from free plans) */
export function getFirstPaidTier(): PlanTier {
  return 'varsity';
}

/** Get max_team_videos for a given tier */
export function getVideoLimitForTier(tier: PlanTier): number {
  return TIER_VIDEO_LIMITS[tier];
}

/** Get includes_reports for a given tier */
export function getIncludesReportsForTier(tier: PlanTier): boolean {
  return TIER_INCLUDES_REPORTS[tier];
}

/** Get parent limit for a given tier */
export function getParentLimitForTier(tier: PlanTier): number | null {
  return PLAN_TIER_LIMITS[tier];
}

/**
 * Build the insert payload for activating a free (rookie) plan on a new team.
 * Uses sentinel values for NOT NULL columns that normally come from Stripe.
 */
export function buildFreePlanInsert(teamId: string, ownerUserId: string, tier: PlanTier = 'rookie') {
  return {
    team_id: teamId,
    purchased_by: ownerUserId,
    purchaser_role: 'owner' as const,
    stripe_payment_id: 'free_tier',
    stripe_product_id: null,
    plan_tier: tier,
    max_parents: getParentLimitForTier(tier),
    max_team_videos: getVideoLimitForTier(tier),
    team_videos_used: 0,
    includes_reports: getIncludesReportsForTier(tier),
    activated_at: new Date().toISOString(),
    expires_at: '2099-12-31T23:59:59.000Z',
    status: 'active' as const,
  };
}
