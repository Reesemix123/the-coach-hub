/**
 * Seed Play Instances for Testing
 * Creates videos and play_instances with proper play_type for strategic insights
 *
 * Run with: npx tsx scripts/seed-play-instances.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bawcgmongnswmrxfsweh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhd2NnbW9uZ25zd21yeGZzd2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MTI4MzAsImV4cCI6MjA2NDA4ODgzMH0.hN8_Vgm5GxSVazYYIITjsHAR-7lZQKz5R6jqqXCPGQ0';

const TEAM_ID = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('🏈 Seeding Play Instances for Strategic Insights Testing...\n');

  // Step 1: Get games for this team
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, name, opponent, is_opponent_game')
    .eq('team_id', TEAM_ID);

  if (gamesError || !games?.length) {
    console.error('❌ No games found for team:', gamesError?.message);
    return;
  }

  console.log(`Found ${games.length} games:`);
  games.forEach(g => console.log(`  - ${g.name} (opponent: ${g.is_opponent_game})`));

  // Find an opponent game and an own game
  const opponentGame = games.find(g => g.is_opponent_game);
  const ownGame = games.find(g => !g.is_opponent_game);

  if (!opponentGame) {
    console.error('❌ No opponent game found. Need a game with is_opponent_game=true');
    return;
  }

  if (!ownGame) {
    console.error('❌ No own game found. Need a game with is_opponent_game=false');
    return;
  }

  console.log(`\nUsing opponent game: ${opponentGame.name} (${opponentGame.id})`);
  console.log(`Using own game: ${ownGame.name} (${ownGame.id})\n`);

  // Step 2: Create videos for each game (if they don't exist)
  console.log('📹 Creating test videos...');

  const videosToCreate = [
    { game_id: opponentGame.id, name: `${opponentGame.opponent} Film`, file_path: 'test/opponent.mp4', url: 'https://example.com/opponent.mp4' },
    { game_id: ownGame.id, name: `${ownGame.opponent} - Our Film`, file_path: 'test/own.mp4', url: 'https://example.com/own.mp4' }
  ];

  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .upsert(videosToCreate, { onConflict: 'game_id' })
    .select();

  if (videosError) {
    console.error('❌ Error creating videos:', videosError.message);

    // Try to get existing videos
    const { data: existingVideos } = await supabase
      .from('videos')
      .select('*')
      .in('game_id', [opponentGame.id, ownGame.id]);

    if (!existingVideos?.length) {
      // Create videos without upsert
      const { data: newVideos, error: insertError } = await supabase
        .from('videos')
        .insert(videosToCreate)
        .select();

      if (insertError) {
        console.error('❌ Could not create videos:', insertError.message);
        return;
      }
      console.log(`✅ Created ${newVideos?.length} videos`);
    }
  } else {
    console.log(`✅ Videos ready: ${videos?.length}`);
  }

  // Get video IDs
  const { data: allVideos } = await supabase
    .from('videos')
    .select('id, game_id, name')
    .in('game_id', [opponentGame.id, ownGame.id]);

  if (!allVideos?.length) {
    console.error('❌ No videos found after creation');
    return;
  }

  const opponentVideoId = allVideos.find(v => v.game_id === opponentGame.id)?.id;
  const ownVideoId = allVideos.find(v => v.game_id === ownGame.id)?.id;

  console.log(`Opponent video ID: ${opponentVideoId}`);
  console.log(`Own video ID: ${ownVideoId}\n`);

  // Step 3: Delete existing play instances for these videos
  console.log('🗑️  Clearing existing play instances...');

  if (opponentVideoId) {
    await supabase.from('play_instances').delete().eq('video_id', opponentVideoId);
  }
  if (ownVideoId) {
    await supabase.from('play_instances').delete().eq('video_id', ownVideoId);
  }

  // Step 4: Create opponent play instances (run-heavy team for testing)
  console.log('📝 Creating opponent play instances...');

  const opponentPlays = [];
  let timestamp = 0;

  // 30 opponent plays: 20 runs, 10 passes (67% run)
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

  for (let i = 0; i < 10; i++) {
    opponentPlays.push({
      video_id: opponentVideoId,
      team_id: TEAM_ID,
      is_opponent_play: true,
      play_type: 'pass',
      down: (i % 3) + 2, // More passes on 2nd/3rd down
      distance: Math.floor(Math.random() * 10) + 5,
      yard_line: Math.floor(Math.random() * 60) + 20,
      yards_gained: Math.floor(Math.random() * 15),
      timestamp_start: timestamp,
      quarter: Math.floor(i / 3) + 1
    });
    timestamp += 30;
  }

  // Add some 3rd & long passes for situational analysis
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

  // Add red zone plays
  for (let i = 0; i < 6; i++) {
    opponentPlays.push({
      video_id: opponentVideoId,
      team_id: TEAM_ID,
      is_opponent_play: true,
      play_type: i < 4 ? 'run' : 'pass', // 67% run in red zone
      down: (i % 4) + 1,
      distance: i % 4 === 0 ? 10 : Math.floor(Math.random() * 5) + 1,
      yard_line: Math.floor(Math.random() * 15) + 5, // Red zone: 5-20 yard line
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
    console.error('❌ Error inserting opponent plays:', oppError.message);
  } else {
    console.log(`✅ Inserted ${insertedOpponent?.length} opponent plays`);
  }

  // Step 5: Create own team play instances
  console.log('📝 Creating own team play instances...');

  const ownPlays = [];
  timestamp = 0;

  // 25 own plays: balanced run/pass with some explosive plays
  for (let i = 0; i < 12; i++) {
    const isExplosive = Math.random() < 0.2; // 20% explosive
    ownPlays.push({
      video_id: ownVideoId,
      team_id: TEAM_ID,
      is_opponent_play: false,
      play_type: 'run',
      down: (i % 4) + 1,
      distance: i % 4 === 0 ? 10 : Math.floor(Math.random() * 8) + 2,
      yard_line: Math.floor(Math.random() * 80) + 10,
      yards_gained: isExplosive ? Math.floor(Math.random() * 20) + 10 : Math.floor(Math.random() * 6) + 1,
      is_turnover: Math.random() < 0.05, // 5% turnover rate
      timestamp_start: timestamp,
      quarter: Math.floor(i / 3) + 1
    });
    timestamp += 30;
  }

  for (let i = 0; i < 13; i++) {
    const isExplosive = Math.random() < 0.15; // 15% explosive
    ownPlays.push({
      video_id: ownVideoId,
      team_id: TEAM_ID,
      is_opponent_play: false,
      play_type: 'pass',
      down: (i % 3) + 1,
      distance: Math.floor(Math.random() * 10) + 3,
      yard_line: Math.floor(Math.random() * 60) + 20,
      yards_gained: isExplosive ? Math.floor(Math.random() * 25) + 15 : Math.floor(Math.random() * 10),
      is_turnover: Math.random() < 0.08, // 8% turnover rate for passes
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
    console.error('❌ Error inserting own plays:', ownError.message);
  } else {
    console.log(`✅ Inserted ${insertedOwn?.length} own team plays`);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`Opponent plays: ${insertedOpponent?.length || 0}`);
  console.log(`  - Run: ${opponentPlays.filter(p => p.play_type === 'run').length}`);
  console.log(`  - Pass: ${opponentPlays.filter(p => p.play_type === 'pass').length}`);
  console.log(`Own team plays: ${insertedOwn?.length || 0}`);
  console.log(`  - Run: ${ownPlays.filter(p => p.play_type === 'run').length}`);
  console.log(`  - Pass: ${ownPlays.filter(p => p.play_type === 'pass').length}`);
  console.log('\n🎯 Now refresh the Game Prep Hub to see generated insights!');
  console.log('   The placeholder insights should be replaced with real data.');
}

main().catch(console.error);
