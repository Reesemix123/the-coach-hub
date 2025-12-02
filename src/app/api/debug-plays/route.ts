import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  // Get the current user's team
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: teams } = await supabase
    .from('teams')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);

  if (!teams?.length) {
    return NextResponse.json({ error: 'No team found' }, { status: 400 });
  }

  const TEAM_ID = teams[0].id;

  // Get games
  const { data: games } = await supabase
    .from('games')
    .select('id, name, opponent, is_opponent_game')
    .eq('team_id', TEAM_ID)
    .limit(10);

  const gameIds = games?.map(g => g.id) || [];

  // Get videos for these games (play_instances link through videos)
  const { data: videos } = await supabase
    .from('videos')
    .select('id, game_id, name')
    .in('game_id', gameIds.length > 0 ? gameIds : ['none']);

  const videoIds = videos?.map(v => v.id) || [];

  // Get play_instances through video_id
  const { data: plays, error } = await supabase
    .from('play_instances')
    .select('id, video_id, play_type, is_opponent_play, down, distance, yards_gained')
    .in('video_id', videoIds.length > 0 ? videoIds : ['none'])
    .limit(50);

  // Count by play_type
  const runPlays = plays?.filter(p => p.play_type === 'run') || [];
  const passPlays = plays?.filter(p => p.play_type === 'pass') || [];
  const nullTypePlays = plays?.filter(p => !p.play_type) || [];

  // Count by is_opponent_play
  const opponentPlays = plays?.filter(p => p.is_opponent_play === true) || [];
  const ownPlays = plays?.filter(p => p.is_opponent_play === false || p.is_opponent_play === null) || [];

  return NextResponse.json({
    games: games?.length || 0,
    gamesList: games,
    videos: videos?.length || 0,
    videosList: videos,
    totalPlays: plays?.length || 0,
    playsByType: {
      run: runPlays.length,
      pass: passPlays.length,
      null: nullTypePlays.length
    },
    playsByOwner: {
      opponent: opponentPlays.length,
      own: ownPlays.length
    },
    samplePlays: plays?.slice(0, 10),
    error: error?.message
  });
}
