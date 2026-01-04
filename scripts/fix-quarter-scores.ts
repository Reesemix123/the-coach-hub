/**
 * Fix Quarter Scores for Test Games
 *
 * Directly populates the quarter_scores JSONB field on games
 * with realistic quarter-by-quarter scoring data.
 *
 * Run: npx tsx scripts/fix-quarter-scores.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Game info with scores and quarter breakdown
interface GameQuarterScores {
  gameId: string;
  name: string;
  teamScore: number;
  oppScore: number;
  team: { q1: number; q2: number; q3: number; q4: number };
  opp: { q1: number; q2: number; q3: number; q4: number };
}

// Realistic quarter-by-quarter scoring that matches final scores
const GAMES: GameQuarterScores[] = [
  {
    gameId: '22222222-2222-2222-2222-222222222201',
    name: 'Week 1 vs Lincoln',
    teamScore: 21,
    oppScore: 14,
    team: { q1: 7, q2: 0, q3: 7, q4: 7 },  // 21 total
    opp: { q1: 0, q2: 7, q3: 0, q4: 7 }    // 14 total
  },
  {
    gameId: '22222222-2222-2222-2222-222222222202',
    name: 'Week 2 vs Roosevelt',
    teamScore: 14,
    oppScore: 28,
    team: { q1: 0, q2: 7, q3: 0, q4: 7 },  // 14 total
    opp: { q1: 7, q2: 7, q3: 7, q4: 7 }    // 28 total
  },
  {
    gameId: '22222222-2222-2222-2222-222222222203',
    name: 'Week 3 vs Jefferson',
    teamScore: 28,
    oppScore: 7,
    team: { q1: 7, q2: 14, q3: 0, q4: 7 }, // 28 total
    opp: { q1: 0, q2: 0, q3: 7, q4: 0 }    // 7 total
  },
  {
    gameId: '22222222-2222-2222-2222-222222222204',
    name: 'Week 4 vs Washington',
    teamScore: 17,
    oppScore: 21,
    team: { q1: 3, q2: 7, q3: 0, q4: 7 },  // 17 total
    opp: { q1: 7, q2: 0, q3: 7, q4: 7 }    // 21 total
  },
  {
    gameId: '22222222-2222-2222-2222-222222222205',
    name: 'Week 5 vs Adams',
    teamScore: 35,
    oppScore: 14,
    team: { q1: 14, q2: 7, q3: 7, q4: 7 }, // 35 total
    opp: { q1: 0, q2: 7, q3: 0, q4: 7 }    // 14 total
  },
  {
    gameId: '22222222-2222-2222-2222-222222222206',
    name: 'Week 6 vs Madison',
    teamScore: 24,
    oppScore: 21,
    team: { q1: 7, q2: 3, q3: 7, q4: 7 },  // 24 total
    opp: { q1: 0, q2: 14, q3: 0, q4: 7 }   // 21 total
  },
  {
    gameId: '22222222-2222-2222-2222-222222222207',
    name: 'Week 7 vs Monroe',
    teamScore: 7,
    oppScore: 14,
    team: { q1: 0, q2: 0, q3: 7, q4: 0 },  // 7 total
    opp: { q1: 0, q2: 7, q3: 0, q4: 7 }    // 14 total
  },
  {
    gameId: '22222222-2222-2222-2222-222222222208',
    name: 'Week 8 vs Hamilton',
    teamScore: 28,
    oppScore: 21,
    team: { q1: 0, q2: 14, q3: 7, q4: 7 }, // 28 total
    opp: { q1: 7, q2: 7, q3: 0, q4: 7 }    // 21 total
  },
];

async function main() {
  console.log('🏈 Fixing Quarter Scores for Test Games\n');

  // Login
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'testcoach@youthcoachhub.test',
    password: 'test'
  });

  if (authError) {
    console.error('❌ Auth error:', authError.message);
    return;
  }

  for (const game of GAMES) {
    // Verify quarter totals match final scores
    const teamTotal = game.team.q1 + game.team.q2 + game.team.q3 + game.team.q4;
    const oppTotal = game.opp.q1 + game.opp.q2 + game.opp.q3 + game.opp.q4;

    if (teamTotal !== game.teamScore || oppTotal !== game.oppScore) {
      console.error(`❌ Score mismatch for ${game.name}: Team ${teamTotal}!=${game.teamScore}, Opp ${oppTotal}!=${game.oppScore}`);
      continue;
    }

    // Build quarter_scores JSONB structure
    const quarterScores = {
      calculated: {
        team: {
          q1: game.team.q1,
          q2: game.team.q2,
          q3: game.team.q3,
          q4: game.team.q4,
          ot: 0,
          total: game.teamScore
        },
        opponent: {
          q1: game.opp.q1,
          q2: game.opp.q2,
          q3: game.opp.q3,
          q4: game.opp.q4,
          ot: 0,
          total: game.oppScore
        }
      },
      manual: null,
      source: 'calculated',
      last_calculated_at: new Date().toISOString(),
      mismatch_acknowledged: false
    };

    // Update the game
    const { error } = await supabase
      .from('games')
      .update({ quarter_scores: quarterScores })
      .eq('id', game.gameId);

    if (error) {
      console.error(`❌ Error updating ${game.name}:`, error.message);
    } else {
      console.log(`✅ ${game.name}:`);
      console.log(`   Team: ${game.team.q1} | ${game.team.q2} | ${game.team.q3} | ${game.team.q4} = ${game.teamScore}`);
      console.log(`   Opp:  ${game.opp.q1} | ${game.opp.q2} | ${game.opp.q3} | ${game.opp.q4} = ${game.oppScore}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Quarter scores fix complete!');
}

main().catch(console.error);
