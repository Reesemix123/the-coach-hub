/**
 * AI Practice Plan Generator API
 *
 * POST /api/practice/ai-generate
 * Generate an AI-powered practice plan based on team analytics.
 *
 * GET /api/practice/ai-generate/analysis
 * Get initial team analysis for conversation start.
 *
 * POST /api/practice/ai-generate/refine
 * Refine an existing plan based on coach feedback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  generatePracticePlan,
  streamPracticePlan,
  generateTeamAnalysis,
  refinePracticePlan,
  type GeneratedPracticePlan,
} from '@/lib/ai/practice/practice-plan-generator';
import { fetchUpcomingGames } from '@/lib/ai/practice/practice-data-fetcher';

/**
 * Request body for plan generation
 */
interface GenerateRequest {
  teamId: string;
  duration?: number;
  focusAreas?: string[];
  opponentName?: string;
  gameId?: string;
  practiceDate?: string;
  practiceLocation?: string;
  contactLevel?: 'no_contact' | 'thud' | 'live';
  equipmentWorn?: 'helmets' | 'shells' | 'full_pads';
  equipmentNeeded?: string[];
  coachCount?: number;
  conditioning?: {
    type: 'sprints' | 'gassers' | 'ladders' | 'shuttles' | 'intervals' | 'bear_crawls' | 'custom' | 'none';
    duration: number;
  };
  stream?: boolean;
}

/**
 * Request body for plan refinement
 */
interface RefineRequest {
  teamId: string;
  currentPlan: GeneratedPracticePlan;
  feedback: string;
  teamLevel?: string;
}

/**
 * POST /api/practice/ai-generate
 * Generate a new practice plan
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateRequest;
    const { teamId, duration, focusAreas, opponentName, gameId, contactLevel, equipmentWorn, equipmentNeeded, coachCount, conditioning, stream } = body;

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
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
      // Also check team memberships
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

    // Check subscription tier for AI access
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, status, billing_waived')
      .eq('team_id', teamId)
      .maybeSingle();

    const isActive = subscription && (
      subscription.status === 'active' ||
      subscription.status === 'trialing' ||
      subscription.billing_waived
    );

    // Allow access in development or if no subscription exists yet (trial/new team)
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (!isActive && !isDevelopment) {
      return NextResponse.json(
        { error: 'Active subscription required for AI features' },
        { status: 403 }
      );
    }

    // Generate plan
    if (stream) {
      // Return streaming response
      const planStream = await streamPracticePlan(supabase, teamId, {
        duration,
        focusAreas,
        opponentName,
        gameId,
        contactLevel,
        equipmentWorn,
        equipmentNeeded,
        coachCount,
        conditioning,
      });

      return new Response(planStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } else {
      // Return complete plan as JSON
      const plan = await generatePracticePlan(supabase, teamId, {
        duration,
        focusAreas,
        opponentName,
        gameId,
        contactLevel,
        equipmentWorn,
        equipmentNeeded,
        coachCount,
        conditioning,
      });

      return NextResponse.json({ plan });
    }
  } catch (error) {
    console.error('Practice plan generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate practice plan';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/practice/ai-generate
 * Get team analysis and upcoming games for conversation start
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamId = searchParams.get('teamId');
    const opponentName = searchParams.get('opponent');

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
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

    // Get upcoming games and team analysis in parallel
    const [upcomingGames, analysis] = await Promise.all([
      fetchUpcomingGames(supabase, teamId),
      generateTeamAnalysis(supabase, teamId, opponentName || undefined),
    ]);

    return NextResponse.json({
      upcomingGames,
      analysis,
    });
  } catch (error) {
    console.error('Practice analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to get team analysis' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/practice/ai-generate
 * Refine an existing practice plan
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as RefineRequest;
    const { teamId, currentPlan, feedback, teamLevel } = body;

    if (!teamId || !currentPlan || !feedback) {
      return NextResponse.json(
        { error: 'Team ID, current plan, and feedback are required' },
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

    // Get team level if not provided
    let level = teamLevel || 'youth';
    if (!teamLevel) {
      const { data: team } = await supabase
        .from('teams')
        .select('level')
        .eq('id', teamId)
        .single();

      level = team?.level || 'youth';
    }

    // Refine the plan
    const refinedPlan = await refinePracticePlan(currentPlan, feedback, level);

    return NextResponse.json({ plan: refinedPlan });
  } catch (error) {
    console.error('Practice plan refinement error:', error);
    const message = error instanceof Error ? error.message : 'Failed to refine practice plan';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
