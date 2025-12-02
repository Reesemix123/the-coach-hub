import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const TEAM_ID = '99ef9d88-454e-42bf-8f52-04d37b34a9d6';

/**
 * Seed opponent film data for testing the Game Plan Builder's opponent analytics
 *
 * This creates:
 * 1. A video linked to an existing game with the opponent
 * 2. Play instances marked as opponent plays with realistic defensive tendencies (for offensive game planning)
 * 3. Play instances marked as opponent offensive plays (for defensive game planning)
 */
export async function POST() {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const results: { video: boolean; defensivePlays: number; offensivePlays: number; errors: string[] } = {
    video: false,
    defensivePlays: 0,
    offensivePlays: 0,
    errors: []
  };

  // Step 1: Find an existing game for this team
  // Use the Mountain Ridge game specifically so opponent analytics work in game plan builder
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, opponent')
    .eq('team_id', TEAM_ID)
    .eq('opponent', 'Mountain Ridge')
    .limit(1);

  if (gamesError || !games || games.length === 0) {
    return NextResponse.json({
      error: 'No games found. Please create a game first.',
      details: gamesError?.message
    }, { status: 400 });
  }

  const game = games[0];
  const gameId = game.id;
  const opponentName = game.opponent || 'Opponent';

  // Step 1.5: Mark this game as an opponent scouting game
  const { error: updateError } = await supabase
    .from('games')
    .update({
      is_opponent_game: true,
      opponent_team_name: opponentName
    })
    .eq('id', gameId);

  if (updateError) {
    results.errors.push(`Game update failed: ${updateError.message}`);
  }

  // Step 2: Create or find a video for this game (for opponent film)
  let videoId: string;

  const { data: existingVideo } = await supabase
    .from('videos')
    .select('id')
    .eq('game_id', gameId)
    .eq('name', 'Opponent Film - Scouting')
    .limit(1);

  if (existingVideo && existingVideo.length > 0) {
    videoId = existingVideo[0].id;

    // Delete existing opponent play instances for this video
    await supabase
      .from('play_instances')
      .delete()
      .eq('video_id', videoId)
      .eq('is_opponent_play', true);
  } else {
    // Create new video
    const { data: newVideo, error: videoError } = await supabase
      .from('videos')
      .insert({
        game_id: gameId,
        name: 'Opponent Film - Scouting',
        file_path: 'scouting/opponent_film.mp4',
        url: null
      })
      .select()
      .single();

    if (videoError || !newVideo) {
      results.errors.push(`Video creation failed: ${videoError?.message}`);
      return NextResponse.json(results, { status: 500 });
    }

    videoId = newVideo.id;
    results.video = true;
  }

  // Step 3: Create opponent play instances with realistic defensive tendencies
  // This simulates scouting data from watching opponent's defense (for our offensive game planning)

  const opponentDefensivePlays = generateOpponentDefensivePlays(videoId);

  const { data: insertedDefensivePlays, error: defensivePlaysError } = await supabase
    .from('play_instances')
    .insert(opponentDefensivePlays)
    .select();

  if (defensivePlaysError) {
    results.errors.push(`Defensive play instances failed: ${defensivePlaysError.message}`);
  } else {
    results.defensivePlays = insertedDefensivePlays?.length || 0;
  }

  // Step 4: Create opponent offensive play instances
  // This simulates scouting data from watching opponent's offense (for our defensive game planning)

  const opponentOffensivePlays = generateOpponentOffensivePlays(videoId);

  const { data: insertedOffensivePlays, error: offensivePlaysError } = await supabase
    .from('play_instances')
    .insert(opponentOffensivePlays)
    .select();

  if (offensivePlaysError) {
    results.errors.push(`Offensive play instances failed: ${offensivePlaysError.message}`);
  } else {
    results.offensivePlays = insertedOffensivePlays?.length || 0;
  }

  return NextResponse.json({
    success: results.errors.length === 0,
    gameId,
    opponent: opponentName,
    ...results,
    defensiveSummary: generateDefensiveSummary(opponentDefensivePlays),
    offensiveSummary: generateOffensiveSummary(opponentOffensivePlays)
  });
}

