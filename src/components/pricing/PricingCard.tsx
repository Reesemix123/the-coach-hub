'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2, Upload, Camera, Calendar } from 'lucide-react';
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
    monthly_upload_tokens: number;
    max_cameras_per_game: number;
    retention_days: number;
    features: string[];
  };
  billingCycle: 'monthly' | 'annual';
}

export default function PricingCard({
  tier,
  billingCycle
}: PricingCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);

  const isFree = tier.price_monthly === 0;
  const isPopular = tier.id === 'plus'; // Highlight the Plus tier

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
  const ctaText = isFree ? 'Get Started Free' : 'Get Started';

  // Helper to format retention days
  const formatRetention = (days: number): string => {
    if (days >= 365) return '1 year';
    if (days >= 180) return '6 months';
    if (days >= 30) return `${Math.floor(days / 30)} month${days >= 60 ? 's' : ''}`;
    return `${days} days`;
  };

  // Calculate games per type (tokens split evenly between team and opponent)
  const gamesPerType = tier.monthly_upload_tokens / 2;

  return (
    <div
      className={`group relative flex flex-col rounded-2xl p-8 transition-all duration-200 backdrop-blur-sm ${
        isPopular
          ? 'border-2 border-[#B8CA6E]/50 bg-[#201a16]/70 shadow-lg shadow-[#B8CA6E]/10'
          : 'border border-white/10 bg-[#201a16]/60 hover:border-[#B8CA6E]/30'
      }`}
    >
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 bg-[#B8CA6E] text-[#1a1410] text-xs font-semibold rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {/* Tier name and description */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white">{tier.name}</h3>
        <p className="mt-2 text-sm text-gray-400">{tier.description}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-white">
            ${displayPrice}
          </span>
          <span className="text-gray-400">{priceLabel}</span>
        </div>
        {billingCycle === 'annual' && tier.annual_savings > 0 && (
          <p className="mt-1 text-sm text-[#B8CA6E] font-medium">
            Save ${tier.annual_savings}/year
          </p>
        )}
        {isFree && (
          <p className="mt-1 text-sm text-gray-500">
            Free forever
          </p>
        )}
      </div>

      {/* Key stats - New metrics */}
      <div className="mb-6 space-y-3 rounded-xl bg-[#1a1410]/50 border border-white/5 p-4">
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-300">Games per Month</span>
            </div>
            <span className="text-lg font-semibold text-white">{tier.monthly_upload_tokens}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            {gamesPerType} team + {gamesPerType} opponent
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-300">Cameras per Game</span>
          </div>
          <span className="text-lg font-semibold text-white">{tier.max_cameras_per_game}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-300">Game Retention</span>
          </div>
          <span className="text-lg font-semibold text-white">{formatRetention(tier.retention_days)}</span>
        </div>
      </div>

      {/* Features list */}
      <ul className="mb-8 flex-grow space-y-3">
        {tier.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check className="h-5 w-5 flex-shrink-0 text-[#B8CA6E] mt-0.5" />
            <span className="text-sm text-gray-300/80">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={handleCheckout}
        disabled={isLoading}
        className={`block w-full rounded-xl px-6 py-4 text-center font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          isPopular
            ? 'bg-[#B8CA6E] text-[#1a1410] hover:bg-[#c9d88a]'
            : 'border border-white/20 text-white hover:bg-white/10'
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
