'use client';

import { use, useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CreditCard, CheckCircle, X } from 'lucide-react';
import { PlanTierCard } from '@/components/communication/plan/PlanTierCard';
import { PlanStatusCard } from '@/components/communication/plan/PlanStatusCard';
import { PLAN_TIER_PRICES, PLAN_TIER_LIMITS } from '@/types/communication';
import type { PlanTier } from '@/types/communication';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanData {
  plan_tier: string;
  status: string;
  activated_at: string;
  expires_at: string;
  max_parents: number | null;
  parent_count: number;
  max_team_videos: number;
  team_videos_used: number;
  total_videos_remaining: number;
  days_remaining: number;
  coach_override_status: string | null;
}

interface PlanStatusResponse {
  has_plan: boolean;
  plan: PlanData | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIERS: Array<{ key: PlanTier; name: string; recommended?: boolean }> = [
  { key: 'rookie', name: 'Rookie' },
  { key: 'varsity', name: 'Varsity', recommended: true },
  { key: 'all_conference', name: 'All-Conference' },
  { key: 'all_state', name: 'All-State' },
];

// ---------------------------------------------------------------------------
// Inner component — reads search params (must be inside Suspense)
// ---------------------------------------------------------------------------

function PlanPageInner({ teamId }: { teamId: string }) {
  const searchParams = useSearchParams();
  const purchaseStatus = searchParams.get('purchase');

  const [plan, setPlan] = useState<PlanData | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showParentPrompt, setShowParentPrompt] = useState(false);

  const dismissParentPrompt = useCallback(() => {
    setShowParentPrompt(false);
    try { sessionStorage.setItem('parent_prompt_dismissed', '1'); } catch {}
  }, []);

  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch(`/api/communication/plan/status?teamId=${teamId}`);
        if (res.ok) {
          const data: PlanStatusResponse = await res.json();
          setHasPlan(data.has_plan);
          setPlan(data.plan);
        }
      } catch {
        // Non-fatal: page degrades to the "no plan" state
      } finally {
        setLoading(false);
      }
    }

    fetchPlan();

    // Check if we should show the parent onboarding prompt
    if (purchaseStatus === 'success') {
      const dismissed = sessionStorage.getItem('parent_prompt_dismissed');
      if (!dismissed) {
        fetch('/api/parent/athlete-profile-id')
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            // If athleteProfileId is null AND no parent profile exists, show prompt
            // The endpoint returns null if no parent_profiles row exists
            if (!data?.athleteProfileId) setShowParentPrompt(true);
          })
          .catch(() => {});
      }
    }
  }, [teamId, purchaseStatus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Post-checkout banners */}
        {purchaseStatus === 'success' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800 font-medium">
              Communication plan activated. You can now invite parents and start communicating.
            </p>
          </div>
        )}

        {purchaseStatus === 'success' && showParentPrompt && (
          <div className="mb-6 border border-[#e5e7eb] border-l-4 border-l-[#B8CA6E] rounded-xl p-4 relative">
            <button
              onClick={dismissParentPrompt}
              className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold text-gray-900 pr-8">
              Do you have a child on this team?
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Set up a parent profile to see their highlights and reports.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <Link
                href="/parent/athletes/new"
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#B8CA6E] text-[#1a1410] hover:brightness-105 transition-all"
              >
                Set up parent profile
              </Link>
              <button
                onClick={dismissParentPrompt}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                No thanks
              </button>
            </div>
          </div>
        )}

        {purchaseStatus === 'canceled' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              Checkout was canceled. You can try again below.
            </p>
          </div>
        )}

        {hasPlan && plan ? (
          /* Active plan view */
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
                <CreditCard className="w-7 h-7" />
                Communication Plan
              </h1>
            </div>
            <PlanStatusCard plan={plan} />
          </div>
        ) : (
          /* No plan — show tier selection */
          <div>
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-gray-900">
                Connect With Your Team&apos;s Families
              </h1>
              <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
                Choose a communication plan to unlock announcements, scheduling, video sharing, and
                more. All plans include full features — choose based on your roster size.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {TIERS.map((tier) => (
                <PlanTierCard
                  key={tier.key}
                  tier={tier.key}
                  name={tier.name}
                  price={PLAN_TIER_PRICES[tier.key]}
                  maxParents={PLAN_TIER_LIMITS[tier.key]}
                  isRecommended={tier.recommended}
                  teamId={teamId}
                />
              ))}
            </div>

            <p className="text-center text-sm text-gray-400 mt-8">
              All plans are billed as a one-time payment for a 6-month season. No recurring charges.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — unwraps params and wraps inner component in Suspense
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function PlanPage({ params }: PageProps) {
  const { teamId } = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
        </div>
      }
    >
      <PlanPageInner teamId={teamId} />
    </Suspense>
  );
}
