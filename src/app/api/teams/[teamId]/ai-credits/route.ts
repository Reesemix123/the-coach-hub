// /api/teams/:teamId/ai-credits - AI credits status and consumption
// Returns current credits balance and allows consuming credits

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getTrialConfig, getTierConfig } from '@/lib/admin/config';
import { SubscriptionTier } from '@/types/admin';

// Feature costs - how many credits each AI feature uses
export const AI_FEATURE_COSTS: Record<string, number> = {
  'play_analysis': 1,        // Analyze a single play
  'auto_tagging': 1,         // AI-assisted play tagging
  'game_summary': 5,         // Generate game summary
  'opponent_tendencies': 10, // Analyze opponent patterns
  'practice_plan': 8,        // Generate practice plan
  'player_evaluation': 3,    // Individual player analysis
  'strategy_assistant': 2,   // Strategy chat/suggestions
  'play_recognition': 1,     // Auto-recognition of plays from video
  'scouting_analysis': 10,   // Opponent scouting AI
  'default': 1               // Default cost for unknown features
};

export function getCreditCost(feature: string): number {
  return AI_FEATURE_COSTS[feature] || AI_FEATURE_COSTS['default'];
}

interface AICreditsResponse {
  team_id: string;
  credits_allowed: number;
  credits_used: number;
  credits_remaining: number;
  period_start: string;
  period_end: string;
  is_trial: boolean;
  trial_limit: number | null;
  percentage_used: number;
  near_limit: boolean; // true if >= 80% used
  at_limit: boolean;   // true if 100% used
}

