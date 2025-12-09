// /api/enforcement - Tier Enforcement API
// Enforce tier limits for a team (lock/unlock games as needed)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { teamId } = body;

    if (!teamId) {
      return NextResponse.json(
        { error: 'team_id is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this team
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Check if user owns the team or is a member
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isOwner = team.user_id === user.id;
    const isAdmin = membership?.role === 'owner' || membership?.role === 'coach';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Enforce tier limits
    const { data, error } = await supabase.rpc('enforce_tier_limits', {
      p_team_id: teamId
    });

    if (error) {
      console.error('Failed to enforce tier limits:', error);
      return NextResponse.json(
        { error: 'Failed to enforce tier limits', details: error.message },
        { status: 500 }
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      success: true,
      gamesLocked: result?.games_locked || 0,
      gamesUnlocked: result?.games_unlocked || 0,
      currentActiveGames: result?.current_active_games || 0,
      maxAllowedGames: result?.max_allowed_games || 0
    });

  } catch (err) {
    console.error('Enforcement API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check enforcement status
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json(
        { error: 'teamId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this team
    const { data: team } = await supabase
      .from('teams')
      .select('id, user_id')
      .eq('id', teamId)
      .single();

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Check access
    const { data: membership } = await supabase
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const isOwner = team.user_id === user.id;
    const isMember = !!membership;

    if (!isOwner && !isMember) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get tier limits
    const { data: limits } = await supabase.rpc('get_team_tier_limits', {
      p_team_id: teamId
    });

    // Count active games
    const { data: activeCount } = await supabase.rpc('count_active_games', {
      p_team_id: teamId
    });

    // Get locked games
    const { data: lockedGames } = await supabase
      .from('games')
      .select('id, name, locked_reason, created_at')
      .eq('team_id', teamId)
      .eq('is_locked', true)
      .order('created_at', { ascending: false });

    // Get expiring games (within 7 days)
    const { data: expiringGames } = await supabase.rpc('get_expiring_games', {
      p_team_id: teamId,
      p_days_ahead: 7
    });

    const tierLimits = Array.isArray(limits) && limits.length > 0 ? limits[0] : null;

    return NextResponse.json({
      tierKey: tierLimits?.tier_key || 'basic',
      maxActiveGames: tierLimits?.max_active_games || 3,
      camerasPerGame: tierLimits?.cameras_per_game || 1,
      retentionDays: tierLimits?.retention_days || 30,
      currentActiveGames: activeCount || 0,
      lockedGames: lockedGames || [],
      expiringGames: expiringGames || []
    });

  } catch (err) {
    console.error('Enforcement status API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
