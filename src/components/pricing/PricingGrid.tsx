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
  monthly_upload_tokens: number;
  max_cameras_per_game: number;
  retention_days: number;
  features: string[];
}

interface PricingGridProps {
  tiers: PricingTier[];
}

export default function PricingGrid({
  tiers
}: PricingGridProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  return (
    <div>
      {/* Billing Toggle */}
      <div className="flex justify-center items-center gap-3 mb-10">
        <div className="relative bg-brand-surface rounded-full p-1 flex border border-gray-800">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`relative z-10 px-6 py-2 text-sm font-medium rounded-full transition-colors ${
              billingCycle === 'monthly'
                ? 'text-brand-dark'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`relative z-10 px-6 py-2 text-sm font-medium rounded-full transition-colors ${
              billingCycle === 'annual'
                ? 'text-brand-dark'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Annual
          </button>
          {/* Sliding background */}
          <div
            className={`absolute inset-y-1 w-[calc(50%-4px)] bg-brand-green rounded-full transition-transform duration-200 ${
              billingCycle === 'annual' ? 'translate-x-full' : 'translate-x-0'
            }`}
            style={{ left: '4px' }}
          />
        </div>
        <span className="inline-flex items-center rounded-full bg-brand-green/10 border border-brand-green/20 px-2.5 py-1 text-xs font-medium text-brand-green">
          Save 17%
        </span>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {tiers.map((tier) => (
          <PricingCard
            key={tier.id}
            tier={tier}
            billingCycle={billingCycle}
          />
        ))}
      </div>
    </div>
  );
}
