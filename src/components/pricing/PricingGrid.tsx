'use client';

import PricingCard from './PricingCard';
import { SubscriptionTier } from '@/types/admin';

interface PricingTier {
  id: SubscriptionTier;
  name: string;
  description: string;
  price_monthly: number;
  ai_credits: number;
  max_coaches: number;
  storage_gb: number;
  features: string[];
  popular?: boolean;
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
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
      {tiers.map((tier) => (
        <PricingCard
          key={tier.id}
          tier={tier}
          trialEnabled={trialEnabled}
          trialAllowedTiers={trialAllowedTiers}
          trialDurationDays={trialDurationDays}
        />
      ))}
    </div>
  );
}
