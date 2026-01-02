'use client';

import { useState, Suspense } from 'react';
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

  // Validate tier param (only 3 tiers: basic, plus, premium)
  const validTiers: SubscriptionTier[] = ['basic', 'plus', 'premium'];
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
    <div className="min-h-screen bg-[#0d1117] -mt-24">
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/logo-darkmode.png"
            alt="Youth Coach Hub"
            className="h-10 w-auto"
          />
          <span className="text-white font-semibold text-lg tracking-tight">
            youth<span className="text-[#a3e635]">coach</span>hub
          </span>
        </Link>
        <div className="flex items-center gap-8">
          <Link href="/#features" className="text-gray-400 hover:text-white transition-colors text-sm">Features</Link>
          <Link href="/pricing" className="text-gray-400 hover:text-white transition-colors text-sm">Pricing</Link>
          <Link href="/auth/login" className="text-gray-400 hover:text-white transition-colors text-sm">Log In</Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white">
              Create your account
            </h2>
            {tierDisplayName && !isInviteFlow && (
              <p className="mt-2 text-sm text-gray-400">
                Selected plan: <span className="font-semibold text-[#a3e635]">{tierDisplayName}</span>
              </p>
            )}
            {isInviteFlow && (
              <p className="mt-2 text-sm text-gray-400">
                You&apos;ve been invited to join a team
              </p>
            )}
            {!selectedTier && !isInviteFlow && (
              <p className="mt-2 text-sm text-gray-400">
                <Link href="/pricing" className="text-[#a3e635] hover:text-[#bef264] transition-colors">
                  View pricing plans
                </Link>
              </p>
            )}
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
            <div className="rounded-2xl bg-[#161b22] border border-gray-800 p-6 space-y-5">
              {/* Full Name (optional) */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-2">
                  Full name <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0d1117] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] focus:outline-none transition-colors"
                  placeholder="Coach Smith"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
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
                  className="w-full px-4 py-3 bg-[#0d1117] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] focus:outline-none transition-colors"
                  placeholder="coach@school.edu"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
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
                  className="w-full px-4 py-3 bg-[#0d1117] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] focus:outline-none transition-colors"
                  placeholder="At least 8 characters"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
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
                  className="w-full px-4 py-3 bg-[#0d1117] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635] focus:outline-none transition-colors"
                  placeholder="Confirm your password"
                />
                <div className="mt-3 flex items-center">
                  <input
                    id="show-password"
                    name="show-password"
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="h-4 w-4 bg-[#0d1117] border-gray-700 rounded text-[#a3e635] focus:ring-[#a3e635] focus:ring-offset-0"
                  />
                  <label htmlFor="show-password" className="ml-2 text-sm text-gray-400">
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
                  className="h-4 w-4 mt-1 bg-[#0d1117] border-gray-700 rounded text-[#a3e635] focus:ring-[#a3e635] focus:ring-offset-0"
                />
                <label htmlFor="terms" className="ml-2 block text-sm text-gray-400">
                  I agree to the{' '}
                  <Link href="/terms" className="text-[#a3e635] hover:text-[#bef264] transition-colors">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-[#a3e635] hover:text-[#bef264] transition-colors">
                    Privacy Policy
                  </Link>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#a3e635] text-[#0d1117] font-semibold rounded-xl hover:bg-[#bef264] transition-all disabled:opacity-50 shadow-lg shadow-[#a3e635]/20"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </div>

            {/* Message */}
            {message && (
              <div className={`text-sm text-center ${messageType === 'error' ? 'text-red-400' : 'text-[#a3e635]'}`}>
                {message}
              </div>
            )}

            {/* Sign In Link */}
            <div className="text-center">
              <p className="text-sm text-gray-400">
                Already have an account?{' '}
                <Link
                  href="/auth/login"
                  className="text-[#a3e635] font-medium hover:text-[#bef264] transition-colors"
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
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                &larr; Back to pricing
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-gray-800 mt-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img
                src="/logo-darkmode.png"
                alt="Youth Coach Hub"
                className="h-8 w-auto"
              />
              <span className="text-white font-semibold tracking-tight">
                youth<span className="text-[#a3e635]">coach</span>hub
              </span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-8">
              <Link href="/about" className="text-gray-400 hover:text-white transition-colors text-sm">About</Link>
              <Link href="/contact" className="text-gray-400 hover:text-white transition-colors text-sm">Contact</Link>
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors text-sm">Privacy</Link>
              <Link href="/terms" className="text-gray-400 hover:text-white transition-colors text-sm">Terms</Link>
            </div>

            {/* Copyright */}
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} Youth Coach Hub
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Loading fallback
function SignUpLoading() {
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center -mt-24">
      <div className="text-gray-400">Loading...</div>
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
