/**
 * Add Special Teams Data to Test Games
 *
 * Updates existing plays to add special teams data via the boolean fields:
 * - is_kickoff, is_kickoff_return, kick_distance
 * - is_punt, is_punt_return, return_yards
 *
 * Run: npx tsx scripts/add-special-teams.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface GameSTData {
  gameId: string;
  name: string;
  kickoffs: number;
  avgKickoffYardLine: number;
  punts: number;
  avgPuntYards: number;
  kickReturns: number;
  avgKickReturnYards: number;
  puntReturns: number;
  avgPuntReturnYards: number;
}

const GAMES: GameSTData[] = [
  { gameId: '22222222-2222-2222-2222-222222222201', name: 'Week 1', kickoffs: 6, avgKickoffYardLine: 25, punts: 4, avgPuntYards: 35, kickReturns: 3, avgKickReturnYards: 22, puntReturns: 2, avgPuntReturnYards: 8 },
  { gameId: '22222222-2222-2222-2222-222222222202', name: 'Week 2', kickoffs: 8, avgKickoffYardLine: 22, punts: 6, avgPuntYards: 32, kickReturns: 4, avgKickReturnYards: 18, puntReturns: 3, avgPuntReturnYards: 6 },
  { gameId: '22222222-2222-2222-2222-222222222203', name: 'Week 3', kickoffs: 7, avgKickoffYardLine: 28, punts: 3, avgPuntYards: 38, kickReturns: 3, avgKickReturnYards: 25, puntReturns: 2, avgPuntReturnYards: 12 },
  { gameId: '22222222-2222-2222-2222-222222222204', name: 'Week 4', kickoffs: 7, avgKickoffYardLine: 23, punts: 5, avgPuntYards: 34, kickReturns: 4, avgKickReturnYards: 20, puntReturns: 3, avgPuntReturnYards: 7 },
  { gameId: '22222222-2222-2222-2222-222222222205', name: 'Week 5', kickoffs: 9, avgKickoffYardLine: 30, punts: 3, avgPuntYards: 40, kickReturns: 4, avgKickReturnYards: 28, puntReturns: 1, avgPuntReturnYards: 15 },
  { gameId: '22222222-2222-2222-2222-222222222206', name: 'Week 6', kickoffs: 8, avgKickoffYardLine: 26, punts: 4, avgPuntYards: 36, kickReturns: 4, avgKickReturnYards: 23, puntReturns: 2, avgPuntReturnYards: 10 },
  { gameId: '22222222-2222-2222-2222-222222222207', name: 'Week 7', kickoffs: 5, avgKickoffYardLine: 20, punts: 7, avgPuntYards: 30, kickReturns: 2, avgKickReturnYards: 15, puntReturns: 4, avgPuntReturnYards: 5 },
  { gameId: '22222222-2222-2222-2222-222222222208', name: 'Week 8', kickoffs: 8, avgKickoffYardLine: 27, punts: 4, avgPuntYards: 37, kickReturns: 4, avgKickReturnYards: 24, puntReturns: 2, avgPuntReturnYards: 11 },
];

function randomVariance(base: number, variance: number): number {
  return Math.max(0, Math.round(base + (Math.random() - 0.5) * variance * 2));
}

async function main() {
  console.log('🏈 Adding Special Teams Data to Test Games\n');

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

    // First, clear any existing special teams flags
    await supabase
      .from('play_instances')
      .update({
        is_kickoff: false,
        is_kickoff_return: false,
        is_punt: false,
        is_punt_return: false,
        kick_distance: null,
        return_yards: null,
      })
      .eq('video_id', videoId);

    // Get plays to mark as special teams
    const { data: plays } = await supabase
      .from('play_instances')
      .select('id, is_opponent_play')
      .eq('video_id', videoId)
      .order('timestamp_start', { ascending: true });

    if (!plays?.length) {
      console.log('  ⚠️ No plays found, skipping');
      continue;
    }

    const offensivePlays = plays.filter(p => !p.is_opponent_play);
    const defensivePlays = plays.filter(p => p.is_opponent_play);

    let updates = 0;

    // Mark kickoffs (team kicking off - happens when opponent has ball after)
    for (let i = 0; i < Math.min(game.kickoffs, defensivePlays.length); i++) {
      const kickDistance = randomVariance(60, 10);
      await supabase
        .from('play_instances')
        .update({ is_kickoff: true, kick_distance: kickDistance })
        .eq('id', defensivePlays[i].id);
      updates++;
    }

    // Mark kickoff returns (team receiving - marked on offensive plays)
    for (let i = 0; i < Math.min(game.kickReturns, offensivePlays.length); i++) {
      const returnYards = randomVariance(game.avgKickReturnYards, 12);
      await supabase
        .from('play_instances')
        .update({ is_kickoff_return: true, return_yards: returnYards })
        .eq('id', offensivePlays[i].id);
      updates++;
    }

    // Mark punts (team punting - happens before opponent drives)
    const puntStartIdx = Math.floor(offensivePlays.length / 3);
    for (let i = 0; i < Math.min(game.punts, offensivePlays.length - puntStartIdx); i++) {
      const puntYards = randomVariance(game.avgPuntYards, 8);
      await supabase
        .from('play_instances')
        .update({ is_punt: true, kick_distance: puntYards })
        .eq('id', offensivePlays[puntStartIdx + i].id);
      updates++;
    }

    // Mark punt returns
    const puntReturnStartIdx = Math.floor(defensivePlays.length / 2);
    for (let i = 0; i < Math.min(game.puntReturns, defensivePlays.length - puntReturnStartIdx); i++) {
      const returnYards = randomVariance(game.avgPuntReturnYards, 6);
      await supabase
        .from('play_instances')
        .update({ is_punt_return: true, return_yards: returnYards })
        .eq('id', defensivePlays[puntReturnStartIdx + i].id);
      updates++;
    }

    console.log(`  ✅ Marked ${updates} plays as special teams`);
    totalUpdates += updates;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Updated ${totalUpdates} plays with special teams data!`);
}

main().catch(console.error);
