// /api/tokens/consume - Consume a token when creating a game
// POST: Consumes one token from the team's balance

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { TokenService } from '@/lib/entitlements/token-service';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { team_id, game_id } = body;

  if (!team_id) {
    return NextResponse.json(
      { error: 'team_id is required' },
      { status: 400 }
    );
  }

  if (!game_id) {
    return NextResponse.json(
      { error: 'game_id is required' },
      { status: 400 }
    );
  }

  // Verify user has access to this team
  const { data: team } = await supabase
    .from('teams')
    .select('id, user_id')
    .eq('id', team_id)
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
    .select('id')
    .eq('team_id', team_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (team.user_id !== user.id && !membership) {
    return NextResponse.json(
      { error: 'Access denied to this team' },
      { status: 403 }
    );
  }

  try {
    const tokenService = new TokenService(supabase);
    const result = await tokenService.consumeToken(team_id, game_id, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to consume token' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      remainingTotal: result.remainingTotal
    });

  } catch (error) {
    console.error('Error consuming token:', error);
    return NextResponse.json(
      { error: 'Failed to consume token' },
      { status: 500 }
    );
  }
}
