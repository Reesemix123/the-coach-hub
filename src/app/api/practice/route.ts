/**
 * Practice Plan API
 *
 * POST /api/practice
 * Create a practice plan from AI-generated data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createFromAIGenerated, type AIGeneratedPlan } from '@/lib/services/practice-plan.service';

interface SelectedCoach {
  id: string;
  name: string;
  isGuest?: boolean;
}

interface CreatePracticeRequest {
  teamId: string;
  plan: AIGeneratedPlan;
  date: string;
  location?: string;
  coaches?: SelectedCoach[];
}

/**
 * POST /api/practice
 * Create a practice plan from AI-generated data
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreatePracticeRequest;
    const { teamId, plan, date, location, coaches } = body;

    if (!teamId || !plan) {
      return NextResponse.json(
        { error: 'Team ID and plan are required' },
        { status: 400 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user has access to this team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      // Check team memberships
      const { data: membership } = await supabase
        .from('team_memberships')
        .select('team_id')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!membership) {
        return NextResponse.json(
          { error: 'Team not found or access denied' },
          { status: 403 }
        );
      }
    } else if (team.user_id !== user.id) {
      // Check if member
      const { data: membership } = await supabase
        .from('team_memberships')
        .select('team_id')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!membership) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    // Create the practice plan
    const createdPlan = await createFromAIGenerated(
      teamId,
      plan,
      date || new Date().toISOString().split('T')[0],
      location,
      coaches
    );

    // Also create a schedule event for this practice
    const { error: eventError } = await supabase
      .from('team_events')
      .insert({
        team_id: teamId,
        event_type: 'practice',
        title: plan.title,
        description: plan.ai_reasoning,
        date: date || new Date().toISOString().split('T')[0],
        practice_plan_id: createdPlan.id,
        created_by: user.id
      });

    if (eventError) {
      console.error('Error creating schedule event:', eventError);
      // Don't fail the request - practice was created successfully
    }

    return NextResponse.json({
      id: createdPlan.id,
      message: 'Practice plan created successfully',
    });
  } catch (error) {
    console.error('Error creating practice plan:', error);
    const message = error instanceof Error ? error.message : 'Failed to create practice plan';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
