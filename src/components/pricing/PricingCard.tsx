'use client';

import { Check, Sparkles, Video, MessageSquare, Zap } from 'lucide-react';
import Link from 'next/link';
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
  const canTrial = trialEnabled && trialAllowedTiers.includes(tier.id);
  const isFree = tier.price_monthly === 0;
  const isAIPowered = tier.id === 'ai_powered';
  const hasAI = tier.ai_video_minutes > 0 || tier.ai_text_actions !== 0;

  const displayPrice = billingCycle === 'monthly' ? tier.price_monthly : tier.price_annual;
  const priceLabel = billingCycle === 'monthly' ? '/month' : '/year';

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
            {tier.priority_processing && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                <Zap className="h-3 w-3" />
                Priority
              </span>
            )}
          </div>
          <div className="space-y-2">
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
      <Link
        href={`/auth/signup?tier=${tier.id}&billing=${billingCycle}`}
        className={`block w-full rounded-lg px-6 py-3 text-center font-medium transition-colors ${
          tier.popular
            ? 'bg-gray-900 text-white hover:bg-gray-800'
            : 'border-2 border-gray-900 text-gray-900 bg-white group-hover:bg-gray-900 group-hover:text-white'
        }`}
      >
        {ctaText}
      </Link>
    </div>
  );
}
