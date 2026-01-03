'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Zap, Upload, Camera, Calendar, ChevronRight } from 'lucide-react';
import type { SubscriptionTier } from '@/types/admin';

interface SubscriptionData {
  tier: SubscriptionTier;
  tier_display_name: string;
  status: string;
  billing_waived: boolean;
  current_period_end: string | null;
  trial_ends_at: string | null;
  trial_days_remaining: number | null;
  monthly_cost_cents: number;
}

interface TierLimits {
  monthly_upload_tokens: number;
  max_cameras_per_game: number;
  retention_days: number;
}

interface SubscriptionBannerProps {
  teamId: string;
  isOwner: boolean;
  onManagePlan?: () => void;
  initialData?: SubscriptionData | null;
}

const TIER_COLORS: Record<SubscriptionTier, { bg: string; text: string; badge: string }> = {
  basic: { bg: 'bg-gray-100', text: 'text-gray-700', badge: 'bg-gray-200 text-gray-700' },
  plus: { bg: 'bg-amber-50', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-800' },
  premium: { bg: 'bg-purple-50', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-800' },
};

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  basic: { monthly_upload_tokens: 2, max_cameras_per_game: 1, retention_days: 30 },
  plus: { monthly_upload_tokens: 4, max_cameras_per_game: 3, retention_days: 90 },
  premium: { monthly_upload_tokens: 8, max_cameras_per_game: 5, retention_days: 365 },
};

export default function SubscriptionBanner({ teamId, isOwner, onManagePlan, initialData }: SubscriptionBannerProps) {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    // Skip fetch if initialData was provided
    if (initialData) {
      setSubscription(initialData);
      setLoading(false);
      return;
    }
    fetchSubscription();
  }, [teamId, initialData]);

  const fetchSubscription = async () => {
    try {
      const response = await fetch(`/api/console/teams/${teamId}`);
      if (response.ok) {
        const data = await response.json();
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-64"></div>
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const tier = subscription.tier as SubscriptionTier;
  const colors = TIER_COLORS[tier] || TIER_COLORS.basic;
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.basic;

  const formatRetention = (days: number): string => {
    if (days >= 365) return '1 year';
    if (days >= 180) return '6 months';
    if (days >= 30) return `${Math.floor(days / 30)} month${days >= 60 ? 's' : ''}`;
    return `${days} days`;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusDisplay = (): { text: string; color: string } | null => {
    if (subscription.status === 'trialing' && subscription.trial_days_remaining !== null) {
      return { text: `${subscription.trial_days_remaining} days left in trial`, color: 'text-blue-600' };
    }
    if (subscription.status === 'past_due') {
      return { text: 'Payment past due', color: 'text-red-600' };
    }
    if (subscription.billing_waived && tier !== 'basic') {
      return { text: 'Billing waived', color: 'text-green-600' };
    }
    return null;
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className={`${colors.bg} border border-gray-200 rounded-xl p-4 mb-6`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Tier Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.badge}`}>
            <Zap className="h-4 w-4" />
            <span className="font-semibold">{subscription.tier_display_name} Plan</span>
          </div>

          {/* Key Limits */}
          <div className="hidden sm:flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1.5">
              <Upload className="h-4 w-4 text-gray-400" />
              <span>{limits.monthly_upload_tokens} uploads/mo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-gray-400" />
              <span>{limits.max_cameras_per_game} camera{limits.max_cameras_per_game > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>{formatRetention(limits.retention_days)} retention</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Status/Renewal Info */}
          <div className="text-right hidden md:block">
            {statusDisplay ? (
              <span className={`text-sm font-medium ${statusDisplay.color}`}>
                {statusDisplay.text}
              </span>
            ) : subscription.current_period_end ? (
              <span className="text-sm text-gray-500">
                Renews {formatDate(subscription.current_period_end)}
              </span>
            ) : null}
          </div>

          {/* Manage Plan Button (Owner Only) */}
          {isOwner && (
            <button
              onClick={onManagePlan}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Manage Plan
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile: Show limits below */}
      <div className="flex sm:hidden items-center gap-4 mt-3 text-sm text-gray-600">
        <div className="flex items-center gap-1.5">
          <Upload className="h-4 w-4 text-gray-400" />
          <span>{limits.monthly_upload_tokens}/mo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Camera className="h-4 w-4 text-gray-400" />
          <span>{limits.max_cameras_per_game} cam</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span>{formatRetention(limits.retention_days)}</span>
        </div>
      </div>
    </div>
  );
}
