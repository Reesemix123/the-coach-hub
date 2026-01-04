import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

const TEAM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

async function check() {
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'testcoach@youthcoachhub.test',
    password: 'test'
  });

  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }

  // Get raw data from play_instances
  console.log('=== SEED DATA CHECK ===\n');

  const { data: plays } = await supabase
    .from('play_instances')
    .select('*')
    .eq('team_id', TEAM_ID);

  // Kickoff section
  const kickoffs = plays?.filter(p => p.is_kickoff === true) || [];
  const touchbacks = plays?.filter(p => p.is_touchback === true && p.is_kickoff === true) || [];
  console.log('KICKOFF PERFORMANCE:');
  console.log(`  Kickoffs: ${kickoffs.length} (seed data)`);
  console.log(`  Touchbacks: ${touchbacks.length} (seed data: is_touchback=true AND is_kickoff=true)`);

  // Punt section
  const punts = plays?.filter(p => p.is_punt === true) || [];
  const puntYards = punts.reduce((sum, p) => sum + (p.kick_distance || 0), 0);
  console.log('\nPUNT PERFORMANCE:');
  console.log(`  Punts: ${punts.length} (seed data)`);
  console.log(`  Total punt yards (kick_distance): ${puntYards}`);
  console.log(`  Sample punt kick_distance values:`, punts.slice(0, 3).map(p => p.kick_distance));

  // Returns section
  const puntReturns = plays?.filter(p => p.is_punt_return === true) || [];
  const kickoffReturns = plays?.filter(p => p.is_kickoff_return === true) || [];
  const puntReturnYards = puntReturns.reduce((sum, p) => sum + (p.return_yards || 0), 0);
  const kickoffReturnYards = kickoffReturns.reduce((sum, p) => sum + (p.return_yards || 0), 0);
  const allReturns = [...puntReturns, ...kickoffReturns];
  const longestReturn = Math.max(0, ...allReturns.map(p => p.return_yards || 0));

  console.log('\nRETURN PERFORMANCE:');
  console.log(`  Punt Returns: ${puntReturns.length} with ${puntReturnYards} yards`);
  console.log(`  Kickoff Returns: ${kickoffReturns.length} with ${kickoffReturnYards} yards`);
  console.log(`  Longest Return: ${longestReturn} (calculated from seed data)`);

  // Field Goal section
  const fgAttempts = plays?.filter(p => p.is_field_goal_attempt === true) || [];
  const fgMade = plays?.filter(p => p.is_field_goal_made === true) || [];
  const fgBlocked = plays?.filter(p => p.is_field_goal_attempt === true && p.kick_result === 'blocked') || [];

  console.log('\nFIELD GOAL PERFORMANCE:');
  console.log(`  FG Attempts: ${fgAttempts.length}`);
  console.log(`  FG Made: ${fgMade.length}`);
  console.log(`  FG Blocked (kick_result='blocked'): ${fgBlocked.length}`);

  // PAT section
  const patAttempts = plays?.filter(p => p.is_extra_point_attempt === true) || [];
  const patMade = plays?.filter(p => p.is_extra_point_made === true) || [];

  console.log('\nPAT PERFORMANCE:');
  console.log(`  PAT Attempts: ${patAttempts.length}`);
  console.log(`  PAT Made: ${patMade.length}`);

  // FG Block section (defensive)
  // This would need opponent plays with blocked FGs
  const oppPlays = plays?.filter(p => p.is_opponent_play === true) || [];
  const blockedOppFGs = oppPlays.filter(p => p.is_field_goal_attempt === true && p.kick_result === 'blocked');

  console.log('\nFG BLOCK PERFORMANCE (Defense):');
  console.log(`  Opponent FG attempts: ${oppPlays.filter(p => p.is_field_goal_attempt === true).length}`);
  console.log(`  Blocked opponent FGs: ${blockedOppFGs.length}`);

  // Now get the RPC result
  console.log('\n\n=== RPC FUNCTION RESULT ===\n');

  const { data: metrics } = await supabase.rpc('calculate_team_metrics', {
    p_team_id: TEAM_ID,
    p_game_id: null,
    p_start_date: null,
    p_end_date: null,
    p_opponent: null,
  });

  const st = metrics?.specialTeams;

  console.log('KICKOFF:');
  console.log(`  kickoffs: ${st?.kickoff?.kickoffs}`);
  console.log(`  touchbacks: ${st?.kickoff?.touchbacks}`);
  console.log(`  touchbackRate: ${st?.kickoff?.touchbackRate}`);
  console.log(`  averageKickoffYardLine: ${st?.kickoff?.averageKickoffYardLine}`);

  console.log('\nPUNT:');
  console.log(`  punts: ${st?.punt?.punts}`);
  console.log(`  totalYards: ${st?.punt?.totalYards}`);
  console.log(`  averagePuntYards: ${st?.punt?.averagePuntYards}`);
  console.log(`  netPuntAverage: ${st?.punt?.netPuntAverage}`);

  console.log('\nRETURNS:');
  console.log(`  returns: ${st?.returns?.returns}`);
  console.log(`  puntReturns: ${st?.returns?.puntReturns}`);
  console.log(`  kickReturns: ${st?.returns?.kickReturns}`);
  console.log(`  averageReturnYards: ${st?.returns?.averageReturnYards}`);
  console.log(`  longestReturn: ${st?.returns?.longestReturn}`);

  console.log('\nFIELD GOAL:');
  console.log(`  made: ${st?.fieldGoal?.made}`);
  console.log(`  attempted: ${st?.fieldGoal?.attempted}`);
  console.log(`  percentage: ${st?.fieldGoal?.percentage}`);
  console.log(`  blocked: ${st?.fieldGoal?.blocked}`);

  console.log('\nPAT:');
  console.log(`  made: ${st?.pat?.made}`);
  console.log(`  attempted: ${st?.pat?.attempted}`);
  console.log(`  percentage: ${st?.pat?.percentage}`);

  console.log('\nFG BLOCK (Defense):');
  console.log(`  blocks: ${st?.fgBlock?.blocks}`);
  console.log(`  blocksRecovered: ${st?.fgBlock?.blocksRecovered}`);
  console.log(`  blocksReturnedForTD: ${st?.fgBlock?.blocksReturnedForTD}`);

  // Summary
  console.log('\n\n=== ZERO VALUES ANALYSIS ===\n');

  const issues: string[] = [];

  if (st?.kickoff?.touchbacks === 0 && touchbacks.length === 0) {
    issues.push('Touchbacks: 0 - SEED DATA missing is_touchback=true on kickoffs');
  }

  if ((st?.punt?.totalYards === 0 || st?.punt?.averagePuntYards === null) && puntYards === 0) {
    issues.push('Punt Yards: 0 - SEED DATA missing kick_distance on punts');
  }

  if (st?.returns?.longestReturn === 0) {
    issues.push('Longest Return: 0 - FUNCTION hardcoded to 0 (would need MAX tracking)');
  }

  if (st?.fieldGoal?.blocked === 0 && fgBlocked.length === 0) {
    issues.push('FGs Blocked: 0 - SEED DATA has no blocked FGs (kick_result=blocked)');
  }

  if (st?.fgBlock?.blocks === 0) {
    issues.push('FG Blocks (Defense): 0 - FUNCTION hardcoded to 0 (needs tracking of blocked opponent FGs)');
  }

  if (st?.fgBlock?.blocksRecovered === 0) {
    issues.push('Blocks Recovered: 0 - FUNCTION hardcoded to 0 (not tracked)');
  }

  if (st?.fgBlock?.blocksReturnedForTD === 0) {
    issues.push('Blocks for TD: 0 - FUNCTION hardcoded to 0 (not tracked)');
  }

  issues.forEach(i => console.log(`- ${i}`));
}

check().catch(console.error);
