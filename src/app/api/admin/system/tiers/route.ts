// /api/admin/system/tiers - Tier Configuration API
// Manages subscription tier settings
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';
import { getConfig, setConfig } from '@/lib/admin/config';
import { SubscriptionTier } from '@/types/admin';

const CONFIG_KEY = 'tier_config';

interface TierConfig {
  name: string;
  description?: string;
  ai_credits: number;
  price_monthly: number;
  features: string[];
}

interface TierConfigs {
  [key: string]: TierConfig;
}

interface TierWithStats extends TierConfig {
  id: string;
  active_subscriptions: number;
}

/**
 * GET /api/admin/system/tiers
 * Returns all tier configurations with subscription counts
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const supabase = auth.serviceClient;

  try {
    // Get tier configs from platform_config
    const tierConfigs = await getConfig<TierConfigs>(CONFIG_KEY);

    if (!tierConfigs) {
      return NextResponse.json(
        { error: 'Tier configuration not found' },
        { status: 404 }
      );
    }

    // Get subscription counts per tier
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('tier')
      .in('status', ['active', 'trialing']);

    if (subError) throw subError;

    // Count subscriptions per tier
    const tierCounts: Record<string, number> = {};
    for (const sub of subscriptions || []) {
      tierCounts[sub.tier] = (tierCounts[sub.tier] || 0) + 1;
    }

    // Build response with subscription counts
    const tiers: TierWithStats[] = Object.entries(tierConfigs).map(([id, config]) => ({
      id,
      ...config,
      active_subscriptions: tierCounts[id] || 0
    }));

    // Sort by price (free first, then ascending)
    tiers.sort((a, b) => a.price_monthly - b.price_monthly);

    return NextResponse.json({ tiers });

  } catch (error) {
    console.error('Error fetching tier config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tier configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/system/tiers
 * Update a specific tier configuration
 *
 * Request body: { tierId: string, name: string, description?: string, ai_credits: number, price_monthly: number, features: string[] }
 *
 * Note: Price changes only affect new subscriptions, not existing ones
 */
export async function PUT(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const { tierId, name, description, ai_credits, price_monthly, features } = body;

    // Validate required fields
    if (!tierId) {
      return NextResponse.json({ error: 'Tier ID is required' }, { status: 400 });
    }

    const validTiers: SubscriptionTier[] = ['little_league', 'hs_basic', 'hs_advanced', 'ai_powered'];
    if (!validTiers.includes(tierId)) {
      return NextResponse.json({ error: 'Invalid tier ID' }, { status: 400 });
    }

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (typeof ai_credits !== 'number' || ai_credits < 0) {
      return NextResponse.json({ error: 'AI credits must be a non-negative number' }, { status: 400 });
    }

    if (typeof price_monthly !== 'number' || price_monthly < 0) {
      return NextResponse.json({ error: 'Price must be a non-negative number' }, { status: 400 });
    }

    if (!Array.isArray(features)) {
      return NextResponse.json({ error: 'Features must be an array' }, { status: 400 });
    }

    // Get current config
    const currentConfig = await getConfig<TierConfigs>(CONFIG_KEY);
    if (!currentConfig) {
      return NextResponse.json({ error: 'Tier configuration not found' }, { status: 404 });
    }

    const previousConfig = currentConfig[tierId];

    // Update the specific tier
    const updatedConfig: TierConfigs = {
      ...currentConfig,
      [tierId]: {
        name: name.trim(),
        description: description?.trim() || previousConfig?.description,
        ai_credits,
        price_monthly,
        features
      }
    };

    await setConfig(
      CONFIG_KEY,
      updatedConfig,
      'Subscription tier configuration',
      auth.admin.id
    );

    // Log the change
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'tier_config.updated',
      'config',
      undefined,
      tierId,
      {
        previous: previousConfig,
        updated: updatedConfig[tierId]
      }
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating tier config:', error);
    return NextResponse.json(
      { error: 'Failed to update tier configuration' },
      { status: 500 }
    );
  }
}
