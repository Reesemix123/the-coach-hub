'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { PlanTier } from '@/types/communication';
import { PLAN_TIER_PRICES, PLAN_TIER_LIMITS } from '@/types/communication';
import { isPaidCommHubPlan } from '@/lib/services/communication/plan-helpers';

// ---------------------------------------------------------------------------
// Tier ordering for comparison
// ---------------------------------------------------------------------------

const TIER_ORDER: PlanTier[] = ['sideline', 'rookie', 'varsity', 'all_conference', 'all_state'];

function tierIndex(tier: PlanTier): number {
  return TIER_ORDER.indexOf(tier);
}

// ---------------------------------------------------------------------------
// Feature definitions — tier-aware
// ---------------------------------------------------------------------------

const ROOKIE_FEATURES = [
  'Team messaging (coach \u2192 parents)',
  'Parent-to-parent messaging',
  'SMS + email notifications',
  'Scheduling + RSVP',
  'Roster management',
];

const PAID_EXTRA_FEATURES = [
  'Player clips shared to parents',
  'AI-generated performance reports',
  'Parent portal (PWA)',
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlanTierCardProps {
  tier: PlanTier;
  teamId: string;
  currentTier?: PlanTier | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays a single communication plan tier with tier-aware features,
 * current plan styling, and contextual CTA.
 */
export function PlanTierCard({ tier, teamId, currentTier }: PlanTierCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = PLAN_TIER_PRICES[tier];
  const maxParents = PLAN_TIER_LIMITS[tier];
  const name = TIER_LABELS[tier];
  const isPaid = isPaidCommHubPlan(tier);

  // Determine card state relative to current plan
  const isCurrentPlan = currentTier === tier;
  const isBelowCurrent = currentTier ? tierIndex(tier) < tierIndex(currentTier) : false;
  const isAboveCurrent = currentTier ? tierIndex(tier) > tierIndex(currentTier) : false;
  const isRecommended = tier === 'all_conference';

  // Features list
  const features = isPaid
    ? [...ROOKIE_FEATURES, ...PAID_EXTRA_FEATURES]
    : ROOKIE_FEATURES;

  async function handlePurchase() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/communication/plan/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, planTier: tier }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError('Something went wrong. Please refresh and try again, or contact support.');
        return;
      }

      const { url } = data as { url?: string };
      if (url) {
        window.location.href = url;
      }
    } catch {
      setError('Something went wrong. Please refresh and try again, or contact support.');
    } finally {
      setLoading(false);
    }
  }

  // --- Card border / opacity ---
  let cardClasses = 'rounded-xl border-2 p-6 flex flex-col transition-all';

  if (isCurrentPlan) {
    // Accent border for current plan
    cardClasses += ' border-[#B8CA6E] bg-white shadow-sm';
  } else if (isBelowCurrent) {
    // Grayed out
    cardClasses += ' border-gray-100 bg-gray-50 opacity-50';
  } else if (isRecommended) {
    // Highlighted recommended tier
    cardClasses += ' border-gray-900 bg-white shadow-lg';
  } else {
    cardClasses += ' border-gray-200 bg-white';
  }

  return (
    <div className={cardClasses}>
      {/* Badges */}
      <div className="flex items-center gap-2 mb-4 min-h-[24px]">
        {isCurrentPlan && (
          <span className="text-xs font-semibold text-[#1a1410] bg-[#B8CA6E] rounded-full px-3 py-1">
            Current Plan
          </span>
        )}
        {isRecommended && !isCurrentPlan && !isBelowCurrent && (
          <span className="text-xs font-semibold text-white bg-gray-900 rounded-full px-3 py-1">
            Most Popular
          </span>
        )}
      </div>

      <h3 className="text-xl font-bold text-gray-900">{name}</h3>
      <p className="text-sm text-gray-500 mt-1">
        {maxParents ? `Up to ${maxParents} parents` : 'Unlimited parents'}
      </p>

      <div className="mt-4 mb-6">
        {price === 0 ? (
          <span className="text-4xl font-bold text-gray-900">Free</span>
        ) : (
          <>
            <span className="text-4xl font-bold text-gray-900">${price}</span>
            <span className="text-gray-500 text-sm">/season</span>
          </>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-2 mb-6 flex-1">
        {isPaid && (
          <li className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
            Everything in Rookie, plus:
          </li>
        )}
        {(isPaid ? PAID_EXTRA_FEATURES : ROOKIE_FEATURES).map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            {feature}
          </li>
        ))}
        {!isPaid && null}
        {isPaid && (
          <li className="text-xs text-gray-400 mt-2 pl-6">
            + all Rookie features
          </li>
        )}
      </ul>

      {/* CTA */}
      {isCurrentPlan ? (
        <div className="w-full py-3 rounded-lg font-medium text-center text-sm border-2 border-[#B8CA6E] text-[#1a1410] bg-[#B8CA6E]/10">
          Current Plan
        </div>
      ) : isBelowCurrent ? (
        // No CTA for tiers below current
        null
      ) : (
        <button
          onClick={handlePurchase}
          disabled={loading}
          className={`
            w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2
            disabled:opacity-50
            ${
              isRecommended
                ? 'bg-black text-white hover:bg-gray-800'
                : price === 0
                ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
            }
          `}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {price === 0 ? 'Get Started Free' : `Upgrade to ${name}`}
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600 mt-2 text-center">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Display labels
// ---------------------------------------------------------------------------

const TIER_LABELS: Record<PlanTier, string> = {
  sideline: 'Sideline',
  rookie: 'Rookie',
  varsity: 'Varsity',
  all_conference: 'All-Conference',
  all_state: 'All-State',
};
