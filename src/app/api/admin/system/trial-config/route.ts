// /api/admin/system/trial-config - Trial Configuration API
// Manages trial settings for the platform
// Requires platform admin authentication

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';
import { getConfig, setConfig } from '@/lib/admin/config';
import { SubscriptionTier } from '@/types/admin';

interface TrialConfig {
  trial_enabled: boolean;
  trial_duration_days: number;
  trial_allowed_tiers: SubscriptionTier[];
  trial_ai_credits_limit: number;
}

/**
 * GET /api/admin/system/trial-config
 * Returns current trial configuration
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  try {
    // Trial config is split across multiple keys in platform_config
    const [
      trialEnabled,
      trialDuration,
      trialAllowedTiers,
      trialAiCredits
    ] = await Promise.all([
      getConfig<string>('trial_enabled'),
      getConfig<string>('trial_duration_days'),
      getConfig<string>('trial_allowed_tiers'),
      getConfig<string>('trial_ai_credits_limit')
    ]);

    const config: TrialConfig = {
      trial_enabled: trialEnabled === 'true' || trialEnabled === true,
      trial_duration_days: parseInt(String(trialDuration)) || 14,
      trial_allowed_tiers: typeof trialAllowedTiers === 'string'
        ? JSON.parse(trialAllowedTiers)
        : (trialAllowedTiers as unknown as SubscriptionTier[]) || ['basic', 'plus'],
      trial_ai_credits_limit: parseInt(String(trialAiCredits)) || 25
    };

    return NextResponse.json(config);

  } catch (error) {
    console.error('Error fetching trial config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trial configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/system/trial-config
 * Update trial configuration
 *
 * Request body: { trial_enabled, trial_duration_days, trial_allowed_tiers, trial_ai_credits_limit }
 */
export async function PUT(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  try {
    const body = await request.json();
    const {
      trial_enabled,
      trial_duration_days,
      trial_allowed_tiers,
      trial_ai_credits_limit
    } = body;

    // Validate fields
    if (typeof trial_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'trial_enabled must be a boolean' },
        { status: 400 }
      );
    }

    if (typeof trial_duration_days !== 'number' || trial_duration_days < 1 || trial_duration_days > 90) {
      return NextResponse.json(
        { error: 'trial_duration_days must be between 1 and 90' },
        { status: 400 }
      );
    }

    if (!Array.isArray(trial_allowed_tiers)) {
      return NextResponse.json(
        { error: 'trial_allowed_tiers must be an array' },
        { status: 400 }
      );
    }

    const validTiers: SubscriptionTier[] = ['basic', 'plus', 'premium'];
    for (const tier of trial_allowed_tiers) {
      if (!validTiers.includes(tier)) {
        return NextResponse.json(
          { error: `Invalid tier: ${tier}` },
          { status: 400 }
        );
      }
    }

    if (typeof trial_ai_credits_limit !== 'number' || trial_ai_credits_limit < 0) {
      return NextResponse.json(
        { error: 'trial_ai_credits_limit must be a non-negative number' },
        { status: 400 }
      );
    }

    // Get previous values for audit log
    const [prevEnabled, prevDuration, prevTiers, prevCredits] = await Promise.all([
      getConfig('trial_enabled'),
      getConfig('trial_duration_days'),
      getConfig('trial_allowed_tiers'),
      getConfig('trial_ai_credits_limit')
    ]);

    // Update each config value
    await Promise.all([
      setConfig('trial_enabled', String(trial_enabled), 'Whether free trials are available', auth.admin.id),
      setConfig('trial_duration_days', String(trial_duration_days), 'Length of trial period in days', auth.admin.id),
      setConfig('trial_allowed_tiers', JSON.stringify(trial_allowed_tiers), 'Which tiers can be trialed', auth.admin.id),
      setConfig('trial_ai_credits_limit', String(trial_ai_credits_limit), 'AI credits allowed during trial', auth.admin.id)
    ]);

    // Log the change
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'trial_config.updated',
      'config',
      undefined,
      'trial_config',
      {
        previous: {
          trial_enabled: prevEnabled,
          trial_duration_days: prevDuration,
          trial_allowed_tiers: prevTiers,
          trial_ai_credits_limit: prevCredits
        },
        updated: {
          trial_enabled,
          trial_duration_days,
          trial_allowed_tiers,
          trial_ai_credits_limit
        }
      }
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating trial config:', error);
    return NextResponse.json(
      { error: 'Failed to update trial configuration' },
      { status: 500 }
    );
  }
}
