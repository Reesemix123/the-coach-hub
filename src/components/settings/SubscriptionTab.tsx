'use client';

import { useState, useEffect } from 'react';
import { Zap, Upload, Camera, Calendar, Check, Users, Clock, Loader2, CreditCard, ExternalLink, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import type { SubscriptionTier } from '@/types/admin';

interface SubscriptionData {
  tier: SubscriptionTier;
  tier_display_name: string;
  status: string;
  billing_waived: boolean;
  billing_waived_reason: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  trial_days_remaining: number | null;
  monthly_cost_cents: number;
}

interface TokenData {
  available: number;
  used_this_period: number;
  allocation: number;
}

interface TeamDetailData {
  team: {
    id: string;
    name: string;
    level: string;
    created_at: string;
  };
  subscription: SubscriptionData;
  upload_tokens: TokenData;
  usage: {
    games_count: number;
    plays_count: number;
    players_count: number;
    members_count: number;
  };
}

interface TierInfo {
  name: string;
  price: number;
  monthly_upload_tokens: number;
  team_tokens: number;
  opponent_tokens: number;
  max_cameras_per_game: number;
  retention_days: number;
  features: string[];
}

interface SubscriptionTabProps {
  teamId: string;
  isOwner: boolean;
  initialData?: TeamDetailData | null;
  showChangePlanOnMount?: boolean;
}

const TIER_INFO: Record<SubscriptionTier, TierInfo> = {
  basic: {
    name: 'Basic',
    price: 0,
    monthly_upload_tokens: 2,
    team_tokens: 1,
    opponent_tokens: 1,
    max_cameras_per_game: 1,
    retention_days: 30,
    features: [
      'Digital playbook builder',
      'Game film upload & storage',
      'Basic play tagging',
      'Team roster management',
    ],
  },
  plus: {
    name: 'Plus',
    price: 29,
    monthly_upload_tokens: 4,
    team_tokens: 2,
    opponent_tokens: 2,
    max_cameras_per_game: 3,
    retention_days: 90,
    features: [
      'Everything in Basic',
      'Multi-camera support',
      'Advanced analytics',
      'Opponent scouting tools',
      'Extended video retention',
    ],
  },
  premium: {
    name: 'Premium',
    price: 49,
    monthly_upload_tokens: 8,
    team_tokens: 4,
    opponent_tokens: 4,
    max_cameras_per_game: 5,
    retention_days: 365,
    features: [
      'Everything in Plus',
      'AI-powered play suggestions',
      'Automated film tagging',
      'Priority support',
      '1-year video retention',
    ],
  },
};

const TIER_COLORS: Record<SubscriptionTier, { bg: string; border: string; badge: string }> = {
  basic: { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700' },
  plus: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800' },
  premium: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800' },
};

export default function SubscriptionTab({ teamId, isOwner, initialData, showChangePlanOnMount }: SubscriptionTabProps) {
  const [data, setData] = useState<TeamDetailData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [showChangePlan, setShowChangePlan] = useState(showChangePlanOnMount || false);
  const [changingTier, setChangingTier] = useState<SubscriptionTier | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }
    fetchData();
  }, [teamId, initialData]);

  // Open modal when showChangePlanOnMount changes to true
  useEffect(() => {
    if (showChangePlanOnMount) {
      setShowChangePlan(true);
    }
  }, [showChangePlanOnMount]);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/console/teams/${teamId}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeTier = async (newTier: SubscriptionTier) => {
    if (!isOwner || !data) return;

    const currentTier = data.subscription.tier;
    if (newTier === currentTier) {
      setShowChangePlan(false);
      return;
    }

    setChangingTier(newTier);

    try {
      // For upgrading to paid tiers, redirect to Stripe checkout
      if (newTier !== 'basic' && (currentTier === 'basic' || data.subscription.billing_waived)) {
        const response = await fetch('/api/console/billing/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'subscription',
            team_id: teamId,
            tier: newTier,
            billing_cycle: 'monthly',
          }),
        });

        const result = await response.json();
        if (result.url) {
          window.location.href = result.url;
          return;
        }
      }

      // For other changes (downgrade, tier change while subscribed)
      const response = await fetch(`/api/console/teams/${teamId}/change-tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_tier: newTier }),
      });

      if (response.ok) {
        await fetchData();
        setShowChangePlan(false);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to change plan');
      }
    } catch (error) {
      console.error('Error changing tier:', error);
      alert('Failed to change plan');
    } finally {
      setChangingTier(null);
    }
  };

  const openStripePortal = async () => {
    setPortalLoading(true);
    setPortalError(null);

    try {
      const response = await fetch('/api/console/billing/stripe/portal', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      } else {
        const errData = await response.json();
        setPortalError(errData.message || errData.error || 'Failed to open billing portal');
        setPortalLoading(false);
      }
    } catch {
      setPortalError('Failed to connect to server');
      setPortalLoading(false);
    }
  };

  const formatRetention = (days: number): string => {
    if (days >= 365) return '1 year';
    if (days >= 180) return '6 months';
    if (days >= 30) return `${Math.floor(days / 30)} month${days >= 60 ? 's' : ''}`;
    return `${days} days`;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-48 bg-gray-100 rounded-lg"></div>
        <div className="h-32 bg-gray-100 rounded-lg"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Unable to load subscription data</p>
      </div>
    );
  }

  const { subscription } = data;
  const tier = subscription.tier as SubscriptionTier;
  const tierInfo = TIER_INFO[tier];
  const colors = TIER_COLORS[tier];

  const getStatusBadge = () => {
    if (subscription.status === 'trialing') {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
          Trial - {subscription.trial_days_remaining} days left
        </span>
      );
    }
    if (subscription.status === 'past_due') {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
          Past Due
        </span>
      );
    }
    if (subscription.billing_waived && tier !== 'basic') {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
          Waived
        </span>
      );
    }
    if (tier === 'basic') {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
          Free
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
        Active
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Current Plan Card */}
      <div className={`${colors.bg} border ${colors.border} rounded-xl p-6`}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.badge}`}>
                <Zap className="h-4 w-4" />
                <span className="font-semibold">{tierInfo.name} Plan</span>
              </div>
              {getStatusBadge()}
            </div>
            <p className="text-gray-600">
              {tier === 'basic'
                ? 'Get started with essential coaching tools'
                : tier === 'plus'
                ? 'Enhanced features for serious coaches'
                : 'Full-featured platform for competitive programs'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">
              ${tierInfo.price}
              <span className="text-base font-normal text-gray-500">/mo</span>
            </div>
            {subscription.current_period_end && !subscription.billing_waived && tier !== 'basic' && (
              <p className="text-sm text-gray-500 mt-1">
                Renews {formatDate(subscription.current_period_end)}
              </p>
            )}
          </div>
        </div>

        {/* Plan Limits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/60 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Upload className="h-4 w-4" />
              Film Uploads
            </div>
            <div className="text-2xl font-semibold text-gray-900">
              {tierInfo.monthly_upload_tokens}
              <span className="text-sm font-normal text-gray-500">/month</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {tierInfo.team_tokens} team + {tierInfo.opponent_tokens} opponent
            </div>
          </div>
          <div className="bg-white/60 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Camera className="h-4 w-4" />
              Cameras per Game
            </div>
            <div className="text-2xl font-semibold text-gray-900">
              {tierInfo.max_cameras_per_game}
            </div>
          </div>
          <div className="bg-white/60 rounded-lg p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Calendar className="h-4 w-4" />
              Video Retention
            </div>
            <div className="text-2xl font-semibold text-gray-900">
              {formatRetention(tierInfo.retention_days)}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="border-t border-gray-200/50 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Included Features</h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tierInfo.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Change Plan Button */}
        {isOwner && (
          <div className="mt-6 pt-4 border-t border-gray-200/50">
            <button
              onClick={() => setShowChangePlan(true)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Change Plan
            </button>
          </div>
        )}
      </div>

      {/* Payment Method Card (Owner Only, Paid Tiers) */}
      {isOwner && (
        <div className="border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Payment Method</h3>
          </div>

          {tier === 'basic' ? (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600">
                You&apos;re on the free Basic plan. No payment method required.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Upgrade to Plus or Premium to unlock more features and capacity.
              </p>
            </div>
          ) : subscription.billing_waived ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-medium text-green-800">Billing Waived</span>
              </div>
              <p className="text-sm text-green-700">
                {subscription.billing_waived_reason || 'Your billing has been waived by an administrator.'}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Manage your payment method through our secure payment partner, Stripe.
              </p>

              {portalError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{portalError}</p>
                </div>
              )}

              <button
                onClick={openStripePortal}
                disabled={portalLoading}
                className="flex items-center gap-2 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {portalLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opening Portal...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Manage Payment Method
                    <ExternalLink className="h-4 w-4" />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Change Plan Modal */}
      {showChangePlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Change Your Plan</h2>
              <p className="text-gray-600 mt-1">Select a plan that fits your coaching needs</p>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['basic', 'plus', 'premium'] as SubscriptionTier[]).map((tierKey) => {
                const info = TIER_INFO[tierKey];
                const tierColors = TIER_COLORS[tierKey];
                const isCurrentTier = tierKey === tier;

                return (
                  <div
                    key={tierKey}
                    className={`relative border-2 rounded-xl p-4 transition-all ${
                      isCurrentTier
                        ? `${tierColors.border} ${tierColors.bg}`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {isCurrentTier && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-2 py-0.5 bg-gray-900 text-white text-xs font-medium rounded-full">
                          Current
                        </span>
                      </div>
                    )}

                    <div className="text-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{info.name}</h3>
                      <div className="text-2xl font-bold text-gray-900 mt-1">
                        ${info.price}
                        <span className="text-sm font-normal text-gray-500">/mo</span>
                      </div>
                    </div>

                    <ul className="space-y-2 mb-4 text-sm">
                      <li className="flex items-start gap-2 text-gray-600">
                        <Upload className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span>
                          {info.monthly_upload_tokens} uploads/mo
                          <span className="block text-xs text-gray-500">
                            ({info.team_tokens} team + {info.opponent_tokens} opponent)
                          </span>
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-gray-600">
                        <Camera className="h-4 w-4 text-gray-400" />
                        {info.max_cameras_per_game} {info.max_cameras_per_game === 1 ? 'camera' : 'cameras'}
                      </li>
                      <li className="flex items-center gap-2 text-gray-600">
                        <Clock className="h-4 w-4 text-gray-400" />
                        {formatRetention(info.retention_days)} retention
                      </li>
                    </ul>

                    <button
                      onClick={() => handleChangeTier(tierKey)}
                      disabled={changingTier !== null}
                      className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                        isCurrentTier
                          ? 'bg-gray-100 text-gray-500 cursor-default'
                          : tierKey === 'plus'
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : tierKey === 'premium'
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      {changingTier === tierKey ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </span>
                      ) : isCurrentTier ? (
                        'Current Plan'
                      ) : tierKey === 'basic' ? (
                        'Downgrade'
                      ) : (
                        'Select'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowChangePlan(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Billing Info for non-owners */}
      {!isOwner && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900">Need to change your plan?</h4>
              <p className="text-sm text-gray-600 mt-1">
                Contact your team owner to upgrade or modify the subscription plan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-gray-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-gray-900">Need help with billing?</h4>
            <p className="text-sm text-gray-600 mt-1">
              If you have questions about your subscription, billing, or need assistance,{' '}
              <a
                href="/contact"
                className="text-gray-900 underline hover:text-gray-700"
              >
                contact us
              </a>
              {' '}and we&apos;ll be happy to help.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
