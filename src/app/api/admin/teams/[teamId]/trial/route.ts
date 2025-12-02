// /api/admin/teams/[teamId]/trial - Trial Management API
// Platform admin endpoints for managing team trials
// Supports: GET (status), POST (start), PUT (extend), DELETE (end)

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, logAdminAction } from '@/lib/admin/auth';
import { getConfig } from '@/lib/admin/config';

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

/**
 * GET /api/admin/teams/:teamId/trial
 * Returns trial status for a team
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { teamId } = await params;
  const supabase = auth.serviceClient;

  try {
    // Get team info
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, has_had_trial, organization_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get subscription info
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, status, trial_ends_at')
      .eq('team_id', teamId)
      .single();

    // Get AI credits if trialing
    let aiCredits = null;
    if (subscription?.status === 'trialing') {
      const { data: credits } = await supabase
        .from('ai_credits')
        .select('credits_used, credits_allowed')
        .eq('team_id', teamId)
        .gte('period_end', new Date().toISOString())
        .order('period_start', { ascending: false })
        .limit(1)
        .single();

      aiCredits = credits;
    }

    // Calculate days remaining
    let daysRemaining = 0;
    if (subscription?.status === 'trialing' && subscription.trial_ends_at) {
      const endDate = new Date(subscription.trial_ends_at);
      const now = new Date();
      daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    return NextResponse.json({
      team_id: team.id,
      team_name: team.name,
      has_had_trial: team.has_had_trial,
      is_trialing: subscription?.status === 'trialing',
      trial_ends_at: subscription?.trial_ends_at || null,
      days_remaining: daysRemaining,
      tier: subscription?.tier || null,
      status: subscription?.status || 'none',
      ai_credits_used: aiCredits?.credits_used || 0,
      ai_credits_limit: aiCredits?.credits_allowed || 0
    });

  } catch (error) {
    console.error('Error fetching trial status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trial status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/teams/:teamId/trial
 * Start a new trial for a team
 * Body: { tier: string, duration_days?: number, ai_credits_limit?: number }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { teamId } = await params;
  const supabase = auth.serviceClient;

  try {
    const body = await request.json();
    const { tier } = body;

    if (!tier) {
      return NextResponse.json({ error: 'tier is required' }, { status: 400 });
    }

    // Get trial config defaults
    const trialDurationDays = body.duration_days ||
      (await getConfig<number>('trial_duration_days')) || 14;
    const trialAiCreditsLimit = body.ai_credits_limit ||
      (await getConfig<number>('trial_ai_credits_limit')) || 25;

    // Get team info
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Calculate trial end date
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDurationDays);

    // Upsert subscription
    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        team_id: teamId,
        tier,
        status: 'trialing',
        trial_ends_at: trialEndsAt.toISOString()
      }, {
        onConflict: 'team_id'
      });

    if (subError) throw subError;

    // Upsert AI credits
    const { error: creditsError } = await supabase
      .from('ai_credits')
      .upsert({
        team_id: teamId,
        credits_allowed: trialAiCreditsLimit,
        credits_used: 0,
        period_start: new Date().toISOString(),
        period_end: trialEndsAt.toISOString()
      }, {
        onConflict: 'team_id,period_start',
        ignoreDuplicates: false
      });

    if (creditsError) {
      // If upsert fails due to conflict, insert new record
      await supabase.from('ai_credits').insert({
        team_id: teamId,
        credits_allowed: trialAiCreditsLimit,
        credits_used: 0,
        period_start: new Date().toISOString(),
        period_end: trialEndsAt.toISOString()
      });
    }

    // Mark team as having had trial
    await supabase
      .from('teams')
      .update({ has_had_trial: true })
      .eq('id', teamId);

    // Log audit event
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'trial.started',
      'team',
      teamId,
      team.name,
      {
        tier,
        duration_days: trialDurationDays,
        ai_credits_limit: trialAiCreditsLimit,
        trial_ends_at: trialEndsAt.toISOString()
      }
    );

    return NextResponse.json({
      success: true,
      trial_ends_at: trialEndsAt.toISOString(),
      tier,
      duration_days: trialDurationDays,
      ai_credits_limit: trialAiCreditsLimit
    });

  } catch (error) {
    console.error('Error starting trial:', error);
    return NextResponse.json(
      { error: 'Failed to start trial' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/teams/:teamId/trial
 * Extend an existing trial
 * Body: { additional_days: number }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { teamId } = await params;
  const supabase = auth.serviceClient;

  try {
    const body = await request.json();
    const { additional_days } = body;

    if (!additional_days || additional_days <= 0) {
      return NextResponse.json(
        { error: 'additional_days must be a positive number' },
        { status: 400 }
      );
    }

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('tier, status, trial_ends_at')
      .eq('team_id', teamId)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: 'No subscription found for this team' },
        { status: 404 }
      );
    }

    if (subscription.status !== 'trialing') {
      return NextResponse.json(
        { error: 'Team is not currently in a trial' },
        { status: 400 }
      );
    }

    // Get team name for audit
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single();

    // Calculate new end date
    const currentEnd = new Date(subscription.trial_ends_at);
    const now = new Date();
    const baseDate = currentEnd < now ? now : currentEnd;
    const newEnd = new Date(baseDate);
    newEnd.setDate(newEnd.getDate() + additional_days);

    // Update subscription
    const { error: updateSubError } = await supabase
      .from('subscriptions')
      .update({ trial_ends_at: newEnd.toISOString() })
      .eq('team_id', teamId);

    if (updateSubError) throw updateSubError;

    // Extend AI credits period
    await supabase
      .from('ai_credits')
      .update({ period_end: newEnd.toISOString() })
      .eq('team_id', teamId)
      .gte('period_end', now.toISOString());

    // Log audit event
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'trial.extended',
      'team',
      teamId,
      team?.name || teamId,
      {
        additional_days,
        previous_end: subscription.trial_ends_at,
        new_end: newEnd.toISOString()
      }
    );

    return NextResponse.json({
      success: true,
      previous_end: subscription.trial_ends_at,
      new_end: newEnd.toISOString(),
      additional_days
    });

  } catch (error) {
    console.error('Error extending trial:', error);
    return NextResponse.json(
      { error: 'Failed to extend trial' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/teams/:teamId/trial
 * End a trial early
 * Body: { new_status: 'expired' | 'canceled' | 'active' }
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const { teamId } = await params;
  const supabase = auth.serviceClient;

  try {
    const body = await request.json();
    const { new_status } = body;

    if (!new_status || !['expired', 'canceled', 'active'].includes(new_status)) {
      return NextResponse.json(
        { error: 'new_status must be one of: expired, canceled, active' },
        { status: 400 }
      );
    }

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('tier, status, trial_ends_at')
      .eq('team_id', teamId)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: 'No subscription found for this team' },
        { status: 404 }
      );
    }

    // Get team name for audit
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single();

    const now = new Date().toISOString();

    // Update subscription status
    const updateData: Record<string, unknown> = { status: new_status };
    if (new_status === 'expired' || new_status === 'canceled') {
      updateData.trial_ends_at = now;
    }

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('team_id', teamId);

    if (updateError) throw updateError;

    // If ending/canceling, zero out AI credits
    if (new_status === 'expired' || new_status === 'canceled') {
      await supabase
        .from('ai_credits')
        .update({ credits_allowed: 0, period_end: now })
        .eq('team_id', teamId)
        .gt('period_end', now);
    }

    // Log audit event
    await logAdminAction(
      auth.admin.id,
      auth.admin.email,
      'trial.ended',
      'team',
      teamId,
      team?.name || teamId,
      {
        old_status: subscription.status,
        new_status
      }
    );

    return NextResponse.json({
      success: true,
      old_status: subscription.status,
      new_status
    });

  } catch (error) {
    console.error('Error ending trial:', error);
    return NextResponse.json(
      { error: 'Failed to end trial' },
      { status: 500 }
    );
  }
}
