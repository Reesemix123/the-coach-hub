/**
 * Seed Opponent Scouting Data
 *
 * Creates opponent scouting games and play instances for Central Eagles.
 * This data shows opponent tendencies for game planning.
 *
 * - Creates scouting games (is_opponent_game = true)
 * - Creates play instances with is_opponent_play = true
 * - Each opponent has distinct tendencies
 *
 * Run: npx tsx scripts/seed-opponent-scouting.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CENTRAL_EAGLES_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

// Opponent profiles with their tendencies
interface OpponentProfile {
  name: string;
  shortName: string;
  offensiveStyle: string;
  defensiveStyle: string;
  runPassRatio: number; // 0-1, higher = more run
  primaryFormations: string[];
  defensiveCoverages: string[];
  blitzRate: number; // 0-1
  redZoneTendency: 'run' | 'pass' | 'balanced';
  thirdDownTendency: 'aggressive' | 'conservative' | 'balanced';
}

const OPPONENTS: OpponentProfile[] = [
  {
    name: 'Lincoln Lions',
    shortName: 'Lions',
    offensiveStyle: 'Spread',
    defensiveStyle: 'Nickel',
    runPassRatio: 0.35,
    primaryFormations: ['Shotgun Spread', 'Shotgun Empty', 'Shotgun Trips'],
    defensiveCoverages: ['Cover 3', 'Cover 1', 'Cover 4'],
    blitzRate: 0.25,
    redZoneTendency: 'pass',
    thirdDownTendency: 'aggressive',
  },
  {
    name: 'Roosevelt Roughriders',
    shortName: 'Roughriders',
    offensiveStyle: 'Power',
    defensiveStyle: '4-3',
    runPassRatio: 0.72,
    primaryFormations: ['I-Formation', 'I-Formation Strong', 'Goal Line'],
    defensiveCoverages: ['Cover 2', 'Cover 3', 'Cover 1'],
    blitzRate: 0.35,
    redZoneTendency: 'run',
    thirdDownTendency: 'conservative',
  },
  {
    name: 'Jefferson Jaguars',
    shortName: 'Jaguars',
    offensiveStyle: 'West Coast',
    defensiveStyle: '3-4',
    runPassRatio: 0.48,
    primaryFormations: ['Pro Set', 'Twins', '22 Personnel'],
    defensiveCoverages: ['Cover 3', 'Cover 2', 'Cover 6'],
    blitzRate: 0.40,
    redZoneTendency: 'balanced',
    thirdDownTendency: 'balanced',
  },
  {
    name: 'Washington Wolves',
    shortName: 'Wolves',
    offensiveStyle: 'Air Raid',
    defensiveStyle: '4-2-5',
    runPassRatio: 0.25,
    primaryFormations: ['Shotgun Empty', 'Shotgun Trips', 'Shotgun Spread'],
    defensiveCoverages: ['Cover 4', 'Cover 3', 'Cover 2 Man'],
    blitzRate: 0.20,
    redZoneTendency: 'pass',
    thirdDownTendency: 'aggressive',
  },
  {
    name: 'Adams Arrows',
    shortName: 'Arrows',
    offensiveStyle: 'Option',
    defensiveStyle: '3-3-5',
    runPassRatio: 0.78,
    primaryFormations: ['Flexbone', 'Wishbone', 'Shotgun'],
    defensiveCoverages: ['Cover 6', 'Cover 3', 'Cover 1'],
    blitzRate: 0.30,
    redZoneTendency: 'run',
    thirdDownTendency: 'aggressive',
  },
  {
    name: 'Madison Mustangs',
    shortName: 'Mustangs',
    offensiveStyle: 'Pro Style',
    defensiveStyle: '4-3',
    runPassRatio: 0.52,
    primaryFormations: ['Pro Set', 'I-Formation', 'Shotgun'],
    defensiveCoverages: ['Cover 2', 'Tampa 2', 'Cover 3'],
    blitzRate: 0.28,
    redZoneTendency: 'balanced',
    thirdDownTendency: 'conservative',
  },
  {
    name: 'Monroe Monarchs',
    shortName: 'Monarchs',
    offensiveStyle: 'Spread RPO',
    defensiveStyle: 'Nickel',
    runPassRatio: 0.42,
    primaryFormations: ['Shotgun Spread', 'Shotgun Twins', 'Pistol'],
    defensiveCoverages: ['Cover 3', 'Cover 1', 'Cover 4'],
    blitzRate: 0.22,
    redZoneTendency: 'pass',
    thirdDownTendency: 'balanced',
  },
  {
    name: 'Hamilton Hawks',
    shortName: 'Hawks',
    offensiveStyle: 'Power',
    defensiveStyle: '3-4',
    runPassRatio: 0.65,
    primaryFormations: ['I-Formation', 'Wing-T', 'Pro Set'],
    defensiveCoverages: ['Cover 3', 'Cover 1', 'Cover 2'],
    blitzRate: 0.45,
    redZoneTendency: 'run',
    thirdDownTendency: 'aggressive',
  },
];

// Play concepts by type
const RUN_CONCEPTS = ['Power', 'Inside Zone', 'Outside Zone', 'Counter', 'Dive', 'Sweep', 'Draw', 'Toss'];
const PASS_CONCEPTS = ['Slant', 'Curl', 'Out', 'Post', 'Corner', 'Seam', 'Screen', 'Deep Ball', 'Mesh', 'Levels'];
const OPTION_CONCEPTS = ['Triple Option', 'Speed Option', 'Midline', 'Veer', 'Zone Read'];

function selectConcept(isRun: boolean, style: string): string {
  if (style === 'Option' && isRun && Math.random() < 0.6) {
    return OPTION_CONCEPTS[Math.floor(Math.random() * OPTION_CONCEPTS.length)];
  }
  const concepts = isRun ? RUN_CONCEPTS : PASS_CONCEPTS;
  return concepts[Math.floor(Math.random() * concepts.length)];
}

interface ScoutingPlayInstance {
  id: string;
  video_id: string;
  team_id: string;
  timestamp_start: number;
  timestamp_end: number;
  down: number;
  distance: number;
  yard_line: number;
  hash_mark: string;
  result: string;
  yards_gained: number;
  resulted_in_first_down: boolean;
  is_turnover: boolean;
  is_opponent_play: boolean;
  play_type: 'run' | 'pass';
  formation: string;
  run_concept?: string;
  pass_concept?: string;
  personnel?: string;
  quarter: number;
  notes?: string;
}

function generateScoutingPlays(
  videoId: string,
  teamId: string,
  opponent: OpponentProfile,
  playsCount: number = 50
): ScoutingPlayInstance[] {
  const instances: ScoutingPlayInstance[] = [];

  let timestamp = 0;
  let yardLine = 25;
  let down = 1;
  let distance = 10;
  let quarter = 1;

  for (let i = 0; i < playsCount; i++) {
    // Determine play type based on opponent tendencies
    // Using only 'run' and 'pass' to match database constraint
    const isRun = Math.random() < opponent.runPassRatio;
    const playType: 'run' | 'pass' = isRun ? 'run' : 'pass';

    // Select formation based on opponent's primary formations
    const formation = opponent.primaryFormations[
      Math.floor(Math.random() * opponent.primaryFormations.length)
    ];

    // Select play concept
    const playConcept = selectConcept(isRun, opponent.offensiveStyle);

    // Personnel grouping based on style
    const personnelOptions = opponent.offensiveStyle === 'Spread' || opponent.offensiveStyle === 'Air Raid'
      ? ['10', '11', '00']
      : opponent.offensiveStyle === 'Power' || opponent.offensiveStyle === 'Pro Style'
        ? ['21', '22', '12']
        : ['11', '12', '21'];
    const personnel = personnelOptions[Math.floor(Math.random() * personnelOptions.length)];

    // Calculate result
    let yards: number;
    let result: string;

    // Success influenced by down/distance and play type
    const isThirdDown = down === 3;
    const isShortYardage = distance <= 3;
    const isRedZone = yardLine >= 80;

    let successChance = 0.45; // Base

    // Adjust based on tendencies
    if (isRedZone) {
      if ((opponent.redZoneTendency === 'run' && isRun) ||
          (opponent.redZoneTendency === 'pass' && !isRun)) {
        successChance += 0.1;
      }
    }
    if (isThirdDown) {
      if (opponent.thirdDownTendency === 'aggressive') {
        successChance += isRun ? -0.05 : 0.05;
      } else if (opponent.thirdDownTendency === 'conservative') {
        successChance += isRun ? 0.05 : -0.05;
      }
    }

    const isSuccess = Math.random() < successChance;

    if (isSuccess) {
      if (Math.random() < 0.12) {
        // Explosive play
        yards = isRun ? 12 + Math.floor(Math.random() * 25) : 18 + Math.floor(Math.random() * 35);
        result = 'Big Gain';
      } else {
        yards = isRun ? 3 + Math.floor(Math.random() * 5) : 7 + Math.floor(Math.random() * 8);
        result = 'Gain';
      }
    } else {
      if (Math.random() < 0.15) {
        yards = -(1 + Math.floor(Math.random() * 4));
        result = isRun ? 'TFL' : 'Sack';
      } else {
        yards = isRun ? Math.floor(Math.random() * 2) : 0;
        result = yards === 0 ? (isRun ? 'No Gain' : 'Incomplete') : 'Short';
      }
    }

    // Turnover chance
    const isTurnover = Math.random() < 0.02;
    if (isTurnover) {
      result = isRun ? 'Fumble' : 'Interception';
      yards = 0;
    }

    const madeFirstDown = yards >= distance && !isTurnover;

    instances.push({
      id: randomUUID(),
      video_id: videoId,
      team_id: teamId,
      timestamp_start: timestamp,
      timestamp_end: timestamp + 8,
      down: Math.min(down, 4), // Ensure down is 1-4
      distance: Math.max(1, Math.min(distance, 99)),
      yard_line: Math.max(1, Math.min(yardLine, 99)),
      hash_mark: ['left', 'middle', 'right'][Math.floor(Math.random() * 3)],
      result,
      yards_gained: yards,
      resulted_in_first_down: madeFirstDown,
      is_turnover: isTurnover,
      is_opponent_play: true, // KEY: This marks it as opponent scouting data
      play_type: playType,
      formation,
      run_concept: isRun ? playConcept : undefined,
      pass_concept: !isRun ? playConcept : undefined,
      personnel,
      quarter,
      notes: `${opponent.shortName} ${formation} - ${playConcept}`,
    });

    // Update game state
    timestamp += 20 + Math.floor(Math.random() * 15);
    yardLine = Math.min(99, Math.max(1, yardLine + yards));

    if (madeFirstDown || isTurnover || down >= 4) {
      down = 1;
      distance = 10;
      if (isTurnover || yardLine >= 95) {
        yardLine = 25;
      }
    } else {
      down = Math.min(down + 1, 4);
      distance = Math.max(1, distance - Math.max(0, yards));
    }

    // Quarter progression
    if (timestamp > (quarter * 720)) {
      quarter = Math.min(4, quarter + 1);
    }
  }

  return instances;
}

async function main() {
  console.log('🔍 Creating Opponent Scouting Data\n');
  console.log('='.repeat(60));

  // Login
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'testcoach@youthcoachhub.test',
    password: 'test'
  });

  if (authError) {
    console.error('❌ Auth error:', authError.message);
    return;
  }

  const userId = auth.user?.id;
  console.log('✅ Logged in\n');

  let gamesCreated = 0;
  let videosCreated = 0;
  let playsCreated = 0;

  // Delete existing scouting games first
  const { data: existingScoutGames } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', CENTRAL_EAGLES_ID)
    .eq('is_opponent_game', true);

  if (existingScoutGames?.length) {
    const gameIds = existingScoutGames.map(g => g.id);

    // Get videos for these games
    const { data: videos } = await supabase
      .from('videos')
      .select('id')
      .in('game_id', gameIds);

    if (videos?.length) {
      const videoIds = videos.map(v => v.id);
      // Delete play instances
      await supabase.from('play_instances').delete().in('video_id', videoIds);
      // Delete markers
      await supabase.from('video_timeline_markers').delete().in('video_id', videoIds);
      // Delete videos
      await supabase.from('videos').delete().in('game_id', gameIds);
    }

    // Delete games
    await supabase.from('games').delete().in('id', gameIds);
    console.log(`🗑️  Cleaned up ${existingScoutGames.length} existing scouting games\n`);
  }

  // Create scouting data for each opponent
  for (const opponent of OPPONENTS) {
    console.log(`📋 ${opponent.name}`);
    console.log(`   Style: ${opponent.offensiveStyle} offense / ${opponent.defensiveStyle} defense`);
    console.log(`   Run/Pass: ${Math.round(opponent.runPassRatio * 100)}% run, Blitz: ${Math.round(opponent.blitzRate * 100)}%`);

    // Create scouting game
    const gameId = randomUUID();
    const scoutDate = new Date();
    scoutDate.setDate(scoutDate.getDate() - Math.floor(Math.random() * 30)); // Random date in last 30 days

    const { error: gameError } = await supabase
      .from('games')
      .insert({
        id: gameId,
        team_id: CENTRAL_EAGLES_ID,
        user_id: userId,
        name: `Scout: ${opponent.name}`,
        opponent: opponent.name,
        opponent_team_name: opponent.name,
        date: scoutDate.toISOString().split('T')[0],
        is_opponent_game: true,
        game_type: 'opponent',
        notes: `Scouting film for ${opponent.name}. ${opponent.offensiveStyle} offense.`,
      });

    if (gameError) {
      console.log(`   ❌ Game error: ${gameError.message}`);
      continue;
    }
    gamesCreated++;

    // Create video for scouting game
    const videoId = randomUUID();
    const { error: videoError } = await supabase
      .from('videos')
      .insert({
        id: videoId,
        name: `${opponent.name} Game Film`,
        file_path: 'scouting/opponent-film.mp4',
        url: 'https://storage.example.com/scouting/opponent-film.mp4',
        game_id: gameId,
      });

    if (videoError) {
      console.log(`   ❌ Video error: ${videoError.message}`);
      continue;
    }
    videosCreated++;

    // Generate scouting plays (40-60 plays per opponent)
    const playsCount = 40 + Math.floor(Math.random() * 20);
    const plays = generateScoutingPlays(videoId, CENTRAL_EAGLES_ID, opponent, playsCount);

    // Insert plays in batches
    const batchSize = 25;
    let insertedCount = 0;

    for (let i = 0; i < plays.length; i += batchSize) {
      const batch = plays.slice(i, i + batchSize);
      const { data: inserted, error: insertError } = await supabase
        .from('play_instances')
        .insert(batch)
        .select('id');

      if (insertError) {
        console.log(`   ⚠️ Play insert error: ${insertError.message}`);
      } else {
        insertedCount += inserted?.length || 0;
      }
    }

    playsCreated += insertedCount;
    console.log(`   ✅ Created ${insertedCount} scouting plays\n`);
  }

  // Summary
  console.log('='.repeat(60));
  console.log('📊 OPPONENT SCOUTING SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Scouting games: ${gamesCreated}`);
  console.log(`✅ Videos: ${videosCreated}`);
  console.log(`✅ Opponent plays tagged: ${playsCreated}`);
  console.log('\nScouting data includes:');
  console.log('  - Offensive formations and tendencies');
  console.log('  - Run/pass splits by situation');
  console.log('  - Personnel groupings');
  console.log('  - Play concepts (run and pass)');
  console.log('\n🏈 Ready for game planning!');
}

main().catch(console.error);
