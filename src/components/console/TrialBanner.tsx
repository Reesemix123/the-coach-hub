'use client';

import { useState, useEffect } from 'react';
import { Clock, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface TrialStatus {
  is_trialing: boolean;
  trial_ends_at?: string;
  days_remaining?: number;
  tier?: string;
  ai_credits_used?: number;
  ai_credits_limit?: number;
  status?: string;
}

interface TrialBannerProps {
  teamId: string;
  teamName?: string;
}

const TIER_LABELS: Record<string, string> = {
  basic: 'Basic',
  plus: 'Plus',
  premium: 'Premium',
  ai_powered: 'AI Powered'
};

export default function TrialBanner({ teamId, teamName }: TrialBannerProps) {
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrialStatus() {
      try {
        const response = await fetch(`/api/console/teams/${teamId}/trial-status`);
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (error) {
        console.error('Error fetching trial status:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTrialStatus();
  }, [teamId]);

  // Don't show if loading, no status, or not trialing
  if (loading || !status || !status.is_trialing) {
    return null;
  }

  const isUrgent = (status.days_remaining || 0) <= 3;
  const tierLabel = status.tier ? TIER_LABELS[status.tier] || status.tier : 'Unknown';

  return (
    <div className={`rounded-lg p-4 mb-6 ${
      isUrgent
        ? 'bg-orange-50 border border-orange-200'
        : 'bg-blue-50 border border-blue-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${isUrgent ? 'bg-orange-100' : 'bg-blue-100'}`}>
            <Clock className={`w-5 h-5 ${isUrgent ? 'text-orange-600' : 'text-blue-600'}`} />
          </div>
          <div>
            <p className={`font-medium ${isUrgent ? 'text-orange-900' : 'text-blue-900'}`}>
              {isUrgent && '⚠️ '}
              {teamName ? `${teamName}: ` : ''}Trial ends in {status.days_remaining} day{status.days_remaining !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-4 text-sm mt-1">
              <span className={isUrgent ? 'text-orange-700' : 'text-blue-700'}>
                {tierLabel} plan
              </span>
              <span className={`flex items-center gap-1 ${isUrgent ? 'text-orange-700' : 'text-blue-700'}`}>
                <Zap className="w-3 h-3" />
                AI Credits: {status.ai_credits_used || 0} / {status.ai_credits_limit || 0}
              </span>
            </div>
          </div>
        </div>
        <Link
          href={`/console/teams/${teamId}/billing`}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isUrgent
              ? 'bg-orange-600 text-white hover:bg-orange-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          Subscribe Now
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