/**
 * GET /api/teams/:teamId/ai-credits
 * Returns current AI credits status for the team
 */
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
    .select('id, user_id, organization_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Check access
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  const hasAccess =
    team.user_id === user.id ||
    (profile?.organization_id && profile.organization_id === team.organization_id);

  if (!hasAccess) {
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

  // Get subscription to check trial status
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status, trial_ends_at')
    .eq('team_id', teamId)
    .single();

  const isTrial = subscription?.status === 'trialing';

  // Get trial config for trial limits
  let trialLimit: number | null = null;
  if (isTrial) {
    const trialConfig = await getTrialConfig();
    trialLimit = trialConfig?.trial_ai_credits_limit || null;
  }

  // Get current period credits
  const now = new Date();
  const { data: credits } = await supabase
    .from('ai_credits')
    .select('*')
    .eq('team_id', teamId)
    .lte('period_start', now.toISOString())
    .gte('period_end', now.toISOString())
    .order('period_start', { ascending: false })
    .limit(1)
    .single();

  // If no credits record exists, return zero state
  if (!credits) {
    // Get tier config to know default allowed credits
    const tier = (subscription?.tier || 'hs_basic') as SubscriptionTier;
    const tierConfig = await getTierConfig(tier);
    const defaultAllowed = tierConfig?.ai_credits || 0;

    const response: AICreditsResponse = {
      team_id: teamId,
      credits_allowed: defaultAllowed,
      credits_used: 0,
      credits_remaining: isTrial && trialLimit !== null
        ? Math.min(defaultAllowed, trialLimit)
        : defaultAllowed,
      period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      period_end: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      is_trial: isTrial,
      trial_limit: trialLimit,
      percentage_used: 0,
      near_limit: false,
      at_limit: false
    };

    return NextResponse.json(response);
  }

  // Calculate effective limit (trial limit may be lower)
  const effectiveAllowed = isTrial && trialLimit !== null
    ? Math.min(credits.credits_allowed, trialLimit)
    : credits.credits_allowed;

  const creditsRemaining = Math.max(0, effectiveAllowed - credits.credits_used);
  const percentageUsed = effectiveAllowed > 0
    ? Math.round((credits.credits_used / effectiveAllowed) * 100)
    : 0;

  const response: AICreditsResponse = {
    team_id: teamId,
    credits_allowed: credits.credits_allowed,
    credits_used: credits.credits_used,
    credits_remaining: creditsRemaining,
    period_start: credits.period_start,
    period_end: credits.period_end,
    is_trial: isTrial,
    trial_limit: trialLimit,
    percentage_used: percentageUsed,
    near_limit: percentageUsed >= 80 && percentageUsed < 100,
    at_limit: percentageUsed >= 100
  };

  return NextResponse.json(response);
}

/**
 * POST /api/teams/:teamId/ai-credits
 * Consume AI credits for a feature
 *
 * Request body:
 * {
 *   feature: string,
 *   metadata?: object
 * }
 */
export async function POST(
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

  // Parse request body
  let body: { feature: string; metadata?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const { feature, metadata } = body;

  if (!feature) {
    return NextResponse.json(
      { error: 'Feature is required' },
      { status: 400 }
    );
  }

  // Verify user has access to this team
  const { data: team } = await supabase
    .from('teams')
    .select('id, user_id, organization_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Check access
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  const hasAccess =
    team.user_id === user.id ||
    (profile?.organization_id && profile.organization_id === team.organization_id);

  if (!hasAccess) {
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

  // Get subscription status
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status, trial_ends_at')
    .eq('team_id', teamId)
    .single();

  // Check if subscription allows AI features
  const tier = (subscription?.tier || 'hs_basic') as SubscriptionTier;
  if (tier !== 'ai_powered' && !subscription?.status?.match(/active|trialing/)) {
    return NextResponse.json(
      {
        error: 'AI features require an active subscription to AI-Powered tier',
        code: 'TIER_REQUIRED'
      },
      { status: 403 }
    );
  }

  const isTrial = subscription?.status === 'trialing';
  const creditsToUse = getCreditCost(feature);

  // Get current credits
  const now = new Date();
  const { data: credits } = await supabase
    .from('ai_credits')
    .select('*')
    .eq('team_id', teamId)
    .lte('period_start', now.toISOString())
    .gte('period_end', now.toISOString())
    .order('period_start', { ascending: false })
    .limit(1)
    .single();

  // Check trial limit
  if (isTrial) {
    const trialConfig = await getTrialConfig();
    const trialLimit = trialConfig?.trial_ai_credits_limit || 0;
    const currentUsed = credits?.credits_used || 0;

    if (currentUsed + creditsToUse > trialLimit) {
      return NextResponse.json(
        {
          error: `Trial limited to ${trialLimit} AI credits. Subscribe for full access.`,
          code: 'TRIAL_LIMIT_EXCEEDED',
          credits_used: currentUsed,
          trial_limit: trialLimit,
          credits_remaining: Math.max(0, trialLimit - currentUsed)
        },
        { status: 403 }
      );
    }
  }

  // Check regular credit limit
  if (credits) {
    const effectiveLimit = credits.credits_allowed;
    if (credits.credits_used + creditsToUse > effectiveLimit) {
      return NextResponse.json(
        {
          error: 'AI credits exhausted for this billing period. Upgrade your plan or wait for next period.',
          code: 'CREDITS_EXHAUSTED',
          credits_used: credits.credits_used,
          credits_allowed: effectiveLimit,
          credits_remaining: 0
        },
        { status: 403 }
      );
    }
  }

  // Consume credits using the database function
  const { data: logId, error: logError } = await supabase.rpc('log_ai_usage', {
    p_team_id: teamId,
    p_user_id: user.id,
    p_feature: feature,
    p_credits: creditsToUse,
    p_metadata: metadata || null
  });

  if (logError) {
    console.error('Failed to log AI usage:', logError);
    return NextResponse.json(
      { error: 'Failed to consume AI credits' },
      { status: 500 }
    );
  }

  // Get updated credits
  const { data: updatedCredits } = await supabase
    .from('ai_credits')
    .select('credits_used, credits_allowed')
    .eq('team_id', teamId)
    .lte('period_start', now.toISOString())
    .gte('period_end', now.toISOString())
    .order('period_start', { ascending: false })
    .limit(1)
    .single();

  const newRemaining = updatedCredits
    ? Math.max(0, updatedCredits.credits_allowed - updatedCredits.credits_used)
    : 0;

  return NextResponse.json({
    success: true,
    log_id: logId,
    credits_consumed: creditsToUse,
    credits_remaining: newRemaining,
    credits_used: updatedCredits?.credits_used || creditsToUse,
    credits_allowed: updatedCredits?.credits_allowed || 0
  });
}
