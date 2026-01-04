import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function test() {
  // Login first
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'testcoach@youthcoachhub.test',
    password: 'test'
  });

  if (authError) {
    console.error('Auth error:', authError);
    return;
  }

  const teamId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  console.log('Team ID:', teamId);

  // Check games
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, name, opponent, date')
    .eq('team_id', teamId);

  console.log('\nGames for team:', games?.length || 0);
  if (games && games.length > 0) {
    games.forEach(g => console.log(`  - ${g.name} vs ${g.opponent} (${g.date}) [${g.id}]`));
  }

  // Check videos
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select('id, name, game_id')
    .limit(10);

  console.log('\nVideos:', videos?.length || 0);
  if (videos && videos.length > 0) {
    videos.forEach(v => console.log(`  - ${v.name} [game: ${v.game_id}]`));
  }

  // Check play_instances
  const { data: plays, error: playsError } = await supabase
    .from('play_instances')
    .select('id, play_code, video_id, team_id, yards_gained, play_type, down')
    .eq('team_id', teamId)
    .limit(10);

  console.log('\nPlay instances for team:', plays?.length || 0);
  if (plays && plays.length > 0) {
    plays.forEach(p => console.log(`  - ${p.play_code}: ${p.play_type} D${p.down} for ${p.yards_gained} yds`));
  }

  // Check if play_instances have video_id links
  const { data: playsWithVideo, error: playsWithVideoError } = await supabase
    .from('play_instances')
    .select(`
      id,
      play_code,
      video_id,
      videos!inner(id, game_id, name)
    `)
    .eq('team_id', teamId)
    .limit(5);

  console.log('\nPlay instances with video links:', playsWithVideo?.length || 0);
  if (playsWithVideoError) {
    console.error('Error joining plays to videos:', playsWithVideoError.message);
  }

  // Direct check: plays joined to games through videos
  const { data: playsWithGames, error: pwgError } = await supabase.rpc('calculate_team_metrics', {
    p_team_id: teamId,
    p_game_id: null,
    p_start_date: null,
    p_end_date: null,
    p_opponent: null
  });

  console.log('\nMetrics result - gamesPlayed:', playsWithGames?.overall?.gamesPlayed);
  console.log('Metrics result - totalPlays:', playsWithGames?.offense?.efficiency?.totalPlays);
}

test();
