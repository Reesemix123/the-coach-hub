/**
 * API: /api/communication/plan
 * GET - Get plan status for a team
 * POST - Create/purchase a plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  getPlanStatus,
  createPlan,
  getActivePlan,
} from '@/lib/services/communication';
import type { PlanTier } from '@/types/communication';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // Verify user has access to this team (any role or parent)
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    // Check if user is a parent with access
    const { data: parentAccess } = await supabase
      .from('team_parent_access')
      .select('parent_id')
      .eq('team_id', teamId)
      .eq('status', 'active')
      .single();

    const isOwner = team.user_id === user.id;
    const isMember = !!membership;
    const isParent = !!parentAccess;

    if (!isOwner && !isMember && !isParent) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const status = await getPlanStatus(teamId);

    return NextResponse.json({ status });
  } catch (error) {
    console.error('Error fetching plan status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plan status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, planTier, stripePaymentId, stripeProductId } = body;

    if (!teamId || !planTier || !stripePaymentId) {
      return NextResponse.json(
        { error: 'teamId, planTier, and stripePaymentId are required' },
        { status: 400 }
      );
    }

    // Validate plan tier
    const validTiers: PlanTier[] = ['rookie', 'varsity', 'all_conference', 'all_state'];
    if (!validTiers.includes(planTier)) {
      return NextResponse.json({ error: 'Invalid plan tier' }, { status: 400 });
    }

    // Verify user can purchase (owner or team_admin)
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isOwner = team.user_id === user.id;
    const isTeamAdmin = membership?.role === 'team_admin';

    if (!isOwner && !isTeamAdmin) {
      return NextResponse.json(
        { error: 'Only the head coach or team admin can purchase plans' },
        { status: 403 }
      );
    }

    // Check for existing active plan
    const existingPlan = await getActivePlan(teamId);
    if (existingPlan) {
      return NextResponse.json(
        { error: 'Team already has an active plan. Use upgrade endpoint instead.' },
        { status: 409 }
      );
    }

    const plan = await createPlan({
      teamId,
      planTier,
      stripePaymentId,
      stripeProductId,
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    console.error('Error creating plan:', error);
    return NextResponse.json(
      { error: 'Failed to create plan' },
      { status: 500 }
    );
  }
}