/**
 * Generate realistic opponent DEFENSIVE play data (for our offensive game planning)
 * Creates a defensive profile with clear tendencies:
 * - Heavy Cover 3 team (55% of plays)
 * - High blitz rate on 3rd down (60%)
 * - Struggles vs the run (40% stop rate)
 * - Solid pass defense (55% success rate defending)
 */
function generateOpponentDefensivePlays(videoId: string) {
  const plays: Array<{
    video_id: string;
    is_opponent_play: boolean;
    play_concept: string;
    facing_blitz: boolean;
    play_type: string;
    success: boolean;
    down: number;
    distance: number;
    yard_line: number;
    timestamp_start: number;
    notes: string;
  }> = [];

  let timestamp = 0;

  // Coverage distribution (opponent's defensive coverage)
  const coverages = [
    { type: 'Cover 3', weight: 55 },
    { type: 'Cover 2', weight: 20 },
    { type: 'Cover 1 Man', weight: 15 },
    { type: 'Cover 4', weight: 10 }
  ];

  // Generate 60 plays worth of scouting data
  const totalPlays = 60;

  for (let i = 0; i < totalPlays; i++) {
    const down = getRandomDown();
    const distance = getDistanceForDown(down);
    const yardLine = Math.floor(Math.random() * 80) + 10; // Between 10-90

    // Determine coverage based on weights
    const coverage = getWeightedRandom(coverages);

    // Blitz rate varies by down
    // 1st down: 20% blitz
    // 2nd down: 30% blitz
    // 3rd down: 60% blitz (they love to blitz on 3rd)
    const blitzRates: Record<number, number> = { 1: 0.2, 2: 0.3, 3: 0.6, 4: 0.5 };
    const facingBlitz = Math.random() < (blitzRates[down] || 0.3);

    // Play type (what we ran against them)
    const playType = Math.random() < 0.45 ? 'run' : 'pass';

    // Success rate based on play type
    // They struggle vs the run (we succeed 60% of time)
    // They're better vs the pass (we succeed 45% of time)
    let success: boolean;
    if (playType === 'run') {
      success = Math.random() < 0.60; // 60% success running
    } else {
      success = Math.random() < 0.45; // 45% success passing
    }

    // Adjust success if they blitzed - quick passes work better
    if (facingBlitz && playType === 'pass') {
      success = Math.random() < 0.55; // Better success vs blitz with quick game
    }

    plays.push({
      video_id: videoId,
      is_opponent_play: true,
      play_concept: coverage,
      facing_blitz: facingBlitz,
      play_type: playType,
      success,
      down,
      distance,
      yard_line: yardLine,
      timestamp_start: timestamp,
      notes: `Scouting: ${coverage}${facingBlitz ? ' + Blitz' : ''}`
    });

    timestamp += Math.floor(Math.random() * 30) + 15; // 15-45 seconds between plays
  }

  return plays;
}

/**
 * Generate realistic opponent OFFENSIVE play data (for our defensive game planning)
 * Creates an offensive profile with clear tendencies:
 * - Run-heavy team (55% run, 45% pass)
 * - Primary formation: 21 Personnel (2 RB, 1 TE) - 40% of plays
 * - Secondary formation: 11 Personnel (1 RB, 1 TE, 3 WR) - 35% of plays
 * - Power run scheme (Inside Zone, Outside Zone, Power)
 * - West Coast passing concepts (Slant, Curl, Screen)
 * - High 3rd down conversion rate (45%)
 */
