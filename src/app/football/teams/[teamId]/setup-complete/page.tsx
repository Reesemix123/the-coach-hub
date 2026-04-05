'use client';

import { use, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { PLAN_TIER_PRICES, PLAN_TIER_LIMITS } from '@/types/communication';
import type { PlanTier } from '@/types/communication';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommHubTierConfig {
  key: PlanTier;
  name: string;
  price: number;
  maxParents: number | null;
  features: string[];
  badge?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UPGRADE_TIERS: CommHubTierConfig[] = [
  {
    key: 'varsity',
    name: 'Varsity',
    price: PLAN_TIER_PRICES.varsity,
    maxParents: PLAN_TIER_LIMITS.varsity,
    features: [
      '10 shared videos / season',
      'AI game reports',
      'SMS + email notifications',
      'Family RSVP tracking',
      'All Rookie features',
    ],
  },
  {
    key: 'all_conference',
    name: 'All-Conference',
    price: PLAN_TIER_PRICES.all_conference,
    maxParents: PLAN_TIER_LIMITS.all_conference,
    features: [
      '10 shared videos / season',
      'AI game reports',
      'SMS + email notifications',
      'Family RSVP tracking',
      'All Rookie features',
    ],
    badge: 'Most Popular',
  },
  {
    key: 'all_state',
    name: 'All-State',
    price: PLAN_TIER_PRICES.all_state,
    maxParents: PLAN_TIER_LIMITS.all_state,
    features: [
      '10 shared videos / season',
      'AI game reports',
      'SMS + email notifications',
      'Family RSVP tracking',
      'All Rookie features',
    ],
  },
];

// ---------------------------------------------------------------------------
// Tier card
// ---------------------------------------------------------------------------

interface TierCardProps {
  config: CommHubTierConfig;
  teamId: string;
}

function TierCard({ config, teamId }: TierCardProps) {
  const [loading, setLoading] = useState(false);

  async function handleChoose() {
    setLoading(true);
    try {
      const res = await fetch('/api/communication/plan/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, planTier: config.key }),
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

  const isPopular = config.badge === 'Most Popular';

  return (
    <div
      className={`relative flex flex-col rounded-xl border p-6 backdrop-blur-sm transition-all ${
        isPopular
          ? 'border-[#B8CA6E]/60 bg-[#201a16]/80 ring-1 ring-[#B8CA6E]/30'
          : 'border-white/10 bg-[#201a16]/60 hover:border-white/20'
      }`}
    >
      {config.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-[#B8CA6E] px-3 py-0.5 text-xs font-semibold text-[#1a1410]">
            {config.badge}
          </span>
        </div>
      )}

      <h3 className="text-lg font-bold text-white">{config.name}</h3>
      <p className="mt-1 text-sm text-gray-400">
        {config.maxParents ? `Up to ${config.maxParents} parents` : 'Unlimited parents'}
      </p>

      <div className="mt-4 mb-5">
        <span className="text-3xl font-bold text-white">${config.price}</span>
        <span className="ml-1 text-sm text-gray-400">/season</span>
      </div>

      <ul className="mb-6 flex-1 space-y-2">
        {config.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-gray-300">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#B8CA6E]" />
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={handleChoose}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#B8CA6E] px-4 py-3 text-sm font-semibold text-[#1a1410] transition-all hover:brightness-105 disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Choose Plan
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner component — reads search params (must be inside Suspense)
// ---------------------------------------------------------------------------

function SetupCompleteInner({ teamId }: { teamId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const purchaseSuccess = searchParams.get('purchase') === 'success';
  const filmSuccess = searchParams.get('film') === 'success';

  const [teamName, setTeamName] = useState<string | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(true);

  useEffect(() => {
    async function fetchTeamName() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('teams')
          .select('name')
          .eq('id', teamId)
          .single();
        setTeamName(data?.name ?? null);
      } catch {
        // Non-fatal — heading will render without team name
      } finally {
        setLoadingTeam(false);
      }
    }

    fetchTeamName();
  }, [teamId]);

  // If returning from a successful comm hub Stripe checkout, redirect to dashboard
  useEffect(() => {
    if (purchaseSuccess) {
      const timer = setTimeout(() => {
        router.push(`/football/teams/${teamId}/communication/plan?purchase=success`);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [purchaseSuccess, teamId, router]);

  const dashboardHref = `/football/teams/${teamId}`;

  if (purchaseSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a1410] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#B8CA6E]/20">
            <Check className="h-8 w-8 text-[#B8CA6E]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Plan activated!</h1>
          <p className="mt-2 text-gray-400">Taking you to your team now...</p>
          <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-gray-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1410] px-4 py-12">
      <div className="mx-auto max-w-4xl">

        {/* Film checkout success banner */}
        {filmSuccess && (
          <div className="mb-8 flex items-center gap-3 rounded-lg border border-[#B8CA6E]/30 bg-[#B8CA6E]/10 p-4">
            <Check className="h-5 w-5 flex-shrink-0 text-[#B8CA6E]" />
            <p className="text-sm font-medium text-[#B8CA6E]">
              Film plan activated. Your team is ready to go.
            </p>
          </div>
        )}

        {/* Hero heading */}
        <div className="mb-10 text-center">
          {loadingTeam ? (
            <div className="mx-auto mb-3 h-8 w-48 animate-pulse rounded bg-white/10" />
          ) : (
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-[#B8CA6E]">
              {teamName ?? 'Your team'} is ready
            </p>
          )}
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Want to connect with parents?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-gray-400">
            Replace the group text. Send announcements, share schedules, track RSVPs, and message
            parents — all in one place.
          </p>
        </div>

        {/* Upgrade tier cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {UPGRADE_TIERS.map((config) => (
            <TierCard key={config.key} config={config} teamId={teamId} />
          ))}
        </div>

        {/* Rookie note */}
        <p className="mt-6 text-center text-xs text-gray-500">
          Your team already has the free Rookie plan (20 parents, messaging, schedule). Upgrade for
          video sharing, AI reports, and more parents.
        </p>
        <p className="mt-1.5 text-center text-xs text-gray-600">
          All plans are a one-time payment for a 6-month season. No recurring charges.
        </p>

        {/* Skip button */}
        <div className="mt-8">
          <Link
            href={dashboardHref}
            className="block w-full rounded-lg border border-white/20 px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-white/5"
          >
            Skip — take me to my team
          </Link>
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — unwraps params and wraps inner in Suspense
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default function SetupCompletePage({ params }: PageProps) {
  const { teamId } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#1a1410]">
          <Loader2 className="h-10 w-10 animate-spin text-gray-500" />
        </div>
      }
    >
      <SetupCompleteInner teamId={teamId} />
    </Suspense>
  );
}
