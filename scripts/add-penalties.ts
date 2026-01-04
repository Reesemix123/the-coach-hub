/**
 * Add Penalties to Test Games
 *
 * Adds realistic penalty data to existing play_instances
 * without disrupting yards, results, or other data.
 *
 * Typical youth/HS game: 8-12 penalties total
 * Common penalties: False Start, Holding, Offsides, Pass Interference
 *
 * Run: npx tsx scripts/add-penalties.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Game penalty profiles (realistic for youth/HS football)
interface GamePenalties {
  gameId: string;
  name: string;
  penaltiesOnUs: number;
  penaltiesOnOpp: number;
  avgYardsOnUs: number;
  avgYardsOnOpp: number;
}

const GAMES: GamePenalties[] = [
  { gameId: '22222222-2222-2222-2222-222222222201', name: 'Week 1 vs Lincoln', penaltiesOnUs: 4, penaltiesOnOpp: 5, avgYardsOnUs: 7, avgYardsOnOpp: 8 },
  { gameId: '22222222-2222-2222-2222-222222222202', name: 'Week 2 vs Roosevelt', penaltiesOnUs: 6, penaltiesOnOpp: 3, avgYardsOnUs: 8, avgYardsOnOpp: 5 },
  { gameId: '22222222-2222-2222-2222-222222222203', name: 'Week 3 vs Jefferson', penaltiesOnUs: 3, penaltiesOnOpp: 7, avgYardsOnUs: 5, avgYardsOnOpp: 9 },
  { gameId: '22222222-2222-2222-2222-222222222204', name: 'Week 4 vs Washington', penaltiesOnUs: 5, penaltiesOnOpp: 4, avgYardsOnUs: 6, avgYardsOnOpp: 7 },
  { gameId: '22222222-2222-2222-2222-222222222205', name: 'Week 5 vs Adams', penaltiesOnUs: 2, penaltiesOnOpp: 6, avgYardsOnUs: 5, avgYardsOnOpp: 8 },
  { gameId: '22222222-2222-2222-2222-222222222206', name: 'Week 6 vs Madison', penaltiesOnUs: 5, penaltiesOnOpp: 5, avgYardsOnUs: 7, avgYardsOnOpp: 7 },
  { gameId: '22222222-2222-2222-2222-222222222207', name: 'Week 7 vs Monroe', penaltiesOnUs: 7, penaltiesOnOpp: 2, avgYardsOnUs: 9, avgYardsOnOpp: 5 },
  { gameId: '22222222-2222-2222-2222-222222222208', name: 'Week 8 vs Hamilton', penaltiesOnUs: 4, penaltiesOnOpp: 4, avgYardsOnUs: 6, avgYardsOnOpp: 6 },
];

// Common penalty yardages
const PENALTY_YARDS = [5, 5, 5, 5, 10, 10, 10, 15, 15]; // Weighted toward 5 and 10

function randomPenaltyYards(avg: number): number {
  // Pick from common yardages, weighted by average
  const base = PENALTY_YARDS[Math.floor(Math.random() * PENALTY_YARDS.length)];
  // Slight variance around base
  return base;
}

async function main() {
  console.log('🏈 Adding Penalties to Test Games\n');

  // Login
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'testcoach@youthcoachhub.test',
    password: 'test'
  });

  if (authError) {
    console.error('❌ Auth error:', authError.message);
    return;
  }

  let totalPenaltiesAdded = 0;

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

    // First, clear any existing penalties for this game
    await supabase
      .from('play_instances')
      .update({ penalty_on_play: false, penalty_on_us: null, penalty_yards: null })
      .eq('video_id', videoId);

    // Get offensive plays (penalties on us happen on our offensive plays)
    const { data: offensivePlays } = await supabase
      .from('play_instances')
      .select('id')
      .eq('video_id', videoId)
      .eq('is_opponent_play', false)
      .order('timestamp_start', { ascending: true });

    // Get defensive plays (penalties on opponent happen when we're on defense)
    const { data: defensivePlays } = await supabase
      .from('play_instances')
      .select('id')
      .eq('video_id', videoId)
      .eq('is_opponent_play', true)
      .order('timestamp_start', { ascending: true });

    if (!offensivePlays?.length || !defensivePlays?.length) {
      console.log('  ⚠️ Not enough plays found, skipping');
      continue;
    }

    // Add penalties on us (to offensive plays)
    const usIndices = new Set<number>();
    while (usIndices.size < Math.min(game.penaltiesOnUs, offensivePlays.length)) {
      usIndices.add(Math.floor(Math.random() * offensivePlays.length));
    }

    let penaltiesOnUsTotal = 0;
    let yardsOnUsTotal = 0;
    for (const idx of usIndices) {
      const yards = randomPenaltyYards(game.avgYardsOnUs);
      await supabase
        .from('play_instances')
        .update({
          penalty_on_play: true,
          penalty_on_us: true,
          penalty_yards: yards
        })
        .eq('id', offensivePlays[idx].id);
      penaltiesOnUsTotal++;
      yardsOnUsTotal += yards;
    }

    // Add penalties on opponent (to defensive plays - when opponent has ball but we draw flag)
    // Actually, penalties on opponent during our offense should go on offensive plays too
    // Let me rethink: penalty_on_us means OUR team committed the penalty
    // So for opponent penalties, we mark plays where opponent committed penalty

    const oppIndices = new Set<number>();
    // Mix of offensive and defensive plays for opponent penalties
    const allPlays = [...offensivePlays, ...defensivePlays];
    while (oppIndices.size < Math.min(game.penaltiesOnOpp, allPlays.length)) {
      oppIndices.add(Math.floor(Math.random() * allPlays.length));
    }

    let penaltiesOnOppTotal = 0;
    let yardsOnOppTotal = 0;
    for (const idx of oppIndices) {
      // Skip if this play already has a penalty on us
      if (usIndices.has(idx) && idx < offensivePlays.length) continue;

      const yards = randomPenaltyYards(game.avgYardsOnOpp);
      await supabase
        .from('play_instances')
        .update({
          penalty_on_play: true,
          penalty_on_us: false,
          penalty_yards: yards
        })
        .eq('id', allPlays[idx].id);
      penaltiesOnOppTotal++;
      yardsOnOppTotal += yards;
    }

    console.log(`  ✅ Us: ${penaltiesOnUsTotal} penalties, ${yardsOnUsTotal} yards`);
    console.log(`  ✅ Opp: ${penaltiesOnOppTotal} penalties, ${yardsOnOppTotal} yards`);
    totalPenaltiesAdded += penaltiesOnUsTotal + penaltiesOnOppTotal;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Added ${totalPenaltiesAdded} penalties across all games!`);
}

main().catch(console.error);
