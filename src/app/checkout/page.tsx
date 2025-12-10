'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { SubscriptionTier } from '@/types/admin';
import { TIER_DISPLAY_NAMES } from '@/lib/feature-access';

// Tier pricing for display
const TIER_PRICES: Record<Exclude<SubscriptionTier, 'basic'>, { monthly: number; yearly: number }> = {
  plus: { monthly: 29, yearly: 290 },
  premium: { monthly: 79, yearly: 790 }
};

// Features by tier for display
const TIER_FEATURES: Record<Exclude<SubscriptionTier, 'basic'>, string[]> = {
  plus: [
    '4 game uploads/month',
    '3 camera angles per game',
    '180-day film retention',
    'Drive-by-drive analytics',
    'Player performance stats'
  ],
  premium: [
    '8 game uploads/month',
    '5 camera angles per game',
    '365-day film retention',
    'O-Line grading & tracking',
    'Opponent scouting reports'
  ]
};

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const tierParam = searchParams.get('tier') as SubscriptionTier | null;
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Validate tier (only plus and premium are valid paid tiers)
  const validPaidTiers: Exclude<SubscriptionTier, 'basic'>[] = ['plus', 'premium'];
  const selectedTier = tierParam && validPaidTiers.includes(tierParam as Exclude<SubscriptionTier, 'basic'>) ? tierParam as Exclude<SubscriptionTier, 'basic'> : null;

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser({ id: user.id, email: user.email || '' });
      }
      setCheckingAuth(false);
    }
    checkAuth();
  }, [supabase]);

  const handleCheckout = async () => {
    if (!selectedTier || !user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/signup-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: selectedTier,
          billing_cycle: billingCycle
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe
      window.location.href = data.url;
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setLoading(false);
    }
  };

  // Loading state
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Please Sign In
          </h2>
          <p className="text-gray-600">
            You need to be signed in to complete your subscription.
          </p>
          <Link
            href={`/auth/login?next=${encodeURIComponent(`/checkout?tier=${tierParam}`)}`}
            className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // Invalid tier
  if (!selectedTier) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Invalid Subscription Tier
          </h2>
          <p className="text-gray-600">
            Please select a valid subscription tier from our pricing page.
          </p>
          <Link
            href="/pricing"
            className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            View Pricing
          </Link>
        </div>
      </div>
    );
  }

  const price = TIER_PRICES[selectedTier];
  const features = TIER_FEATURES[selectedTier];
  const displayPrice = billingCycle === 'monthly' ? price.monthly : price.yearly;
  const savings = billingCycle === 'yearly' ? Math.round((price.monthly * 12 - price.yearly) / (price.monthly * 12) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            Youth Coach Hub
          </Link>
          <h1 className="mt-6 text-3xl font-extrabold text-gray-900">
            Complete Your Subscription
          </h1>
          <p className="mt-2 text-gray-600">
            You&apos;re signing up for the <span className="font-semibold">{TIER_DISPLAY_NAMES[selectedTier]}</span> plan
          </p>
        </div>

        {/* Plan Summary Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Plan Header */}
          <div className="bg-gray-900 text-white px-6 py-4">
            <h2 className="text-xl font-semibold">{TIER_DISPLAY_NAMES[selectedTier]}</h2>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  billingCycle === 'yearly'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Yearly
                {savings > 0 && (
                  <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                    Save {savings}%
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Price Display */}
          <div className="px-6 py-6 text-center border-b border-gray-200">
            <div className="text-4xl font-bold text-gray-900">
              ${displayPrice}
              <span className="text-lg font-normal text-gray-500">
                /{billingCycle === 'monthly' ? 'month' : 'year'}
              </span>
            </div>
            {billingCycle === 'yearly' && (
              <p className="text-sm text-gray-500 mt-1">
                Billed annually (${Math.round(price.yearly / 12)}/month)
              </p>
            )}
          </div>

          {/* Features List */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900 mb-3">Included Features:</h3>
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Account Info */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              Subscribing as: <span className="font-medium text-gray-900">{user.email}</span>
            </p>
          </div>

          {/* Checkout Button */}
          <div className="px-6 py-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Redirecting to checkout...' : `Subscribe for $${displayPrice}/${billingCycle === 'monthly' ? 'mo' : 'yr'}`}
            </button>

            <p className="mt-4 text-xs text-gray-500 text-center">
              You&apos;ll be redirected to Stripe for secure payment processing.
              You can cancel anytime from your team settings.
            </p>
          </div>
        </div>

        {/* Back to Pricing Link */}
        <div className="mt-6 text-center">
          <Link
            href="/pricing"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Choose a different plan
          </Link>
        </div>
      </div>
    </div>
  );
}

function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoading />}>
      <CheckoutContent />
    </Suspense>
  );
}
