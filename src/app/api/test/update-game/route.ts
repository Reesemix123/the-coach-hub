/**
 * Test API route to update game result
 * Hit this endpoint in browser: http://localhost:3001/api/test/update-game
 */

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const TEAM_ID = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

export async function GET() {
  try {
    const supabase = await createClient();

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
