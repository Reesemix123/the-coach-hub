/**
 * Add Quarter/Halftime/End of Game Markers to Test Games
 *
 * Creates video_timeline_markers for:
 * - Quarter Start (Q1)
 * - Quarter Ends (Q1, Q2, Q3, Q4)
 * - Halftime
 * - Game End (custom marker)
 *
 * Run: npx tsx scripts/add-game-markers.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface GameInfo {
  gameId: string;
  opponent: string;
  teamScore: number;
  oppScore: number;
}

const GAMES: GameInfo[] = [
  { gameId: '22222222-2222-2222-2222-222222222201', opponent: 'Lincoln Lions', teamScore: 21, oppScore: 14 },
  { gameId: '22222222-2222-2222-2222-222222222202', opponent: 'Roosevelt Roughriders', teamScore: 14, oppScore: 28 },
  { gameId: '22222222-2222-2222-2222-222222222203', opponent: 'Jefferson Jaguars', teamScore: 28, oppScore: 7 },
  { gameId: '22222222-2222-2222-2222-222222222204', opponent: 'Washington Wolves', teamScore: 17, oppScore: 21 },
  { gameId: '22222222-2222-2222-2222-222222222205', opponent: 'Adams Arrows', teamScore: 35, oppScore: 14 },
  { gameId: '22222222-2222-2222-2222-222222222206', opponent: 'Madison Mustangs', teamScore: 24, oppScore: 21 },
  { gameId: '22222222-2222-2222-2222-222222222207', opponent: 'Monroe Monarchs', teamScore: 7, oppScore: 14 },
  { gameId: '22222222-2222-2222-2222-222222222208', opponent: 'Hamilton Hawks', teamScore: 28, oppScore: 21 },
];

async function main() {
  console.log('🏈 Adding Game Markers to Test Games\n');

  // Login
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'testcoach@youthcoachhub.test',
    password: 'test'
  });

  if (authError) {
    console.error('❌ Auth error:', authError.message);
    return;
  }

  // Get videos for each game
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select('id, game_id, name')
    .in('game_id', GAMES.map(g => g.gameId));

  if (videosError || !videos?.length) {
    console.error('❌ Could not find videos:', videosError?.message);
    return;
  }

  console.log(`Found ${videos.length} videos\n`);

  // Delete existing markers for these videos
  for (const video of videos) {
    await supabase
      .from('video_timeline_markers')
      .delete()
      .eq('video_id', video.id);
  }

  let markersCreated = 0;

  // Create markers for each game
  for (let i = 0; i < GAMES.length; i++) {
    const game = GAMES[i];
    const video = videos.find(v => v.game_id === game.gameId);

    if (!video) {
      console.log(`⚠️ No video for ${game.opponent}`);
      continue;
    }

    console.log(`Week ${i + 1} vs ${game.opponent}...`);

    // Calculate approximate timestamps based on 12-minute quarters (in milliseconds)
    const quarterLength = 12 * 60 * 1000; // 12 minutes in ms
    const halftimeLength = 10 * 60 * 1000; // 10 minutes in ms
    const breakLength = 30 * 1000; // 30 seconds in ms

    // Timestamps (in milliseconds)
    const q1Start = 0;
    const q1End = quarterLength;
    const q2Start = q1End + breakLength;
    const q2End = q2Start + quarterLength;
    const halftimeStart = q2End;
    const halftimeEnd = q2End + halftimeLength;
    const q3Start = halftimeEnd;
    const q3End = q3Start + quarterLength;
    const q4Start = q3End + breakLength;
    const q4End = q4Start + quarterLength;

    // Generate quarter scores (distribute total score across quarters)
    const teamQ1 = Math.floor(game.teamScore * 0.2);
    const teamQ2 = Math.floor(game.teamScore * 0.3);
    const teamQ3 = Math.floor(game.teamScore * 0.25);
    const teamQ4 = game.teamScore - teamQ1 - teamQ2 - teamQ3;

    const oppQ1 = Math.floor(game.oppScore * 0.25);
    const oppQ2 = Math.floor(game.oppScore * 0.25);
    const oppQ3 = Math.floor(game.oppScore * 0.25);
    const oppQ4 = game.oppScore - oppQ1 - oppQ2 - oppQ3;

    // Using video_id only (XOR with video_group_id per migration 027)
    // marker_type must be: 'play', 'quarter_start', 'quarter_end', 'halftime',
    // 'overtime', 'big_play', 'turnover', 'timeout', 'custom'
    const markers = [
      // Game Start (Q1 Start)
      {
        video_id: video.id,
        marker_type: 'quarter_start',
        virtual_timestamp_start_ms: q1Start,
        quarter: 1,
        label: 'Game Start - Q1',
        notes: `Central Eagles vs ${game.opponent}`,
        color: '#22C55E', // Green for start
      },
      // Q1 End
      {
        video_id: video.id,
        marker_type: 'quarter_end',
        virtual_timestamp_start_ms: q1End,
        quarter: 1,
        label: 'End of Q1',
        notes: `Score: Eagles ${teamQ1} - ${game.opponent.split(' ')[0]} ${oppQ1}`,
        color: '#3B82F6', // Blue
      },
      // Q2 Start
      {
        video_id: video.id,
        marker_type: 'quarter_start',
        virtual_timestamp_start_ms: q2Start,
        quarter: 2,
        label: 'Start of Q2',
        notes: null,
        color: '#3B82F6',
      },
      // Q2 End / Halftime
      {
        video_id: video.id,
        marker_type: 'quarter_end',
        virtual_timestamp_start_ms: q2End,
        quarter: 2,
        label: 'End of Q2',
        notes: `Halftime Score: Eagles ${teamQ1 + teamQ2} - ${game.opponent.split(' ')[0]} ${oppQ1 + oppQ2}`,
        color: '#F59E0B', // Amber for halftime
      },
      // Halftime marker
      {
        video_id: video.id,
        marker_type: 'halftime',
        virtual_timestamp_start_ms: halftimeStart,
        quarter: 2,
        label: 'Halftime',
        notes: 'Teams head to locker rooms for halftime adjustments',
        color: '#F59E0B',
      },
      // Q3 Start
      {
        video_id: video.id,
        marker_type: 'quarter_start',
        virtual_timestamp_start_ms: q3Start,
        quarter: 3,
        label: 'Start of Q3',
        notes: null,
        color: '#3B82F6',
      },
      // Q3 End
      {
        video_id: video.id,
        marker_type: 'quarter_end',
        virtual_timestamp_start_ms: q3End,
        quarter: 3,
        label: 'End of Q3',
        notes: `Score: Eagles ${teamQ1 + teamQ2 + teamQ3} - ${game.opponent.split(' ')[0]} ${oppQ1 + oppQ2 + oppQ3}`,
        color: '#3B82F6',
      },
      // Q4 Start
      {
        video_id: video.id,
        marker_type: 'quarter_start',
        virtual_timestamp_start_ms: q4Start,
        quarter: 4,
        label: 'Start of Q4',
        notes: null,
        color: '#3B82F6',
      },
      // Q4 End
      {
        video_id: video.id,
        marker_type: 'quarter_end',
        virtual_timestamp_start_ms: q4End,
        quarter: 4,
        label: 'End of Q4',
        notes: `Final Score: Eagles ${game.teamScore} - ${game.opponent.split(' ')[0]} ${game.oppScore}`,
        color: '#EF4444', // Red for game end
      },
      // Game End (custom marker)
      {
        video_id: video.id,
        marker_type: 'custom',
        virtual_timestamp_start_ms: q4End + 60000, // 1 min after Q4 end
        quarter: 4,
        label: 'Game End',
        notes: game.teamScore > game.oppScore ? '🏆 VICTORY!' : 'Loss',
        color: game.teamScore > game.oppScore ? '#22C55E' : '#EF4444',
      },
    ];

    // Insert markers
    const { data: inserted, error: insertError } = await supabase
      .from('video_timeline_markers')
      .insert(markers)
      .select('id');

    if (insertError) {
      console.log(`  ❌ Error: ${insertError.message}`);
    } else {
      console.log(`  ✅ ${inserted?.length || 0} markers added`);
      markersCreated += inserted?.length || 0;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 MARKERS SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Created ${markersCreated} game markers across ${GAMES.length} games`);
  console.log('\nMarkers include:');
  console.log('  - Quarter Starts (Q1, Q2, Q3, Q4)');
  console.log('  - Quarter Ends (Q1, Q2, Q3, Q4)');
  console.log('  - Halftime');
  console.log('  - Game End');
}

main().catch(console.error);
