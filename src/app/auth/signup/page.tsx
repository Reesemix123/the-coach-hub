'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { SubscriptionTier } from '@/types/admin';
import { TIER_DISPLAY_NAMES } from '@/lib/feature-access';

// Wrap the main component to use useSearchParams
function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const supabase = createClient();

  // Get URL params
  const tierParam = searchParams.get('tier') as SubscriptionTier | null;
  const inviteParam = searchParams.get('invite');

  // Validate tier param
  const validTiers: SubscriptionTier[] = ['basic', 'plus', 'premium', 'ai_powered'];
  const selectedTier = tierParam && validTiers.includes(tierParam) ? tierParam : null;

  // Determine flow type
  const isInviteFlow = !!inviteParam;
  const isNewTeamFlow = !!selectedTier && !isInviteFlow;

  // Get tier display name
  const tierDisplayName = selectedTier ? TIER_DISPLAY_NAMES[selectedTier] : null;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      setMessageType('error');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters');
      setMessageType('error');
      setLoading(false);
      return;
    }

    // Validate terms acceptance
    if (!acceptedTerms) {
      setMessage('Please accept the terms of service');
      setMessageType('error');
      setLoading(false);
      return;
    }

    try {
      // Build the redirect URL with tier parameter if selected
      let redirectUrl = `${window.location.origin}/auth/callback`;
      if (selectedTier) {
        redirectUrl += `?next=${encodeURIComponent(`/setup?tier=${selectedTier}`)}`;
      } else if (inviteParam) {
        redirectUrl += `?next=${encodeURIComponent(`/setup?invite=${inviteParam}`)}`;
      }

      // Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || null,
            selected_tier: selectedTier,
            invite_code: inviteParam
          },
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        setMessage(error.message);
        setMessageType('error');
        setLoading(false);
        return;
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        // Email confirmation required
        setMessage('Check your email for a confirmation link to complete your registration.');
        setMessageType('success');
        setLoading(false);
        return;
      }

      // User is signed up and logged in
      if (data.session) {
        // Route based on flow type
        if (isInviteFlow && inviteParam) {
          // Process invite and redirect to team
          // The invite processing will happen in the callback or via API
          router.push(`/auth/callback?invite=${inviteParam}`);
        } else if (selectedTier) {
          // New team flow - redirect to setup with tier
          router.push(`/setup?tier=${selectedTier}`);
        } else {
          // No tier selected - redirect to pricing
          router.push('/pricing');
        }
        router.refresh();
      }
    } catch (err) {
      console.error('Signup error:', err);
      setMessage('An unexpected error occurred. Please try again.');
      setMessageType('error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link href="/" className="block text-center text-2xl font-bold text-gray-900 mb-6">
            Youth Coach Hub
          </Link>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          {tierDisplayName && !isInviteFlow && (
            <p className="mt-2 text-center text-sm text-gray-600">
              Selected plan: <span className="font-semibold">{tierDisplayName}</span>
            </p>
          )}
          {isInviteFlow && (
            <p className="mt-2 text-center text-sm text-gray-600">
              You&apos;ve been invited to join a team
            </p>
          )}
          {!selectedTier && !isInviteFlow && (
            <p className="mt-2 text-center text-sm text-gray-600">
              <Link href="/pricing" className="text-gray-900 underline hover:no-underline">
                View pricing plans
              </Link>
            </p>
          )}
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
          {/* Full Name (optional) */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
              Full name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black text-gray-900"
              placeholder="Coach Smith"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black text-gray-900"
              placeholder="coach@school.edu"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black text-gray-900"
              placeholder="At least 8 characters"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black text-gray-900"
              placeholder="Confirm your password"
            />
            <div className="mt-2 flex items-center">
              <input
                id="show-password"
                name="show-password"
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="h-4 w-4 text-gray-900 border-gray-300 rounded focus:ring-black"
              />
              <label htmlFor="show-password" className="ml-2 text-sm text-gray-600">
                Show password
              </label>
            </div>
          </div>

          {/* Terms of Service */}
          <div className="flex items-start">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="h-4 w-4 mt-1 text-gray-900 border-gray-300 rounded focus:ring-black"
            />
            <label htmlFor="terms" className="ml-2 block text-sm text-gray-700">
              I agree to the{' '}
              <Link href="/terms" className="text-gray-900 underline hover:no-underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-gray-900 underline hover:no-underline">
                Privacy Policy
              </Link>
            </label>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>

          {/* Message */}
          {message && (
            <div className={`text-sm ${messageType === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </div>
          )}

          {/* Sign In Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                href="/auth/login"
                className="text-gray-900 font-medium underline hover:no-underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </form>

        {/* Back to pricing */}
        {!isInviteFlow && (
          <div className="text-center">
            <Link
              href="/pricing"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; Back to pricing
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// Loading fallback
function SignUpLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  );
}

// Export the page with Suspense boundary
export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpLoading />}>
      <SignUpForm />
    </Suspense>
  );
}
