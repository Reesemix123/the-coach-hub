/**
 * Add Kicking Data (FG, XP, Kickoffs, Punts) to Test Games
 *
 * Updates existing plays to add kicking data via boolean fields:
 * - is_field_goal_attempt, is_field_goal_made
 * - is_extra_point_attempt, is_extra_point_made
 * - is_kickoff, kick_distance
 * - is_punt, kick_distance
 *
 * Run: npx tsx scripts/add-kicking-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface GameKickingData {
  gameId: string;
  name: string;
  fgAttempts: number;
  fgMade: number;
  xpAttempts: number;
  xpMade: number;
  kickoffs: number;
  avgKickoffDistance: number;
  punts: number;
  avgPuntDistance: number;
}

// Realistic game kicking data that matches the scores
const GAMES: GameKickingData[] = [
  { gameId: '22222222-2222-2222-2222-222222222201', name: 'Week 1', fgAttempts: 0, fgMade: 0, xpAttempts: 3, xpMade: 3, kickoffs: 4, avgKickoffDistance: 58, punts: 3, avgPuntDistance: 36 },
  { gameId: '22222222-2222-2222-2222-222222222202', name: 'Week 2', fgAttempts: 0, fgMade: 0, xpAttempts: 2, xpMade: 2, kickoffs: 3, avgKickoffDistance: 55, punts: 5, avgPuntDistance: 34 },
  { gameId: '22222222-2222-2222-2222-222222222203', name: 'Week 3', fgAttempts: 0, fgMade: 0, xpAttempts: 4, xpMade: 4, kickoffs: 5, avgKickoffDistance: 60, punts: 2, avgPuntDistance: 38 },
  { gameId: '22222222-2222-2222-2222-222222222204', name: 'Week 4', fgAttempts: 2, fgMade: 1, xpAttempts: 2, xpMade: 2, kickoffs: 4, avgKickoffDistance: 56, punts: 4, avgPuntDistance: 35 },
  { gameId: '22222222-2222-2222-2222-222222222205', name: 'Week 5', fgAttempts: 0, fgMade: 0, xpAttempts: 5, xpMade: 5, kickoffs: 6, avgKickoffDistance: 62, punts: 2, avgPuntDistance: 40 },
  { gameId: '22222222-2222-2222-2222-222222222206', name: 'Week 6', fgAttempts: 1, fgMade: 1, xpAttempts: 3, xpMade: 3, kickoffs: 4, avgKickoffDistance: 57, punts: 3, avgPuntDistance: 37 },
  { gameId: '22222222-2222-2222-2222-222222222207', name: 'Week 7', fgAttempts: 0, fgMade: 0, xpAttempts: 1, xpMade: 1, kickoffs: 2, avgKickoffDistance: 54, punts: 6, avgPuntDistance: 32 },
  { gameId: '22222222-2222-2222-2222-222222222208', name: 'Week 8', fgAttempts: 0, fgMade: 0, xpAttempts: 4, xpMade: 4, kickoffs: 5, avgKickoffDistance: 59, punts: 3, avgPuntDistance: 38 },
];

function randomVariance(base: number, variance: number): number {
  return Math.max(0, Math.round(base + (Math.random() - 0.5) * variance * 2));
}

async function main() {
  console.log('🏈 Adding Kicking Data to Test Games\n');

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'testcoach@youthcoachhub.test',
    password: 'test'
  });

  if (authError) {
    console.error('❌ Auth error:', authError.message);
    return;
  }

  let totalUpdates = 0;

  for (const game of GAMES) {
    console.log(`\n${game.name}:`);

    // Get video for this game
    const { data: videos } = await supabase
      .from('videos')
      .select('id')
      .eq('game_id', game.gameId);

    if (!videos?.length) {
      console.log('  ⚠️ No videos found, skipping');
      continue;
    }

    const videoId = videos[0].id;

    // Clear existing kicking flags (but preserve return flags from previous script)
    await supabase
      .from('play_instances')
      .update({
        is_field_goal_attempt: false,
        is_field_goal_made: false,
        is_extra_point_attempt: false,
        is_extra_point_made: false,
        is_kickoff: false,
        is_punt: false,
      })
      .eq('video_id', videoId);

    // Get plays to mark
    const { data: plays } = await supabase
      .from('play_instances')
      .select('id, is_opponent_play, is_kickoff_return, is_punt_return')
      .eq('video_id', videoId)
      .order('timestamp_start', { ascending: true });

    if (!plays?.length) {
      console.log('  ⚠️ No plays found, skipping');
      continue;
    }

    // Get only our plays that aren't already returns
    const ourPlays = plays.filter(p => !p.is_opponent_play && !p.is_kickoff_return && !p.is_punt_return);

    let updates = 0;
    let playIdx = 0;

    // Mark Field Goal attempts
    for (let i = 0; i < game.fgAttempts && playIdx < ourPlays.length; i++) {
      const made = i < game.fgMade;
      await supabase
        .from('play_instances')
        .update({
          is_field_goal_attempt: true,
          is_field_goal_made: made
        })
        .eq('id', ourPlays[playIdx].id);
      playIdx++;
      updates++;
    }

    // Mark Extra Point attempts
    for (let i = 0; i < game.xpAttempts && playIdx < ourPlays.length; i++) {
      const made = i < game.xpMade;
      await supabase
        .from('play_instances')
        .update({
          is_extra_point_attempt: true,
          is_extra_point_made: made
        })
        .eq('id', ourPlays[playIdx].id);
      playIdx++;
      updates++;
    }

    // Mark Kickoffs
    for (let i = 0; i < game.kickoffs && playIdx < ourPlays.length; i++) {
      const distance = randomVariance(game.avgKickoffDistance, 8);
      await supabase
        .from('play_instances')
        .update({
          is_kickoff: true,
          kick_distance: distance
        })
        .eq('id', ourPlays[playIdx].id);
      playIdx++;
      updates++;
    }

    // Mark Punts
    for (let i = 0; i < game.punts && playIdx < ourPlays.length; i++) {
      const distance = randomVariance(game.avgPuntDistance, 6);
      await supabase
        .from('play_instances')
        .update({
          is_punt: true,
          kick_distance: distance
        })
        .eq('id', ourPlays[playIdx].id);
      playIdx++;
      updates++;
    }

    console.log(`  ✅ FG: ${game.fgMade}/${game.fgAttempts}, XP: ${game.xpMade}/${game.xpAttempts}`);
    console.log(`  ✅ Kickoffs: ${game.kickoffs} (avg ${game.avgKickoffDistance} yds)`);
    console.log(`  ✅ Punts: ${game.punts} (avg ${game.avgPuntDistance} yds)`);
    totalUpdates += updates;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Updated ${totalUpdates} plays with kicking data!`);
}

main().catch(console.error);
