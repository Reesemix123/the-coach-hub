import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TEAM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

async function check() {
  // Login
  await supabase.auth.signInWithPassword({
    email: 'testcoach@youthcoachhub.test',
    password: 'test'
  });

  console.log('=== ROSTER ===');
  const { data: players } = await supabase
    .from('players')
    .select('id, jersey_number, first_name, last_name, primary_position, position_group, depth_order')
    .eq('team_id', TEAM_ID)
    .order('position_group')
    .order('primary_position')
    .order('depth_order');

  if (players?.length) {
    console.log(`Found ${players.length} players:`);
    let currentGroup = '';
    players.forEach(p => {
      if (p.position_group !== currentGroup) {
        currentGroup = p.position_group;
        console.log(`\n  ${currentGroup?.toUpperCase() || 'UNKNOWN'}:`);
      }
      console.log(`    #${p.jersey_number} ${p.first_name} ${p.last_name} - ${p.primary_position} (depth: ${p.depth_order})`);
    });
  } else {
    console.log('No players found');
  }

  console.log('\n=== PLAYBOOK ===');
  const { data: plays } = await supabase
    .from('playbook_plays')
    .select('id, play_code, play_name, attributes')
    .eq('team_id', TEAM_ID)
    .order('play_code');

  if (plays?.length) {
    console.log(`Found ${plays.length} plays:`);
    const byODK: Record<string, any[]> = { offense: [], defense: [], special: [] };
    plays.forEach(p => {
      const odk = p.attributes?.odk || 'unknown';
      if (!byODK[odk]) byODK[odk] = [];
      byODK[odk].push(p);
    });

    Object.entries(byODK).forEach(([odk, playsInOdk]) => {
      if (playsInOdk.length > 0) {
        console.log(`\n  ${odk.toUpperCase()} (${playsInOdk.length}):`);
        playsInOdk.slice(0, 5).forEach(p => {
          console.log(`    ${p.play_code}: ${p.play_name} - ${p.attributes?.formation || 'no formation'}`);
        });
        if (playsInOdk.length > 5) console.log(`    ... and ${playsInOdk.length - 5} more`);
      }
    });
  } else {
    console.log('No plays found');
  }

  console.log('\n=== GAMES ===');
  const { data: games } = await supabase
    .from('games')
    .select('id, name, opponent, date, team_score, opponent_score, game_result')
    .eq('team_id', TEAM_ID)
    .order('date');

  if (games?.length) {
    console.log(`Found ${games.length} games:`);
    games.forEach(g => {
      console.log(`  ${g.date}: ${g.name} - ${g.team_score || '?'}-${g.opponent_score || '?'} (${g.game_result || 'no result'})`);
    });
  }

  console.log('\n=== VIDEOS ===');
  const { data: videos } = await supabase
    .from('videos')
    .select('id, name, game_id')
    .limit(20);

  if (videos?.length) {
    console.log(`Found ${videos.length} videos`);
    videos.forEach(v => console.log(`  ${v.name} [game: ${v.game_id}]`));
  }

  console.log('\n=== PLAY INSTANCES ===');
  const { data: instances } = await supabase
    .from('play_instances')
    .select('id')
    .eq('team_id', TEAM_ID);

  console.log(`Found ${instances?.length || 0} play instances`);
}

check().catch(console.error);
