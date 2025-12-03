/**
 * Test API route to update game result
 * SECURITY: Requires authentication and platform admin access
 * Only works in development or for platform admins
 */

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // SECURITY: Require authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // SECURITY: Only allow in development OR for platform admins
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (!isDevelopment) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_platform_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_platform_admin) {
        return NextResponse.json(
          { error: 'This endpoint is only available in development or for platform admins' },
          { status: 403 }
        );
      }
    }

    // Get user's first team (not a hardcoded ID)
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (!teams?.length) {
      return NextResponse.json({ error: 'No team found for user' }, { status: 400 });
    }

    const TEAM_ID = teams[0].id;

    // First, check what games exist
    const { data: games, error: fetchError } = await supabase
      .from('games')
      .select('id, name, opponent, date, game_result, team_score, opponent_score')
      .eq('team_id', TEAM_ID);

    if (fetchError) {
      return NextResponse.json({ error: 'Error fetching games', details: fetchError }, { status: 500 });
    }

    if (!games || games.length === 0) {
      return NextResponse.json({ message: 'No games found for this team' }, { status: 404 });
    }

    // Update the first game to be a win
    const gameId = games[0].id;

    const { data, error } = await supabase
      .from('games')
      .update({
        game_result: 'win',
        team_score: 28,
        opponent_score: 14
      })
      .eq('id', gameId)
      .select();

    if (error) {
      return NextResponse.json({ error: 'Error updating game', details: error }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Game updated successfully!',
      before: games[0],
      after: data?.[0],
      instruction: 'Refresh the Analytics & Reports page to see the 1-0 record and 100% Win Rate'
    });

  } catch (error) {
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
