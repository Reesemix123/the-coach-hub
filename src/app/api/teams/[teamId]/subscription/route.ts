// /api/teams/:teamId/subscription - Get team subscription and feature access
// Returns subscription status and computed feature access for the team

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getTierConfigs } from '@/lib/admin/config';
import { SubscriptionTier, SubscriptionStatus, TierConfigValue } from '@/types/admin';

// Feature flags that map to subscription tiers
interface FeatureAccess {
  // Core features (all tiers)
  playbook_builder: boolean;
  film_upload: boolean;
  basic_tagging: boolean;

  // Tier 2+ (plus and above)
  drive_analytics: boolean;
  player_stats: boolean;
  situational_analysis: boolean;

  // Tier 3 (premium)
  ol_tracking: boolean;
  defensive_player_tracking: boolean;
  advanced_situational: boolean;
  opponent_scouting: boolean;
}

interface SubscriptionResponse {
  team_id: string;
  tier: SubscriptionTier;
  tier_display_name: string;
  status: SubscriptionStatus;
  billing_waived: boolean;
  billing_waived_reason: string | null;
  trial_days_remaining: number | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  features: FeatureAccess;
  can_access_features: boolean; // true if status allows feature access
  upgrade_required: boolean;
  tier_config: TierConfigValue | null;
}

// Display names for tiers (using normalized tier names)
const TIER_DISPLAY_NAMES: Record<string, string> = {
  basic: 'Basic',
  plus: 'Plus',
  premium: 'Premium'
};

// Tier hierarchy for comparison (using normalized tier names)
const TIER_LEVELS: Record<string, number> = {
  basic: 1,
  plus: 2,
  premium: 3
};

/**
 * Compute feature access based on tier and subscription status
 */
function computeFeatureAccess(tier: string, canAccess: boolean): FeatureAccess {
  const tierLevel = canAccess ? (TIER_LEVELS[tier] || 0) : 0;

  return {
    // Core features (all tiers if active subscription)
    playbook_builder: tierLevel >= 1,
    film_upload: tierLevel >= 1,
    basic_tagging: tierLevel >= 1,

    // Tier 2+ (plus and above)
    drive_analytics: tierLevel >= 2,
    player_stats: tierLevel >= 2,
    situational_analysis: tierLevel >= 2,

    // Tier 3 (premium)
    ol_tracking: tierLevel >= 3,
    defensive_player_tracking: tierLevel >= 3,
    advanced_situational: tierLevel >= 3,
    opponent_scouting: tierLevel >= 3
  };
}

/**
 * Determine if the subscription status allows feature access
 * Active, trialing, and past_due (grace period) all allow access
 * Waived billing also allows full access
 */
function statusAllowsAccess(status: SubscriptionStatus, billingWaived: boolean): boolean {
  if (billingWaived) return true;
  return ['active', 'trialing', 'past_due'].includes(status);
}

/**
 * Calculate trial days remaining
 */
function calculateTrialDaysRemaining(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;

  const trialEnd = new Date(trialEndsAt);
  const now = new Date();
  const diffMs = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

/**
 * Normalize legacy tier names to new naming convention
 * Database may store: little_league, hs_basic, hs_advanced
 * UI expects: basic, plus, premium
 */
function normalizeTierName(tier: string): SubscriptionTier {
  const legacyMapping: Record<string, SubscriptionTier> = {
    little_league: 'basic',
    hs_basic: 'plus',
    hs_advanced: 'premium',
    // New names map to themselves
    basic: 'basic',
    plus: 'plus',
    premium: 'premium'
  };

  return legacyMapping[tier] || 'basic';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Verify user has access to this team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, user_id, organization_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Check access via ownership or organization membership
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  const hasAccess =
    team.user_id === user.id ||
    (profile?.organization_id && profile.organization_id === team.organization_id);

  if (!hasAccess) {
    // Also check team_memberships for multi-coach access
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
  }

  // Get subscription for this team
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('team_id', teamId)
    .single();

  // Get tier configs for display info
  const tierConfigs = await getTierConfigs();

  // Determine current tier and status
  // Database may use legacy names: little_league, hs_basic, hs_advanced
  // Normalize to new naming: basic, plus, premium
  const rawTier = subscription?.tier || 'plus';
  const tier = normalizeTierName(rawTier);
  const status: SubscriptionStatus = (subscription?.status as SubscriptionStatus) || 'none';
  const billingWaived = subscription?.billing_waived || false;

  // Compute access permissions
  const canAccessFeatures = statusAllowsAccess(status, billingWaived);
  const features = computeFeatureAccess(tier, canAccessFeatures);

  // Determine if upgrade is needed (no active subscription)
  const upgradeRequired = !canAccessFeatures && status !== 'waived';

  const response = {
    team_id: teamId,
    tier,
    tier_display_name: TIER_DISPLAY_NAMES[tier] || tier,
    status,
    billing_waived: billingWaived,
    billing_waived_reason: subscription?.billing_waived_reason || null,
    trial_days_remaining: calculateTrialDaysRemaining(subscription?.trial_ends_at || null),
    current_period_end: subscription?.current_period_end || null,
    cancel_at_period_end: subscription?.cancel_at_period_end || false,
    features,
    can_access_features: canAccessFeatures,
    upgrade_required: upgradeRequired,
    tier_config: tierConfigs?.[tier as keyof typeof tierConfigs] || null
  };

  return NextResponse.json(response);
}
