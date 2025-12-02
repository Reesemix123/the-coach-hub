/**
 * Update test game with win result
 * Run with: npx tsx scripts/update-game-result.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bawcgmongnswmrxfsweh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhd2NnbW9uZ25zd21yeGZzd2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTI4MzAsImV4cCI6MjA2NDA4ODgzMH0.hN8_Vgm5GxSVazYYIITjsHAR-7lZQKz5R6jqqXCPGQ0'
);

const TEAM_ID = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

async function main() {
  console.log('Updating game result...\n');

  // First, check what games exist
  const { data: games, error: fetchError } = await supabase
    .from('games')
    .select('id, name, opponent, date, game_result, team_score, opponent_score')
    .eq('team_id', TEAM_ID);

  if (fetchError) {
    console.error('Error fetching games:', fetchError);
    return;
  }

  console.log('Current games:', games);

  if (!games || games.length === 0) {
    console.log('No games found for this team.');
    return;
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
    console.error('Error updating game:', error);
    return;
  }

  console.log('\nGame updated successfully!');
  console.log('Updated game:', data);
  console.log('\nRefresh the Analytics & Reports page to see the win rate.');
}

main().catch(console.error);
