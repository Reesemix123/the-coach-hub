/**
 * API: /api/communication/plan/activate-rookie
 * POST - Auto-activate a free Rookie communication plan for a team
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { buildFreePlanInsert } from '@/lib/services/communication/plan-helpers';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
    }

    // Verify user owns the team
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id, name')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (team.user_id !== user.id) {
      return NextResponse.json({ error: 'Only team owners can activate plans' }, { status: 403 });
    }

    // Check for existing active plan
    const { data: existingPlan } = await supabase
      .from('team_communication_plans')
      .select('id, plan_tier')
      .eq('team_id', teamId)
      .eq('status', 'active')
      .single();

    if (existingPlan) {
      return NextResponse.json({
        message: 'Team already has an active plan',
        plan_tier: existingPlan.plan_tier,
      });
    }

    // Insert free rookie plan
    const insertPayload = buildFreePlanInsert(teamId, user.id, 'rookie');

    const { data: plan, error: insertError } = await supabase
      .from('team_communication_plans')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to activate rookie plan:', insertError);
      return NextResponse.json(
        { error: 'Failed to activate plan' },
        { status: 500 }
      );
    }

    // Log audit event
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_email: user.email,
      action: 'communication_plan.rookie_activated',
      target_type: 'team',
      target_id: teamId,
      target_name: team.name,
      metadata: {
        plan_id: plan.id,
        plan_tier: 'rookie',
      },
    });

    return NextResponse.json({
      message: 'Rookie plan activated',
      plan_id: plan.id,
      plan_tier: 'rookie',
    }, { status: 201 });
  } catch (error) {
    console.error('Error activating rookie plan:', error);
    return NextResponse.json(
      { error: 'Failed to activate plan' },
      { status: 500 }
    );
  }
}
