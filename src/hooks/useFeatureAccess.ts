'use client';

// src/hooks/useFeatureAccess.ts
// React hook for checking feature access based on team subscription

import { useState, useEffect, useCallback } from 'react';
import { SubscriptionTier, SubscriptionStatus } from '@/types/admin';
import {
  Feature,
  FeatureAccess,
  canAccessFeature,
  computeFeatureAccess,
  getLockedFeatureMessage,
  getStatusMessage,
  shouldShowUpgradePrompt,
  shouldShowPaymentWarning,
  getMinTierForFeature,
  TIER_DISPLAY_NAMES,
  TIER_LEVELS
} from '@/lib/feature-access';

// ============================================================================
// Types
// ============================================================================

interface SubscriptionData {
  team_id: string;
  tier: SubscriptionTier;
  tier_display_name: string;
  status: SubscriptionStatus;
  billing_waived: boolean;
  billing_waived_reason?: string | null;
  trial_days_remaining: number | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  features: FeatureAccess;
  can_access_features: boolean;
  upgrade_required: boolean;
}

interface UseFeatureAccessReturn {
  // Loading/error state
  loading: boolean;
  error: string | null;

  // Subscription data
  subscription: SubscriptionData | null;
  tier: SubscriptionTier | null;
  status: SubscriptionStatus | null;

  // Feature access
  features: FeatureAccess | null;
  canAccess: (feature: Feature) => boolean;
  getLockedMessage: (feature: Feature) => string;

  // UI helpers
  showUpgradePrompt: boolean;
  showPaymentWarning: boolean;
  statusMessage: string;
  tierDisplayName: string;

  // Trial info
  isTrialing: boolean;
  trialDaysRemaining: number | null;

  // Refetch
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useFeatureAccess(teamId: string | null): UseFeatureAccessReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!teamId) {
      setLoading(false);
      setSubscription(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/subscription`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch subscription');
      }

      const data: SubscriptionData = await response.json();
      setSubscription(data);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  // Fetch on mount and when teamId changes
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Feature access check function
  const canAccess = useCallback(
    (feature: Feature): boolean => {
      if (!subscription) return false;

      return canAccessFeature(feature, {
        tier: subscription.tier,
        status: subscription.status,
        billing_waived: subscription.billing_waived
      });
    },
    [subscription]
  );

  // Get locked message for a feature
  const getLockedMessage = useCallback(
    (feature: Feature): string => {
      if (!subscription) {
        return 'Subscribe to access this feature';
      }
      return getLockedFeatureMessage(feature, subscription.tier);
    },
    [subscription]
  );

  // Compute derived values
  const tier = subscription?.tier ?? null;
  const status = subscription?.status ?? null;
  const features = subscription?.features ?? null;

  const showUpgradePrompt = subscription
    ? shouldShowUpgradePrompt(subscription.status, subscription.billing_waived)
    : false;

  const showPaymentWarning = subscription
    ? shouldShowPaymentWarning(subscription.status)
    : false;

  const statusMessage = subscription
    ? getStatusMessage(subscription.status, subscription.billing_waived)
    : 'Loading...';

  const tierDisplayName = tier ? TIER_DISPLAY_NAMES[tier] : '';

  const isTrialing = status === 'trialing';
  const trialDaysRemaining = subscription?.trial_days_remaining ?? null;

  return {
    loading,
    error,
    subscription,
    tier,
    status,
    features,
    canAccess,
    getLockedMessage,
    showUpgradePrompt,
    showPaymentWarning,
    statusMessage,
    tierDisplayName,
    isTrialing,
    trialDaysRemaining,
    refetch: fetchSubscription
  };
}

// ============================================================================
// Additional Hooks
// ============================================================================

/**
 * Hook to check a single feature with a simpler API
 */
export function useFeature(teamId: string | null, feature: Feature) {
  const { canAccess, loading, error, getLockedMessage, tier } = useFeatureAccess(teamId);

  return {
    hasAccess: canAccess(feature),
    loading,
    error,
    lockedMessage: getLockedMessage(feature),
    requiredTier: getMinTierForFeature(feature),
    currentTier: tier
  };
}

/**
 * Hook to get upgrade info for a team
 */
export function useUpgradeInfo(teamId: string | null) {
  const { subscription, tier, status, showUpgradePrompt, loading, error } = useFeatureAccess(teamId);

  const upgradeTiers = tier
    ? (['basic', 'plus', 'premium', 'ai_powered'] as SubscriptionTier[]).filter(
        t => TIER_LEVELS[t] > TIER_LEVELS[tier]
      )
    : [];

  return {
    loading,
    error,
    currentTier: tier,
    currentTierName: tier ? TIER_DISPLAY_NAMES[tier] : null,
    status,
    needsSubscription: showUpgradePrompt,
    availableUpgrades: upgradeTiers.map(t => ({
      tier: t,
      name: TIER_DISPLAY_NAMES[t]
    })),
    billingWaived: subscription?.billing_waived ?? false,
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
    periodEnd: subscription?.current_period_end ?? null
  };
}

export default useFeatureAccess;
