// Add-on Pricing Service
// Handles volume-discounted pricing for team add-ons (coaches, storage)

import { createClient } from '@/utils/supabase/server';

// Types
export interface PricingTier {
  min: number;
  max: number | null;
  price_cents: number;
}

export interface AddonConfig {
  unit_name: string;
  unit_value?: number; // For storage (10GB)
  tiers: PricingTier[];
}

export interface AddonPricing {
  coaches: AddonConfig;
  storage: AddonConfig;
}

export interface TeamAddons {
  id: string;
  team_id: string;
  additional_coaches: number;
  additional_storage_gb: number;
  stripe_subscription_item_id: string | null;
  monthly_cost_cents: number;
  created_at: string;
  updated_at: string;
}

export interface AddonCostResult {
  quantity: number;
  unitPrice: number; // cents per unit
  totalPrice: number; // total cents
  discountApplied: boolean;
  tierDescription: string;
}

export interface EffectiveLimits {
  max_coaches: number;
  storage_gb: number;
  addon_cost_cents: number;
  addons: TeamAddons | null;
}

// Default pricing (fallback if not in platform_config)
const DEFAULT_ADDON_PRICING: AddonPricing = {
  coaches: {
    unit_name: 'coach',
    tiers: [
      { min: 1, max: 4, price_cents: 500 },
      { min: 5, max: 9, price_cents: 400 },
      { min: 10, max: null, price_cents: 300 }
    ]
  },
  storage: {
    unit_name: '10GB',
    unit_value: 10,
    tiers: [
      { min: 1, max: 4, price_cents: 500 },
      { min: 5, max: 9, price_cents: 400 },
      { min: 10, max: null, price_cents: 300 }
    ]
  }
};

/**
 * Get add-on pricing configuration from platform_config
 */
export async function getAddonPricing(): Promise<AddonPricing> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'addon_pricing')
      .single();

    if (data?.value) {
      return data.value as AddonPricing;
    }
  } catch (error) {
    console.error('Error fetching addon pricing:', error);
  }

  return DEFAULT_ADDON_PRICING;
}

/**
 * Find the appropriate price tier for a given quantity
 */
function findPriceTier(tiers: PricingTier[], quantity: number): PricingTier | null {
  if (quantity <= 0) return null;

  for (const tier of tiers) {
    if (quantity >= tier.min && (tier.max === null || quantity <= tier.max)) {
      return tier;
    }
  }

  // Fall back to highest tier if quantity exceeds all defined ranges
  return tiers[tiers.length - 1];
}

/**
 * Calculate the cost for a specific add-on type
 */
export function calculateAddonCost(
  config: AddonConfig,
  quantity: number
): AddonCostResult {
  if (quantity <= 0) {
    return {
      quantity: 0,
      unitPrice: 0,
      totalPrice: 0,
      discountApplied: false,
      tierDescription: 'No add-ons'
    };
  }

  const tier = findPriceTier(config.tiers, quantity);
  if (!tier) {
    return {
      quantity,
      unitPrice: 0,
      totalPrice: 0,
      discountApplied: false,
      tierDescription: 'Invalid quantity'
    };
  }

  const baseRate = config.tiers[0].price_cents;
  const discountApplied = tier.price_cents < baseRate;

  let tierDescription: string;
  if (tier.max === null) {
    tierDescription = `${tier.min}+ ${config.unit_name}s`;
  } else if (tier.min === tier.max) {
    tierDescription = `${tier.min} ${config.unit_name}`;
  } else {
    tierDescription = `${tier.min}-${tier.max} ${config.unit_name}s`;
  }

  return {
    quantity,
    unitPrice: tier.price_cents,
    totalPrice: quantity * tier.price_cents,
    discountApplied,
    tierDescription
  };
}

/**
 * Calculate total add-on cost for all types
 */
export async function calculateTotalAddonCost(
  additionalCoaches: number,
  additionalAiCredits: number, // Legacy parameter, ignored
  additionalStorageGb: number
): Promise<{
  coaches: AddonCostResult;
  storage: AddonCostResult;
  totalMonthly: number;
}> {
  const pricing = await getAddonPricing();

  // Convert storage GB to units (10GB each)
  const storageUnits = Math.ceil(additionalStorageGb / (pricing.storage.unit_value || 10));

  const coaches = calculateAddonCost(pricing.coaches, additionalCoaches);
  const storage = calculateAddonCost(pricing.storage, storageUnits);

  return {
    coaches,
    storage,
    totalMonthly: coaches.totalPrice + storage.totalPrice
  };
}

/**
 * Get team's current add-ons
 */
export async function getTeamAddons(teamId: string): Promise<TeamAddons | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('team_addons')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      console.error('Error fetching team addons:', error);
    }

    return data as TeamAddons | null;
  } catch (error) {
    console.error('Error fetching team addons:', error);
    return null;
  }
}

/**
 * Get effective limits for a team (tier limits + add-ons)
 */
export async function getEffectiveLimits(teamId: string): Promise<EffectiveLimits> {
  const supabase = await createClient();

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
    storage_gb?: number;
  }> | null;

  // Default tier limits
  const defaultLimits: Record<string, { max_coaches: number; storage_gb: number }> = {
    basic: { max_coaches: 3, storage_gb: 10 },
    plus: { max_coaches: 5, storage_gb: 50 },
    premium: { max_coaches: 10, storage_gb: 200 },
  };

  const tierConfig = tierConfigs?.[tier] || defaultLimits[tier] || defaultLimits.basic;

  // Get team's add-ons
  const addons = await getTeamAddons(teamId);

  const baseLimits = {
    max_coaches: tierConfig.max_coaches || defaultLimits[tier]?.max_coaches || 3,
    storage_gb: tierConfig.storage_gb || defaultLimits[tier]?.storage_gb || 10
  };

  return {
    max_coaches: baseLimits.max_coaches + (addons?.additional_coaches || 0),
    storage_gb: baseLimits.storage_gb + (addons?.additional_storage_gb || 0),
    addon_cost_cents: addons?.monthly_cost_cents || 0,
    addons
  };
}

/**
 * Update team add-ons
 */
export async function updateTeamAddons(
  teamId: string,
  additionalCoaches: number,
  additionalAiCredits: number, // Legacy parameter, ignored
  additionalStorageGb: number
): Promise<{ success: boolean; error?: string; addons?: TeamAddons }> {
  try {
    const supabase = await createClient();

    // Calculate new monthly cost
    const cost = await calculateTotalAddonCost(
      additionalCoaches,
      0, // AI credits no longer used
      additionalStorageGb
    );

    // Upsert the add-ons record
    const { data, error } = await supabase
      .from('team_addons')
      .upsert({
        team_id: teamId,
        additional_coaches: additionalCoaches,
        additional_storage_gb: additionalStorageGb,
        monthly_cost_cents: cost.totalMonthly
      }, {
        onConflict: 'team_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating team addons:', error);
      return { success: false, error: error.message };
    }

    return { success: true, addons: data as TeamAddons };
  } catch (error) {
    console.error('Error updating team addons:', error);
    return { success: false, error: 'Failed to update add-ons' };
  }
}

/**
 * Get limit reached response based on user role
 * Used when a limit is hit to determine what message/action to show
 */
export function getLimitReachedResponse(
  limitType: 'coaches' | 'storage',
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
