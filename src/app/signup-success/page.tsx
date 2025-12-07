'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { SubscriptionTier } from '@/types/admin';
import { TIER_DISPLAY_NAMES } from '@/lib/feature-access';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const tierParam = searchParams.get('tier') as SubscriptionTier | null;
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [countdown, setCountdown] = useState(5);

  // Validate tier for display
  const validTiers: SubscriptionTier[] = ['plus', 'premium', 'ai_powered'];
  const displayTier = tierParam && validTiers.includes(tierParam)
    ? TIER_DISPLAY_NAMES[tierParam]
    : 'your new plan';

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);

      // If authenticated, start countdown to redirect
      if (user) {
        const interval = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              router.push('/setup');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        return () => clearInterval(interval);
      }
    }
    checkAuth();
  }, [supabase, router]);

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-green-600"
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
        </div>

        {/* Header */}
        <Link href="/" className="text-2xl font-bold text-gray-900">
          Youth Coach Hub
        </Link>

        <h1 className="mt-6 text-3xl font-extrabold text-gray-900">
          Payment Successful!
        </h1>

        <p className="mt-4 text-lg text-gray-600">
          Welcome to <span className="font-semibold">{displayTier}</span>!
          Your subscription is now active.
        </p>

        {/* Content based on auth status */}
        {isAuthenticated ? (
          <div className="mt-8 space-y-4">
            <p className="text-gray-600">
              Redirecting you to set up your team in {countdown} seconds...
            </p>

            <Link
              href="/setup"
              className="inline-block px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Create Your Team Now
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="bg-gray-100 rounded-lg p-4">
              <p className="text-gray-700">
                Please sign in to access your new subscription and create your team.
              </p>
            </div>

            <Link
              href="/auth/login?next=/setup"
              className="inline-block px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Sign In to Continue
            </Link>
          </div>
        )}

        {/* What's Next Section */}
        <div className="mt-12 text-left bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">What&apos;s Next?</h2>
          <ul className="space-y-3">
            <li className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <span className="ml-3 text-gray-600">Create your team profile</span>
            </li>
            <li className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <span className="ml-3 text-gray-600">Build your digital playbook</span>
            </li>
            <li className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <span className="ml-3 text-gray-600">Upload game film for analysis</span>
            </li>
          </ul>
        </div>

        {/* Help Link */}
        <div className="mt-8">
          <p className="text-sm text-gray-500">
            Have questions? {' '}
            <Link href="/contact" className="text-gray-900 underline hover:no-underline">
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function SuccessLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  );
}

export default function SignupSuccessPage() {
  return (
    <Suspense fallback={<SuccessLoading />}>
      <SuccessContent />
    </Suspense>
  );
}
