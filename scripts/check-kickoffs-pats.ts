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
  await supabase.auth.signInWithPassword({
    email: 'testcoach@youthcoachhub.test',
    password: 'test'
  });

  console.log('=== Checking Kickoffs ===');

  // All kickoffs
  const { data: allKickoffs, count: allKickoffsCount } = await supabase
    .from('play_instances')
    .select('id, is_kickoff, is_opponent_play, is_touchback', { count: 'exact' })
    .eq('team_id', TEAM_ID)
    .eq('is_kickoff', true);

  console.log('Total kickoffs:', allKickoffsCount);

  // Our kickoffs (is_opponent_play = false)
  const { count: ourKickoffs } = await supabase
    .from('play_instances')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', TEAM_ID)
    .eq('is_kickoff', true)
    .eq('is_opponent_play', false);

  console.log('Our kickoffs (is_opponent_play=false):', ourKickoffs);

  // Opponent kickoffs (is_opponent_play = true)
  const { count: oppKickoffs } = await supabase
    .from('play_instances')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', TEAM_ID)
    .eq('is_kickoff', true)
    .eq('is_opponent_play', true);

  console.log('Opponent kickoffs (is_opponent_play=true):', oppKickoffs);

  // Sample kickoff data
  console.log('\nSample kickoff data:');
  if (allKickoffs && allKickoffs.length > 0) {
    allKickoffs.slice(0, 5).forEach(k => {
      console.log('  is_kickoff:', k.is_kickoff, 'is_opponent_play:', k.is_opponent_play, 'is_touchback:', k.is_touchback);
    });
  }

  console.log('\n=== Checking PATs (Extra Points) ===');

  // All PATs
  const { data: allPats, count: allPatsCount } = await supabase
    .from('play_instances')
    .select('id, is_extra_point_attempt, is_extra_point_made, is_opponent_play', { count: 'exact' })
    .eq('team_id', TEAM_ID)
    .eq('is_extra_point_attempt', true);

  console.log('Total PAT attempts:', allPatsCount);

  // Our PATs
  const { count: ourPats } = await supabase
    .from('play_instances')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', TEAM_ID)
    .eq('is_extra_point_attempt', true)
    .eq('is_opponent_play', false);

  console.log('Our PATs (is_opponent_play=false):', ourPats);

  // Sample PAT data
  console.log('\nSample PAT data:');
  if (allPats && allPats.length > 0) {
    allPats.slice(0, 5).forEach(p => {
      console.log('  is_extra_point_attempt:', p.is_extra_point_attempt, 'is_extra_point_made:', p.is_extra_point_made, 'is_opponent_play:', p.is_opponent_play);
    });
  }

  console.log('\n=== Testing the query from migration 132 ===');

  // Test the exact query from migration 132 for kickoffs
  const { data: kickoffQuery } = await supabase
    .from('play_instances')
    .select('id')
    .eq('team_id', TEAM_ID)
    .eq('is_kickoff', true)
    .eq('is_opponent_play', false);

  console.log('Kickoffs matching migration 132 query (is_kickoff=true AND is_opponent_play=false):', kickoffQuery?.length || 0);

  // Test for PATs
  const { data: patQuery } = await supabase
    .from('play_instances')
    .select('id')
    .eq('team_id', TEAM_ID)
    .eq('is_extra_point_attempt', true)
    .eq('is_opponent_play', false);

  console.log('PATs matching migration 132 query (is_extra_point_attempt=true AND is_opponent_play=false):', patQuery?.length || 0);
}

main().catch(console.error);
