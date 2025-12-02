'use client';

// src/components/FeatureGate.tsx
// A component wrapper that gates features based on subscription tier

import React from 'react';
import { useRouter } from 'next/navigation';
import { useFeature, useFeatureAccess } from '@/hooks/useFeatureAccess';
import {
  Feature,
  FEATURE_DISPLAY_NAMES,
  FEATURE_DESCRIPTIONS,
  TIER_DISPLAY_NAMES,
  getMinTierForFeature
} from '@/lib/feature-access';

interface FeatureGateProps {
  teamId: string;
  feature: Feature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

/**
 * FeatureGate - Conditionally renders children based on feature access
 *
 * Usage:
 * <FeatureGate teamId={teamId} feature="drive_analytics">
 *   <DriveAnalytics />
 * </FeatureGate>
 */
export function FeatureGate({
  teamId,
  feature,
  children,
  fallback,
  showUpgradePrompt = true
}: FeatureGateProps) {
  const { hasAccess, loading, lockedMessage, requiredTier } = useFeature(teamId, feature);
  const router = useRouter();

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg h-32 flex items-center justify-center">
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  // Default locked state UI
  return (
    <LockedFeatureCard
      feature={feature}
      requiredTier={requiredTier}
      teamId={teamId}
    />
  );
}

/**
 * LockedFeatureCard - Display shown when a feature is locked
 */
interface LockedFeatureCardProps {
  feature: Feature;
  requiredTier: string;
  teamId: string;
}

export function LockedFeatureCard({ feature, requiredTier, teamId }: LockedFeatureCardProps) {
  const router = useRouter();
  const featureName = FEATURE_DISPLAY_NAMES[feature];
  const featureDescription = FEATURE_DESCRIPTIONS[feature];
  const tierName = TIER_DISPLAY_NAMES[requiredTier as keyof typeof TIER_DISPLAY_NAMES] || requiredTier;

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-gray-200 rounded-lg">
          <svg
            className="w-6 h-6 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{featureName}</h3>
          <p className="text-gray-600 text-sm mb-4">{featureDescription}</p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              Requires <span className="font-medium text-gray-700">{tierName}</span> or higher
            </span>
            <button
              onClick={() => router.push(`/teams/${teamId}/settings`)}
              className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
            >
              Upgrade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * UpgradeBanner - A banner component to show at the top of a page/section
 */
interface UpgradeBannerProps {
  teamId: string;
  message?: string;
}

export function UpgradeBanner({ teamId, message }: UpgradeBannerProps) {
  const { showUpgradePrompt, showPaymentWarning, statusMessage } = useFeatureAccess(teamId);
  const router = useRouter();

  if (!showUpgradePrompt && !showPaymentWarning) {
    return null;
  }

  return (
    <div
      className={`p-4 rounded-lg mb-6 flex items-center justify-between ${
        showPaymentWarning
          ? 'bg-yellow-50 border border-yellow-200'
          : 'bg-blue-50 border border-blue-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <svg
          className={`w-5 h-5 ${showPaymentWarning ? 'text-yellow-600' : 'text-blue-600'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {showPaymentWarning ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          )}
        </svg>
        <span className={`text-sm ${showPaymentWarning ? 'text-yellow-800' : 'text-blue-800'}`}>
          {message || statusMessage}
        </span>
      </div>
      <button
        onClick={() => router.push(`/teams/${teamId}/settings`)}
        className={`px-4 py-2 text-sm rounded-lg transition-colors ${
          showPaymentWarning
            ? 'bg-yellow-600 text-white hover:bg-yellow-700'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {showPaymentWarning ? 'Update Payment' : 'View Plans'}
      </button>
    </div>
  );
}

/**
 * useRequireFeature - Hook to check feature access and optionally redirect
 */
export function useRequireFeature(teamId: string, feature: Feature, redirectOnLocked = false) {
  const featureAccess = useFeature(teamId, feature);
  const router = useRouter();

  React.useEffect(() => {
    if (redirectOnLocked && !featureAccess.loading && !featureAccess.hasAccess) {
      router.push(`/teams/${teamId}/settings`);
    }
  }, [featureAccess.loading, featureAccess.hasAccess, redirectOnLocked, teamId, router]);

  return featureAccess;
}

export default FeatureGate;
