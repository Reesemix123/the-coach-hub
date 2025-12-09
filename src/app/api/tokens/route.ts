// /api/tokens - Upload Token API
// Get token balance and transaction history for authenticated user's teams

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { TokenService } from '@/lib/entitlements/token-service';

/**
 * GET /api/tokens
 * Returns token balance for a team
 *
 * Query params:
 * - team_id: string (required) - Team ID to get balance for
 * - include_history: boolean (optional) - Include recent transaction history
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('team_id');
  const includeHistory = searchParams.get('include_history') === 'true';

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
    .select('id')
    .eq('team_id', teamId)
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
    const summary = await tokenService.getTokenBalanceSummary(teamId);

    const response: {
      balance: typeof summary;
      history?: Awaited<ReturnType<typeof tokenService.getTransactionHistory>>;
    } = {
      balance: summary
    };

    if (includeHistory) {
      response.history = await tokenService.getTransactionHistory(teamId, { limit: 10 });
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching token balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token balance' },
      { status: 500 }
    );
  }
}
