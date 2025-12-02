// src/lib/admin/config.ts
// Platform configuration helper functions

import { createClient } from '@/utils/supabase/server';
import { PlatformConfig, TierConfigs, TrialConfig, SubscriptionTier } from '@/types/admin';

// ============================================================================
// Known Config Keys
// ============================================================================

export const CONFIG_KEYS = {
  TIER_CONFIGS: 'tier_config',  // Note: singular in database
  TRIAL_CONFIG: 'trial_config',
  STRIPE_ENABLED: 'stripe_enabled',
  AI_ENABLED: 'ai_enabled',
  MAINTENANCE_MODE: 'maintenance_mode'
} as const;

export type ConfigKey = typeof CONFIG_KEYS[keyof typeof CONFIG_KEYS];

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get all platform configuration values.
 */
export async function getAllConfig(): Promise<PlatformConfig[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('platform_config')
    .select('*')
    .order('key');

  if (error) {
    console.error('Error fetching platform config:', error);
    throw new Error('Failed to fetch platform configuration');
  }

  return data || [];
}

/**
 * Get a single configuration value by key.
 */
export async function getConfig<T = unknown>(key: string): Promise<T | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('platform_config')
    .select('value')
    .eq('key', key)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - key doesn't exist
      return null;
    }
    console.error(`Error fetching config key "${key}":`, error);
    throw new Error(`Failed to fetch config: ${key}`);
  }

  return data?.value as T;
}

/**
 * Set a configuration value.
 * Creates the key if it doesn't exist, updates if it does.
 */
export async function setConfig(
  key: string,
  value: unknown,
  description?: string,
  updatedBy?: string
): Promise<PlatformConfig> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('platform_config')
    .upsert({
      key,
      value,
      description: description || null,
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'key'
    })
    .select()
    .single();

  if (error) {
    console.error(`Error setting config key "${key}":`, error);
    throw new Error(`Failed to set config: ${key}`);
  }

  return data;
}

// ============================================================================
// Typed Config Getters
// ============================================================================

/**
 * Get tier configurations with proper typing.
 */
export async function getTierConfigs(): Promise<TierConfigs | null> {
  return getConfig<TierConfigs>(CONFIG_KEYS.TIER_CONFIGS);
}

/**
 * Get configuration for a specific tier.
 */
export async function getTierConfig(tier: SubscriptionTier) {
  const configs = await getTierConfigs();
  return configs?.[tier] || null;
}

/**
 * Get trial configuration with proper typing.
 */
export async function getTrialConfig(): Promise<TrialConfig | null> {
  return getConfig<TrialConfig>(CONFIG_KEYS.TRIAL_CONFIG);
}

/**
 * Check if Stripe billing is enabled.
 */
export async function isStripeEnabled(): Promise<boolean> {
  const config = await getConfig<{ enabled: boolean }>(CONFIG_KEYS.STRIPE_ENABLED);
  return config?.enabled ?? false;
}

/**
 * Check if AI features are enabled.
 */
export async function isAIEnabled(): Promise<boolean> {
  const config = await getConfig<{ enabled: boolean }>(CONFIG_KEYS.AI_ENABLED);
  return config?.enabled ?? false;
}

/**
 * Check if the platform is in maintenance mode.
 */
export async function isMaintenanceMode(): Promise<boolean> {
  const config = await getConfig<{ enabled: boolean; message?: string }>(CONFIG_KEYS.MAINTENANCE_MODE);
  return config?.enabled ?? false;
}

/**
 * Get maintenance mode message (if any).
 */
export async function getMaintenanceMessage(): Promise<string | null> {
  const config = await getConfig<{ enabled: boolean; message?: string }>(CONFIG_KEYS.MAINTENANCE_MODE);
  return config?.message || null;
}

// ============================================================================
// AI Credits Helpers
// ============================================================================

/**
 * Get the AI credits limit for a specific tier.
 */
export async function getAICreditsForTier(tier: SubscriptionTier): Promise<number> {
  const configs = await getTierConfigs();
  return configs?.[tier]?.ai_credits ?? 0;
}

/**
 * Get the monthly price for a specific tier (in cents).
 */
export async function getTierPrice(tier: SubscriptionTier): Promise<number> {
  const configs = await getTierConfigs();
  return configs?.[tier]?.price_monthly ?? 0;
}

/**
 * Get all features for a specific tier.
 */
export async function getTierFeatures(tier: SubscriptionTier): Promise<string[]> {
  const configs = await getTierConfigs();
  return configs?.[tier]?.features ?? [];
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate a config value based on its key.
 * Returns an error message if invalid, null if valid.
 */
export function validateConfigValue(key: string, value: unknown): string | null {
  switch (key) {
    case CONFIG_KEYS.TIER_CONFIGS:
      return validateTierConfigs(value);
    case CONFIG_KEYS.TRIAL_CONFIG:
      return validateTrialConfig(value);
    case CONFIG_KEYS.STRIPE_ENABLED:
    case CONFIG_KEYS.AI_ENABLED:
      return validateBooleanConfig(value);
    case CONFIG_KEYS.MAINTENANCE_MODE:
      return validateMaintenanceConfig(value);
    default:
      // Unknown keys - no validation
      return null;
  }
}

function validateTierConfigs(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return 'tier_configs must be an object';
  }

  const tiers: SubscriptionTier[] = ['little_league', 'hs_basic', 'hs_advanced', 'ai_powered'];
  const obj = value as Record<string, unknown>;

  for (const tier of tiers) {
    if (!obj[tier]) {
      return `Missing tier configuration: ${tier}`;
    }
    const tierConfig = obj[tier] as Record<string, unknown>;
    if (typeof tierConfig.name !== 'string') {
      return `Tier ${tier} missing 'name'`;
    }
    if (typeof tierConfig.ai_credits !== 'number') {
      return `Tier ${tier} missing 'ai_credits' (number)`;
    }
    if (typeof tierConfig.price_monthly !== 'number') {
      return `Tier ${tier} missing 'price_monthly' (number)`;
    }
    if (!Array.isArray(tierConfig.features)) {
      return `Tier ${tier} missing 'features' (array)`;
    }
  }

  return null;
}

function validateTrialConfig(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return 'trial_config must be an object';
  }

  const config = value as Record<string, unknown>;

  if (typeof config.trial_enabled !== 'boolean') {
    return "Missing 'trial_enabled' (boolean)";
  }
  if (typeof config.trial_duration_days !== 'number') {
    return "Missing 'trial_duration_days' (number)";
  }
  if (!Array.isArray(config.trial_allowed_tiers)) {
    return "Missing 'trial_allowed_tiers' (array)";
  }
  if (typeof config.trial_ai_credits_limit !== 'number') {
    return "Missing 'trial_ai_credits_limit' (number)";
  }

  return null;
}

function validateBooleanConfig(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return 'Value must be an object with { enabled: boolean }';
  }

  const config = value as Record<string, unknown>;
  if (typeof config.enabled !== 'boolean') {
    return "Missing 'enabled' (boolean)";
  }

  return null;
}

function validateMaintenanceConfig(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return 'Value must be an object';
  }

  const config = value as Record<string, unknown>;
  if (typeof config.enabled !== 'boolean') {
    return "Missing 'enabled' (boolean)";
  }
  if (config.message !== undefined && typeof config.message !== 'string') {
    return "'message' must be a string";
  }

  return null;
}