function generateOpponentOffensivePlays(videoId: string) {
  const plays: Array<{
    video_id: string;
    is_opponent_play: boolean;
    play_type: string;
    formation: string;
    personnel: string;
    run_concept: string | null;
    pass_concept: string | null;
    yards_gained: number;
    success: boolean;
    down: number;
    distance: number;
    yard_line: number;
    timestamp_start: number;
    notes: string;
  }> = [];

  let timestamp = 5000; // Start after defensive plays in video

  // Formation distribution (opponent's offensive formations)
  const formations = [
    { type: 'I-Formation', personnel: '21 (2RB-1TE-2WR)', weight: 25 },
    { type: 'Ace', personnel: '21 (2RB-1TE-2WR)', weight: 15 },
    { type: 'Shotgun Spread', personnel: '11 (1RB-1TE-3WR)', weight: 25 },
    { type: 'Singleback', personnel: '11 (1RB-1TE-3WR)', weight: 10 },
    { type: 'Pistol', personnel: '12 (1RB-2TE-2WR)', weight: 15 },
    { type: 'Empty', personnel: '10 (1RB-0TE-4WR)', weight: 10 }
  ];

  // Run concepts distribution
  const runConcepts = [
    { type: 'Inside Zone', weight: 35 },
    { type: 'Outside Zone', weight: 25 },
    { type: 'Power', weight: 20 },
    { type: 'Counter', weight: 10 },
    { type: 'Dive', weight: 10 }
  ];

  // Pass concepts distribution
  const passConcepts = [
    { type: 'Slant', weight: 20 },
    { type: 'Curl/Flat', weight: 20 },
    { type: 'Screen', weight: 15 },
    { type: 'Post', weight: 15 },
    { type: 'Out', weight: 15 },
    { type: 'Go/Streak', weight: 15 }
  ];

  // Generate 50 offensive plays worth of scouting data
  const totalPlays = 50;

  for (let i = 0; i < totalPlays; i++) {
    const down = getRandomDown();
    const distance = getDistanceForDown(down);
    const yardLine = Math.floor(Math.random() * 80) + 10; // Between 10-90
    const isRedZone = yardLine <= 20;

    // Determine formation based on weights
    const formationData = getWeightedRandomWithData(formations);

    // Determine play type - run-heavy, but more pass on 3rd and long
    let runPercentage = 0.55; // Base 55% run
    if (down === 3 && distance > 5) {
      runPercentage = 0.30; // Only 30% run on 3rd and long
    } else if (down === 1) {
      runPercentage = 0.60; // 60% run on 1st down
    } else if (isRedZone) {
      runPercentage = 0.65; // 65% run in red zone (power running team)
    }

    const isRun = Math.random() < runPercentage;
    const playType = isRun ? 'run' : 'pass';

    // Determine concept based on play type
    const runConcept = isRun ? getWeightedRandom(runConcepts) : null;
    const passConcept = !isRun ? getWeightedRandom(passConcepts) : null;

    // Calculate yards gained - realistic distribution
    let yardsGained: number;
    if (isRun) {
      // Run plays: mostly 2-5 yards, occasional big play
      const rand = Math.random();
      if (rand < 0.10) yardsGained = Math.floor(Math.random() * 3) - 2; // -2 to 0 (TFL)
      else if (rand < 0.40) yardsGained = Math.floor(Math.random() * 3) + 1; // 1-3 yards
      else if (rand < 0.75) yardsGained = Math.floor(Math.random() * 4) + 4; // 4-7 yards
      else if (rand < 0.90) yardsGained = Math.floor(Math.random() * 5) + 8; // 8-12 yards
      else yardsGained = Math.floor(Math.random() * 15) + 15; // 15-30 (explosive)
    } else {
      // Pass plays: more variance
      const rand = Math.random();
      if (rand < 0.25) yardsGained = 0; // Incomplete
      else if (rand < 0.40) yardsGained = Math.floor(Math.random() * 4) + 1; // 1-4 yards (short)
      else if (rand < 0.65) yardsGained = Math.floor(Math.random() * 6) + 5; // 5-10 yards (medium)
      else if (rand < 0.85) yardsGained = Math.floor(Math.random() * 8) + 11; // 11-18 yards
      else yardsGained = Math.floor(Math.random() * 25) + 20; // 20-45 (explosive)
    }

    // Determine success based on down and distance
    const success = calculateSuccessFromYards(down, distance, yardsGained);

    plays.push({
      video_id: videoId,
      is_opponent_play: true,
      play_type: playType,
      formation: formationData.type,
      personnel: formationData.personnel,
      run_concept: runConcept,
      pass_concept: passConcept,
      yards_gained: yardsGained,
      success,
      down,
      distance,
      yard_line: yardLine,
      timestamp_start: timestamp,
      notes: `Opponent Offense: ${formationData.type} - ${isRun ? runConcept : passConcept}`
    });

    timestamp += Math.floor(Math.random() * 30) + 15; // 15-45 seconds between plays
  }

  return plays;
}

