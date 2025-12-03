import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * User Onboarding API
 * Manages onboarding tour and checklist state for coaches
 */

/**
 * GET /api/user/onboarding?team_id=xxx
 * Get onboarding state + checklist completion for a team
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');

    if (!teamId) {
      return NextResponse.json(
        { error: 'team_id is required' },
        { status: 400 }
      );
    }

    // Get onboarding record for this user/team
    const { data: onboardingRecord, error: onboardingError } = await supabase
      .from('user_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .eq('team_id', teamId)
      .single();

    // Not found is ok - user hasn't started onboarding yet
    if (onboardingError && onboardingError.code !== 'PGRST116') {
      console.error('Error fetching onboarding:', onboardingError);
      return NextResponse.json(
        { error: 'Failed to fetch onboarding state' },
        { status: 500 }
      );
    }

    // Check checklist completion by counting records in each table
    // Note: videos are linked through games, so we need to join
    const [playersResult, gamesResult, playsResult, videosResult] = await Promise.all([
      supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId),
      supabase
        .from('games')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId),
      supabase
        .from('playbook_plays')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId),
      // Videos are linked through games, so count videos where game.team_id matches
      supabase
        .from('videos')
        .select('id, games!inner(team_id)', { count: 'exact', head: true })
        .eq('games.team_id', teamId),
    ]);

    const completedItems = {
      hasPlayers: (playersResult.count || 0) > 0,
      hasGames: (gamesResult.count || 0) > 0,
      hasPlays: (playsResult.count || 0) > 0,
      hasVideos: (videosResult.count || 0) > 0,
    };

    const completionCount = Object.values(completedItems).filter(Boolean).length;
    const totalItems = 4;

    const response = {
      tourCompleted: !!onboardingRecord?.tour_completed_at,
      tourSkipped: !!onboardingRecord?.tour_skipped_at,
      checklistDismissed: !!onboardingRecord?.checklist_dismissed_at,
      completedItems,
      completionCount,
      totalItems,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Onboarding GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/onboarding
 * Update onboarding state (tour completed, skipped, checklist dismissed)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { team_id, action } = body;

    if (!team_id) {
      return NextResponse.json(
        { error: 'team_id is required' },
        { status: 400 }
      );
    }

    if (!action || !['complete_tour', 'skip_tour', 'dismiss_checklist', 'reset_tour'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action is required (complete_tour, skip_tour, dismiss_checklist, reset_tour)' },
        { status: 400 }
      );
    }

    // First, try to get existing record
    const { data: existingRecord } = await supabase
      .from('user_onboarding')
      .select('id')
      .eq('user_id', user.id)
      .eq('team_id', team_id)
      .single();

    let updateData: Record<string, string | null> = {};

    switch (action) {
      case 'complete_tour':
        updateData = { tour_completed_at: new Date().toISOString() };
        break;
      case 'skip_tour':
        updateData = { tour_skipped_at: new Date().toISOString() };
        break;
      case 'dismiss_checklist':
        updateData = { checklist_dismissed_at: new Date().toISOString() };
        break;
      case 'reset_tour':
        updateData = {
          tour_completed_at: null,
          tour_skipped_at: null,
        };
        break;
    }

    if (existingRecord) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('user_onboarding')
        .update(updateData)
        .eq('id', existingRecord.id);

      if (updateError) {
        console.error('Error updating onboarding:', updateError);
        return NextResponse.json(
          { error: 'Failed to update onboarding state' },
          { status: 500 }
        );
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('user_onboarding')
        .insert({
          user_id: user.id,
          team_id,
          ...updateData,
        });

      if (insertError) {
        console.error('Error inserting onboarding:', insertError);
        return NextResponse.json(
          { error: 'Failed to create onboarding state' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error('Onboarding POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
