'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { useParams, useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import Link from 'next/link';
import ConsoleNav from '@/components/console/ConsoleNav';
import {
  Users,
  Trophy,
  Film,
  AlertCircle,
  ChevronLeft,
  Settings,
  Clock,
  CreditCard,
  Upload,
  Calendar,
  ExternalLink,
  XCircle,
  CheckCircle,
  Zap
} from 'lucide-react';

interface TeamDetailData {
  team: {
    id: string;
    name: string;
    level: string;
    created_at: string;
  };
  subscription: {
    tier: string;
    tier_display_name: string;
    status: string;
    billing_waived: boolean;
    billing_waived_reason: string | null;
    current_period_end: string | null;
    trial_ends_at: string | null;
    trial_days_remaining: number | null;
    monthly_cost_cents: number;
  };
  usage: {
    games_count: number;
    plays_count: number;
    players_count: number;
    members_count: number;
  };
  upload_tokens: {
    available: number;
    used_this_period: number;
    allocation: number;
  };
  recent_games: Array<{
    id: string;
    name: string;
    opponent: string | null;
    date: string | null;
    plays_count: number;
    created_at: string;
  }>;
}

interface TierConfigValue {
  name: string;
  description: string;
  price_monthly: number;
  features: string[];
}

// Valid tiers and token allocation
const validTiers = ['basic', 'plus', 'premium'];
const tierTokens: Record<string, number> = {
  'basic': 2,
  'plus': 4,
  'premium': 8
};