function calculateSuccessFromYards(down: number, distance: number, yards: number): boolean {
  if (down === 1) return yards >= distance * 0.40; // 40% of distance on 1st
  if (down === 2) return yards >= distance * 0.60; // 60% of distance on 2nd
  return yards >= distance; // 100% on 3rd/4th
}

function getWeightedRandomWithData<T extends { type: string; weight: number }>(items: T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * total;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }

  return items[0];
}

function getRandomDown(): number {
  const rand = Math.random();
  if (rand < 0.35) return 1;
  if (rand < 0.65) return 2;
  if (rand < 0.95) return 3;
  return 4;
}

function getDistanceForDown(down: number): number {
  if (down === 1) return 10;
  if (down === 2) {
    // 2nd down: short (1-3), medium (4-6), long (7+)
    const rand = Math.random();
    if (rand < 0.3) return Math.floor(Math.random() * 3) + 1;
    if (rand < 0.6) return Math.floor(Math.random() * 3) + 4;
    return Math.floor(Math.random() * 5) + 7;
  }
  if (down === 3) {
    // 3rd down distribution
    const rand = Math.random();
    if (rand < 0.25) return Math.floor(Math.random() * 3) + 1; // short
    if (rand < 0.55) return Math.floor(Math.random() * 4) + 4; // medium
    return Math.floor(Math.random() * 6) + 8; // long
  }
  // 4th down - usually short
  return Math.floor(Math.random() * 2) + 1;
}

function getWeightedRandom(items: Array<{ type: string; weight: number }>): string {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * total;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item.type;
  }

  return items[0].type;
}

function generateDefensiveSummary(plays: Array<{ play_concept: string; facing_blitz: boolean; play_type: string; success: boolean; down: number }>) {
  const totalPlays = plays.length;
  const blitzPlays = plays.filter(p => p.facing_blitz).length;
  const runPlays = plays.filter(p => p.play_type === 'run');
  const passPlays = plays.filter(p => p.play_type === 'pass');

  const coverageCounts: Record<string, number> = {};
  plays.forEach(p => {
    coverageCounts[p.play_concept] = (coverageCounts[p.play_concept] || 0) + 1;
  });

  const thirdDownPlays = plays.filter(p => p.down === 3);
  const thirdDownBlitzes = thirdDownPlays.filter(p => p.facing_blitz).length;

  return {
    type: 'defensive',
    totalPlays,
    blitzRate: Math.round((blitzPlays / totalPlays) * 100),
    runSuccessRate: Math.round((runPlays.filter(p => p.success).length / runPlays.length) * 100),
    passSuccessRate: Math.round((passPlays.filter(p => p.success).length / passPlays.length) * 100),
    thirdDownBlitzRate: Math.round((thirdDownBlitzes / thirdDownPlays.length) * 100),
    coverageBreakdown: Object.entries(coverageCounts)
      .map(([coverage, count]) => ({ coverage, percentage: Math.round((count / totalPlays) * 100) }))
      .sort((a, b) => b.percentage - a.percentage)
  };
}

