/**
 * Comprehensive Seed Data for Test Team (Central Eagles)
 *
 * Team Profile:
 * - Run-heavy offense: Flexbone, Power I, Wing-T formations
 * - Strong RB (#22 DeShawn Carter), Very good WR (#1 Jaylen Davis)
 * - Average OL, Average overall defense
 * - Strong secondary, strong LBs, average DL
 * - Good turnover ratio (+ takeaways)
 * - Average special teams
 *
 * Run: npx tsx scripts/seed-comprehensive-test-data.ts
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

const TEAM_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

// ============================================================================
// ROSTER UPDATES - Assign proper positions
// ============================================================================

const ROSTER_UPDATES = [
  // OFFENSE
  // QBs
  { jersey_number: '12', primary_position: 'QB', position_group: 'offense', depth_order: 1 },
  { jersey_number: '7', primary_position: 'QB', position_group: 'offense', depth_order: 2 },

  // RBs - Strong RB (#22 is the star)
  { jersey_number: '22', primary_position: 'RB', position_group: 'offense', depth_order: 1 }, // Star RB
  { jersey_number: '28', primary_position: 'RB', position_group: 'offense', depth_order: 2 },
  { jersey_number: '44', primary_position: 'FB', position_group: 'offense', depth_order: 1 },

  // WRs - Very good WR (#1 is the star)
  { jersey_number: '1', primary_position: 'WR', position_group: 'offense', depth_order: 1 }, // Star WR
  { jersey_number: '11', primary_position: 'WR', position_group: 'offense', depth_order: 2 },
  { jersey_number: '15', primary_position: 'WR', position_group: 'offense', depth_order: 3 },

  // TEs
  { jersey_number: '85', primary_position: 'TE', position_group: 'offense', depth_order: 1 },
  { jersey_number: '48', primary_position: 'TE', position_group: 'offense', depth_order: 2 },

  // OL - Average
  { jersey_number: '72', primary_position: 'LT', position_group: 'offense', depth_order: 1 },
  { jersey_number: '64', primary_position: 'LG', position_group: 'offense', depth_order: 1 },
  { jersey_number: '55', primary_position: 'C', position_group: 'offense', depth_order: 1 },
  { jersey_number: '66', primary_position: 'RG', position_group: 'offense', depth_order: 1 },
  { jersey_number: '78', primary_position: 'RT', position_group: 'offense', depth_order: 1 },

  // DEFENSE
  // DL - Average
  { jersey_number: '91', primary_position: 'DE', position_group: 'defense', depth_order: 1 },
  { jersey_number: '95', primary_position: 'DT', position_group: 'defense', depth_order: 1 },
  { jersey_number: '99', primary_position: 'DE', position_group: 'defense', depth_order: 2 },

  // LBs - Strong
  { jersey_number: '52', primary_position: 'MLB', position_group: 'defense', depth_order: 1 }, // Star LB
  { jersey_number: '56', primary_position: 'OLB', position_group: 'defense', depth_order: 1 },
  { jersey_number: '58', primary_position: 'OLB', position_group: 'defense', depth_order: 2 },

  // DBs - Strong secondary
  { jersey_number: '21', primary_position: 'CB', position_group: 'defense', depth_order: 1 }, // Star CB
  { jersey_number: '24', primary_position: 'CB', position_group: 'defense', depth_order: 2 },
  { jersey_number: '27', primary_position: 'FS', position_group: 'defense', depth_order: 1 },
  { jersey_number: '32', primary_position: 'SS', position_group: 'defense', depth_order: 1 },

  // Special Teams / Utility
  { jersey_number: '3', primary_position: 'K', position_group: 'special_teams', depth_order: 1 },
  { jersey_number: '9', primary_position: 'P', position_group: 'special_teams', depth_order: 1 },
];

// ============================================================================
// NEW PLAYBOOK PLAYS - Run-heavy offense
// ============================================================================

const NEW_PLAYS = [
  // Flexbone plays
  {
    play_code: 'R-010',
    play_name: 'Flexbone Triple Option',
    attributes: {
      odk: 'offense',
      formation: 'Flexbone',
      playType: 'Run',
      personnel: '12 (1RB-2TE-2WR)',
      runConcept: 'Option',
      targetHole: '4',
    },
  },
  {
    play_code: 'R-011',
    play_name: 'Flexbone Speed Option',
    attributes: {
      odk: 'offense',
      formation: 'Flexbone',
      playType: 'Run',
      personnel: '12 (1RB-2TE-2WR)',
      runConcept: 'Option',
      targetHole: '6',
    },
  },
  {
    play_code: 'R-012',
    play_name: 'Flexbone Midline',
    attributes: {
      odk: 'offense',
      formation: 'Flexbone',
      playType: 'Run',
      personnel: '12 (1RB-2TE-2WR)',
      runConcept: 'Option',
      targetHole: '2',
    },
  },
  // Wing-T plays
  {
    play_code: 'R-013',
    play_name: 'Wing-T Buck Sweep',
    attributes: {
      odk: 'offense',
      formation: 'Wing-T',
      playType: 'Run',
      personnel: '21 (2RB-1TE-2WR)',
      runConcept: 'Sweep',
      targetHole: '8',
    },
  },
  {
    play_code: 'R-014',
    play_name: 'Wing-T Trap',
    attributes: {
      odk: 'offense',
      formation: 'Wing-T',
      playType: 'Run',
      personnel: '21 (2RB-1TE-2WR)',
      runConcept: 'Trap',
      targetHole: '2',
    },
  },
  {
    play_code: 'R-015',
    play_name: 'Wing-T Counter',
    attributes: {
      odk: 'offense',
      formation: 'Wing-T',
      playType: 'Run',
      personnel: '21 (2RB-1TE-2WR)',
      runConcept: 'Counter',
      targetHole: '6',
    },
  },
  // More Power I plays
  {
    play_code: 'R-016',
    play_name: 'Power I Iso',
    attributes: {
      odk: 'offense',
      formation: 'Power I',
      playType: 'Run',
      personnel: '22 (2RB-2TE-1WR)',
      runConcept: 'Iso',
      targetHole: '3',
    },
  },
  {
    play_code: 'R-017',
    play_name: 'Power I Dive',
    attributes: {
      odk: 'offense',
      formation: 'Power I',
      playType: 'Run',
      personnel: '22 (2RB-2TE-1WR)',
      runConcept: 'Dive',
      targetHole: '1',
    },
  },
  // Goal line
  {
    play_code: 'R-018',
    play_name: 'Goal Line Dive',
    attributes: {
      odk: 'offense',
      formation: 'Goal Line',
      playType: 'Run',
      personnel: '23 (2RB-3TE-0WR)',
      runConcept: 'Dive',
      targetHole: '0',
    },
  },
  // Play action passes
  {
    play_code: 'P-010',
    play_name: 'PA Boot Right',
    attributes: {
      odk: 'offense',
      formation: 'Power I',
      playType: 'Pass',
      personnel: '22 (2RB-2TE-1WR)',
      passConcept: 'Play Action',
      protection: 'Boot',
    },
  },
  {
    play_code: 'P-011',
    play_name: 'Wing-T Waggle',
    attributes: {
      odk: 'offense',
      formation: 'Wing-T',
      playType: 'Pass',
      personnel: '21 (2RB-1TE-2WR)',
      passConcept: 'Play Action',
      protection: 'Waggle',
    },
  },
];

// ============================================================================
// GAME DATA - 8 games with different characteristics
// ============================================================================

interface GameProfile {
  gameId: string;
  opponent: string;
  result: 'win' | 'loss';
  teamScore: number;
  oppScore: number;
  runPercentage: number;
  avgYardsPerRun: number;
  avgYardsPerPass: number;
  turnovers: number;
  takeaways: number;
  sacks: number;
  yardsAllowed: number;
}

const GAME_PROFILES: GameProfile[] = [
  {
    gameId: '22222222-2222-2222-2222-222222222201',
    opponent: 'Lincoln Lions',
    result: 'win',
    teamScore: 21,
    oppScore: 14,
    runPercentage: 70,
    avgYardsPerRun: 5.2,
    avgYardsPerPass: 8.5,
    turnovers: 1,
    takeaways: 2,
    sacks: 3,
    yardsAllowed: 280,
  },
  {
    gameId: '22222222-2222-2222-2222-222222222202',
    opponent: 'Roosevelt Roughriders',
    result: 'loss',
    teamScore: 14,
    oppScore: 28,
    runPercentage: 55,
    avgYardsPerRun: 3.1,
    avgYardsPerPass: 6.2,
    turnovers: 3,
    takeaways: 1,
    sacks: 1,
    yardsAllowed: 380,
  },
  {
    gameId: '22222222-2222-2222-2222-222222222203',
    opponent: 'Jefferson Jaguars',
    result: 'win',
    teamScore: 28,
    oppScore: 7,
    runPercentage: 75,
    avgYardsPerRun: 6.8,
    avgYardsPerPass: 12.0,
    turnovers: 0,
    takeaways: 3,
    sacks: 4,
    yardsAllowed: 180,
  },
  {
    gameId: '22222222-2222-2222-2222-222222222204',
    opponent: 'Washington Wolves',
    result: 'loss',
    teamScore: 17,
    oppScore: 21,
    runPercentage: 65,
    avgYardsPerRun: 4.0,
    avgYardsPerPass: 7.5,
    turnovers: 2,
    takeaways: 1,
    sacks: 2,
    yardsAllowed: 320,
  },
  {
    gameId: '22222222-2222-2222-2222-222222222205',
    opponent: 'Adams Arrows',
    result: 'win',
    teamScore: 35,
    oppScore: 14,
    runPercentage: 72,
    avgYardsPerRun: 7.2,
    avgYardsPerPass: 15.0,
    turnovers: 0,
    takeaways: 2,
    sacks: 5,
    yardsAllowed: 220,
  },
  {
    gameId: '22222222-2222-2222-2222-222222222206',
    opponent: 'Madison Mustangs',
    result: 'win',
    teamScore: 24,
    oppScore: 21,
    runPercentage: 68,
    avgYardsPerRun: 4.8,
    avgYardsPerPass: 9.0,
    turnovers: 1,
    takeaways: 2,
    sacks: 3,
    yardsAllowed: 300,
  },
  {
    gameId: '22222222-2222-2222-2222-222222222207',
    opponent: 'Monroe Monarchs',
    result: 'loss',
    teamScore: 7,
    oppScore: 14,
    runPercentage: 60,
    avgYardsPerRun: 2.8,
    avgYardsPerPass: 5.5,
    turnovers: 2,
    takeaways: 0,
    sacks: 1,
    yardsAllowed: 290,
  },
  {
    gameId: '22222222-2222-2222-2222-222222222208',
    opponent: 'Hamilton Hawks',
    result: 'win',
    teamScore: 28,
    oppScore: 21,
    runPercentage: 70,
    avgYardsPerRun: 5.5,
    avgYardsPerPass: 11.0,
    turnovers: 1,
    takeaways: 2,
    sacks: 4,
    yardsAllowed: 310,
  },
];

// Player ID mapping (will be populated from database)
let PLAYER_IDS: Record<string, string> = {};

// Play codes available
const RUN_PLAYS = ['R-001', 'R-002', 'R-003', 'R-004', 'R-010', 'R-011', 'R-012', 'R-013', 'R-014', 'R-015', 'R-016', 'R-017', 'R-018'];
const PASS_PLAYS = ['P-004', 'P-010', 'P-011'];
const DEFENSIVE_PLAYS = ['D-001', 'D-002', 'D-003', 'D-004', 'D-005', 'D-006'];

// Special teams plays
const SPECIAL_TEAMS_PLAYS = ['ST-001', 'ST-002', 'ST-003'];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateYards(avgYards: number, variance: number = 3): number {
  const base = avgYards + (Math.random() - 0.5) * variance * 2;
  const roll = Math.random();
  if (roll < 0.05) return randomInt(-3, 0);
  if (roll > 0.92) return Math.round(base * 2.5);
  return Math.round(Math.max(-5, base));
}

function getBlockResult(): string {
  const roll = Math.random();
  if (roll < 0.45) return 'win';
  if (roll < 0.80) return 'neutral';
  return 'loss';
}

// Calculate how many TDs based on score (assume some FGs and PATs)
function calculateTDsFromScore(score: number): { tds: number; fgs: number; pats: number } {
  // Assume most scoring is TDs with PATs
  // Rough distribution: Each TD is 7pts with PAT, FG is 3pts
  let tds = 0;
  let fgs = 0;
  let remaining = score;

  // First allocate TDs (with PATs = 7pts each)
  tds = Math.floor(remaining / 7);
  remaining -= tds * 7;

  // Remaining can be from FGs or missed PATs
  if (remaining >= 6) {
    // Probably a TD with missed PAT
    tds++;
    remaining -= 6;
  }
  if (remaining >= 3) {
    fgs = Math.floor(remaining / 3);
    remaining -= fgs * 3;
  }

  // PATs = TDs (assuming all made for simplicity)
  const pats = tds;

  return { tds, fgs, pats };
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  console.log('🏈 Seeding Comprehensive Test Data for Central Eagles\n');
  console.log('Team Profile: Run-heavy (Flexbone, Power I, Wing-T)');
  console.log('Star RB #22, Star WR #1, Strong LBs, Strong Secondary\n');

  // Login
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'testcoach@youthcoachhub.test',
    password: 'test'
  });

  if (authError) {
    console.error('❌ Auth error:', authError.message);
    return;
  }

  // ========================================
  // Step 1: Update roster positions
  // ========================================
  console.log('📋 Updating roster positions...');

  for (const update of ROSTER_UPDATES) {
    const { error } = await supabase
      .from('players')
      .update({
        primary_position: update.primary_position,
        position_group: update.position_group,
        depth_order: update.depth_order,
      })
      .eq('team_id', TEAM_ID)
      .eq('jersey_number', update.jersey_number);

    if (error) {
      console.error(`  ❌ Failed to update #${update.jersey_number}:`, error.message);
    }
  }
  console.log('  ✅ Roster positions updated');

  // Get player IDs
  const { data: players } = await supabase
    .from('players')
    .select('id, jersey_number, primary_position')
    .eq('team_id', TEAM_ID);

  if (players) {
    players.forEach(p => {
      PLAYER_IDS[p.jersey_number] = p.id;
      if (p.primary_position) {
        PLAYER_IDS[p.primary_position] = p.id;
      }
    });
  }
  console.log(`  📊 Loaded ${players?.length || 0} players\n`);

  // ========================================
  // Step 2: Add new playbook plays
  // ========================================
  console.log('📖 Adding run-heavy playbook plays...');

  for (const play of NEW_PLAYS) {
    // Check if play exists
    const { data: existing } = await supabase
      .from('playbook_plays')
      .select('id')
      .eq('team_id', TEAM_ID)
      .eq('play_code', play.play_code)
      .single();

    if (existing) {
      // Update existing
      await supabase
        .from('playbook_plays')
        .update({
          play_name: play.play_name,
          attributes: play.attributes,
        })
        .eq('id', existing.id);
    } else {
      // Insert new
      const { error } = await supabase
        .from('playbook_plays')
        .insert({
          team_id: TEAM_ID,
          play_code: play.play_code,
          play_name: play.play_name,
          attributes: play.attributes,
          diagram: { odk: play.attributes.odk, formation: play.attributes.formation, players: [], routes: [] },
        });

      if (error) {
        console.error(`  ❌ Failed to add ${play.play_code}:`, error.message);
      }
    }
  }
  console.log(`  ✅ Processed ${NEW_PLAYS.length} plays\n`);

  // ========================================
  // Step 3: Create videos for all games
  // ========================================
  console.log('📹 Creating video records for all 8 games...');

  // Get existing videos to avoid duplicates
  const { data: existingVideos } = await supabase
    .from('videos')
    .select('id, game_id');

  const existingGameIds = new Set(existingVideos?.map(v => v.game_id) || []);

  // Create videos only for games that don't have one
  const videoIds: Record<string, string> = {};

  for (let idx = 0; idx < GAME_PROFILES.length; idx++) {
    const game = GAME_PROFILES[idx];

    if (existingGameIds.has(game.gameId)) {
      // Use existing video
      const existing = existingVideos?.find(v => v.game_id === game.gameId);
      if (existing) {
        videoIds[game.gameId] = existing.id;
        console.log(`  ✓ Week ${idx + 1}: Using existing video`);
      }
    } else {
      // Create new video
      const newVideoId = randomUUID();
      const { error } = await supabase
        .from('videos')
        .insert({
          id: newVideoId,
          game_id: game.gameId,
          name: `Week ${idx + 1} vs ${game.opponent}`,
          file_path: `test/week${idx + 1}.mp4`,
          url: `https://example.com/week${idx + 1}.mp4`,
          moderation_status: 'approved',
        });

      if (error) {
        console.error(`  ❌ Week ${idx + 1} video error:`, error.message);
      } else {
        videoIds[game.gameId] = newVideoId;
        console.log(`  ✅ Week ${idx + 1}: Created new video`);
      }
    }
  }

  console.log('');

  // ========================================
  // Step 3b: Update games to comprehensive tagging tier
  // ========================================
  console.log('📊 Setting games to comprehensive tagging tier and marking as complete...');
  const gameIds = GAME_PROFILES.map(g => g.gameId);
  const { error: tierError } = await supabase
    .from('games')
    .update({
      tagging_tier: 'comprehensive',
      film_analysis_status: 'complete'  // Required for analytics to include these games
    })
    .in('id', gameIds);

  if (tierError) {
    console.log('  Note: Could not update tagging tier:', tierError.message);
  } else {
    console.log('  ✅ All games set to comprehensive tier\n');
  }

  // ========================================
  // Step 4: Create play instances for each game
  // ========================================
  console.log('🏃 Creating comprehensive play instances...\n');

  // Clear existing play instances and player participation for this team
  const { error: deleteParticipationError } = await supabase
    .from('player_participation')
    .delete()
    .eq('team_id', TEAM_ID);

  if (deleteParticipationError) {
    console.log('  Note: Could not clear player participation:', deleteParticipationError.message);
  }

  const { error: deleteError } = await supabase
    .from('play_instances')
    .delete()
    .eq('team_id', TEAM_ID);

  if (deleteError) {
    console.log('  Note: Could not clear existing plays:', deleteError.message);
  }

  let totalPlays = 0;
  let totalParticipation = 0;

  for (let gameIdx = 0; gameIdx < GAME_PROFILES.length; gameIdx++) {
    const game = GAME_PROFILES[gameIdx];
    const videoId = videoIds[game.gameId];

    if (!videoId) {
      console.log(`  Week ${gameIdx + 1}: ❌ No video ID, skipping`);
      continue;
    }

    console.log(`  Week ${gameIdx + 1} vs ${game.opponent} (${game.result})...`);

    const plays: any[] = [];
    const participationRecords: any[] = [];
    let timestamp = 60;

    // Calculate scoring from game scores
    const teamScoring = calculateTDsFromScore(game.teamScore);
    const oppScoring = calculateTDsFromScore(game.oppScore);

    // Generate 50-70 plays per game
    const totalGamePlays = randomInt(50, 70);
    const offensivePlays = Math.round(totalGamePlays * 0.45);
    const defensivePlays = Math.round(totalGamePlays * 0.45);
    const specialTeamsPlays = totalGamePlays - offensivePlays - defensivePlays;

    // Track scoring plays to distribute
    let teamTDsLeft = teamScoring.tds;
    let teamFGsLeft = teamScoring.fgs;
    let oppTDsLeft = oppScoring.tds;

    // ========================================
    // OFFENSIVE PLAYS (Team offense)
    // ========================================
    let turnoversLeft = game.turnovers;
    for (let i = 0; i < offensivePlays; i++) {
      const isRun = Math.random() * 100 < game.runPercentage;
      const playCode = isRun ? randomElement(RUN_PLAYS) : randomElement(PASS_PLAYS);
      let yards = generateYards(isRun ? game.avgYardsPerRun : game.avgYardsPerPass);
      const down = (i % 4) + 1;
      const distance = down === 1 ? 10 : randomInt(2, 12);
      const quarter = Math.min(4, Math.floor(i / (offensivePlays / 4)) + 1);

      const isTurnover = turnoversLeft > 0 && Math.random() < 0.15;
      if (isTurnover) turnoversLeft--;

      // Determine if this is a touchdown play
      let isTouchdown = false;
      let scoringType: string | null = null;
      if (!isTurnover && teamTDsLeft > 0) {
        // Higher chance of TD on big plays or goal-line situations
        const tdChance = yards > 15 ? 0.25 : (Math.random() < 0.08 ? 0.5 : 0.05);
        if (Math.random() < tdChance) {
          isTouchdown = true;
          scoringType = 'touchdown';
          teamTDsLeft--;
          yards = Math.max(yards, randomInt(5, 25)); // TDs are at least 5 yards
        }
      }

      const resultedInFirstDown = !isTurnover && !isTouchdown && yards >= distance;

      // Ball carrier - #22 DeShawn Carter gets most carries
      let ballCarrierId = PLAYER_IDS['22'];
      if (isRun && Math.random() < 0.3) {
        ballCarrierId = PLAYER_IDS['28'];
      }

      // For passes, determine completion
      // Pass TDs are ALWAYS completions. Otherwise ~60% completion rate (Math.random() > 0.40)
      const isComplete = !isRun ? (!isTurnover && (isTouchdown || Math.random() > 0.40)) : null;

      // Target for passes - #1 Jaylen Davis gets most targets
      let targetId = isRun ? null : (Math.random() < 0.4 ? PLAYER_IDS['1'] : randomElement([PLAYER_IDS['11'], PLAYER_IDS['15'], PLAYER_IDS['85']].filter(Boolean)));

      // Determine result string for analytics
      let result: string;
      if (isTouchdown) {
        result = 'touchdown';
      } else if (isTurnover) {
        result = isRun ? 'fumble' : 'interception';
      } else if (isRun) {
        result = yards > 0 ? 'gain' : (yards < 0 ? 'loss' : 'no gain');
      } else {
        result = isComplete ? 'complete' : 'incomplete';
      }

      const play: any = {
        team_id: TEAM_ID,
        video_id: videoId,
        play_code: playCode,
        is_opponent_play: false,
        play_type: isRun ? 'run' : 'pass',
        down,
        distance,
        yard_line: randomInt(20, 80),
        hash_mark: randomElement(['left', 'middle', 'right']),
        yards_gained: isComplete === false && !isRun ? 0 : yards, // Incomplete passes = 0 yards
        resulted_in_first_down: resultedInFirstDown,
        result, // Add result string for analytics
        is_turnover: isTurnover,
        is_fumble: isTurnover && isRun,
        is_interception: isTurnover && !isRun,
        is_touchdown: isTouchdown,
        scoring_type: scoringType,
        is_complete: isComplete,
        quarter,
        timestamp_start: timestamp,
        timestamp_end: timestamp + randomInt(5, 12),
        formation: isRun ? randomElement(['Flexbone', 'Power I', 'Wing-T', 'I-Formation']) : randomElement(['Shotgun Spread', 'Power I', 'Wing-T']),
        personnel: isRun ? randomElement(['22 (2RB-2TE-1WR)', '21 (2RB-1TE-2WR)', '12 (1RB-2TE-2WR)']) : '11 (1RB-1TE-3WR)',
        play_duration_seconds: randomInt(4, 8),
      };

      // Add player attribution if we have the IDs
      if (PLAYER_IDS['12']) play.qb_id = PLAYER_IDS['12'];
      if (ballCarrierId) play.ball_carrier_id = ballCarrierId;
      if (targetId) play.target_id = targetId;

      // OL tracking
      if (PLAYER_IDS['72']) {
        play.lt_id = PLAYER_IDS['72'];
        play.lt_block_result = getBlockResult();
      }
      if (PLAYER_IDS['64']) {
        play.lg_id = PLAYER_IDS['64'];
        play.lg_block_result = getBlockResult();
      }
      if (PLAYER_IDS['55']) {
        play.c_id = PLAYER_IDS['55'];
        play.c_block_result = getBlockResult();
      }
      if (PLAYER_IDS['66']) {
        play.rg_id = PLAYER_IDS['66'];
        play.rg_block_result = getBlockResult();
      }
      if (PLAYER_IDS['78']) {
        play.rt_id = PLAYER_IDS['78'];
        play.rt_block_result = getBlockResult();
      }

      // Add penalty data (~8% of plays have a penalty)
      if (Math.random() < 0.08) {
        play.penalty_on_play = true;
        // 60% chance penalty is on us (offensive penalties), 40% on opponent (defensive)
        play.penalty_on_us = Math.random() < 0.6;
        if (play.penalty_on_us) {
          // Offensive penalties: false start, holding, illegal formation
          play.penalty_type = randomElement(['false_start', 'holding_offense', 'illegal_formation', 'illegal_motion']);
          play.penalty_yards = randomElement([5, 5, 10, 10, 5]); // Mostly 5-yard penalties
        } else {
          // Defensive penalties: offsides, pass interference, roughing
          play.penalty_type = randomElement(['offsides', 'pass_interference', 'roughing_passer', 'encroachment']);
          play.penalty_yards = randomElement([5, 15, 15, 5]); // Mix of 5 and 15
        }
      }

      plays.push(play);
      timestamp += randomInt(25, 45);
    }

    // ========================================
    // DEFENSIVE PLAYS (Opponent offense)
    // ========================================
    let takeawaysLeft = game.takeaways;
    let sacksLeft = game.sacks;
    const tflsExpected = Math.round(game.sacks * 1.5); // TFLs are about 1.5x sacks
    let tflsLeft = tflsExpected;

    for (let i = 0; i < defensivePlays; i++) {
      const isRun = Math.random() < 0.5;
      const playCode = randomElement(DEFENSIVE_PLAYS);
      const down = (i % 4) + 1;
      const distance = down === 1 ? 10 : randomInt(2, 12);
      const quarter = Math.min(4, Math.floor(i / (defensivePlays / 4)) + 1);

      const avgYardsAllowed = game.yardsAllowed / defensivePlays;
      let yards = generateYards(avgYardsAllowed, 4);

      const isSack = !isRun && sacksLeft > 0 && Math.random() < 0.15;
      if (isSack) {
        yards = randomInt(-8, -3);
        sacksLeft--;
      }

      const isTFL = isRun && !isSack && tflsLeft > 0 && Math.random() < 0.12;
      if (isTFL) {
        yards = randomInt(-3, 0);
        tflsLeft--;
      }

      const isTakeaway = takeawaysLeft > 0 && Math.random() < 0.12;
      if (isTakeaway) takeawaysLeft--;

      // Opponent touchdowns (defensive perspective = points allowed)
      let isTouchdown = false;
      let scoringType: string | null = null;
      if (!isTakeaway && oppTDsLeft > 0) {
        const tdChance = yards > 15 ? 0.20 : 0.05;
        if (Math.random() < tdChance) {
          isTouchdown = true;
          scoringType = 'touchdown';
          oppTDsLeft--;
          yards = Math.max(yards, randomInt(5, 20));
        }
      }

      const resultedInFirstDown = yards >= distance && !isTakeaway && !isTouchdown;

      // For passes, determine completion
      // Pass TDs are ALWAYS completions. Otherwise ~55% completion rate (lower for opponents)
      const isComplete = !isRun ? (!isTakeaway && (isTouchdown || Math.random() > 0.45)) : null;

      // Determine result string for analytics
      let oppResult: string;
      if (isTouchdown) {
        oppResult = 'touchdown';
      } else if (isTakeaway) {
        oppResult = isRun ? 'fumble' : 'interception';
      } else if (isSack) {
        oppResult = 'sack';
      } else if (isRun) {
        oppResult = yards > 0 ? 'gain' : (yards < 0 ? 'loss' : 'no gain');
      } else {
        oppResult = isComplete ? 'complete' : 'incomplete';
      }

      const play: any = {
        team_id: TEAM_ID,
        video_id: videoId,
        play_code: playCode,
        is_opponent_play: true,
        play_type: isRun ? 'run' : 'pass',
        down,
        distance,
        yard_line: randomInt(20, 80),
        hash_mark: randomElement(['left', 'middle', 'right']),
        yards_gained: isComplete === false && !isRun ? 0 : yards,
        resulted_in_first_down: resultedInFirstDown,
        result: oppResult, // Add result string for analytics
        is_turnover: isTakeaway,
        is_fumble: isTakeaway && isRun,
        is_interception: isTakeaway && !isRun,
        is_touchdown: isTouchdown,
        scoring_type: scoringType,
        is_complete: isComplete,
        is_sack: isSack,
        is_tfl: isTFL,
        quarter,
        timestamp_start: timestamp,
        timestamp_end: timestamp + randomInt(5, 12),
        formation: isRun ? randomElement(['I-Formation', 'Shotgun', 'Singleback']) : 'Shotgun Spread',
        play_duration_seconds: randomInt(4, 8),
      };

      // Track play index for player_participation later
      play._playIndex = plays.length;
      play._isSack = isSack;
      play._isTFL = isTFL;
      play._isTakeaway = isTakeaway;
      play._isInterception = isTakeaway && !isRun;
      play._isFumbleRecovery = isTakeaway && isRun;

      // Add penalty data (~8% of plays have a penalty)
      // For opponent plays, penalty_on_us means penalty on OPPONENT (the offense)
      if (Math.random() < 0.08) {
        play.penalty_on_play = true;
        // 55% chance penalty is on opponent (their offense), 45% on us (our defense)
        play.penalty_on_us = Math.random() < 0.45; // penalty_on_us = true means OUR team committed penalty
        if (!play.penalty_on_us) {
          // Their offensive penalties (counts as penalty NOT on us)
          play.penalty_type = randomElement(['false_start', 'holding_offense', 'illegal_formation', 'illegal_shift']);
          play.penalty_yards = randomElement([5, 5, 10, 10, 5]);
        } else {
          // Our defensive penalties
          play.penalty_type = randomElement(['offsides', 'pass_interference', 'roughing_passer', 'personal_foul']);
          play.penalty_yards = randomElement([5, 15, 15, 15]);
        }
      }

      plays.push(play);
      timestamp += randomInt(25, 45);
    }

    // ========================================
    // SPECIAL TEAMS PLAYS
    // ========================================

    // Kickoffs (one per scoring play + game start)
    const kickoffs = teamScoring.tds + teamScoring.fgs + oppScoring.tds + 1;
    for (let i = 0; i < Math.min(kickoffs, 8); i++) {
      const isTouchback = Math.random() > 0.7; // 30% touchbacks
      const isReturn = !isTouchback;
      const isOpponentKickoff = i % 2 === 0; // Alternate who is kicking off
      const play: any = {
        team_id: TEAM_ID,
        video_id: videoId,
        play_code: randomElement(SPECIAL_TEAMS_PLAYS),
        is_opponent_play: isOpponentKickoff,
        play_type: 'special_teams',
        // Set special_teams_unit for proper function filtering
        special_teams_unit: isOpponentKickoff && isReturn ? 'kick_return' : 'kickoff',
        is_kickoff: true,
        is_kickoff_return: isReturn,
        is_touchback: isTouchback,
        kick_result: isTouchback ? 'touchback' : 'returned',
        kick_distance: randomInt(55, 70), // Kickoff distance
        return_yards: isReturn ? randomInt(15, 35) : 0,
        yard_line: isTouchback ? 25 : randomInt(20, 35),
        quarter: Math.min(4, Math.floor(i / 2) + 1),
        timestamp_start: timestamp,
        timestamp_end: timestamp + randomInt(8, 15),
        play_duration_seconds: randomInt(5, 10),
      };
      plays.push(play);
      timestamp += randomInt(30, 60);
    }

    // Field goals (our team)
    for (let i = 0; i < teamScoring.fgs + 1; i++) { // +1 for a possible miss
      const isMade = i < teamScoring.fgs;
      const play: any = {
        team_id: TEAM_ID,
        video_id: videoId,
        play_code: randomElement(SPECIAL_TEAMS_PLAYS),
        is_opponent_play: false,
        play_type: 'special_teams',
        special_teams_unit: 'field_goal',
        is_field_goal_attempt: true,
        is_field_goal_made: isMade,
        kick_result: isMade ? 'made' : 'missed',
        scoring_type: isMade ? 'field_goal' : null,
        kick_distance: randomInt(25, 45),
        yard_line: randomInt(10, 35),
        quarter: randomInt(2, 4),
        timestamp_start: timestamp,
        timestamp_end: timestamp + randomInt(5, 10),
        play_duration_seconds: randomInt(3, 5),
      };
      plays.push(play);
      timestamp += randomInt(30, 50);
    }

    // Opponent field goal attempts (some blocked by our defense)
    const oppFgAttempts = randomInt(1, 3);
    for (let i = 0; i < oppFgAttempts; i++) {
      const isBlocked = i === 0; // First one is blocked by our defense
      const isMade = !isBlocked && Math.random() > 0.3;
      const play: any = {
        team_id: TEAM_ID,
        video_id: videoId,
        play_code: randomElement(SPECIAL_TEAMS_PLAYS),
        is_opponent_play: true,
        play_type: 'special_teams',
        special_teams_unit: 'field_goal',
        is_field_goal_attempt: true,
        is_field_goal_made: isMade,
        kick_result: isBlocked ? 'blocked' : (isMade ? 'made' : 'missed'),
        scoring_type: isMade ? 'field_goal' : null,
        kick_distance: randomInt(30, 50),
        yard_line: randomInt(15, 40),
        quarter: randomInt(2, 4),
        timestamp_start: timestamp,
        timestamp_end: timestamp + randomInt(5, 10),
        play_duration_seconds: randomInt(3, 5),
      };
      plays.push(play);
      timestamp += randomInt(30, 50);
    }

    // Extra points (PATs) - one per TD
    for (let i = 0; i < teamScoring.tds; i++) {
      const isMade = Math.random() > 0.1; // 90% success rate
      const play: any = {
        team_id: TEAM_ID,
        video_id: videoId,
        play_code: randomElement(SPECIAL_TEAMS_PLAYS),
        is_opponent_play: false,
        play_type: 'special_teams',
        special_teams_unit: 'pat',
        is_extra_point_attempt: true,
        is_extra_point_made: isMade,
        scoring_type: isMade ? 'extra_point' : null,
        yard_line: 3, // PAT from 3-yard line
        quarter: randomInt(1, 4),
        timestamp_start: timestamp,
        timestamp_end: timestamp + randomInt(3, 6),
        play_duration_seconds: randomInt(2, 4),
      };
      plays.push(play);
      timestamp += randomInt(20, 40);
    }

    // Punts (assume 3-5 per game)
    const puntCount = randomInt(3, 5);
    for (let i = 0; i < puntCount; i++) {
      const isOurPunt = i % 2 === 0; // Alternate between our punts and opponent punts
      const isReturn = Math.random() > 0.4;
      const puntDistance = randomInt(35, 50);
      const returnYards = isReturn ? randomInt(5, 20) : 0;
      const play: any = {
        team_id: TEAM_ID,
        video_id: videoId,
        play_code: randomElement(SPECIAL_TEAMS_PLAYS),
        is_opponent_play: !isOurPunt, // Flip: our punts are NOT opponent plays
        play_type: 'special_teams',
        // Set special_teams_unit: 'punt' for our punts, 'punt_return' when opponent punts to us
        special_teams_unit: isOurPunt ? 'punt' : 'punt_return',
        is_punt: true,
        is_punt_return: isReturn && !isOurPunt, // Only our team returns opponent punts
        kick_distance: puntDistance, // Gross punt yards
        return_yards: returnYards,
        yards_gained: puntDistance - returnYards, // Net punt yards
        yard_line: randomInt(25, 45),
        quarter: randomInt(2, 4),
        timestamp_start: timestamp,
        timestamp_end: timestamp + randomInt(8, 15),
        play_duration_seconds: randomInt(4, 8),
      };
      plays.push(play);
      timestamp += randomInt(30, 60);
    }

    // Insert plays for this game
    const { data: inserted, error: insertError } = await supabase
      .from('play_instances')
      .insert(plays.map(p => {
        // Remove temp fields before insert
        const { _playIndex, _isSack, _isTFL, _isTakeaway, _isInterception, _isFumbleRecovery, ...cleanPlay } = p;
        return cleanPlay;
      }))
      .select('id');

    if (insertError) {
      console.error(`    ❌ Error: ${insertError.message}`);
    } else {
      console.log(`    ✅ ${inserted?.length || 0} plays created`);
      totalPlays += inserted?.length || 0;

      // ========================================
      // Create player_participation records
      // ========================================
      if (inserted && inserted.length > 0) {
        // Map play indices to inserted IDs
        const playIdMap: Record<number, string> = {};
        inserted.forEach((ins, idx) => {
          playIdMap[idx] = ins.id;
        });

        // Now create participation records for defensive plays
        const defensivePlayerIds = [
          PLAYER_IDS['91'], // DE
          PLAYER_IDS['95'], // DT
          PLAYER_IDS['99'], // DE
          PLAYER_IDS['52'], // MLB (star)
          PLAYER_IDS['56'], // OLB
          PLAYER_IDS['58'], // OLB
          PLAYER_IDS['21'], // CB (star)
          PLAYER_IDS['24'], // CB
          PLAYER_IDS['27'], // FS
          PLAYER_IDS['32'], // SS
        ].filter(Boolean);

        const dlPlayers = [PLAYER_IDS['91'], PLAYER_IDS['95'], PLAYER_IDS['99']].filter(Boolean);
        const lbPlayers = [PLAYER_IDS['52'], PLAYER_IDS['56'], PLAYER_IDS['58']].filter(Boolean);
        const dbPlayers = [PLAYER_IDS['21'], PLAYER_IDS['24'], PLAYER_IDS['27'], PLAYER_IDS['32']].filter(Boolean);

        // OL players for offensive line tracking
        const olPlayers = {
          lt: PLAYER_IDS['72'],
          lg: PLAYER_IDS['64'],
          c: PLAYER_IDS['55'],
          rg: PLAYER_IDS['66'],
          rt: PLAYER_IDS['78'],
        };

        for (let i = 0; i < plays.length; i++) {
          const play = plays[i];
          const playId = playIdMap[i];

          if (!playId) continue;

          // OL tracking for OUR offensive plays (run/pass only, not special teams)
          if (!play.is_opponent_play && play.play_type && ['run', 'pass'].includes(play.play_type)) {
            // Create OL participation records with win rates
            // Average OL: ~60% win rate for run, ~65% for pass
            const isRunPlay = play.play_type === 'run';
            const baseWinRate = isRunPlay ? 0.60 : 0.65;

            const olPositions = [
              { pos: 'ol_lt', playerId: olPlayers.lt },
              { pos: 'ol_lg', playerId: olPlayers.lg },
              { pos: 'ol_c', playerId: olPlayers.c },
              { pos: 'ol_rg', playerId: olPlayers.rg },
              { pos: 'ol_rt', playerId: olPlayers.rt },
            ];

            olPositions.forEach(({ pos, playerId }) => {
              if (playerId) {
                // Randomize win/loss with some variance
                const isWin = Math.random() < baseWinRate;
                participationRecords.push({
                  play_instance_id: playId,
                  team_id: TEAM_ID,
                  player_id: playerId,
                  participation_type: pos,
                  result: isWin ? 'win' : 'loss',
                });
              }
            });

            // ========================================
            // Create receiver/passer/rusher participation records
            // This is critical for Standard tier stats (WR/TE, QB, RB)
            // Valid results: success, failure, neutral (from player_participation_result_check)
            // ========================================

            // Passer participation (QB on all offensive plays)
            if (play.qb_id) {
              participationRecords.push({
                play_instance_id: playId,
                team_id: TEAM_ID,
                player_id: play.qb_id,
                participation_type: 'passer',
                phase: 'offense',
                yards_gained: play.play_type === 'pass' ? play.yards_gained : 0,
                is_touchdown: play.play_type === 'pass' && play.is_touchdown,
                // Use valid result values from constraint
                result: play.play_type === 'pass'
                  ? (play.is_complete ? 'success' : 'failure')
                  : 'neutral', // handoff is neutral for QB
              });
            }

            // Rusher participation (ball carrier on run plays)
            if (play.play_type === 'run' && play.ball_carrier_id) {
              participationRecords.push({
                play_instance_id: playId,
                team_id: TEAM_ID,
                player_id: play.ball_carrier_id,
                participation_type: 'rusher',
                phase: 'offense',
                yards_gained: play.yards_gained,
                is_touchdown: play.is_touchdown,
                // Use valid result values from constraint
                result: play.yards_gained > 0 ? 'success' : (play.yards_gained < 0 ? 'failure' : 'neutral'),
              });
            }

            // Receiver participation (target on pass plays)
            if (play.play_type === 'pass' && play.target_id) {
              participationRecords.push({
                play_instance_id: playId,
                team_id: TEAM_ID,
                player_id: play.target_id,
                participation_type: 'receiver',
                phase: 'offense',
                yards_gained: play.is_complete ? play.yards_gained : 0,
                is_touchdown: play.is_complete && play.is_touchdown,
                // Use valid result values from constraint
                result: play.is_complete ? 'success' : 'failure',
              });
            }
          }

          // ========================================
          // SPECIAL TEAMS PARTICIPATION RECORDS
          // (MUST be BEFORE the 'continue' for non-opponent plays!)
          // ========================================
          const kickerId = PLAYER_IDS['3'];   // K - Kicker (#3 Ethan Reynolds)
          const punterId = PLAYER_IDS['9'];   // P - Punter (#9 Lucas Chen)
          const returnerId = PLAYER_IDS['1']; // WR - also used as returner (#1 Jaylen Davis)

          // Kicker participation for OUR kickoffs
          if (play.is_kickoff && !play.is_opponent_play && kickerId) {
            participationRecords.push({
              play_instance_id: playId,
              team_id: TEAM_ID,
              player_id: kickerId,
              participation_type: 'kicker',
              phase: 'special_teams',
              yards_gained: play.kick_distance || 0,
              result: play.kick_result === 'touchback' ? 'success' : 'neutral',
            });
          }

          // Kicker participation for OUR field goals
          if (play.is_field_goal_attempt && !play.is_opponent_play && kickerId) {
            participationRecords.push({
              play_instance_id: playId,
              team_id: TEAM_ID,
              player_id: kickerId,
              participation_type: 'kicker',
              phase: 'special_teams',
              yards_gained: play.kick_distance || 0,
              result: play.kick_result === 'made' ? 'success' : 'failure',
            });
          }

          // Kicker participation for OUR extra points (PATs)
          if (play.is_extra_point_attempt && !play.is_opponent_play && kickerId) {
            participationRecords.push({
              play_instance_id: playId,
              team_id: TEAM_ID,
              player_id: kickerId,
              participation_type: 'kicker',
              phase: 'special_teams',
              result: play.is_extra_point_made ? 'success' : 'failure',
            });
          }

          // Punter participation for OUR punts
          if (play.is_punt && !play.is_opponent_play && punterId) {
            participationRecords.push({
              play_instance_id: playId,
              team_id: TEAM_ID,
              player_id: punterId,
              participation_type: 'punter',
              phase: 'special_teams',
              yards_gained: play.kick_distance || 0,
              result: 'success',
            });
          }

          // Returner participation for kick/punt returns (when opponent kicks to us)
          if (play.is_kickoff_return && play.is_opponent_play && returnerId) {
            participationRecords.push({
              play_instance_id: playId,
              team_id: TEAM_ID,
              player_id: returnerId,
              participation_type: 'returner',
              phase: 'special_teams',
              yards_gained: play.return_yards || 0,
              is_touchdown: play.is_touchdown || false,
              result: (play.return_yards || 0) >= 20 ? 'success' : 'neutral',
            });
          }

          // Punt returner participation (when opponent punts to us)
          if (play.is_punt_return && play.is_opponent_play && returnerId) {
            participationRecords.push({
              play_instance_id: playId,
              team_id: TEAM_ID,
              player_id: returnerId,
              participation_type: 'returner',
              phase: 'special_teams',
              yards_gained: play.return_yards || 0,
              is_touchdown: play.is_touchdown || false,
              result: (play.return_yards || 0) >= 10 ? 'success' : 'neutral',
            });
          }

          // Skip defensive tracking for non-opponent plays
          if (!play.is_opponent_play) continue;

          // Sacks -> pressure participation
          if (play._isSack) {
            const sackPlayer = randomElement(dlPlayers.concat(lbPlayers));
            if (sackPlayer) {
              participationRecords.push({
                play_instance_id: playId,
                team_id: TEAM_ID,
                player_id: sackPlayer,
                participation_type: 'pressure',
                phase: 'defense',  // Required for fallback queries
                result: 'sack',
              });
            }
          }

          // TFLs -> tackle_for_loss participation
          if (play._isTFL) {
            const tflPlayer = randomElement(defensivePlayerIds);
            if (tflPlayer) {
              participationRecords.push({
                play_instance_id: playId,
                team_id: TEAM_ID,
                player_id: tflPlayer,
                participation_type: 'tackle_for_loss',
                phase: 'defense',  // Required for fallback queries
                result: 'made',
              });
            }
          }

          // Interceptions
          if (play._isInterception) {
            const intPlayer = randomElement(dbPlayers.concat(lbPlayers));
            if (intPlayer) {
              participationRecords.push({
                play_instance_id: playId,
                team_id: TEAM_ID,
                player_id: intPlayer,
                participation_type: 'interception',
                phase: 'defense',  // Required for fallback queries
                result: 'success',
              });
            }
          }

          // Fumble recoveries
          if (play._isFumbleRecovery) {
            const fumblePlayer = randomElement(defensivePlayerIds);
            if (fumblePlayer) {
              participationRecords.push({
                play_instance_id: playId,
                team_id: TEAM_ID,
                player_id: fumblePlayer,
                participation_type: 'fumble_recovery',
                phase: 'defense',  // Required for fallback queries
                result: 'success',
              });
            }
          }

          // Add tackles for most defensive plays
          if (play.is_opponent_play && !play._isTakeaway && Math.random() > 0.2) {
            const tackler = randomElement(defensivePlayerIds);
            if (tackler) {
              participationRecords.push({
                play_instance_id: playId,
                team_id: TEAM_ID,
                player_id: tackler,
                participation_type: 'primary_tackle',
                phase: 'defense',  // Required for fallback queries
                result: 'made',
              });
            }
          }
        }

        // Insert participation records
        if (participationRecords.length > 0) {
          const { data: partInserted, error: partError } = await supabase
            .from('player_participation')
            .insert(participationRecords)
            .select('id');

          if (partError) {
            console.error(`    ❌ Participation error: ${partError.message}`);
          } else {
            console.log(`    ✅ ${partInserted?.length || 0} participation records`);
            totalParticipation += partInserted?.length || 0;
          }
        }

        // Clear for next game
        participationRecords.length = 0;
      }
    }
  }

  // ========================================
  // Summary
  // ========================================
  console.log('\n' + '='.repeat(50));
  console.log('📊 SEED DATA SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Roster: ${players?.length || 0} players with positions assigned`);
  console.log(`✅ Playbook: ${21 + NEW_PLAYS.length} plays (run-heavy offense)`);
  console.log(`✅ Videos: ${Object.keys(videoIds).length} game videos`);
  console.log(`✅ Play Instances: ${totalPlays} comprehensive tagged plays`);
  console.log(`✅ Player Participation: ${totalParticipation} player stat records`);
  console.log('\nData includes:');
  console.log('  - Offensive plays with TDs, passing yards, OL tracking');
  console.log('  - Defensive plays with opponent TDs, sacks, TFLs, takeaways');
  console.log('  - Special teams: kickoffs, punts, FGs, PATs, returns');
  console.log('  - Offensive participation: passer, rusher, receiver stats');
  console.log('  - OL participation: block win/loss tracking');
  console.log('  - Defensive participation: sacks, TFLs, interceptions, fumble recoveries');
  console.log('  - Special teams participation: kicker, punter, returner stats');
  console.log('\n🎯 Refresh Analytics & Reports to see the data!');
}

main().catch(console.error);
