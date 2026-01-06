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

  // Get kicker player ID
  const { data: kicker } = await supabase
    .from('players')
    .select('id, jersey_number, first_name, last_name')
    .eq('team_id', TEAM_ID)
    .eq('jersey_number', '3')
    .single();

  console.log('Kicker:', kicker);

  // Get all kicker participation records
  const { data: kickerParts, count } = await supabase
    .from('player_participation')
    .select('*', { count: 'exact' })
    .eq('team_id', TEAM_ID)
    .eq('participation_type', 'kicker');

  console.log('\nTotal kicker participation records:', count);

  // Check which play types have kicker participation
  if (kickerParts && kickerParts.length > 0) {
    // Get all play instances for these participations
    const playIds = kickerParts.map(p => p.play_instance_id);

    const { data: plays } = await supabase
      .from('play_instances')
      .select('id, is_kickoff, is_field_goal_attempt, is_extra_point_attempt, special_teams_unit')
      .in('id', playIds);

    const kickoffs = plays?.filter(p => p.is_kickoff) || [];
    const fgs = plays?.filter(p => p.is_field_goal_attempt) || [];
    const pats = plays?.filter(p => p.is_extra_point_attempt) || [];

    console.log('\nKicker participation by play type:');
    console.log('  Kickoffs:', kickoffs.length);
    console.log('  Field Goals:', fgs.length);
    console.log('  PATs:', pats.length);

    console.log('\nSample participation records with play info:');
    for (let i = 0; i < Math.min(10, kickerParts.length); i++) {
      const part = kickerParts[i];
      const play = plays?.find(p => p.id === part.play_instance_id);
      console.log('  play_instance_id:', part.play_instance_id?.substring(0, 8),
        '| is_kickoff:', play?.is_kickoff,
        '| is_fg:', play?.is_field_goal_attempt,
        '| is_pat:', play?.is_extra_point_attempt,
        '| unit:', play?.special_teams_unit);
    }
  }

  // Now check what plays SHOULD have kicker participation but don't
  console.log('\n=== Checking plays missing kicker participation ===');

  // Get all our kickoffs
  const { data: ourKickoffs } = await supabase
    .from('play_instances')
    .select('id')
    .eq('team_id', TEAM_ID)
    .eq('is_kickoff', true)
    .eq('is_opponent_play', false);

  // Get all our PATs
  const { data: ourPats } = await supabase
    .from('play_instances')
    .select('id')
    .eq('team_id', TEAM_ID)
    .eq('is_extra_point_attempt', true)
    .eq('is_opponent_play', false);

  // Get all our FGs
  const { data: ourFgs } = await supabase
    .from('play_instances')
    .select('id')
    .eq('team_id', TEAM_ID)
    .eq('is_field_goal_attempt', true)
    .eq('is_opponent_play', false);

  // Check how many have kicker participation
  const kickerPlayIds = new Set(kickerParts?.map(p => p.play_instance_id) || []);

  const kickoffsWithPart = ourKickoffs?.filter(k => kickerPlayIds.has(k.id)) || [];
  const patsWithPart = ourPats?.filter(p => kickerPlayIds.has(p.id)) || [];
  const fgsWithPart = ourFgs?.filter(f => kickerPlayIds.has(f.id)) || [];

  console.log('Our Kickoffs:', ourKickoffs?.length, '| with kicker participation:', kickoffsWithPart.length);
  console.log('Our PATs:', ourPats?.length, '| with kicker participation:', patsWithPart.length);
  console.log('Our FGs:', ourFgs?.length, '| with kicker participation:', fgsWithPart.length);
}

main().catch(console.error);
