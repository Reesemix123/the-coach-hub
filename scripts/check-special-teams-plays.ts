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

  // Check play_instances with special teams flags
  console.log('--- Checking play_instances special teams flags ---');

  const { data: kickoffs, error: e1 } = await supabase
    .from('play_instances')
    .select('id, is_kickoff, is_touchback, kick_distance, is_opponent_play')
    .eq('team_id', TEAM_ID)
    .eq('is_kickoff', true)
    .limit(5);

  console.log('\nKickoffs (is_kickoff=true):');
  console.log('Count from query:', kickoffs?.length || 0);
  if (kickoffs && kickoffs.length > 0) {
    kickoffs.forEach(k => console.log('  ', k));
  }

  const { data: punts, error: e2 } = await supabase
    .from('play_instances')
    .select('id, is_punt, kick_distance, is_opponent_play')
    .eq('team_id', TEAM_ID)
    .eq('is_punt', true)
    .limit(5);

  console.log('\nPunts (is_punt=true):');
  console.log('Count from query:', punts?.length || 0);
  if (punts && punts.length > 0) {
    punts.forEach(p => console.log('  ', p));
  }

  const { data: fgAttempts, error: e3 } = await supabase
    .from('play_instances')
    .select('id, is_field_goal_attempt, is_field_goal_made, kick_distance, is_opponent_play')
    .eq('team_id', TEAM_ID)
    .eq('is_field_goal_attempt', true)
    .limit(5);

  console.log('\nField Goal Attempts (is_field_goal_attempt=true):');
  console.log('Count from query:', fgAttempts?.length || 0);
  if (fgAttempts && fgAttempts.length > 0) {
    fgAttempts.forEach(f => console.log('  ', f));
  }

  // Count all special teams plays
  console.log('\n--- Summary counts ---');

  const { count: kickoffCount } = await supabase
    .from('play_instances')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', TEAM_ID)
    .eq('is_kickoff', true);

  const { count: puntCount } = await supabase
    .from('play_instances')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', TEAM_ID)
    .eq('is_punt', true);

  const { count: fgCount } = await supabase
    .from('play_instances')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', TEAM_ID)
    .eq('is_field_goal_attempt', true);

  const { count: xpCount } = await supabase
    .from('play_instances')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', TEAM_ID)
    .eq('is_extra_point_attempt', true);

  console.log('Total kickoffs (is_kickoff=true):', kickoffCount);
  console.log('Total punts (is_punt=true):', puntCount);
  console.log('Total FG attempts (is_field_goal_attempt=true):', fgCount);
  console.log('Total XP attempts (is_extra_point_attempt=true):', xpCount);

  // Now test calculate_team_metrics RPC
  console.log('\n--- Testing calculate_team_metrics RPC ---');
  const { data: metrics, error: metricsError } = await supabase.rpc('calculate_team_metrics', {
    p_team_id: TEAM_ID,
    p_game_id: null,
    p_start_date: null,
    p_end_date: null,
    p_opponent: null
  });

  if (metricsError) {
    console.log('Error:', metricsError.message);
  } else {
    console.log('Special Teams Metrics from calculate_team_metrics:');
    console.log(JSON.stringify(metrics?.specialTeams, null, 2));

    console.log('\n--- Checking nested structure ---');
    console.log('specialTeams.kickoff:', metrics?.specialTeams?.kickoff);
    console.log('specialTeams.punt:', metrics?.specialTeams?.punt);
    console.log('specialTeams.returns:', metrics?.specialTeams?.returns);
    console.log('specialTeams.fieldGoal:', metrics?.specialTeams?.fieldGoal);
    console.log('specialTeams.pat:', metrics?.specialTeams?.pat);
    console.log('specialTeams.fgBlock:', metrics?.specialTeams?.fgBlock);

    console.log('\n--- Full metrics output (first level keys) ---');
    console.log('Keys:', Object.keys(metrics || {}));

    console.log('\n--- Games played ---');
    console.log('filters.gamesPlayed:', metrics?.filters?.gamesPlayed);
  }
}

main().catch(console.error);
