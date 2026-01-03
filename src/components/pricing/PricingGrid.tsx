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
  const [highlightedTier, setHighlightedTier] = useState<SubscriptionTier>('plus');

  return (
    <div>
      {/* Billing Toggle */}
      <div className="flex justify-center items-center gap-3 mb-10">
        <div className="relative bg-[#201a16]/60 backdrop-blur-sm rounded-full p-1 flex border border-white/10">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`relative z-10 px-6 py-2 text-sm font-medium rounded-full transition-colors ${
              billingCycle === 'monthly'
                ? 'text-[#1a1410]'
                : 'text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`relative z-10 px-6 py-2 text-sm font-medium rounded-full transition-colors ${
              billingCycle === 'annual'
                ? 'text-[#1a1410]'
                : 'text-white'
            }`}
          >
            Annual
          </button>
          {/* Sliding background */}
          <div
            className={`absolute inset-y-1 w-[calc(50%-4px)] bg-[#B8CA6E] rounded-full transition-transform duration-200 ${
              billingCycle === 'annual' ? 'translate-x-full' : 'translate-x-0'
            }`}
            style={{ left: '4px' }}
          />
        </div>
        {billingCycle === 'annual' && (
          <span className="inline-flex items-center rounded-full bg-[#B8CA6E]/10 border border-[#B8CA6E]/20 px-2.5 py-1 text-xs font-medium text-[#B8CA6E]">
            Save 17%
          </span>
        )}
      </div>

      {/* Pricing Cards */}
      <div
        className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-6"
        onMouseLeave={() => setHighlightedTier('plus')}
      >
        {tiers.map((tier) => (
          <PricingCard
            key={tier.id}
            tier={tier}
            billingCycle={billingCycle}
            isHighlighted={highlightedTier === tier.id}
            onMouseEnter={() => setHighlightedTier(tier.id)}
          />
        ))}
      </div>
    </div>
  );
}
