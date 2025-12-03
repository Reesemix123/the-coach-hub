// Add-on Pricing Service - Client-side version
// Handles volume-discounted pricing for team add-ons (coaches, AI credits, storage)
// This version accepts a supabase client as a parameter for use in client components

import { SupabaseClient } from '@supabase/supabase-js';

// Types (re-export from main service for consistency)
export interface PricingTier {
  min: number;
  max: number | null;
  price_cents: number;
}

export interface AddonConfig {
  unit_name: string;
  unit_value?: number;
  tiers: PricingTier[];
}

export interface AddonPricing {
  coaches: AddonConfig;
  ai_credits: AddonConfig;
  storage: AddonConfig;
}

export interface TeamAddons {
  id: string;
  team_id: string;
  additional_coaches: number;
  additional_ai_credits: number;
  additional_storage_gb: number;
  stripe_subscription_item_id: string | null;
  monthly_cost_cents: number;
  created_at: string;
  updated_at: string;
}

export interface EffectiveLimits {
  max_coaches: number;
  ai_credits: number;
  storage_gb: number;
  addon_cost_cents: number;
  addons: TeamAddons | null;
}

// Default tier limits
const DEFAULT_TIER_LIMITS: Record<string, { max_coaches: number; ai_credits: number; storage_gb: number }> = {
  basic: { max_coaches: 3, ai_credits: 0, storage_gb: 10 },
  plus: { max_coaches: 5, ai_credits: 100, storage_gb: 50 },
  premium: { max_coaches: 10, ai_credits: 500, storage_gb: 200 },
  ai_powered: { max_coaches: 10, ai_credits: 2000, storage_gb: 500 }
};

/**
 * Get team's current add-ons (client-side version)
 */
export async function getTeamAddonsClient(
  supabase: SupabaseClient,
  teamId: string
): Promise<TeamAddons | null> {
  try {
    const { data, error } = await supabase
      .from('team_addons')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching team addons:', error);
    }

    return data as TeamAddons | null;
  } catch (error) {
    console.error('Error fetching team addons:', error);
    return null;
  }
}

/**
 * Get effective limits for a team (tier limits + add-ons) - client-side version
 */
export async function getEffectiveLimitsClient(
  supabase: SupabaseClient,
  teamId: string
): Promise<EffectiveLimits> {
  // Get team's subscription tier
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('team_id', teamId)
    .single();

  const tier = subscription?.tier || 'basic';

  // Get tier config
  const { data: tierConfigData } = await supabase
    .from('platform_config')
    .select('value')
    .eq('key', 'tier_config')
    .single();

  const tierConfigs = tierConfigData?.value as Record<string, {
    max_coaches?: number;
    ai_credits?: number;
    storage_gb?: number;
  }> | null;

  const tierConfig = tierConfigs?.[tier] || DEFAULT_TIER_LIMITS[tier] || DEFAULT_TIER_LIMITS.basic;

  // Get team's add-ons
  const addons = await getTeamAddonsClient(supabase, teamId);

  const baseLimits = {
    max_coaches: tierConfig.max_coaches || DEFAULT_TIER_LIMITS[tier]?.max_coaches || 3,
    ai_credits: tierConfig.ai_credits || DEFAULT_TIER_LIMITS[tier]?.ai_credits || 0,
    storage_gb: tierConfig.storage_gb || DEFAULT_TIER_LIMITS[tier]?.storage_gb || 10
  };

  return {
    max_coaches: baseLimits.max_coaches + (addons?.additional_coaches || 0),
    ai_credits: baseLimits.ai_credits + (addons?.additional_ai_credits || 0),
    storage_gb: baseLimits.storage_gb + (addons?.additional_storage_gb || 0),
    addon_cost_cents: addons?.monthly_cost_cents || 0,
    addons
  };
}

/**
 * Get limit reached response based on user role - pure function (no async)
 * Used when a limit is hit to determine what message/action to show
 */
export function getLimitReachedResponseClient(
  limitType: 'coaches' | 'ai_credits' | 'storage',
  userRole: string,
  ownerName: string,
  teamId: string
): {
  action: 'purchase_addon' | 'contact_owner';
  message: string;
  buttonText: string | null;
  buttonUrl: string | null;
} {
  const limitLabels: Record<string, string> = {
    coaches: 'coach',
    ai_credits: 'AI credits',
    storage: 'storage'
  };

  const limitLabel = limitLabels[limitType] || limitType;

  if (userRole === 'owner') {
    return {
      action: 'purchase_addon',
      message: `${limitLabel.charAt(0).toUpperCase() + limitLabel.slice(1)} limit reached`,
      buttonText: 'Add More',
      buttonUrl: `/teams/${teamId}/settings/addons`
    };
  } else {
    return {
      action: 'contact_owner',
      message: `Contact ${ownerName || 'your head coach'} to increase your team's ${limitLabel} limit.`,
      buttonText: null,
      buttonUrl: null
    };
  }
}