export default function ConsoleTeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.teamId as string;

  const [user, setUser] = useState<User | null>(null);
  const [teamData, setTeamData] = useState<TeamDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [tierConfigs, setTierConfigs] = useState<Record<string, TierConfigValue> | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [teamId]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Load team data and billing data in parallel
      const [teamResponse, billingResponse] = await Promise.all([
        fetch(`/api/console/teams/${teamId}`),
        fetch('/api/console/billing')
      ]);

      if (teamResponse.ok) {
        const data = await teamResponse.json();
        setTeamData(data);
      } else {
        const errData = await teamResponse.json();
        setError(errData.error || 'Failed to load team');
      }

      // Get tier configs from billing data
      if (billingResponse.ok) {
        const billingData = await billingResponse.json();
        if (billingData.tier_configs) {
          setTierConfigs(billingData.tier_configs);
        }
      }
    } catch (err) {
      setError('Failed to connect to server');
    }

    setLoading(false);
  }

  async function handleChangePlan(newTier: string) {
    if (newTier === teamData?.subscription.tier) {
      setShowPlanModal(false);
      return;
    }

    setChangingPlan(true);

    try {
      const response = await fetch('/api/console/billing/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          team_id: teamId,
          tier: newTier,
          billing_cycle: 'monthly'
        })
      });

      const data = await response.json();

      if (response.ok && data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        alert(data.error || data.message || 'Failed to change plan');
      }
    } catch (err) {
      alert('Failed to connect to server');
    }

    setChangingPlan(false);
  }

  function formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function getSubscriptionBadge() {
    if (!teamData) return null;

    const { status, billing_waived, trial_days_remaining } = teamData.subscription;

    if (billing_waived || status === 'waived') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
          Billing Waived
        </span>
      );
    }

    if (status === 'trialing' && trial_days_remaining !== null) {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
          <Clock className="w-4 h-4" />
          Trial ({trial_days_remaining} days left)
        </span>
      );
    }

    if (status === 'active') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          Active
        </span>
      );
    }

    if (status === 'past_due') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-4 h-4" />
          Past Due
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
        {status || 'No Subscription'}
      </span>
    );
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
            <p className="text-gray-600">Loading team...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!user) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <h1 className="text-3xl font-semibold text-gray-900 mb-3">Sign in required</h1>
            <p className="text-gray-600 mb-8">Please sign in to access the console.</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (error) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">Error Loading Team</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => { setError(null); loadData(); }}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              Try Again
            </button>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!teamData) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <p className="text-gray-600">Team not found</p>
        </div>
      </AuthGuard>
    );
  }

  const tokenUsagePercent = teamData.upload_tokens.allocation > 0
    ? Math.round(((teamData.upload_tokens.allocation - teamData.upload_tokens.available) / teamData.upload_tokens.allocation) * 100)
    : 0;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center gap-4 mb-4">
              <Link
                href="/console/teams"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
                    {teamData.team.name}
                  </h1>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                    {teamData.team.level}
                  </span>
                  {getSubscriptionBadge()}
                </div>
                <p className="text-gray-600 mt-2">
                  Created {formatDate(teamData.team.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/teams/${teamId}`}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Team
                </Link>
                <Link
                  href={`/teams/${teamId}/settings`}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                >
                  <Settings className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Console Navigation */}
        <ConsoleNav />

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Trophy className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-sm text-gray-600">Games</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                {teamData.usage.games_count}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Film className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-sm text-gray-600">Plays Tagged</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                {teamData.usage.plays_count.toLocaleString()}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Users className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-sm text-gray-600">Members</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                {teamData.usage.members_count}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <CreditCard className="w-4 h-4 text-gray-600" />
                </div>
                <span className="text-sm text-gray-600">Monthly Cost</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900">
                {teamData.subscription.billing_waived
                  ? '$0.00'
                  : formatCurrency(teamData.subscription.monthly_cost_cents)
                }
              </div>
            </div>
          </div>

          {/* Resources Section */}
          <div className="mb-8">
            {/* Film Uploads Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Film Uploads</h3>
                <Upload className="w-5 h-5 text-gray-400" />
              </div>
              <div className="mb-4">
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-semibold text-gray-900">
                    {teamData.upload_tokens.available}
                  </span>
                  <span className="text-gray-500 mb-1">
                    of {teamData.upload_tokens.allocation} remaining
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      teamData.upload_tokens.available <= 1
                        ? 'bg-red-500'
                        : teamData.upload_tokens.available <= Math.ceil(teamData.upload_tokens.allocation / 2)
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(tokenUsagePercent, 100)}%` }}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {teamData.upload_tokens.used_this_period} used this period
              </p>
            </div>
          </div>

          {/* Subscription Details */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Subscription Details</h3>
              <button
                onClick={() => setShowPlanModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Zap className="w-4 h-4" />
                Change Plan
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Plan</p>
                <p className="font-medium text-gray-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  {teamData.subscription.tier_display_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <p className="font-medium text-gray-900 capitalize">
                  {teamData.subscription.billing_waived ? 'Waived' : teamData.subscription.status}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">
                  {teamData.subscription.status === 'trialing' ? 'Trial Ends' : 'Renews'}
                </p>
                <p className="font-medium text-gray-900">
                  {teamData.subscription.status === 'trialing'
                    ? formatDate(teamData.subscription.trial_ends_at)
                    : formatDate(teamData.subscription.current_period_end)
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Monthly Cost</p>
                <p className="font-medium text-gray-900">
                  {teamData.subscription.billing_waived
                    ? '$0.00 (waived)'
                    : formatCurrency(teamData.subscription.monthly_cost_cents)
                  }
                </p>
              </div>
            </div>
            {teamData.subscription.billing_waived && teamData.subscription.billing_waived_reason && (
              <p className="text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
                Waiver reason: {teamData.subscription.billing_waived_reason}
              </p>
            )}
          </div>

          {/* Recent Games */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Games</h3>
            {teamData.recent_games.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
                <Trophy className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No games yet</p>
                <Link
                  href={`/teams/${teamId}/film`}
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                >
                  <Upload className="w-4 h-4" />
                  Upload First Game
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {teamData.recent_games.map((game) => (
                  <Link
                    key={game.id}
                    href={`/teams/${teamId}/film/${game.id}/tag`}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Trophy className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{game.name}</p>
                        <p className="text-sm text-gray-500">
                          {game.opponent ? `vs ${game.opponent}` : 'No opponent'}
                          {game.date && ` · ${formatDate(game.date)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        {game.plays_count} plays tagged
                      </span>
                      <Calendar className="w-4 h-4 text-gray-400" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Change Plan Modal */}
        {showPlanModal && tierConfigs && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">Change Plan</h2>
                    <p className="text-gray-600 mt-1">
                      Select a new plan for {teamData?.team.name}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPlanModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(tierConfigs)
                    .filter(([tierId]) => validTiers.includes(tierId))
                    .sort((a, b) => {
                      const order = { basic: 0, plus: 1, premium: 2 };
                      return (order[a[0] as keyof typeof order] || 0) - (order[b[0] as keyof typeof order] || 0);
                    })
                    .map(([tierId, config]) => {
                      const isCurrentPlan = teamData?.subscription.tier === tierId;
                      const isBasic = tierId === 'basic';

                      return (
                        <div
                          key={tierId}
                          className={`relative border rounded-xl p-5 transition-all ${
                            isCurrentPlan
                              ? 'border-black bg-gray-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {isCurrentPlan && (
                            <div className="absolute -top-3 left-4 px-2 py-0.5 bg-black text-white text-xs font-medium rounded">
                              Current Plan
                            </div>
                          )}
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {config.name}
                          </h3>
                          <p className="text-sm text-gray-600 mb-3">
                            {config.description}
                          </p>
                          <p className="text-3xl font-semibold text-gray-900 mb-4">
                            {formatCurrency(config.price_monthly)}
                            <span className="text-sm font-normal text-gray-500">/mo</span>
                          </p>

                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Upload className="w-4 h-4 text-purple-500" />
                              {tierTokens[tierId] || 4} film uploads/month
                            </div>
                          </div>

                          {config.features.length > 0 && (
                            <ul className="space-y-1 mb-4 text-sm">
                              {config.features.slice(0, 3).map((feature, i) => (
                                <li key={i} className="flex items-start gap-2 text-gray-600">
                                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          )}

                          <button
                            onClick={() => isBasic ? alert('Basic tier is free - contact support to downgrade') : handleChangePlan(tierId)}
                            disabled={isCurrentPlan || changingPlan}
                            className={`w-full py-2.5 px-4 rounded-lg font-medium transition-colors ${
                              isCurrentPlan
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : isBasic
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                : 'bg-black text-white hover:bg-gray-800'
                            }`}
                          >
                            {changingPlan ? (
                              <span className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Processing...
                              </span>
                            ) : isCurrentPlan ? (
                              'Current Plan'
                            ) : isBasic ? (
                              'Contact Support'
                            ) : (
                              'Select Plan'
                            )}
                          </button>
                        </div>
                      );
                    })}
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Note:</strong> Upgrading will start a new billing cycle.
                    For downgrades or cancellations, please contact support.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
