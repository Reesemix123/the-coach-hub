'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { Play, Gift } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useGlobalOnboardingSafe } from '@/components/onboarding/GlobalOnboardingProvider';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [trialSubmitting, setTrialSubmitting] = useState(false);
  const [trialMessage, setTrialMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [trialReason, setTrialReason] = useState('');
  const supabase = createClient();
  const onboarding = useGlobalOnboardingSafe();

  useEffect(() => {
    checkUserTeams();
  }, []);

  async function handleRequestTrial() {
    setTrialSubmitting(true);
    setTrialMessage(null);

    try {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Redirect to login with return URL
        router.push('/auth/login?returnTo=/&requestTrial=true');
        return;
      }

      // Submit trial request
      const response = await fetch('/api/trial-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_tier: 'hs_basic',
          reason: trialReason || null
        })
      });

      const result = await response.json();

      if (response.ok) {
        setTrialMessage({
          type: 'success',
          text: 'Trial request submitted! An admin will review your request shortly.'
        });
        setTrialReason('');
      } else {
        setTrialMessage({
          type: 'error',
          text: result.error || 'Failed to submit request'
        });
      }
    } catch (error) {
      console.error('Error requesting trial:', error);
      setTrialMessage({
        type: 'error',
        text: 'Something went wrong. Please try again.'
      });
    } finally {
      setTrialSubmitting(false);
    }
  }

  async function checkUserTeams() {
    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in - show homepage
        setLoading(false);
        return;
      }

      // Check if user owns any teams
      const { data: ownedTeams } = await supabase
        .from('teams')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (ownedTeams && ownedTeams.length > 0) {
        // User has a team - redirect to first team
        router.push(`/teams/${ownedTeams[0].id}`);
        return;
      }

      // Check for teams user is a member of (invited coaches)
      const { data: memberTeams } = await supabase
        .from('team_memberships')
        .select('team_id')
        .eq('user_id', user.id)
        .limit(1);

      if (memberTeams && memberTeams.length > 0) {
        // User is a member of a team - redirect to that team
        router.push(`/teams/${memberTeams[0].team_id}`);
        return;
      }

      // User is logged in but has no teams - redirect to setup
      router.push('/setup');
    } catch (error) {
      console.error('Error checking teams:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="bg-white">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-8 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-semibold text-gray-900 mb-4 tracking-tight">
            Football Coaching
            <span className="block mt-2">Made More Efficient</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            So you can do what matters most: COACH
          </p>

          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onboarding?.startDemoTour()}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                <Play className="h-4 w-4" />
                Take a Tour
              </button>
              <button
                onClick={() => setShowTrialModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <Gift className="h-4 w-4" />
                Request Free Trial
              </button>
            </div>
            <Link
              href="/pricing"
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors font-medium"
            >
              View solutions and pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-3xl font-semibold text-gray-900 text-center mb-12">
            Everything you need to coach effectively
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="text-center">
              <div className="mb-6">
                <svg className="w-12 h-12 text-gray-900 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Team Management</h3>
              <p className="text-gray-600 leading-relaxed">
                Organize your teams, track rosters, and manage schedules all in one place.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6">
                <svg className="w-12 h-12 text-gray-900 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Digital Playbook</h3>
              <p className="text-gray-600 leading-relaxed">
                Build and organize your playbook with visual diagrams and play codes.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6">
                <svg className="w-12 h-12 text-gray-900 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Game Planning</h3>
              <p className="text-gray-600 leading-relaxed">
                Create game plans, build wristbands, and organize practice schedules.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6">
                <svg className="w-12 h-12 text-gray-900 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Film Analysis</h3>
              <p className="text-gray-600 leading-relaxed">
                Upload and review game film, tag plays, and track performance analytics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trial Request Modal */}
      {showTrialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Gift className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Request Free Trial</h2>
                <p className="text-sm text-gray-500">14-day full access to all features</p>
              </div>
            </div>

            {trialMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                trialMessage.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {trialMessage.text}
              </div>
            )}

            {!trialMessage?.type || trialMessage.type !== 'success' ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Why are you interested in trying The Coach Hub? (optional)
                  </label>
                  <textarea
                    value={trialReason}
                    onChange={(e) => setTrialReason(e.target.value)}
                    placeholder="e.g., I coach a youth football team and want to organize our playbook..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowTrialModal(false);
                      setTrialMessage(null);
                      setTrialReason('');
                    }}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    disabled={trialSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestTrial}
                    disabled={trialSubmitting}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {trialSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => {
                  setShowTrialModal(false);
                  setTrialMessage(null);
                }}
                className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}