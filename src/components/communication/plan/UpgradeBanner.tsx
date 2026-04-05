'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { PLAN_TIER_PRICES, PLAN_TIER_LIMITS } from '@/types/communication';
import type { PlanTier } from '@/types/communication';

// ---------------------------------------------------------------------------
// Display labels
// ---------------------------------------------------------------------------

const TIER_LABELS: Record<string, string> = {
  sideline: 'Sideline',
  rookie: 'Rookie',
  varsity: 'Varsity',
  all_conference: 'All-Conference',
  all_state: 'All-State',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UpgradeBannerProps {
  /** Current tier key returned by the API */
  currentTier: string;
  /** Max parents on the current plan */
  maxParents: number;
  /** How many parents (active + pending) the team currently has */
  currentCount: number;
  /** Next tier key, or null if already at max */
  nextTier: string | null;
  /** Team ID for checkout redirect */
  teamId: string;
  /** Called when the user dismisses the banner */
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Inline banner shown when a coach hits the parent invite limit.
 * Persists until explicitly dismissed. Shows current usage, next tier info,
 * and a CTA to upgrade.
 */
export function UpgradeBanner({
  currentTier,
  maxParents,
  currentCount,
  nextTier,
  teamId,
  onDismiss,
}: UpgradeBannerProps) {
  const [loading, setLoading] = useState(false);

  const currentLabel = TIER_LABELS[currentTier] ?? currentTier;

  // Derive next tier info from centralized constants
  const nextLabel = nextTier ? (TIER_LABELS[nextTier] ?? nextTier) : null;
  const nextPrice = nextTier ? PLAN_TIER_PRICES[nextTier as PlanTier] : null;
  const nextLimit = nextTier ? PLAN_TIER_LIMITS[nextTier as PlanTier] : null;

  async function handleUpgrade() {
    if (!nextTier) return;
    setLoading(true);
    try {
      const res = await fetch('/api/communication/plan/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, planTier: nextTier }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert((data as { error?: string }).error ?? 'Failed to start checkout');
        return;
      }

      const { url } = data as { url?: string };
      if (url) {
        window.location.href = url;
      }
    } catch {
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900">
            You&apos;ve reached the {maxParents}-parent limit on your {currentLabel} plan
          </p>
          <p className="text-sm text-amber-700 mt-1">
            You currently have {currentCount} parents (active + pending invites).
            {nextTier && nextLabel && nextPrice !== null && (
              <>
                {' '}Upgrade to <strong>{nextLabel}</strong> for ${nextPrice}/season
                {nextLimit ? ` (up to ${nextLimit} parents)` : ' (unlimited parents)'}.
              </>
            )}
          </p>

          {nextTier && (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Upgrade to {nextLabel}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={onDismiss}
          className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
