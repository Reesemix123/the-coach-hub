'use client';

import { useState } from 'react';
import PricingCard from './PricingCard';
import { SubscriptionTier } from '@/types/admin';

export interface PricingTier {
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
}

interface PricingGridProps {
  tiers: PricingTier[];
  trialEnabled: boolean;
  trialAllowedTiers: SubscriptionTier[];
  trialDurationDays: number;
}

export default function PricingGrid({
  tiers,
  trialEnabled,
  trialAllowedTiers,
  trialDurationDays
}: PricingGridProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  return (
    <div>
      {/* Billing Toggle */}
      <div className="flex justify-center mb-10">
        <div className="relative bg-gray-100 rounded-full p-1 flex">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`relative z-10 px-6 py-2 text-sm font-medium rounded-full transition-colors ${
              billingCycle === 'monthly'
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`relative z-10 px-6 py-2 text-sm font-medium rounded-full transition-colors ${
              billingCycle === 'annual'
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Annual
            <span className="ml-1.5 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Save 17%
            </span>
          </button>
          {/* Sliding background */}
          <div
            className={`absolute inset-y-1 w-[calc(50%-4px)] bg-gray-900 rounded-full transition-transform duration-200 ${
              billingCycle === 'annual' ? 'translate-x-full' : 'translate-x-0'
            }`}
            style={{ left: '4px' }}
          />
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {tiers.map((tier) => (
          <PricingCard
            key={tier.id}
            tier={tier}
            billingCycle={billingCycle}
            trialEnabled={trialEnabled}
            trialAllowedTiers={trialAllowedTiers}
            trialDurationDays={trialDurationDays}
          />
        ))}
      </div>
    </div>
  );
}
