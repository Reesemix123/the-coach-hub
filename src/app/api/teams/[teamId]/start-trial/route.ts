// /api/teams/[teamId]/start-trial - Start a trial for a team
// User-facing API for starting a trial when signing up

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

// Valid tier values (matching database constraint)
const VALID_TIERS = ['basic', 'plus', 'premium'];

// Map from URL/display tiers to database tiers
// Note: We now use the new tier names directly in the database
const TIER_MAP: Record<string, string> = {
  'basic': 'basic',
  'plus': 'plus',
  'premium': 'premium',
  // Also accept legacy values for backwards compatibility
  'little_league': 'basic',
  'hs_basic': 'plus',
  'hs_advanced': 'premium'
};

/**
 * POST /api/teams/:teamId/start-trial
 * Start a trial for a newly created team
 * Body: { tier: string }
 *
 * This is accessible by the team owner (not admin-only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const { teamId } = await params;

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const requestedTier = body.tier || 'plus';

    // Map to database tier value
    const tier = TIER_MAP[requestedTier] || 'plus';

    if (!VALID_TIERS.includes(tier)) {
      return NextResponse.json(
        { error: `Invalid tier. Valid tiers: ${VALID_TIERS.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify user is the team owner
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, user_id, has_had_trial')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (team.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the team owner can start a trial' },
        { status: 403 }
      );
    }

    // Check if team has already had a trial
    if (team.has_had_trial) {
      // Check if there's an active subscription
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('team_id', teamId)
        .single();

      if (existingSub && ['active', 'trialing'].includes(existingSub.status)) {
        return NextResponse.json({
          success: true,
          message: 'Team already has an active subscription',
          already_subscribed: true
        });
      }
    }

    // Default trial duration: 14 days
    const trialDurationDays = 14;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDurationDays);

    // Upsert subscription (creates or updates)
    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        team_id: teamId,
        tier,
        status: 'trialing',
        trial_ends_at: trialEndsAt.toISOString(),
        billing_waived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'team_id'
      });

    if (subError) {
      console.error('Error creating subscription:', subError);
      return NextResponse.json(
        { error: 'Failed to start trial' },
        { status: 500 }
      );
    }

    // Mark team as having had a trial
    await supabase
      .from('teams')
      .update({ has_had_trial: true })
      .eq('id', teamId);

    return NextResponse.json({
      success: true,
      trial_ends_at: trialEndsAt.toISOString(),
      tier,
      days_remaining: trialDurationDays
    });

  } catch (error) {
    console.error('Error starting trial:', error);
    return NextResponse.json(
      { error: 'Failed to start trial' },
      { status: 500 }
    );
  }
}
