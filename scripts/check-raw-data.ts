/**
 * Script to check raw data in database tables
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bawcgmongnswmrxfsweh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhd2NnbW9uZ25zd21yeGZzd2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTI4MzAsImV4cCI6MjA2NDA4ODgzMH0.hN8_Vgm5GxSVazYYIITjsHAR-7lZQKz5R6jqqXCPGQ0'
);

async function main() {
  console.log('Checking raw data...\n');

  // Check play_instances
  const { data: plays, error: playsError } = await supabase
    .from('play_instances')
    .select('*')
    .limit(5);

  console.log('=== play_instances ===');
  if (playsError) {
    console.log('Error:', playsError.message);
  } else {
    console.log('Count:', plays?.length);
    if (plays && plays.length > 0) {
      console.log('Sample:', JSON.stringify(plays[0], null, 2));
    }
  }

  // Check players
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .limit(5);

  console.log('\n=== players ===');
  if (playersError) {
    console.log('Error:', playersError.message);
  } else {
    console.log('Count:', players?.length);
    if (players && players.length > 0) {
      console.log('Sample:', JSON.stringify(players[0], null, 2));
    }
  }

  // Check player_participation
  const { data: participation, error: participationError } = await supabase
    .from('player_participation')
    .select('*')
    .limit(5);

  console.log('\n=== player_participation ===');
  if (participationError) {
    console.log('Error:', participationError.message);
  } else {
    console.log('Count:', participation?.length);
    if (participation && participation.length > 0) {
      console.log('Sample:', JSON.stringify(participation[0], null, 2));
    }
  }

  // Check teams
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, user_id')
    .limit(5);

  console.log('\n=== teams ===');
  if (teamsError) {
    console.log('Error:', teamsError.message);
  } else {
    console.log('Teams:', teams);
  }
}

main().catch(console.error);
