import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TEAM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

async function main() {
  // Login
  await supabase.auth.signInWithPassword({
    email: 'testcoach@youthcoachhub.test',
    password: 'test'
  });

  // Get all players
  const { data: players, error } = await supabase
    .from('players')
    .select('id, jersey_number, first_name, last_name, primary_position, position_group')
    .eq('team_id', TEAM_ID)
    .order('jersey_number');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total players: ' + (players ? players.length : 0));
  console.log('\nAll players:');
  if (players) {
    players.forEach(p => {
      console.log('  #' + p.jersey_number + ' - ' + p.first_name + ' ' + p.last_name + ' (' + (p.primary_position || 'NO POSITION') + ') - ' + (p.position_group || 'NO GROUP'));
    });
  }

  // Check specifically for #3 and #9
  const kicker = players ? players.find(p => p.jersey_number === '3') : null;
  const punter = players ? players.find(p => p.jersey_number === '9') : null;

  console.log('\n--- Special Teams Players ---');
  console.log('Kicker #3:', kicker ? 'EXISTS - ' + kicker.first_name + ' ' + kicker.last_name : 'DOES NOT EXIST');
  console.log('Punter #9:', punter ? 'EXISTS - ' + punter.first_name + ' ' + punter.last_name : 'DOES NOT EXIST');

  // Also check for player_participation records for special teams - count by type
  const { data: kickerPart } = await supabase
    .from('player_participation')
    .select('id', { count: 'exact' })
    .eq('team_id', TEAM_ID)
    .eq('participation_type', 'kicker');

  const { data: punterPart } = await supabase
    .from('player_participation')
    .select('id', { count: 'exact' })
    .eq('team_id', TEAM_ID)
    .eq('participation_type', 'punter');

  const { data: returnerPart } = await supabase
    .from('player_participation')
    .select('id', { count: 'exact' })
    .eq('team_id', TEAM_ID)
    .eq('participation_type', 'returner');

  console.log('\n--- Special Teams Participation Records ---');
  console.log('Kicker records:', kickerPart ? kickerPart.length : 0);
  console.log('Punter records:', punterPart ? punterPart.length : 0);
  console.log('Returner records:', returnerPart ? returnerPart.length : 0);

  // Now test the get_kicker_stats function directly
  console.log('\n--- Testing get_kicker_stats RPC ---');
  const { data: kickerStats, error: kickerError } = await supabase
    .rpc('get_kicker_stats', {
      p_team_id: TEAM_ID,
      p_game_id: null
    });

  if (kickerError) {
    console.log('Error:', kickerError.message);
  } else {
    console.log('Result:', JSON.stringify(kickerStats, null, 2));
  }

  // Test get_returner_stats
  console.log('\n--- Testing get_returner_stats RPC ---');
  const { data: returnerStats, error: returnerError } = await supabase
    .rpc('get_returner_stats', {
      p_team_id: TEAM_ID,
      p_game_id: null
    });

  if (returnerError) {
    console.log('Error:', returnerError.message);
  } else {
    console.log('Result:', JSON.stringify(returnerStats, null, 2));
  }
}

main().catch(console.error);