function generateOffensiveSummary(plays: Array<{
  play_type: string;
  formation: string;
  personnel: string;
  run_concept: string | null;
  pass_concept: string | null;
  yards_gained: number;
  success: boolean;
  down: number;
  yard_line: number;
}>) {
  const totalPlays = plays.length;
  const runPlays = plays.filter(p => p.play_type === 'run');
  const passPlays = plays.filter(p => p.play_type === 'pass');
  const redZonePlays = plays.filter(p => p.yard_line <= 20);

  // Formation breakdown
  const formationCounts: Record<string, number> = {};
  plays.forEach(p => {
    formationCounts[p.formation] = (formationCounts[p.formation] || 0) + 1;
  });

  // Run concept breakdown
  const runConceptCounts: Record<string, number> = {};
  runPlays.forEach(p => {
    if (p.run_concept) {
      runConceptCounts[p.run_concept] = (runConceptCounts[p.run_concept] || 0) + 1;
    }
  });

  // Pass concept breakdown
  const passConceptCounts: Record<string, number> = {};
  passPlays.forEach(p => {
    if (p.pass_concept) {
      passConceptCounts[p.pass_concept] = (passConceptCounts[p.pass_concept] || 0) + 1;
    }
  });

  // Third down analysis
  const thirdDownPlays = plays.filter(p => p.down === 3);
  const thirdDownSuccesses = thirdDownPlays.filter(p => p.success).length;

  // Red zone run rate
  const redZoneRuns = redZonePlays.filter(p => p.play_type === 'run').length;

  // Average yards
  const avgYardsPerPlay = plays.reduce((sum, p) => sum + p.yards_gained, 0) / totalPlays;
  const avgYardsPerRun = runPlays.length > 0
    ? runPlays.reduce((sum, p) => sum + p.yards_gained, 0) / runPlays.length
    : 0;
  const avgYardsPerPass = passPlays.length > 0
    ? passPlays.reduce((sum, p) => sum + p.yards_gained, 0) / passPlays.length
    : 0;

  return {
    type: 'offensive',
    totalPlays,
    runPercentage: Math.round((runPlays.length / totalPlays) * 100),
    passPercentage: Math.round((passPlays.length / totalPlays) * 100),
    avgYardsPerPlay: Math.round(avgYardsPerPlay * 10) / 10,
    avgYardsPerRun: Math.round(avgYardsPerRun * 10) / 10,
    avgYardsPerPass: Math.round(avgYardsPerPass * 10) / 10,
    thirdDownConversionRate: Math.round((thirdDownSuccesses / thirdDownPlays.length) * 100),
    redZoneRunPercentage: redZonePlays.length > 0
      ? Math.round((redZoneRuns / redZonePlays.length) * 100)
      : 0,
    formationBreakdown: Object.entries(formationCounts)
      .map(([formation, count]) => ({ formation, percentage: Math.round((count / totalPlays) * 100) }))
      .sort((a, b) => b.percentage - a.percentage),
    topRunConcepts: Object.entries(runConceptCounts)
      .map(([concept, count]) => ({ concept, percentage: Math.round((count / runPlays.length) * 100) }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3),
    topPassConcepts: Object.entries(passConceptCounts)
      .map(([concept, count]) => ({ concept, percentage: Math.round((count / passPlays.length) * 100) }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3)
  };
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to seed opponent scouting data',
    description: 'Creates ~110 opponent play instances: 60 defensive plays (for offensive game planning) and 50 offensive plays (for defensive game planning)',
    defensiveTendencies: {
      primaryCoverage: 'Cover 3 (55%)',
      blitzRate: '~35% overall, 60% on 3rd down',
      runDefense: 'Weak (allows 60% success)',
      passDefense: 'Solid (allows 45% success)'
    },
    offensiveTendencies: {
      runPassSplit: '55% run / 45% pass',
      primaryFormation: 'I-Formation / Ace (40%)',
      secondaryFormation: 'Shotgun Spread (25%)',
      runScheme: 'Inside Zone (35%), Outside Zone (25%), Power (20%)',
      passScheme: 'West Coast (Slant, Curl/Flat, Screen)',
      redZoneRunRate: '~65%',
      thirdDownConversion: '~45%'
    }
  });
}
