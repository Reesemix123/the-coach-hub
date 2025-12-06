'use client';

import { useState, useEffect } from 'react';
import { Check, Sparkles, Video, MessageSquare, Zap, Loader2, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { SubscriptionTier } from '@/types/admin';

interface PricingCardProps {
  tier: {
    id: SubscriptionTier;
    name: string;
    description: string;
    price_monthly: number;
    price_annual: number;
    annual_savings: number;
    ai_video_minutes: number;
    ai_text_actions: number | 'unlimited';
    max_coaches: number;
    storage_gb: number;
    features: string[];
    popular?: boolean;
    priority_processing?: boolean;
  };
  billingCycle: 'monthly' | 'annual';
  trialEnabled: boolean;
  trialAllowedTiers: SubscriptionTier[];
  trialDurationDays: number;
}

export default function PricingCard({
  tier,
  billingCycle,
  trialEnabled,
  trialAllowedTiers,
  trialDurationDays
}: PricingCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);

  const canTrial = trialEnabled && trialAllowedTiers.includes(tier.id);
  const isFree = tier.price_monthly === 0;
  const isAIPowered = tier.id === 'ai_powered';
  const hasAI = tier.ai_video_minutes > 0 || tier.ai_text_actions !== 0;

  const displayPrice = billingCycle === 'monthly' ? tier.price_monthly : tier.price_annual;
  const priceLabel = billingCycle === 'monthly' ? '/month' : '/year';

  // Check if user is logged in and has a team
  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);

        // Get user's first team
        const { data: teams } = await supabase
          .from('teams')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (teams && teams.length > 0) {
          setUserTeamId(teams[0].id);
        }
      }
    };

    checkUser();
  }, []);

  // Handle checkout
  const handleCheckout = async () => {
    // Basic tier is free - just redirect to signup/team creation
    if (isFree) {
      if (userId) {
        router.push('/setup');
      } else {
        router.push(`/auth/signup?tier=${tier.id}&billing=${billingCycle === 'annual' ? 'yearly' : 'monthly'}`);
      }
      return;
    }

    // For paid tiers:
    // If not logged in, redirect to signup
    if (!userId) {
      router.push(`/auth/signup?tier=${tier.id}&billing=${billingCycle === 'annual' ? 'yearly' : 'monthly'}`);
      return;
    }

    // If logged in but no team, redirect to setup
    if (!userTeamId) {
      router.push(`/setup?tier=${tier.id}&billing=${billingCycle === 'annual' ? 'yearly' : 'monthly'}`);
      return;
    }

    // User is logged in with a team - initiate checkout
    setIsLoading(true);

    try {
      const response = await fetch('/api/console/billing/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'subscription',
          team_id: userTeamId,
          tier: tier.id,
          billing_cycle: billingCycle === 'annual' ? 'yearly' : 'monthly'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      // On error, fall back to signup flow
      router.push(`/auth/signup?tier=${tier.id}&billing=${billingCycle === 'annual' ? 'yearly' : 'monthly'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Determine CTA text
  let ctaText = 'Get Started';
  if (canTrial) {
    ctaText = `Start ${trialDurationDays}-Day Free Trial`;
  } else if (isFree) {
    ctaText = 'Get Started Free';
  }

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border-2 p-8 transition-all duration-200 hover:shadow-xl ${
        tier.popular
          ? 'border-gray-900 bg-white'
          : 'border-gray-200 bg-white hover:border-gray-900'
      }`}
    >
      {/* Popular badge */}
      {tier.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-4 py-1 text-sm font-medium text-white">
            Most Popular
          </span>
        </div>
      )}

      {/* AI Powered badge */}
      {isAIPowered && !tier.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-1 text-sm font-medium text-white">
            <Sparkles className="h-3.5 w-3.5" />
            AI Powered
          </span>
        </div>
      )}

      {/* Tier name and description */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900">{tier.name}</h3>
        <p className="mt-2 text-sm text-gray-600">{tier.description}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-gray-900">
            ${displayPrice}
          </span>
          <span className="text-gray-600">{priceLabel}</span>
        </div>
        {billingCycle === 'annual' && tier.annual_savings > 0 && (
          <p className="mt-1 text-sm text-green-600 font-medium">
            Save ${tier.annual_savings}/year
          </p>
        )}
        {canTrial && (
          <p className="mt-1 text-sm text-green-600 font-medium">
            {trialDurationDays} days free, then ${billingCycle === 'monthly' ? tier.price_monthly : tier.price_annual}{priceLabel}
          </p>
        )}
        {isFree && (
          <p className="mt-1 text-sm text-gray-500">
            Free forever
          </p>
        )}
      </div>

      {/* Key stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Coaches</p>
          <p className="text-lg font-semibold text-gray-900">{tier.max_coaches}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Storage</p>
          <p className="text-lg font-semibold text-gray-900">{tier.storage_gb} GB</p>
        </div>
      </div>

      {/* AI Credits Section - only for tiers with AI */}
      {hasAI && (
        <div className="mb-6 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-semibold text-gray-900">AI Features</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              <Clock className="h-3 w-3" />
              Coming Soon
            </span>
          </div>
          <div className="space-y-2 opacity-75">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700">
                <span className="font-medium">{tier.ai_video_minutes}</span> AI film minutes/mo
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700">
                {tier.ai_text_actions === 'unlimited' ? (
                  <span className="font-medium text-purple-600">Unlimited</span>
                ) : (
                  <span className="font-medium">{tier.ai_text_actions}</span>
                )} AI actions/mo
              </span>
            </div>
          </div>
          <p className="text-xs text-purple-600 mt-2 font-medium">
            AI features launching early 2025
          </p>
        </div>
      )}

      {/* No AI badge for Basic tier */}
      {!hasAI && (
        <div className="mb-6 rounded-lg bg-gray-50 border border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-500">
            No AI features included
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Upgrade to Plus for AI capabilities
          </p>
        </div>
      )}

      {/* Features list */}
      <ul className="mb-8 flex-grow space-y-3">
        {tier.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check className="h-5 w-5 flex-shrink-0 text-green-600 mt-0.5" />
            <span className="text-sm text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={handleCheckout}
        disabled={isLoading}
        className={`block w-full rounded-lg px-6 py-3 text-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          tier.popular
            ? 'bg-gray-900 text-white hover:bg-gray-800'
            : 'border-2 border-gray-900 text-gray-900 bg-white group-hover:bg-gray-900 group-hover:text-white'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </span>
        ) : (
          ctaText
        )}
      </button>
    </div>
  );
}
