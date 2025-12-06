// /billing/success - Post-checkout success page
// Shows confirmation after successful Stripe checkout

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { CheckCircle, Loader2, ArrowRight, Play, Film, Users } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [tierName, setTierName] = useState<string | null>(null);

  const teamId = searchParams.get('team');
  const tier = searchParams.get('tier');

  useEffect(() => {
    const fetchDetails = async () => {
      const supabase = createClient();

      // Check authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Get team name if teamId provided
      if (teamId) {
        const { data: team } = await supabase
          .from('teams')
          .select('name')
          .eq('id', teamId)
          .single();

        if (team) {
          setTeamName(team.name);
        }
      }

      // Map tier to display name
      const tierNames: Record<string, string> = {
        plus: 'Plus',
        premium: 'Premium',
        ai_powered: 'AI Powered'
      };
      if (tier) {
        setTierName(tierNames[tier] || tier);
      }

      setLoading(false);
    };

    fetchDetails();
  }, [teamId, tier, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Welcome to {tierName || 'Your New Plan'}!
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-8">
          {teamName ? (
            <>Your subscription for <span className="font-medium">{teamName}</span> is now active.</>
          ) : (
            <>Your subscription is now active and ready to use.</>
          )}
        </p>

        {/* What's Next Section */}
        <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">
            What's Next
          </h2>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Play className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Build Your Playbook</p>
                <p className="text-sm text-gray-600">Create plays with our visual play builder</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Film className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Upload Game Film</p>
                <p className="text-sm text-gray-600">Tag plays and track performance</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Add Your Roster</p>
                <p className="text-sm text-gray-600">Track player stats and participation</p>
              </div>
            </li>
          </ul>
        </div>

        {/* CTA Button */}
        {teamId ? (
          <Link
            href={`/teams/${teamId}`}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            Go to Team Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            href="/console"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            Go to Console
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}

        {/* Support Link */}
        <p className="mt-6 text-sm text-gray-500">
          Questions?{' '}
          <Link href="/contact" className="text-gray-900 underline hover:no-underline">
            Contact support
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
