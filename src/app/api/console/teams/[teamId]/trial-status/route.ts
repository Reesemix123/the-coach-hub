// /api/console/teams/[teamId]/trial-status - Trial Status for AD Console
// Returns trial status for a team (accessible by team members)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

/**
 * GET /api/console/teams/:teamId/trial-status
 * Returns trial status for a team
 * Accessible by team members (not admin-only)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const { teamId } = await params;

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify user has access to this team (via membership or ownership)
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const { data: team } = await supabase
      .from('teams')
      .select('id, name, user_id')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user is owner or has active membership
    const isOwner = team.user_id === user.id;
    const hasMembership = !!membership;

    if (!isOwner && !hasMembership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get subscription info
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, status, trial_ends_at')
      .eq('team_id', teamId)
      .single();

    // If not trialing, return minimal info
    if (!subscription || subscription.status !== 'trialing') {
      return NextResponse.json({
        is_trialing: false,
        status: subscription?.status || 'none'
      });
    }

    // Calculate days remaining
    const trialEnd = new Date(subscription.trial_ends_at);
    const nowDate = new Date();
    const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24)));

    return NextResponse.json({
      is_trialing: true,
      trial_ends_at: subscription.trial_ends_at,
      days_remaining: daysRemaining,
      tier: subscription.tier
    });

  } catch (error) {
    console.error('Error fetching trial status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trial status' },
      { status: 500 }
    );
  }
}
