// src/app/api/pricing/route.ts
// Public endpoint for pricing information - no auth required

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { TierConfigs, TrialConfig, SubscriptionTier } from '@/types/admin';

export interface PricingTier {
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

export interface PricingResponse {
  tiers: PricingTier[];
  trial_enabled: boolean;
  trial_duration_days: number;
  trial_allowed_tiers: SubscriptionTier[];
}

// Default tier configs if not found in database
const DEFAULT_TIER_CONFIGS: Record<SubscriptionTier, Omit<PricingTier, 'id'>> = {
  basic: {
    name: 'Basic',
    description: 'Essential game planning for youth coaches',
    price_monthly: 0,
    ai_credits: 0,
    max_coaches: 3,
    storage_gb: 10,
    features: [
      'Film upload & playback',
      'Basic play tagging',
      'Roster management',
      '2 game uploads/month',
      '1 camera angle per game'
    ]
  },
  plus: {
    name: 'Plus',
    description: 'Full season workflow for active coaches',
    price_monthly: 29,
    ai_credits: 0,
    max_coaches: 5,
    storage_gb: 50,
    features: [
      'Everything in Basic',
      'Drive analytics',
      'Player statistics',
      'Game planning tools',
      'Situational analysis',
      '4 game uploads/month',
      '3 camera angles per game',
      '180-day game retention'
    ],
    popular: true
  },
  premium: {
    name: 'Premium',
    description: 'Year-round performance for serious programs',
    price_monthly: 79,
    ai_credits: 0,
    max_coaches: 10,
    storage_gb: 200,
    features: [
      'Everything in Plus',
      'O-Line performance tracking',
      'Defensive player tracking',
      'Advanced situational splits',
      'Opponent scouting reports',
      '8 game uploads/month',
      '5 camera angles per game',
      '365-day game retention',
      'AI Chat included'
    ]
  }
};

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch tier configs from platform_config
    const { data: tierConfigData } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'tier_config')
      .single();

    // Fetch trial config
    const { data: trialConfigData } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'trial_config')
      .single();

    // Use database values or defaults
    const tierConfigs = (tierConfigData?.value as TierConfigs) || null;
    const trialConfig = (trialConfigData?.value as TrialConfig) || {
      trial_enabled: false,
      trial_duration_days: 14,
      trial_allowed_tiers: ['plus', 'premium'] as SubscriptionTier[],
      trial_ai_credits_limit: 25
    };

    // Build pricing tiers array
    const tiers: PricingTier[] = (['basic', 'plus', 'premium'] as SubscriptionTier[]).map(tierId => {
      const dbConfig = tierConfigs?.[tierId];
      const defaultConfig = DEFAULT_TIER_CONFIGS[tierId];

      return {
        id: tierId,
        name: dbConfig?.name || defaultConfig.name,
        description: dbConfig?.description || defaultConfig.description,
        price_monthly: dbConfig?.price_monthly ?? defaultConfig.price_monthly,
        ai_credits: dbConfig?.ai_credits ?? defaultConfig.ai_credits,
        max_coaches: dbConfig?.max_coaches ?? defaultConfig.max_coaches,
        storage_gb: dbConfig?.storage_gb ?? defaultConfig.storage_gb,
        features: dbConfig?.features || defaultConfig.features,
        popular: tierId === 'plus' // Mark Plus as popular
      };
    });

    const response: PricingResponse = {
      tiers,
      trial_enabled: trialConfig.trial_enabled,
      trial_duration_days: trialConfig.trial_duration_days,
      trial_allowed_tiers: trialConfig.trial_allowed_tiers
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching pricing:', error);

    // Return defaults on error
    const tiers: PricingTier[] = (['basic', 'plus', 'premium'] as SubscriptionTier[]).map(tierId => ({
      id: tierId,
      ...DEFAULT_TIER_CONFIGS[tierId]
    }));

    return NextResponse.json({
      tiers,
      trial_enabled: false,
      trial_duration_days: 14,
      trial_allowed_tiers: ['plus', 'premium']
    });
  }
}
