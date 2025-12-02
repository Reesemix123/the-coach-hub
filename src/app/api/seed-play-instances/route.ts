import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  return seedPlayInstances();
}

export async function POST() {
  return seedPlayInstances();
}

async function seedPlayInstances() {
  const supabase = await createClient();
  const log: string[] = [];

  try {
    // Get the current user's team
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated. Please log in first.' }, { status: 401 });
    }

    // Get user's first team
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (!teams?.length) {
      return NextResponse.json({ error: 'No team found for user' }, { status: 400 });
    }

    const TEAM_ID = teams[0].id;
    log.push(`Using team: ${TEAM_ID}`);

    // Step 1: Get games for this team
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, name, opponent, is_opponent_game')
      .eq('team_id', TEAM_ID);

    if (gamesError || !games?.length) {
      return NextResponse.json({ error: 'No games found', details: gamesError?.message }, { status: 400 });
    }

    log.push(`Found ${games.length} games`);

    // Find an opponent game and an own game
    let opponentGame = games.find(g => g.is_opponent_game);
    const ownGame = games.find(g => !g.is_opponent_game);

    if (!ownGame) {
      return NextResponse.json({
        error: 'No own team games found. Please create at least one game first.',
        games: games.map(g => ({ name: g.name, is_opponent_game: g.is_opponent_game }))
      }, { status: 400 });
    }

    // If no opponent game exists, create one for scouting
    if (!opponentGame) {
      log.push('No opponent game found, creating one for scouting...');

      const { data: newOpponentGame, error: createGameError } = await supabase
        .from('games')
        .insert({
          team_id: TEAM_ID,
          user_id: user.id,
          name: 'Opponent Scout Film',
          opponent: 'Mountain Ridge',
          date: new Date().toISOString().split('T')[0],
          is_opponent_game: true
        })
        .select()
        .single();

      if (createGameError || !newOpponentGame) {
        return NextResponse.json({
          error: 'Failed to create opponent game',
          details: createGameError?.message
        }, { status: 500 });
      }

      opponentGame = newOpponentGame;
      log.push(`Created opponent game: ${opponentGame.name} (${opponentGame.id})`);
    }

    log.push(`Using opponent game: ${opponentGame.name}`);
    log.push(`Using own game: ${ownGame.name}`);

    // Step 2: Create videos for each game
    const videosToCreate = [
      { game_id: opponentGame.id, name: `${opponentGame.opponent} Film`, file_path: 'test/opponent.mp4', url: 'https://example.com/opponent.mp4' },
      { game_id: ownGame.id, name: `${ownGame.opponent} - Our Film`, file_path: 'test/own.mp4', url: 'https://example.com/own.mp4' }
    ];

    // Try insert
    const { data: createdVideos, error: insertVideoError } = await supabase
      .from('videos')
      .insert(videosToCreate)
      .select();

    if (insertVideoError) {
      log.push(`Video insert error: ${insertVideoError.message}`);
      log.push(`Error code: ${insertVideoError.code}`);
      log.push(`Error details: ${JSON.stringify(insertVideoError.details)}`);
    } else {
      log.push(`Created videos: ${createdVideos?.length}`);
    }

    // Get video IDs (whether we just created them or they existed)
    const { data: allVideos, error: fetchVideoError } = await supabase
      .from('videos')
      .select('id, game_id, name')
      .in('game_id', [opponentGame.id, ownGame.id]);

    if (fetchVideoError) {
      log.push(`Fetch videos error: ${fetchVideoError.message}`);
    }

    if (!allVideos?.length) {
      return NextResponse.json({
        error: 'Could not create or find videos',
        log,
        insertError: insertVideoError?.message,
        fetchError: fetchVideoError?.message,
        videosToCreate
      }, { status: 500 });
    }

    const opponentVideoId = allVideos.find(v => v.game_id === opponentGame.id)?.id;
    const ownVideoId = allVideos.find(v => v.game_id === ownGame.id)?.id;

    log.push(`Opponent video: ${opponentVideoId}`);
    log.push(`Own video: ${ownVideoId}`);

    // Step 3: Delete existing play instances
    if (opponentVideoId) {
      await supabase.from('play_instances').delete().eq('video_id', opponentVideoId);
    }
    if (ownVideoId) {
      await supabase.from('play_instances').delete().eq('video_id', ownVideoId);
    }

    // Step 4: Create opponent play instances (run-heavy: 67%)
    const opponentPlays: any[] = [];
    let timestamp = 0;

    // 20 runs
    for (let i = 0; i < 20; i++) {
      opponentPlays.push({
        video_id: opponentVideoId,
        team_id: TEAM_ID,
        is_opponent_play: true,
        play_type: 'run',
        down: (i % 4) + 1,
        distance: i % 4 === 0 ? 10 : Math.floor(Math.random() * 8) + 2,
        yard_line: Math.floor(Math.random() * 80) + 10,
        yards_gained: Math.floor(Math.random() * 8) + 1,
        timestamp_start: timestamp,
        quarter: Math.floor(i / 5) + 1
      });
      timestamp += 30;
    }

    // 10 passes
    for (let i = 0; i < 10; i++) {
      opponentPlays.push({
        video_id: opponentVideoId,
        team_id: TEAM_ID,
        is_opponent_play: true,
        play_type: 'pass',
        down: (i % 3) + 2,
        distance: Math.floor(Math.random() * 10) + 5,
        yard_line: Math.floor(Math.random() * 60) + 20,
        yards_gained: Math.floor(Math.random() * 15),
        timestamp_start: timestamp,
        quarter: Math.floor(i / 3) + 1
      });
      timestamp += 30;
    }

    // 8 3rd & long passes
    for (let i = 0; i < 8; i++) {
      opponentPlays.push({
        video_id: opponentVideoId,
        team_id: TEAM_ID,
        is_opponent_play: true,
        play_type: 'pass',
        down: 3,
        distance: 7 + Math.floor(Math.random() * 5),
        yard_line: Math.floor(Math.random() * 50) + 30,
        yards_gained: Math.floor(Math.random() * 12),
        timestamp_start: timestamp,
        quarter: Math.floor(i / 2) + 1
      });
      timestamp += 30;
    }

    // 6 red zone plays (67% run)
    for (let i = 0; i < 6; i++) {
      opponentPlays.push({
        video_id: opponentVideoId,
        team_id: TEAM_ID,
        is_opponent_play: true,
        play_type: i < 4 ? 'run' : 'pass',
        down: (i % 4) + 1,
        distance: i % 4 === 0 ? 10 : Math.floor(Math.random() * 5) + 1,
        yard_line: Math.floor(Math.random() * 15) + 5,
        yards_gained: Math.floor(Math.random() * 6) + 1,
        timestamp_start: timestamp,
        quarter: i < 3 ? 2 : 4
      });
      timestamp += 30;
    }

    const { data: insertedOpponent, error: oppError } = await supabase
      .from('play_instances')
      .insert(opponentPlays)
      .select();

    if (oppError) {
      return NextResponse.json({ error: 'Failed to insert opponent plays', details: oppError.message }, { status: 500 });
    }
    log.push(`Inserted ${insertedOpponent?.length} opponent plays`);

    // Step 5: Create own team play instances
    const ownPlays: any[] = [];
    timestamp = 0;

    // 12 runs with some explosive
    for (let i = 0; i < 12; i++) {
      const isExplosive = Math.random() < 0.2;
      ownPlays.push({
        video_id: ownVideoId,
        team_id: TEAM_ID,
        is_opponent_play: false,
        play_type: 'run',
        down: (i % 4) + 1,
        distance: i % 4 === 0 ? 10 : Math.floor(Math.random() * 8) + 2,
        yard_line: Math.floor(Math.random() * 80) + 10,
        yards_gained: isExplosive ? Math.floor(Math.random() * 20) + 10 : Math.floor(Math.random() * 6) + 1,
        is_turnover: Math.random() < 0.05,
        timestamp_start: timestamp,
        quarter: Math.floor(i / 3) + 1
      });
      timestamp += 30;
    }

    // 13 passes with some explosive
    for (let i = 0; i < 13; i++) {
      const isExplosive = Math.random() < 0.15;
      ownPlays.push({
        video_id: ownVideoId,
        team_id: TEAM_ID,
        is_opponent_play: false,
        play_type: 'pass',
        down: (i % 3) + 1,
        distance: Math.floor(Math.random() * 10) + 3,
        yard_line: Math.floor(Math.random() * 60) + 20,
        yards_gained: isExplosive ? Math.floor(Math.random() * 25) + 15 : Math.floor(Math.random() * 10),
        is_turnover: Math.random() < 0.08,
        timestamp_start: timestamp,
        quarter: Math.floor(i / 4) + 1
      });
      timestamp += 30;
    }

    const { data: insertedOwn, error: ownError } = await supabase
      .from('play_instances')
      .insert(ownPlays)
      .select();

    if (ownError) {
      return NextResponse.json({ error: 'Failed to insert own plays', details: ownError.message }, { status: 500 });
    }
    log.push(`Inserted ${insertedOwn?.length} own team plays`);

    // Also delete existing prep_insights to force regeneration
    const { data: prepPlans } = await supabase
      .from('prep_plans')
      .select('id')
      .eq('team_id', TEAM_ID);

    if (prepPlans?.length) {
      for (const plan of prepPlans) {
        await supabase.from('prep_insights').delete().eq('prep_plan_id', plan.id);
        log.push(`Cleared insights for prep_plan ${plan.id}`);
      }
    }

    return NextResponse.json({
      success: true,
      log,
      summary: {
        opponentPlays: insertedOpponent?.length || 0,
        ownPlays: insertedOwn?.length || 0,
        opponentRunPct: Math.round((opponentPlays.filter(p => p.play_type === 'run').length / opponentPlays.length) * 100),
        message: 'Now refresh the Game Prep Hub page to see generated insights!'
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message, log }, { status: 500 });
  }
}
