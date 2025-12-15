// Opponent Analytics Service
// Analyzes opponent film to project play success and identify tendencies

import { createClient } from '@/utils/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OpponentProfile,
  OpponentOffensiveProfile,
  OpponentSpecialTeamsProfile,
  DefensiveTendency,
  OffensiveTendency,
  PlayMatchScore,
  PlaybookPlay
} from '@/types/football';
import { inferSituation, inferDefensiveSituation } from '@/config/gamePlanCategories';

/**
 * Get opponent tendencies from their tagged film
 * Uses play_instances where is_opponent_play = true
 * @param supabaseClient - Optional Supabase client (for server-side calls)
 */
export async function getOpponentTendencies(
  teamId: string,
  opponentName: string,
  supabaseClient?: SupabaseClient
): Promise<OpponentProfile> {
  const supabase = supabaseClient || createClient();

  // Step 1: Find games against this opponent
  // Try regular games first (where opponent field matches)
  let { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId)
    .ilike('opponent', `%${opponentName}%`);

  // Fallback: Also check opponent scouting games (is_opponent_game = true)
  if (!games || games.length === 0) {
    const { data: scoutingGames } = await supabase
      .from('games')
      .select('id')
      .eq('team_id', teamId)
      .eq('is_opponent_game', true)
      .or(`opponent.ilike.%${opponentName}%,opponent_team_name.ilike.%${opponentName}%`);

    if (scoutingGames && scoutingGames.length > 0) {
      games = scoutingGames;
    }
  }

  if (gamesError || !games || games.length === 0) {
    return getEmptyOpponentProfile(opponentName);
  }

  const gameIds = games.map(g => g.id);

  // Step 2: Find videos for those games
  const { data: videos, error: videoError } = await supabase
    .from('videos')
    .select('id')
    .in('game_id', gameIds);

  if (videoError || !videos || videos.length === 0) {
    return getEmptyOpponentProfile(opponentName);
  }

  const videoIds = videos.map(v => v.id);

  // Step 3: Get opponent play instances (tagged with "Opponent Play")
  // These represent opponent's historical performance which we use to calculate probabilities
  const { data: opponentPlays, error } = await supabase
    .from('play_instances')
    .select('*')
    .eq('is_opponent_play', true)
    .in('video_id', videoIds);

  if (error) {
    console.error('Error fetching opponent plays:', error);
    return getEmptyOpponentProfile(opponentName);
  }

  if (!opponentPlays || opponentPlays.length === 0) {
    return getEmptyOpponentProfile(opponentName);
  }

  // Filter to plays that have defensive data (coverage, blitz info)
  // These are plays where we tracked what defense the opponent showed
  const opponentDefensivePlays = opponentPlays.filter(play => {
    // Include plays that have defensive attributes recorded
    return play.play_concept || play.coverage || play.facing_blitz !== undefined ||
           play.play_type; // Also include general plays for success rate analysis
  });

  if (opponentDefensivePlays.length === 0) {
    return getEmptyOpponentProfile(opponentName);
  }

  // Analyze opponent defensive tendencies from their tagged plays
  const coverageDistribution: Record<string, number> = {};
  let blitzCount = 0;
  let runPlaysAgainst = 0;
  let runSuccessAgainst = 0;
  let passPlaysAgainst = 0;
  let passSuccessAgainst = 0;

  const blitzBySituation: Record<string, { total: number; blitz: number }> = {};
  const tendenciesByDown: Record<string, {
    plays: number;
    coverages: Record<string, number>;
    blitzes: number;
    successAgainst: number;
  }> = {};

  for (const play of opponentDefensivePlays) {
    // Track coverage (from play attributes or linked playbook play)
    const coverage = play.play_concept || 'Unknown';
    coverageDistribution[coverage] = (coverageDistribution[coverage] || 0) + 1;

    // Track blitz rate
    if (play.facing_blitz) {
      blitzCount++;
    }

    // Track run/pass success against opponent
    const playType = play.play_type || 'unknown';
    const isSuccess = play.success || false;

    if (playType === 'run') {
      runPlaysAgainst++;
      if (isSuccess) runSuccessAgainst++;
    } else if (playType === 'pass') {
      passPlaysAgainst++;
      if (isSuccess) passSuccessAgainst++;
    }

    // Track by situation
    const situation = inferSituation(play.down || 1, play.distance || 10, play.yard_line || 50);

    if (!blitzBySituation[situation]) {
      blitzBySituation[situation] = { total: 0, blitz: 0 };
    }
    blitzBySituation[situation].total++;
    if (play.facing_blitz) {
      blitzBySituation[situation].blitz++;
    }

    // Track by down
    const downKey = `down_${play.down || 1}`;
    if (!tendenciesByDown[downKey]) {
      tendenciesByDown[downKey] = {
        plays: 0,
        coverages: {},
        blitzes: 0,
        successAgainst: 0
      };
    }
    tendenciesByDown[downKey].plays++;
    tendenciesByDown[downKey].coverages[coverage] = (tendenciesByDown[downKey].coverages[coverage] || 0) + 1;
    if (play.facing_blitz) tendenciesByDown[downKey].blitzes++;
    if (isSuccess) tendenciesByDown[downKey].successAgainst++;
  }

  // Calculate blitz rate by situation
  const blitzRateBySituation: Record<string, number> = {};
  for (const [situation, data] of Object.entries(blitzBySituation)) {
    blitzRateBySituation[situation] = data.total > 0
      ? Math.round((data.blitz / data.total) * 100)
      : 0;
  }

  // Build defensive tendencies by down
  const processedTendencies: Record<string, DefensiveTendency> = {};
  for (const [down, data] of Object.entries(tendenciesByDown)) {
    const coverages = Object.entries(data.coverages).sort((a, b) => b[1] - a[1]);
    const mostCommon = coverages[0] || ['Unknown', 0];

    processedTendencies[down] = {
      plays: data.plays,
      mostCommonCoverage: mostCommon[0],
      coveragePercentage: data.plays > 0 ? Math.round((mostCommon[1] / data.plays) * 100) : 0,
      blitzPercentage: data.plays > 0 ? Math.round((data.blitzes / data.plays) * 100) : 0,
      successRateAgainst: data.plays > 0 ? Math.round((data.successAgainst / data.plays) * 100) : 0
    };
  }

  return {
    teamName: opponentName,
    totalPlaysAnalyzed: opponentDefensivePlays.length,
    coverageDistribution,
    blitzRate: opponentDefensivePlays.length > 0 ? Math.round((blitzCount / opponentDefensivePlays.length) * 100) : 0,
    blitzRateBySituation,
    runStopRate: runPlaysAgainst > 0 ? Math.round(((runPlaysAgainst - runSuccessAgainst) / runPlaysAgainst) * 100) : 0,
    passDefenseRate: passPlaysAgainst > 0 ? Math.round(((passPlaysAgainst - passSuccessAgainst) / passPlaysAgainst) * 100) : 0,
    tendenciesByDown: processedTendencies
  };
}

/**
 * Empty opponent profile for when no film data exists
 */
function getEmptyOpponentProfile(opponentName: string): OpponentProfile {
  return {
    teamName: opponentName,
    totalPlaysAnalyzed: 0,
    coverageDistribution: {},
    blitzRate: 0,
    blitzRateBySituation: {},
    runStopRate: 0,
    passDefenseRate: 0,
    tendenciesByDown: {}
  };
}

/**
 * Get opponent OFFENSIVE tendencies from scouting film
 * Used for defensive game planning to understand opponent's offense
 * Analyzes play_instances marked as opponent offensive plays
 * @param teamId - Your team's ID
 * @param opponentName - Name of the opponent to analyze
 * @param supabaseClient - Optional Supabase client (for server-side calls)
 */
export async function getOpponentOffensiveTendencies(
  teamId: string,
  opponentName: string,
  supabaseClient?: SupabaseClient
): Promise<OpponentOffensiveProfile> {
  const supabase = supabaseClient || createClient();

  // Step 1: Find games against this opponent marked as opponent scouting games
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId)
    .eq('is_opponent_game', true)
    .ilike('opponent', `%${opponentName}%`);

  let foundGames = games || [];

  if (gamesError || foundGames.length === 0) {
    // Also try games where opponent_team_name matches
    const { data: altGames } = await supabase
      .from('games')
      .select('id')
      .eq('team_id', teamId)
      .ilike('opponent_team_name', `%${opponentName}%`);

    if (!altGames || altGames.length === 0) {
      return getEmptyOpponentOffensiveProfile(opponentName);
    }

    foundGames = altGames;
  }

  const gameIds = foundGames.map(g => g.id);

  // Step 2: Find videos for those games
  const { data: videos, error: videoError } = await supabase
    .from('videos')
    .select('id')
    .in('game_id', gameIds);

  if (videoError || !videos || videos.length === 0) {
    return getEmptyOpponentOffensiveProfile(opponentName);
  }

  const videoIds = videos.map(v => v.id);

  // Step 3: Get opponent OFFENSIVE play instances (their offense, not defense)
  // These are plays tagged as opponent plays that represent their offensive tendencies
  const { data: allOpponentPlays, error } = await supabase
    .from('play_instances')
    .select('*')
    .eq('is_opponent_play', true)
    .in('video_id', videoIds);

  if (error) {
    console.error('Error fetching opponent offensive plays:', error);
    return getEmptyOpponentOffensiveProfile(opponentName);
  }

  if (!allOpponentPlays || allOpponentPlays.length === 0) {
    return getEmptyOpponentOffensiveProfile(opponentName);
  }

  // Filter to only offensive plays (run, pass, etc. - not defensive plays)
  const opponentPlays = allOpponentPlays.filter(play => {
    const playType = (play.play_type || '').toLowerCase();
    // Include offensive play types, exclude defensive or special teams
    return playType === 'run' || playType === 'pass' || playType === 'screen' ||
           playType === 'play action' || playType === 'rpo' || playType === 'draw' ||
           playType === 'unknown' || playType === ''; // Include untyped plays as likely offensive
  });

  if (opponentPlays.length === 0) {
    return getEmptyOpponentOffensiveProfile(opponentName);
  }

  // Analyze offensive tendencies
  let runPlays = 0;
  let passPlays = 0;
  let totalYards = 0;
  let runYards = 0;
  let passYards = 0;
  let thirdDownAttempts = 0;
  let thirdDownConversions = 0;
  let redZonePlays = 0;
  let redZoneRunPlays = 0;
  let passingDownRunPlays = 0;
  let passingDownPlays = 0;

  const formationCounts: Record<string, { total: number; runs: number }> = {};
  const runConceptCounts: Record<string, number> = {};
  const passConceptCounts: Record<string, number> = {};
  const personnelCounts: Record<string, number> = {};
  const runPercentageByDown: Record<string, { runs: number; total: number }> = {};
  const tendenciesByDown: Record<string, {
    plays: number;
    runs: number;
    passes: number;
    formations: Record<string, number>;
    yards: number;
    successes: number;
  }> = {};

  for (const play of opponentPlays) {
    const playType = (play.play_type || 'unknown').toLowerCase();
    const isRun = playType === 'run' || playType === 'draw';
    const isPass = playType === 'pass' || playType === 'screen' || playType === 'play action' || playType === 'rpo';
    const yards = play.yards_gained || 0;
    const down = play.down || 1;
    const distance = play.distance || 10;
    const yardLine = play.yard_line || 50;
    const formation = play.formation || 'Unknown';
    const isSuccess = play.success || play.resulted_in_first_down || false;

    // Basic counts
    if (isRun) {
      runPlays++;
      runYards += yards;
    } else if (isPass) {
      passPlays++;
      passYards += yards;
    }
    totalYards += yards;

    // Formation tracking
    if (!formationCounts[formation]) {
      formationCounts[formation] = { total: 0, runs: 0 };
    }
    formationCounts[formation].total++;
    if (isRun) formationCounts[formation].runs++;

    // Run/Pass concept tracking
    const concept = play.play_concept || play.run_concept || play.pass_concept || 'Unknown';
    if (isRun) {
      runConceptCounts[concept] = (runConceptCounts[concept] || 0) + 1;
    } else if (isPass) {
      passConceptCounts[concept] = (passConceptCounts[concept] || 0) + 1;
    }

    // Personnel tracking (if available)
    const personnel = play.personnel || 'Unknown';
    personnelCounts[personnel] = (personnelCounts[personnel] || 0) + 1;

    // Situational tracking
    const situation = inferDefensiveSituation(down, distance, yardLine);
    const downKey = `down_${down}`;

    // Run percentage by down
    if (!runPercentageByDown[downKey]) {
      runPercentageByDown[downKey] = { runs: 0, total: 0 };
    }
    runPercentageByDown[downKey].total++;
    if (isRun) runPercentageByDown[downKey].runs++;

    // Tendencies by down
    if (!tendenciesByDown[downKey]) {
      tendenciesByDown[downKey] = {
        plays: 0,
        runs: 0,
        passes: 0,
        formations: {},
        yards: 0,
        successes: 0
      };
    }
    tendenciesByDown[downKey].plays++;
    if (isRun) tendenciesByDown[downKey].runs++;
    if (isPass) tendenciesByDown[downKey].passes++;
    tendenciesByDown[downKey].formations[formation] = (tendenciesByDown[downKey].formations[formation] || 0) + 1;
    tendenciesByDown[downKey].yards += yards;
    if (isSuccess) tendenciesByDown[downKey].successes++;

    // Third down tracking
    if (down === 3) {
      thirdDownAttempts++;
      if (isSuccess || (play.resulted_in_first_down)) {
        thirdDownConversions++;
      }
    }

    // Red zone tracking (inside our 20)
    if (yardLine <= 20 || yardLine >= 80) {
      redZonePlays++;
      if (isRun) redZoneRunPlays++;
    }

    // Passing down tracking (3rd & 7+, 2nd & 8+)
    if ((down === 3 && distance >= 7) || (down === 2 && distance >= 8)) {
      passingDownPlays++;
      if (isRun) passingDownRunPlays++;
    }
  }

  const totalPlays = opponentPlays.length;

  // Calculate formation distribution
  const formationDistribution: Record<string, number> = {};
  for (const [formation, data] of Object.entries(formationCounts)) {
    formationDistribution[formation] = Math.round((data.total / totalPlays) * 100);
  }

  // Top formations with run rate
  const topFormations = Object.entries(formationCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([formation, data]) => ({
      formation,
      percentage: Math.round((data.total / totalPlays) * 100),
      runRate: data.total > 0 ? Math.round((data.runs / data.total) * 100) : 0
    }));

  // Run concept distribution
  const runConceptDistribution: Record<string, number> = {};
  for (const [concept, count] of Object.entries(runConceptCounts)) {
    runConceptDistribution[concept] = runPlays > 0 ? Math.round((count / runPlays) * 100) : 0;
  }

  // Pass concept distribution
  const passConceptDistribution: Record<string, number> = {};
  for (const [concept, count] of Object.entries(passConceptCounts)) {
    passConceptDistribution[concept] = passPlays > 0 ? Math.round((count / passPlays) * 100) : 0;
  }

  // Personnel distribution
  const personnelDistribution: Record<string, number> = {};
  for (const [personnel, count] of Object.entries(personnelCounts)) {
    personnelDistribution[personnel] = Math.round((count / totalPlays) * 100);
  }

  // Run percentage by down (formatted)
  const runPctByDown: Record<string, number> = {};
  for (const [down, data] of Object.entries(runPercentageByDown)) {
    runPctByDown[down] = data.total > 0 ? Math.round((data.runs / data.total) * 100) : 0;
  }

  // Build processed tendencies by down
  const processedTendencies: Record<string, OffensiveTendency> = {};
  for (const [down, data] of Object.entries(tendenciesByDown)) {
    const formations = Object.entries(data.formations).sort((a, b) => b[1] - a[1]);
    const mostCommon = formations[0] || ['Unknown', 0];

    processedTendencies[down] = {
      plays: data.plays,
      runPercentage: data.plays > 0 ? Math.round((data.runs / data.plays) * 100) : 0,
      passPercentage: data.plays > 0 ? Math.round((data.passes / data.plays) * 100) : 0,
      mostCommonFormation: mostCommon[0],
      formationPercentage: data.plays > 0 ? Math.round((mostCommon[1] / data.plays) * 100) : 0,
      avgYards: data.plays > 0 ? Math.round((data.yards / data.plays) * 10) / 10 : 0,
      successRate: data.plays > 0 ? Math.round((data.successes / data.plays) * 100) : 0
    };
  }

  return {
    teamName: opponentName,
    totalPlaysAnalyzed: totalPlays,

    // Run/Pass tendencies
    runPercentage: totalPlays > 0 ? Math.round((runPlays / totalPlays) * 100) : 0,
    passPercentage: totalPlays > 0 ? Math.round((passPlays / totalPlays) * 100) : 0,
    runPercentageByDown: runPctByDown,

    // Formation tendencies
    formationDistribution,
    topFormations,

    // Play concept tendencies
    runConceptDistribution,
    passConceptDistribution,

    // Personnel tendencies
    personnelDistribution,

    // Situational tendencies
    redZoneRunPercentage: redZonePlays > 0 ? Math.round((redZoneRunPlays / redZonePlays) * 100) : 0,
    thirdDownConversionRate: thirdDownAttempts > 0 ? Math.round((thirdDownConversions / thirdDownAttempts) * 100) : 0,
    passingDownRunRate: passingDownPlays > 0 ? Math.round((passingDownRunPlays / passingDownPlays) * 100) : 0,

    // Averages
    avgYardsPerPlay: totalPlays > 0 ? Math.round((totalYards / totalPlays) * 10) / 10 : 0,
    avgYardsPerRun: runPlays > 0 ? Math.round((runYards / runPlays) * 10) / 10 : 0,
    avgYardsPerPass: passPlays > 0 ? Math.round((passYards / passPlays) * 10) / 10 : 0,

    // Tendencies by down
    tendenciesByDown: processedTendencies
  };
}

/**
 * Empty opponent offensive profile for when no film data exists
 */
function getEmptyOpponentOffensiveProfile(opponentName: string): OpponentOffensiveProfile {
  return {
    teamName: opponentName,
    totalPlaysAnalyzed: 0,
    runPercentage: 0,
    passPercentage: 0,
    runPercentageByDown: {},
    formationDistribution: {},
    topFormations: [],
    runConceptDistribution: {},
    passConceptDistribution: {},
    personnelDistribution: {},
    redZoneRunPercentage: 0,
    thirdDownConversionRate: 0,
    passingDownRunRate: 0,
    avgYardsPerPlay: 0,
    avgYardsPerRun: 0,
    avgYardsPerPass: 0,
    tendenciesByDown: {}
  };
}

/**
 * Project defensive play success against a specific opponent's offense
 * @param play - The defensive play to evaluate
 * @param opponentProfile - Opponent's offensive tendencies
 * @param situation - Optional situation context (e.g., 'def_3rd_long', 'def_red_zone')
 */
export function projectDefensivePlaySuccess(
  play: PlaybookPlay,
  opponentProfile: OpponentOffensiveProfile,
  situation?: string | null
): PlayMatchScore {
  let score = 50; // Base score
  const reasons: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (opponentProfile.totalPlaysAnalyzed === 0) {
    return {
      playCode: play.play_code,
      score: 50,
      confidence: 'low',
      reasoning: 'No opponent offensive film data available'
    };
  }

  // Set confidence based on sample size
  if (opponentProfile.totalPlaysAnalyzed >= 50) {
    confidence = 'high';
  } else if (opponentProfile.totalPlaysAnalyzed >= 20) {
    confidence = 'medium';
  }

  const defensiveFormation = play.attributes?.formation?.toLowerCase() || '';
  const playType = play.attributes?.playType?.toLowerCase() || '';
  const coverage = play.attributes?.coverage?.toLowerCase() || '';

  // Classify defensive play type
  const isRunStoppingDefense = defensiveFormation.includes('goal') ||
    defensiveFormation.includes('bear') ||
    defensiveFormation.includes('4-4') ||
    defensiveFormation.includes('5-2') ||
    defensiveFormation.includes('4-6') ||
    playType.includes('goal line');

  const isPassDefense = defensiveFormation.includes('nickel') ||
    defensiveFormation.includes('dime') ||
    defensiveFormation.includes('prevent') ||
    playType.includes('nickel') ||
    playType.includes('dime');

  const isBlitz = playType.includes('blitz');
  const isBaseDefense = playType.includes('base');

  // Coverage type analysis
  const isCover3 = coverage.includes('cover 3') || coverage.includes('3');
  const isCover2 = coverage.includes('cover 2') || coverage.includes('2');
  const isCover1 = coverage.includes('cover 1') || coverage.includes('1') || coverage.includes('man');
  const isCover4 = coverage.includes('cover 4') || coverage.includes('4') || coverage.includes('quarters');
  const isCover0 = coverage.includes('cover 0') || coverage.includes('0');

  // Get opponent's down-specific tendencies
  const down1Tendency = opponentProfile.tendenciesByDown?.['down_1'];
  const down2Tendency = opponentProfile.tendenciesByDown?.['down_2'];
  const down3Tendency = opponentProfile.tendenciesByDown?.['down_3'];

  // ==========================================
  // SITUATION-SPECIFIC SCORING
  // ==========================================

  if (situation) {
    const sitLower = situation.toLowerCase();

    // ----- 1ST & SHORT DEFENSE (1-5 yards) -----
    if (sitLower.includes('def_1st_short') || sitLower.includes('1st_short')) {
      // 1st & short = opponent will likely run or take a shot
      if (isRunStoppingDefense) {
        score += 20;
        reasons.push(`Heavy front stops 1st & short runs`);
      } else if (isBaseDefense) {
        score += 15;
        reasons.push(`Base D handles short yardage`);
      } else if (isPassDefense) {
        score -= 10;
        reasons.push(`Light box risky on 1st & short`);
      }
    }

    // ----- 1ST & MEDIUM DEFENSE (6-10 yards, standard 1st & 10) -----
    else if (sitLower.includes('def_1st_medium') || sitLower.includes('1st_medium') || sitLower === 'def_1st_down') {
      const runPct = down1Tendency?.runPercentage || opponentProfile.runPercentage;

      if (runPct > 55) {
        // Run-heavy on 1st down
        if (isBaseDefense) {
          score += 20;
          reasons.push(`Base D stops 1st down run (opponent runs ${runPct}%)`);
        } else if (isRunStoppingDefense) {
          score += 15;
          reasons.push(`Heavy front vs 1st down run game`);
        } else if (isPassDefense) {
          score -= 15;
          reasons.push(`Light box vs run-heavy 1st down`);
        } else if (isBlitz) {
          score -= 10;
          reasons.push(`Risky to blitz predictable 1st down runs`);
        }
      } else {
        // Balanced/pass-leaning on 1st down
        if (isBaseDefense) {
          score += 15;
          reasons.push(`Balanced defense for versatile 1st down`);
        }
      }
    }

    // ----- 1ST & LONG DEFENSE (11+ yards, after penalty) -----
    else if (sitLower.includes('def_1st_long') || sitLower.includes('1st_long')) {
      // 1st & long = opponent likely passing to recover
      if (isPassDefense) {
        score += 20;
        reasons.push(`Extra DBs for 1st & long pass situation`);
      } else if (isBlitz) {
        score += 15;
        reasons.push(`Pressure forces quick decisions on 1st & long`);
      } else if (isRunStoppingDefense) {
        score -= 15;
        reasons.push(`Heavy personnel wrong for 1st & long pass`);
      } else if (isBaseDefense) {
        score += 5;
        reasons.push(`Base D versatile on 1st & long`);
      }
    }

    // ----- 2ND & SHORT DEFENSE -----
    else if (sitLower.includes('2nd_short') || sitLower.includes('2nd & short')) {
      // 2nd & short = likely run
      if (isRunStoppingDefense) {
        score += 25;
        reasons.push(`Stacked box perfect for 2nd & short`);
      } else if (isBaseDefense) {
        score += 15;
        reasons.push(`Solid run defense for short yardage`);
      } else if (isPassDefense) {
        score -= 15;
        reasons.push(`Too light for 2nd & short run threat`);
      } else if (isBlitz) {
        score += 10;
        reasons.push(`A-gap blitz can blow up short yardage`);
      }
    }

    // ----- 2ND & MEDIUM/LONG DEFENSE -----
    else if (sitLower.includes('2nd_medium') || sitLower.includes('2nd_long')) {
      if (isBaseDefense) {
        score += 15;
        reasons.push(`Base coverage handles 2nd down mix`);
      } else if (isCover3 || isCover4) {
        score += 10;
        reasons.push(`Zone coverage protects vs big plays`);
      }
    }

    // ----- 3RD & SHORT DEFENSE -----
    else if (sitLower.includes('3rd_short') || sitLower.includes('3rd & short')) {
      // 3rd & short = run or quick pass
      if (isRunStoppingDefense) {
        score += 25;
        reasons.push(`Goal line package stops 3rd & short`);
      } else if (isBlitz && isCover0) {
        score += 20;
        reasons.push(`All-out blitz gambles for TFL`);
      } else if (isBaseDefense) {
        score += 10;
        reasons.push(`Base defense solid for 3rd & short`);
      } else if (isPassDefense) {
        score -= 10;
        reasons.push(`Nickel/Dime vulnerable to power run`);
      }
    }

    // ----- 3RD & MEDIUM DEFENSE -----
    else if (sitLower.includes('3rd_medium') || sitLower.includes('3rd & medium')) {
      // 3rd & medium = pass likely, but run possible
      if (isBlitz) {
        score += 15;
        reasons.push(`Pressure forces quick decisions on 3rd & medium`);
      } else if (isPassDefense && isCover1) {
        score += 15;
        reasons.push(`Man coverage tight on 3rd & medium routes`);
      } else if (isBaseDefense) {
        score += 5;
        reasons.push(`Base defense stays balanced`);
      } else if (isCover4) {
        score -= 5;
        reasons.push(`Soft coverage gives up 3rd & medium conversions`);
      }

      // Factor in opponent's 3rd down rate
      if (opponentProfile.thirdDownConversionRate < 35) {
        if (isBlitz) {
          score += 10;
          reasons.push(`Opponent struggles on 3rd (${opponentProfile.thirdDownConversionRate}%)`);
        }
      }
    }

    // ----- 3RD & LONG DEFENSE -----
    else if (sitLower.includes('3rd_long') || sitLower.includes('3rd & long')) {
      // 3rd & long = pass heavy, need coverage + pressure
      if (isPassDefense) {
        score += 20;
        reasons.push(`Extra DBs perfect for 3rd & long`);
      }
      if (isBlitz) {
        score += 15;
        reasons.push(`Pressure forces difficult throws on 3rd & long`);
      }
      if (isCover3 || isCover4) {
        score += 10;
        reasons.push(`Deep zone prevents big completion`);
      }
      if (isRunStoppingDefense) {
        score -= 20;
        reasons.push(`Heavy personnel wrong for 3rd & long pass`);
      }
      if (isBaseDefense && !isPassDefense) {
        score -= 5;
        reasons.push(`Need more DBs for 3rd & long`);
      }

      // Big bonus if opponent has low 3rd down rate
      if (opponentProfile.thirdDownConversionRate < 35) {
        score += 10;
        reasons.push(`Opponent only converts ${opponentProfile.thirdDownConversionRate}% on 3rd`);
      }
    }

    // ----- RED ZONE DEFENSE -----
    else if (sitLower.includes('red_zone') || sitLower.includes('red zone')) {
      const rzRunPct = opponentProfile.redZoneRunPercentage;

      if (rzRunPct > 55) {
        // Run-heavy in red zone
        if (isRunStoppingDefense) {
          score += 25;
          reasons.push(`Goal line D vs RZ run game (${rzRunPct}% run)`);
        } else if (isBaseDefense) {
          score += 10;
          reasons.push(`Base D can handle RZ runs`);
        } else if (isPassDefense) {
          score -= 10;
          reasons.push(`Light box vs RZ ground attack`);
        }
      } else {
        // Pass-heavy in red zone
        if (isCover1 || isCover0) {
          score += 20;
          reasons.push(`Man coverage tight in compressed RZ`);
        } else if (isPassDefense) {
          score += 15;
          reasons.push(`Extra DBs cover RZ passing`);
        }
      }

      // Blitzes are risky but can be effective
      if (isBlitz) {
        score += 5;
        reasons.push(`RZ blitz can force turnover`);
      }
    }

    // ----- GOAL LINE DEFENSE -----
    else if (sitLower.includes('goal_line') || sitLower.includes('goal line')) {
      if (isRunStoppingDefense) {
        score += 30;
        reasons.push(`Goal line package built for this`);
      } else if (isCover0 || isCover1) {
        score += 15;
        reasons.push(`Tight man coverage at goal line`);
      } else if (isBaseDefense) {
        score += 5;
        reasons.push(`Base D adequate at goal line`);
      } else if (isPassDefense) {
        score -= 20;
        reasons.push(`Too light for goal line stand`);
      }
    }

    // ----- 4TH & SHORT DEFENSE (1-2 yards) -----
    else if (sitLower.includes('def_4th_short') || sitLower.includes('4th_short')) {
      // 4th & short = they're going for it, likely run
      if (isRunStoppingDefense) {
        score += 25;
        reasons.push(`Goal line package stops 4th & short`);
      } else if (isBlitz && isCover0) {
        score += 20;
        reasons.push(`All-out blitz gambles for TFL`);
      } else if (isBaseDefense) {
        score += 15;
        reasons.push(`Base D solid for 4th & short stop`);
      } else if (isPassDefense) {
        score -= 10;
        reasons.push(`Light box risky on 4th & short`);
      }
    }

    // ----- 4TH & MEDIUM DEFENSE (3-5 yards) -----
    else if (sitLower.includes('def_4th_medium') || sitLower.includes('4th_medium')) {
      // 4th & medium = could be run or pass
      if (isBlitz) {
        score += 20;
        reasons.push(`Pressure disrupts 4th & medium rhythm`);
      } else if (isBaseDefense) {
        score += 15;
        reasons.push(`Balanced D for 4th & medium`);
      } else if (isPassDefense && isCover1) {
        score += 15;
        reasons.push(`Man coverage tight on 4th & medium`);
      } else if (isRunStoppingDefense) {
        score += 10;
        reasons.push(`Heavy front gambles on run`);
      }
    }

    // ----- 4TH & LONG DEFENSE (6+ yards) -----
    else if (sitLower.includes('def_4th_long') || sitLower.includes('4th_long')) {
      // 4th & long = desperation pass or trick play
      if (isPassDefense) {
        score += 25;
        reasons.push(`Extra DBs for 4th & long pass`);
      } else if (isBlitz) {
        score += 20;
        reasons.push(`All-out pressure on 4th & long`);
      } else if (isCover3 || isCover4) {
        score += 15;
        reasons.push(`Deep zone prevents chunk play`);
      } else if (isRunStoppingDefense) {
        score -= 20;
        reasons.push(`Heavy personnel wrong for 4th & long`);
      }
    }
  }

  // ==========================================
  // GENERAL OPPONENT TENDENCY ANALYSIS
  // (Applied when no situation or as bonus)
  // ==========================================

  if (!situation) {
    // Only apply general analysis if no situation is selected

    // Run-heavy opponent (>55%)
    if (opponentProfile.runPercentage > 55) {
      if (isRunStoppingDefense) {
        score += 15;
        reasons.push(`Strong vs run-heavy offense (${opponentProfile.runPercentage}% run)`);
      } else if (isBaseDefense) {
        score += 10;
        reasons.push(`Base defense handles run-heavy team`);
      } else if (isPassDefense) {
        score -= 10;
        reasons.push(`Light personnel vs run-heavy team`);
      }
    }
    // Pass-heavy opponent (>55%)
    else if (opponentProfile.passPercentage > 55) {
      if (isPassDefense) {
        score += 15;
        reasons.push(`Extra coverage vs pass-heavy offense (${opponentProfile.passPercentage}% pass)`);
      } else if (isRunStoppingDefense) {
        score -= 10;
        reasons.push(`Heavy personnel vs pass-first team`);
      }
    }
    // Balanced opponent
    else {
      if (isBaseDefense) {
        score += 10;
        reasons.push(`Versatile base defense vs balanced attack`);
      }
    }

    // Third down analysis for general scoring
    if (opponentProfile.thirdDownConversionRate < 35) {
      score += 5;
      reasons.push(`Opponent struggles on 3rd down (${opponentProfile.thirdDownConversionRate}%)`);
    }
  }

  // ==========================================
  // COVERAGE VS OPPONENT CONCEPTS (Always apply)
  // ==========================================

  // Get top pass concepts
  const topPassConcepts = Object.entries(opponentProfile.passConceptDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  // Coverage matchups (small bonuses/penalties)
  if (isCover3 && topPassConcepts.some(([c]) => c.toLowerCase().includes('screen'))) {
    score += 5;
    reasons.push(`Cover 3 defenders rally to screens`);
  }
  if (isCover2 && topPassConcepts.some(([c]) => c.toLowerCase().includes('out'))) {
    score += 5;
    reasons.push(`Cover 2 corners sit on out routes`);
  }
  if ((isCover1 || isCover0) && topPassConcepts.some(([c]) => c.toLowerCase().includes('slant'))) {
    score -= 3;
    reasons.push(`Man coverage can get beat by quick slants`);
  }

  // Cap score between 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    playCode: play.play_code,
    score,
    confidence,
    reasoning: reasons.length > 0 ? reasons.join('. ') : 'Standard defensive matchup'
  };
}

/**
 * Project offensive play success against a specific opponent's defense
 * @param play - The offensive play to evaluate
 * @param opponentProfile - Opponent's defensive tendencies
 * @param situation - Optional situation context (e.g., '1st_down', '3rd_long', 'red_zone')
 */
export function projectPlaySuccess(
  play: PlaybookPlay,
  opponentProfile: OpponentProfile,
  situation?: string | null
): PlayMatchScore {
  let score = 50; // Base score
  const reasons: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (opponentProfile.totalPlaysAnalyzed === 0) {
    return {
      playCode: play.play_code,
      score: 50,
      confidence: 'low',
      reasoning: 'No opponent film data available'
    };
  }

  // Set confidence based on sample size
  if (opponentProfile.totalPlaysAnalyzed >= 50) {
    confidence = 'high';
  } else if (opponentProfile.totalPlaysAnalyzed >= 20) {
    confidence = 'medium';
  }

  const playType = play.attributes?.playType?.toLowerCase() || '';
  const passConcept = play.attributes?.passConcept?.toLowerCase() || '';
  const runConcept = play.attributes?.runConcept?.toLowerCase() || '';
  const hasMotion = play.attributes?.motion && play.attributes.motion !== 'None';

  // Classify play type
  const isRunPlay = playType === 'run' || playType === 'draw';
  const isPassPlay = playType === 'pass' || playType === 'screen' || playType === 'play action' || playType === 'rpo';
  const isScreen = playType === 'screen' || passConcept.includes('screen');
  const isPlayAction = playType === 'play action' || passConcept.includes('play action');
  const isQuickPass = passConcept.includes('slant') || passConcept.includes('quick') || passConcept.includes('hitch');
  const isDeepPass = passConcept.includes('go') || passConcept.includes('post') || passConcept.includes('streak') || passConcept.includes('vert');
  const isDraw = playType === 'draw' || runConcept.includes('draw');

  // ==========================================
  // SITUATION-SPECIFIC SCORING FOR OFFENSE
  // ==========================================

  if (situation) {
    const sitLower = situation.toLowerCase();

    // ----- 1ST & SHORT OFFENSE (1-5 yards, after big gain or penalty) -----
    if (sitLower.includes('1st_short')) {
      // 1st & short = aggressive, take shots or pound the rock
      if (isRunPlay) {
        score += 20;
        reasons.push(`Power run exploits short distance on 1st`);
      } else if (isPlayAction) {
        score += 25;
        reasons.push(`Play action devastating on 1st & short`);
      } else if (isDeepPass) {
        score += 15;
        reasons.push(`Take a shot - easy conversion if incomplete`);
      }
    }

    // ----- 1ST & MEDIUM OFFENSE (6-10 yards, standard 1st & 10) -----
    else if (sitLower.includes('1st_medium') || sitLower === '1st_down') {
      // 1st & 10 = balanced, establish the run or take shots
      if (isRunPlay) {
        score += 15;
        reasons.push(`Run play sets tone on 1st down`);
        if (opponentProfile.runStopRate < 40) {
          score += 10;
          reasons.push(`Opponent weak vs run (${opponentProfile.runStopRate}% stop rate)`);
        }
      } else if (isPlayAction) {
        score += 20;
        reasons.push(`Play action exploits run-first expectation on 1st down`);
      } else if (isDeepPass) {
        score += 10;
        reasons.push(`Take a shot on 1st down - low risk`);
      }
    }

    // ----- 1ST & LONG OFFENSE (11+ yards, after penalty) -----
    else if (sitLower.includes('1st_long')) {
      // 1st & long = need chunk play, similar to 2nd & long
      if (isPassPlay) {
        score += 15;
        reasons.push(`Pass needed to recover from penalty`);
      }
      if (isScreen) {
        score += 15;
        reasons.push(`Screen can get big yards vs prevent look`);
      }
      if (isDraw) {
        score += 10;
        reasons.push(`Draw exploits pass rush expectation`);
      }
      if (isRunPlay && !isDraw) {
        score -= 5;
        reasons.push(`Straight run makes 2nd down harder`);
      }
    }

    // ----- 2ND & SHORT OFFENSE -----
    else if (sitLower.includes('2nd_short') || sitLower.includes('2nd & short')) {
      // 2nd & short = run to set up 1st down or aggressive play action
      if (isRunPlay) {
        score += 20;
        reasons.push(`Run gets the 1st on 2nd & short`);
      } else if (isPlayAction) {
        score += 25;
        reasons.push(`Play action catches D cheating on run`);
      } else if (isScreen) {
        score += 10;
        reasons.push(`Screen can exploit aggressive linebackers`);
      } else if (isDeepPass) {
        score -= 5;
        reasons.push(`Deep pass risky when conversion is easy`);
      }
    }

    // ----- 2ND & MEDIUM OFFENSE -----
    else if (sitLower.includes('2nd_medium') || sitLower.includes('2nd & medium')) {
      // 2nd & medium = balanced approach
      if (isRunPlay) {
        score += 10;
        reasons.push(`Run keeps chains moving`);
      } else if (isPassPlay && !isDeepPass) {
        score += 15;
        reasons.push(`Medium pass concept fits 2nd & medium`);
      } else if (isPlayAction) {
        score += 15;
        reasons.push(`Play action works on 2nd & medium`);
      }
    }

    // ----- 2ND & LONG OFFENSE -----
    else if (sitLower.includes('2nd_long') || sitLower.includes('2nd & long')) {
      // 2nd & long = need chunk play, passes preferred
      if (isPassPlay) {
        score += 15;
        reasons.push(`Pass needed to get back on track`);
      }
      if (isScreen) {
        score += 10;
        reasons.push(`Screen can get big yards vs soft coverage`);
      }
      if (isRunPlay && !isDraw) {
        score -= 10;
        reasons.push(`Straight run makes 3rd down harder`);
      }
      if (isDraw) {
        score += 5;
        reasons.push(`Draw exploits pass rush on 2nd & long`);
      }
    }

    // ----- 3RD & SHORT OFFENSE -----
    else if (sitLower.includes('3rd_short') || sitLower.includes('3rd & short')) {
      // 3rd & short = run or quick pass, low risk
      if (isRunPlay) {
        score += 25;
        reasons.push(`Power run converts 3rd & short`);
      } else if (isQuickPass) {
        score += 20;
        reasons.push(`Quick pass beats blitz on 3rd & short`);
      } else if (isDeepPass) {
        score -= 15;
        reasons.push(`Deep pass too risky - just get the 1st`);
      }

      // Adjust for blitz tendencies on 3rd down
      const blitz3rdShort = opponentProfile.blitzRateBySituation?.['3rd_short'] || opponentProfile.blitzRate;
      if (blitz3rdShort > 50) {
        if (isQuickPass || isScreen) {
          score += 15;
          reasons.push(`Quick throw beats blitz-heavy D (${blitz3rdShort}%)`);
        }
      }
    }

    // ----- 3RD & MEDIUM OFFENSE -----
    else if (sitLower.includes('3rd_medium') || sitLower.includes('3rd & medium')) {
      // 3rd & medium = pass, medium routes
      if (isPassPlay && !isDeepPass) {
        score += 20;
        reasons.push(`Medium pass concept perfect for 3rd & medium`);
      }
      if (isQuickPass) {
        score += 10;
        reasons.push(`Quick game can get the sticks`);
      }
      if (isRunPlay) {
        score -= 10;
        reasons.push(`Run needs big gain on 3rd & medium`);
      }

      // Motion helps against man coverage
      if (hasMotion && opponentProfile.coverageDistribution) {
        const manCoverage = Object.entries(opponentProfile.coverageDistribution)
          .find(([cov]) => cov.toLowerCase().includes('man') || cov.toLowerCase().includes('cover 1'));
        if (manCoverage) {
          score += 10;
          reasons.push(`Motion defeats man coverage`);
        }
      }
    }

    // ----- 3RD & LONG OFFENSE -----
    else if (sitLower.includes('3rd_long') || sitLower.includes('3rd & long')) {
      // 3rd & long = need big play, chunk passes
      if (isDeepPass) {
        score += 15;
        reasons.push(`Deep shot needed on 3rd & long`);
      }
      if (isScreen) {
        score += 20;
        reasons.push(`Screen exploits prevent defense`);
      }
      if (isDraw) {
        score += 15;
        reasons.push(`Draw catches D off guard on 3rd & long`);
      }
      if (isRunPlay && !isDraw) {
        score -= 20;
        reasons.push(`Straight run won't convert 3rd & long`);
      }

      // Check opponent's 3rd down tendency
      const down3Tendency = opponentProfile.tendenciesByDown?.['down_3'];
      if (down3Tendency?.blitzPercentage && down3Tendency.blitzPercentage > 40) {
        if (isQuickPass || isScreen) {
          score += 10;
          reasons.push(`Quick release beats 3rd down blitz`);
        }
      }
    }

    // ----- 4TH & SHORT OFFENSE (1-2 yards) -----
    else if (sitLower.includes('4th_short') || sitLower.includes('4th & short')) {
      // 4th & short = high percentage, physical plays
      if (isRunPlay) {
        score += 25;
        reasons.push(`Power run best for 4th & short conversion`);
      } else if (isQuickPass) {
        score += 15;
        reasons.push(`Quick pass can beat all-out run defense`);
      } else if (isDeepPass) {
        score -= 25;
        reasons.push(`Way too risky on 4th & short`);
      }
    }

    // ----- 4TH & MEDIUM OFFENSE (3-5 yards) -----
    else if (sitLower.includes('4th_medium') || sitLower.includes('4th & medium')) {
      // 4th & medium = need chunk but not impossible
      if (isQuickPass) {
        score += 20;
        reasons.push(`Quick pass gets the sticks on 4th & medium`);
      } else if (isRunPlay) {
        score += 10;
        reasons.push(`Power run can grind out 4th & medium`);
      } else if (isScreen) {
        score += 15;
        reasons.push(`Screen can break big on 4th & medium`);
      } else if (isDeepPass) {
        score -= 15;
        reasons.push(`Deep pass risky - don't need a home run`);
      }
    }

    // ----- 4TH & LONG OFFENSE (6+ yards) -----
    else if (sitLower.includes('4th_long') || sitLower.includes('4th & long')) {
      // 4th & long = desperation, need big play
      if (isDeepPass) {
        score += 20;
        reasons.push(`Deep shot needed on 4th & long`);
      } else if (isScreen) {
        score += 25;
        reasons.push(`Screen best chance - catches defense off guard`);
      } else if (isDraw) {
        score += 20;
        reasons.push(`Draw can bust big on 4th & long`);
      } else if (isRunPlay && !isDraw) {
        score -= 25;
        reasons.push(`Straight run won't convert 4th & long`);
      } else if (isQuickPass) {
        score -= 5;
        reasons.push(`Quick pass unlikely to get enough yards`);
      }
    }

    // ----- RED ZONE OFFENSE -----
    else if (sitLower.includes('red_zone')) {
      // Red zone = compressed field, run/short pass
      if (isRunPlay) {
        score += 20;
        reasons.push(`Run game punishes compressed RZ defense`);
      }
      if (isQuickPass) {
        score += 15;
        reasons.push(`Quick throws work in tight RZ windows`);
      }
      if (isPlayAction) {
        score += 20;
        reasons.push(`PA creates space in crowded RZ`);
      }
      if (isDeepPass) {
        score -= 10;
        reasons.push(`Deep shots limited in red zone`);
      }

      // Check opponent red zone blitz tendencies
      const rzBlitz = opponentProfile.blitzRateBySituation?.['red_zone'] || opponentProfile.blitzRate;
      if (rzBlitz > 50) {
        if (isQuickPass || isScreen) {
          score += 10;
          reasons.push(`Quick release exploits RZ blitz (${rzBlitz}%)`);
        }
      }
    }

    // ----- GOAL LINE OFFENSE -----
    else if (sitLower.includes('goal_line')) {
      // Goal line = run-heavy, power plays
      if (isRunPlay) {
        score += 30;
        reasons.push(`Power run punches it in at goal line`);
      } else if (isPlayAction) {
        score += 20;
        reasons.push(`PA catches D selling out vs run`);
      } else if (isQuickPass) {
        score += 10;
        reasons.push(`Fade/slant can find soft spot`);
      } else if (isScreen) {
        score -= 10;
        reasons.push(`Screen has no room at goal line`);
      }
    }

    // ----- 2-MINUTE OFFENSE -----
    else if (sitLower.includes('2_minute') || sitLower.includes('2-minute')) {
      // 2-minute = quick passes, sideline routes
      if (passConcept.includes('out') || passConcept.includes('corner') || passConcept.includes('hitch')) {
        score += 20;
        reasons.push(`Sideline route stops clock in 2-minute`);
      }
      if (isQuickPass) {
        score += 15;
        reasons.push(`Quick release essential in 2-minute`);
      }
      if (isRunPlay && !hasMotion) {
        score -= 10;
        reasons.push(`Run burns clock in 2-minute drill`);
      }
      if (isDeepPass) {
        score += 10;
        reasons.push(`Deep shot worth risk in 2-minute`);
      }
    }

    // ----- BACKED UP OFFENSE -----
    else if (sitLower.includes('backed_up')) {
      // Backed up = safe plays, don't turn it over
      if (isRunPlay) {
        score += 20;
        reasons.push(`Safe run call when backed up`);
      }
      if (isQuickPass) {
        score += 15;
        reasons.push(`Quick throw safe when backed up`);
      }
      if (isDeepPass) {
        score -= 15;
        reasons.push(`Deep pass risky in own end zone`);
      }
      if (isPlayAction) {
        score += 10;
        reasons.push(`PA can create space when backed up`);
      }
    }
  }

  // ==========================================
  // GENERAL OPPONENT ANALYSIS (always apply)
  // ==========================================

  if (!situation) {
    // Only apply general analysis if no situation selected
    if (isRunPlay) {
      if (opponentProfile.runStopRate < 40) {
        score += 15;
        reasons.push('Opponent struggles to stop the run');
      } else if (opponentProfile.runStopRate > 60) {
        score -= 15;
        reasons.push('Opponent has strong run defense');
      }
    }

    if (isPassPlay) {
      if (opponentProfile.passDefenseRate < 40) {
        score += 15;
        reasons.push('Opponent vulnerable in pass defense');
      } else if (opponentProfile.passDefenseRate > 60) {
        score -= 10;
        reasons.push('Opponent has solid pass coverage');
      }
    }

    // Blitz rate analysis
    if (opponentProfile.blitzRate > 40) {
      if (isQuickPass || isScreen) {
        score += 10;
        reasons.push('Quick-hitting play exploits blitz-heavy defense');
      }
      if (hasMotion) {
        score += 5;
        reasons.push('Pre-snap motion can confuse blitz assignments');
      }
    }
  }

  // ==========================================
  // COVERAGE MATCHUP ANALYSIS (always apply)
  // ==========================================

  const playPassConcept = play.attributes?.passConcept || '';
  const topCoverages = Object.entries(opponentProfile.coverageDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  if (topCoverages.length > 0 && isPassPlay) {
    const [topCoverage, topCount] = topCoverages[0];
    const coveragePct = Math.round((topCount / opponentProfile.totalPlaysAnalyzed) * 100);

    if (coveragePct > 40) {
      if (isCoverageBeater(playPassConcept, topCoverage)) {
        score += 15;
        reasons.push(`Attacks opponent's ${topCoverage} (${coveragePct}%)`);
      }
    }
  }

  // Cap score between 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    playCode: play.play_code,
    score,
    confidence,
    reasoning: reasons.length > 0 ? reasons.join('. ') : 'Standard matchup'
  };
}

/**
 * Check if a pass concept is a known beater for a coverage type
 */
function isCoverageBeater(passConcept: string, coverage: string): boolean {
  const conceptLower = passConcept.toLowerCase();
  const coverageLower = coverage.toLowerCase();

  const beaters: Record<string, string[]> = {
    'cover 3': ['post', 'seam', '4 verts', 'levels', 'corner'],
    'cover 2': ['post', 'dig', 'middle', 'seam'],
    'cover 1': ['slant', 'out', 'crossing', 'mesh'],
    'cover 4': ['curl', 'dig', 'underneath'],
    'man': ['pick', 'mesh', 'cross', 'motion'],
  };

  for (const [coverageType, concepts] of Object.entries(beaters)) {
    if (coverageLower.includes(coverageType)) {
      for (const concept of concepts) {
        if (conceptLower.includes(concept)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Get situational tendencies for a specific situation
 */
export function getSituationalTendencies(
  opponentProfile: OpponentProfile,
  situation: string
): {
  blitzRate: number;
  mostCommonCoverage: string;
  coveragePercentage: number;
  recommendation: string;
} | null {
  // Map situation to down
  const situationToDown: Record<string, string> = {
    '1st_down': 'down_1',
    '2nd_short': 'down_2',
    '2nd_medium': 'down_2',
    '2nd_long': 'down_2',
    '3rd_short': 'down_3',
    '3rd_medium': 'down_3',
    '3rd_long': 'down_3',
    '4th_short': 'down_4'
  };

  const downKey = situationToDown[situation];
  if (!downKey) return null;

  const tendency = opponentProfile.tendenciesByDown[downKey];
  if (!tendency) return null;

  const blitzRate = opponentProfile.blitzRateBySituation[situation] || tendency.blitzPercentage;

  // Generate recommendation based on tendencies
  let recommendation = '';
  if (blitzRate > 50) {
    recommendation = 'High blitz rate - consider quick passes, screens, or draws';
  } else if (blitzRate < 20) {
    recommendation = 'Low blitz rate - can take deeper shots or use play action';
  }

  if (tendency.mostCommonCoverage.toLowerCase().includes('zone')) {
    recommendation += recommendation ? '. ' : '';
    recommendation += 'Zone-heavy - attack seams and soft spots';
  } else if (tendency.mostCommonCoverage.toLowerCase().includes('man')) {
    recommendation += recommendation ? '. ' : '';
    recommendation += 'Man-heavy - use picks, crosses, and motion';
  }

  return {
    blitzRate,
    mostCommonCoverage: tendency.mostCommonCoverage,
    coveragePercentage: tendency.coveragePercentage,
    recommendation: recommendation || 'Standard offensive approach'
  };
}

/**
 * Batch project success for multiple plays
 */
export function batchProjectPlaySuccess(
  plays: PlaybookPlay[],
  opponentProfile: OpponentProfile
): PlayMatchScore[] {
  return plays.map(play => projectPlaySuccess(play, opponentProfile));
}

/**
 * Get top recommended plays for a situation
 */
export async function getRecommendedPlays(
  teamId: string,
  opponentProfile: OpponentProfile,
  situation: string,
  limit: number = 10
): Promise<PlayMatchScore[]> {
  const supabase = createClient();

  // Get team's playbook
  const { data: plays, error } = await supabase
    .from('playbook_plays')
    .select('*')
    .or(`team_id.eq.${teamId},team_id.is.null`)
    .eq('is_archived', false);

  if (error || !plays) {
    return [];
  }

  // Score all plays
  const scores = batchProjectPlaySuccess(plays as PlaybookPlay[], opponentProfile);

  // Sort by score and return top N
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get opponent SPECIAL TEAMS tendencies from scouting film
 * Used for special teams game planning
 * @param teamId - Your team's ID
 * @param opponentName - Name of the opponent to analyze
 * @param supabaseClient - Optional Supabase client (for server-side calls)
 */
export async function getOpponentSpecialTeamsTendencies(
  teamId: string,
  opponentName: string,
  supabaseClient?: SupabaseClient
): Promise<OpponentSpecialTeamsProfile> {
  const supabase = supabaseClient || createClient();

  // Step 1: Find games against this opponent
  let { data: games } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId)
    .or(`opponent.ilike.%${opponentName}%,opponent_team_name.ilike.%${opponentName}%`);

  // Also check opponent scouting games
  if (!games || games.length === 0) {
    const { data: scoutingGames } = await supabase
      .from('games')
      .select('id')
      .eq('team_id', teamId)
      .eq('is_opponent_game', true)
      .or(`opponent.ilike.%${opponentName}%,opponent_team_name.ilike.%${opponentName}%`);

    if (scoutingGames && scoutingGames.length > 0) {
      games = scoutingGames;
    }
  }

  if (!games || games.length === 0) {
    return getEmptyOpponentSTProfile(opponentName);
  }

  const gameIds = games.map(g => g.id);

  // Step 2: Find videos for those games
  const { data: videos } = await supabase
    .from('videos')
    .select('id')
    .in('game_id', gameIds);

  if (!videos || videos.length === 0) {
    return getEmptyOpponentSTProfile(opponentName);
  }

  const videoIds = videos.map(v => v.id);

  // Step 3: Get opponent special teams play instances
  const { data: allPlays, error } = await supabase
    .from('play_instances')
    .select('*')
    .eq('is_opponent_play', true)
    .not('special_teams_unit', 'is', null)
    .in('video_id', videoIds);

  if (error || !allPlays || allPlays.length === 0) {
    return getEmptyOpponentSTProfile(opponentName);
  }

  // Initialize tracking variables
  const kickoffPlays = allPlays.filter(p => p.special_teams_unit === 'kickoff');
  const kickReturnPlays = allPlays.filter(p => p.special_teams_unit === 'kick_return');
  const puntPlays = allPlays.filter(p => p.special_teams_unit === 'punt');
  const puntReturnPlays = allPlays.filter(p => p.special_teams_unit === 'punt_return');
  const fgPlays = allPlays.filter(p => p.special_teams_unit === 'field_goal');
  const patPlays = allPlays.filter(p => p.special_teams_unit === 'pat');

  // Kickoff analysis
  let koTouchbacks = 0;
  let koOnsides = 0;
  let koTotalDistance = 0;
  const koDirection: Record<string, number> = { left: 0, middle: 0, right: 0 };

  for (const play of kickoffPlays) {
    if (play.kick_result === 'touchback') koTouchbacks++;
    if (play.kick_type?.toLowerCase().includes('onside')) koOnsides++;
    if (play.kick_distance) koTotalDistance += play.kick_distance;
    const dir = play.kick_direction || 'middle';
    koDirection[dir] = (koDirection[dir] || 0) + 1;
  }

  // Kick return analysis
  let krTouchbacks = 0;
  let krTotalYards = 0;
  let krTDs = 0;

  for (const play of kickReturnPlays) {
    if (play.kick_result === 'touchback') krTouchbacks++;
    if (play.return_yards) krTotalYards += play.return_yards;
    if (play.result === 'touchdown') krTDs++;
  }

  // Punt analysis
  let puntTotalDistance = 0;
  let puntTotalHangTime = 0;
  let puntFakes = 0;
  let puntInsideThe20 = 0;
  const puntDirection: Record<string, number> = { left: 0, middle: 0, right: 0 };

  for (const play of puntPlays) {
    if (play.kick_distance) puntTotalDistance += play.kick_distance;
    if (play.hang_time) puntTotalHangTime += play.hang_time;
    if (play.result === 'fake') puntFakes++;
    if (play.kick_result === 'downed' || (play.return_yard_line && play.return_yard_line <= 20)) {
      puntInsideThe20++;
    }
    const dir = play.kick_direction || 'middle';
    puntDirection[dir] = (puntDirection[dir] || 0) + 1;
  }

  // Punt return analysis
  let prTotalYards = 0;
  let prFairCatches = 0;
  let prBlockAttempts = 0;
  let prTDs = 0;

  for (const play of puntReturnPlays) {
    if (play.return_yards) prTotalYards += play.return_yards;
    if (play.is_fair_catch || play.kick_result === 'fair_catch') prFairCatches++;
    if (play.result === 'blocked') prBlockAttempts++;
    if (play.result === 'touchdown') prTDs++;
  }

  // Field goal analysis
  const fgByRange: Record<string, { attempts: number; made: number }> = {
    '0-29': { attempts: 0, made: 0 },
    '30-39': { attempts: 0, made: 0 },
    '40-49': { attempts: 0, made: 0 },
    '50+': { attempts: 0, made: 0 }
  };
  let fgBlocks = 0;
  let fgFakes = 0;

  for (const play of fgPlays) {
    const distance = play.kick_distance || play.yard_line || 30;
    let range = '0-29';
    if (distance >= 50) range = '50+';
    else if (distance >= 40) range = '40-49';
    else if (distance >= 30) range = '30-39';

    fgByRange[range].attempts++;
    if (play.result === 'made' || play.kick_result === 'made') {
      fgByRange[range].made++;
    }
    if (play.result === 'blocked') fgBlocks++;
    if (play.result === 'fake') fgFakes++;
  }

  // PAT analysis
  let patMade = 0;
  let twoPointAttempts = 0;
  let twoPointConversions = 0;

  for (const play of patPlays) {
    if (play.result === 'made' || play.kick_result === 'made') patMade++;
    if (play.result === '2pt_attempt' || play.kick_type === '2_point') {
      twoPointAttempts++;
      if (play.yards_gained && play.yards_gained > 0) twoPointConversions++;
    }
  }

  // Calculate distribution percentages
  const koTotal = kickoffPlays.length || 1;
  const koDist: Record<string, number> = {};
  for (const [dir, count] of Object.entries(koDirection)) {
    koDist[dir] = Math.round((count / koTotal) * 100);
  }

  const puntTotal = puntPlays.length || 1;
  const puntDist: Record<string, number> = {};
  for (const [dir, count] of Object.entries(puntDirection)) {
    puntDist[dir] = Math.round((count / puntTotal) * 100);
  }

  // Calculate FG accuracy by range
  const fgAttemptsByRange: Record<string, number> = {};
  const fgAccuracyByRange: Record<string, number> = {};
  let totalFGAttempts = 0;
  let totalFGMade = 0;

  for (const [range, data] of Object.entries(fgByRange)) {
    fgAttemptsByRange[range] = data.attempts;
    fgAccuracyByRange[range] = data.attempts > 0 ? Math.round((data.made / data.attempts) * 100) : 0;
    totalFGAttempts += data.attempts;
    totalFGMade += data.made;
  }

  return {
    teamName: opponentName,
    totalPlaysAnalyzed: allPlays.length,

    kickoff: {
      plays: kickoffPlays.length,
      avgDistance: kickoffPlays.length > 0 ? Math.round(koTotalDistance / kickoffPlays.length) : 0,
      touchbackRate: kickoffPlays.length > 0 ? Math.round((koTouchbacks / kickoffPlays.length) * 100) : 0,
      onsideAttemptRate: kickoffPlays.length > 0 ? Math.round((koOnsides / kickoffPlays.length) * 100) : 0,
      directionDistribution: koDist
    },

    kickReturn: {
      plays: kickReturnPlays.length,
      avgReturnYards: kickReturnPlays.length > 0 ? Math.round((krTotalYards / kickReturnPlays.length) * 10) / 10 : 0,
      touchbackRate: kickReturnPlays.length > 0 ? Math.round((krTouchbacks / kickReturnPlays.length) * 100) : 0,
      returnTDRate: kickReturnPlays.length > 0 ? Math.round((krTDs / kickReturnPlays.length) * 100) : 0
    },

    punt: {
      plays: puntPlays.length,
      avgDistance: puntPlays.length > 0 ? Math.round(puntTotalDistance / puntPlays.length) : 0,
      avgHangTime: puntPlays.length > 0 ? Math.round((puntTotalHangTime / puntPlays.length) * 10) / 10 : 0,
      directionDistribution: puntDist,
      fakeAttemptRate: puntPlays.length > 0 ? Math.round((puntFakes / puntPlays.length) * 100) : 0,
      insideThe20Rate: puntPlays.length > 0 ? Math.round((puntInsideThe20 / puntPlays.length) * 100) : 0
    },

    puntReturn: {
      plays: puntReturnPlays.length,
      avgReturnYards: puntReturnPlays.length > 0 ? Math.round((prTotalYards / puntReturnPlays.length) * 10) / 10 : 0,
      fairCatchRate: puntReturnPlays.length > 0 ? Math.round((prFairCatches / puntReturnPlays.length) * 100) : 0,
      blockAttemptRate: puntReturnPlays.length > 0 ? Math.round((prBlockAttempts / puntReturnPlays.length) * 100) : 0,
      returnTDRate: puntReturnPlays.length > 0 ? Math.round((prTDs / puntReturnPlays.length) * 100) : 0
    },

    fieldGoal: {
      plays: fgPlays.length,
      attemptsByRange: fgAttemptsByRange,
      accuracyByRange: fgAccuracyByRange,
      overallAccuracy: totalFGAttempts > 0 ? Math.round((totalFGMade / totalFGAttempts) * 100) : 0,
      blockRate: fgPlays.length > 0 ? Math.round((fgBlocks / fgPlays.length) * 100) : 0,
      fakeAttemptRate: fgPlays.length > 0 ? Math.round((fgFakes / fgPlays.length) * 100) : 0
    },

    pat: {
      plays: patPlays.length,
      accuracy: patPlays.length > 0 ? Math.round((patMade / patPlays.length) * 100) : 0,
      twoPointAttemptRate: patPlays.length > 0 ? Math.round((twoPointAttempts / patPlays.length) * 100) : 0,
      twoPointConversionRate: twoPointAttempts > 0 ? Math.round((twoPointConversions / twoPointAttempts) * 100) : 0
    }
  };
}

/**
 * Empty opponent special teams profile for when no film data exists
 */
function getEmptyOpponentSTProfile(opponentName: string): OpponentSpecialTeamsProfile {
  return {
    teamName: opponentName,
    totalPlaysAnalyzed: 0,
    kickoff: {
      plays: 0,
      avgDistance: 0,
      touchbackRate: 0,
      onsideAttemptRate: 0,
      directionDistribution: {}
    },
    kickReturn: {
      plays: 0,
      avgReturnYards: 0,
      touchbackRate: 0,
      returnTDRate: 0
    },
    punt: {
      plays: 0,
      avgDistance: 0,
      avgHangTime: 0,
      directionDistribution: {},
      fakeAttemptRate: 0,
      insideThe20Rate: 0
    },
    puntReturn: {
      plays: 0,
      avgReturnYards: 0,
      fairCatchRate: 0,
      blockAttemptRate: 0,
      returnTDRate: 0
    },
    fieldGoal: {
      plays: 0,
      attemptsByRange: {},
      accuracyByRange: {},
      overallAccuracy: 0,
      blockRate: 0,
      fakeAttemptRate: 0
    },
    pat: {
      plays: 0,
      accuracy: 0,
      twoPointAttemptRate: 0,
      twoPointConversionRate: 0
    }
  };
}

/**
 * Project special teams play success against opponent tendencies
 * @param play - The special teams play to evaluate
 * @param opponentProfile - Opponent's special teams tendencies
 * @param situation - Optional situation context (e.g., 'st_kickoff', 'st_punt_return')
 */
export function projectSpecialTeamsPlaySuccess(
  play: PlaybookPlay,
  opponentProfile: OpponentSpecialTeamsProfile,
  situation?: string | null
): PlayMatchScore {
  let score = 50; // Base score
  const reasons: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (opponentProfile.totalPlaysAnalyzed === 0) {
    return {
      playCode: play.play_code,
      score: 50,
      confidence: 'low',
      reasoning: 'No opponent special teams data available'
    };
  }

  // Set confidence based on sample size
  if (opponentProfile.totalPlaysAnalyzed >= 30) {
    confidence = 'high';
  } else if (opponentProfile.totalPlaysAnalyzed >= 15) {
    confidence = 'medium';
  }

  // Get unit from attributes or infer from formation
  const formation = (play.attributes?.formation || play.diagram?.formation || '').toLowerCase();
  const unit = play.attributes?.unit?.toLowerCase() || formation.replace(/\s+/g, '_') || '';
  const kickType = play.attributes?.kickoffType?.toLowerCase() || '';
  const puntType = play.attributes?.puntType?.toLowerCase() || '';
  const returnScheme = play.attributes?.returnScheme?.toLowerCase() || '';
  const playName = play.play_name?.toLowerCase() || '';

  // Determine play category - check formation as well as unit
  const isKickoff = unit.includes('kickoff') || formation === 'kickoff' || situation?.startsWith('st_ko_');
  const isKickReturn = unit.includes('kick_return') || formation === 'kick return' || situation?.startsWith('st_kr_');
  const isPunt = (unit === 'punt' || formation === 'punt') || situation?.startsWith('st_punt_');
  const isPuntReturn = unit.includes('punt_return') || formation === 'punt return' || situation?.startsWith('st_pr_');
  const isFieldGoal = unit.includes('field_goal') || formation === 'field goal' || situation?.startsWith('st_fg_');
  const isFGBlock = unit.includes('fg_block') || formation === 'fg block' || situation?.startsWith('st_fgb_');
  const isPAT = unit === 'pat' || formation === 'pat' || situation?.startsWith('st_pat_');
  const is2Point = situation?.startsWith('st_2pt_');

  // ==========================================
  // KICKOFF PLAYS (when we're kicking off)
  // ==========================================
  if (isKickoff) {
    const kr = opponentProfile.kickReturn;
    const isOnsidePlay = playName.includes('onside');
    const isSquibPlay = playName.includes('squib');
    const isDeepPlay = playName.includes('deep') || (!isOnsidePlay && !isSquibPlay);

    // Situation-specific scoring for kickoffs
    if (situation === 'st_ko_start_game' || situation === 'st_ko_start_half') {
      // Start of game/half: Deep kicks are standard and preferred
      if (isDeepPlay) {
        score += 20;
        reasons.push('Deep kick is standard for game/half start');
      } else if (isOnsidePlay) {
        score -= 30;
        reasons.push('Onside not appropriate for start of game/half');
      } else if (isSquibPlay) {
        score -= 10;
        reasons.push('Squib less reliable than deep kick for normal situations');
      }
    } else if (situation === 'st_ko_late_game_behind') {
      // Late game behind: Onside kicks make sense
      if (isOnsidePlay) {
        score += 30;
        reasons.push('Onside kick appropriate when trailing late');
      } else if (isDeepPlay) {
        score -= 5;
        reasons.push('Consider onside when trailing late');
      }
    } else if (situation === 'st_ko_late_game_ahead') {
      // Late game ahead: Deep kicks preferred, run clock
      if (isDeepPlay) {
        score += 20;
        reasons.push('Deep kick runs clock when ahead');
      } else if (isOnsidePlay) {
        score -= 25;
        reasons.push('Onside risky when protecting lead');
      }
    }

    // Opponent tendencies adjustments
    if (isDeepPlay && kr.avgReturnYards < 20) {
      score += 10;
      reasons.push(`Deep kick vs opponent's ${kr.avgReturnYards} avg return`);
    }

    if (isSquibPlay && kr.returnTDRate > 5) {
      score += 15;
      reasons.push(`Squib avoids dangerous returner (${kr.returnTDRate}% TD rate)`);
    }

    if (kr.touchbackRate > 50 && isDeepPlay) {
      score += 5;
      reasons.push(`Opponent takes ${kr.touchbackRate}% touchbacks`);
    }
  }

  // ==========================================
  // KICK RETURN PLAYS (when we're receiving)
  // ==========================================
  if (isKickReturn) {
    const ko = opponentProfile.kickoff;
    const isMiddleReturn = playName.includes('middle');
    const isLeftReturn = playName.includes('left');
    const isRightReturn = playName.includes('right');

    // Situation-specific scoring for kick returns
    if (situation === 'st_kr_standard') {
      // Standard return - all schemes viable
      if (isMiddleReturn) {
        score += 10;
        reasons.push('Middle return is versatile');
      }
    } else if (situation === 'st_kr_late_game_behind') {
      // Need big play when trailing
      score += 15;
      reasons.push('Return attempt for big play when trailing');
    } else if (situation === 'st_kr_late_game_ahead') {
      // When ahead late, opponent may try onside kick
      const isOnsideRecovery = playName.includes('onside') || playName.includes('hands team');
      if (isOnsideRecovery) {
        score += 25;
        reasons.push('Onside recovery ready - opponent may attempt onside when trailing');
      } else {
        // Regular return still valuable but less critical
        score += 5;
        reasons.push('Safe return protects lead');
      }
    }

    // Opponent tendencies adjustments
    if (isMiddleReturn && ko.avgDistance < 60) {
      score += 10;
      reasons.push(`Middle return vs short kicks (${ko.avgDistance} avg distance)`);
    }

    // Directional return vs their kick tendencies
    if (ko.directionDistribution) {
      const leftKickPct = ko.directionDistribution.left || 0;
      const rightKickPct = ko.directionDistribution.right || 0;
      if (isLeftReturn && leftKickPct < 30) {
        score += 10;
        reasons.push('Return left vs right-dominant kicker');
      }
      if (isRightReturn && rightKickPct < 30) {
        score += 10;
        reasons.push('Return right vs left-dominant kicker');
      }
    }

    // If opponent has high touchback rate, return plays less relevant
    if (ko.touchbackRate > 60) {
      score -= 10;
      reasons.push(`May not get chance to return (${ko.touchbackRate}% touchback)`);
    }
  }

  // ==========================================
  // PUNT PLAYS (when we're punting)
  // ==========================================
  if (isPunt) {
    const pr = opponentProfile.puntReturn;
    const isFakePunt = playName.includes('fake');
    const isStandardPunt = !isFakePunt;

    // Situation-specific scoring for punts
    if (situation === 'st_punt_backed_up') {
      // Backed up - prioritize getting the ball out safely
      if (isStandardPunt) {
        score += 15;
        reasons.push('Standard punt gets ball out of danger zone');
      } else if (isFakePunt) {
        score -= 20;
        reasons.push('Fake punt risky when backed up');
      }
    } else if (situation === 'st_punt_plus_territory') {
      // In opponent territory - pin them deep or consider fake
      if (isStandardPunt) {
        score += 10;
        reasons.push('Pin them deep inside their territory');
      } else if (isFakePunt) {
        score += 5;
        reasons.push('Fake is an option in plus territory');
      }
    } else if (situation === 'st_punt_late_game_ahead') {
      // Ahead late - eat clock, no risks
      if (isStandardPunt) {
        score += 20;
        reasons.push('Standard punt burns clock when ahead');
      } else if (isFakePunt) {
        score -= 25;
        reasons.push('Fake punt too risky when protecting lead');
      }
    } else if (situation === 'st_punt_late_game_behind') {
      // Behind late - consider fake
      if (isFakePunt) {
        score += 20;
        reasons.push('Fake punt can extend drive when trailing');
      }
    }

    // Opponent tendencies adjustments
    if (isStandardPunt && pr.fairCatchRate > 50) {
      score += 10;
      reasons.push(`Opponent fair catches ${pr.fairCatchRate}%`);
    }

    if (pr.avgReturnYards > 12) {
      score += 5;
      reasons.push('Directional/coverage important vs good returner');
    }

    // Be cautious if opponent rushes punts
    if (pr.blockAttemptRate > 10 && isStandardPunt) {
      score -= 5;
      reasons.push(`Watch for block (${pr.blockAttemptRate}% block attempts)`);
    }
  }

  // ==========================================
  // PUNT RETURN PLAYS (when we're receiving)
  // ==========================================
  if (isPuntReturn) {
    const punt = opponentProfile.punt;
    const isBlockPlay = playName.includes('block') || playName.includes('rush');
    const isReturnPlay = playName.includes('return') && !isBlockPlay;

    // Situation-specific scoring for punt returns
    if (situation === 'st_pr_standard' || situation === 'st_pr_own_territory') {
      // Standard situation - return is good
      if (isReturnPlay) {
        score += 15;
        reasons.push('Set up return in normal situations');
      }
    } else if (situation === 'st_pr_plus_territory') {
      // Already in good field position - fair catch is fine
      if (!isBlockPlay) {
        score += 10;
        reasons.push('Good field position already');
      }
    } else if (situation === 'st_pr_late_game_ahead') {
      // Ahead late - fair catch, no fumble risk
      if (!isBlockPlay && !isReturnPlay) {
        score += 20;
        reasons.push('Fair catch protects lead');
      } else if (isReturnPlay) {
        score -= 10;
        reasons.push('Return risks fumble when ahead');
      }
    } else if (situation === 'st_pr_late_game_behind') {
      // Behind late - need big play
      if (isReturnPlay) {
        score += 20;
        reasons.push('Need return yardage when trailing');
      } else if (isBlockPlay) {
        score += 15;
        reasons.push('Block attempt could be momentum changer');
      }
    }

    // Opponent tendencies adjustments
    if (isBlockPlay) {
      if (punt.avgHangTime < 4.0) {
        score += 15;
        reasons.push(`Block opportunity vs low hang time (${punt.avgHangTime}s)`);
      } else {
        score -= 10;
        reasons.push(`Block risky vs ${punt.avgHangTime}s hang time`);
      }
    }

    if (isReturnPlay && punt.avgDistance < 40) {
      score += 10;
      reasons.push(`Set up return vs short ${punt.avgDistance} yd avg punts`);
    }

    // Check directional tendencies
    const leftPct = punt.directionDistribution?.left || 0;
    const rightPct = punt.directionDistribution?.right || 0;
    if (leftPct > 50 || rightPct > 50) {
      score += 5;
      reasons.push(`Opponent punts ${leftPct > rightPct ? 'left' : 'right'} ${Math.max(leftPct, rightPct)}%`);
    }
  }

  // ==========================================
  // FIELD GOAL PLAYS (when we're attempting)
  // ==========================================
  if (isFieldGoal && !is2Point && !isFGBlock) {
    const fgBlock = opponentProfile.fieldGoal;
    const isFakeFG = playName.includes('fake');
    const isStandardFG = !isFakeFG;

    // Situation-specific scoring for field goals
    if (situation === 'st_fg_short') {
      // Short FG - high percentage kick
      if (isStandardFG) {
        score += 25;
        reasons.push('Short FG is high percentage');
      } else if (isFakeFG) {
        score -= 15;
        reasons.push('Fake unnecessary on short FG');
      }
    } else if (situation === 'st_fg_medium') {
      // Medium FG - standard attempt
      if (isStandardFG) {
        score += 15;
        reasons.push('Medium FG is makeable');
      }
    } else if (situation === 'st_fg_long') {
      // Long FG - consider conditions
      if (isStandardFG) {
        score += 5;
        reasons.push('Long FG is challenging');
      } else if (isFakeFG) {
        score += 10;
        reasons.push('Fake is option on long FG');
      }
    } else if (situation === 'st_fg_max') {
      // Max range - risky attempt
      if (isStandardFG) {
        score -= 5;
        reasons.push('Max range FG is low percentage');
      } else if (isFakeFG) {
        score += 15;
        reasons.push('Consider fake at max range');
      }
    }

    // Opponent tendencies adjustments
    if (fgBlock.blockRate < 5 && isStandardFG) {
      score += 10;
      reasons.push(`Low block risk (${fgBlock.blockRate}%)`);
    } else if (fgBlock.blockRate > 10 && isStandardFG) {
      score -= 10;
      reasons.push(`Watch for block (${fgBlock.blockRate}% block rate)`);
    }

    if (isFakeFG && fgBlock.blockRate > 10) {
      score += 10;
      reasons.push(`Fake exploits aggressive rush`);
    }
  }

  // ==========================================
  // FG BLOCK PLAYS (when they're attempting)
  // ==========================================
  if (isFGBlock) {
    const fg = opponentProfile.fieldGoal;
    const isBlockRush = playName.includes('block') || playName.includes('rush');

    // Situation-specific scoring for FG block
    if (situation === 'st_fgb_short') {
      // Short FG - likely to make, be conservative
      if (isBlockRush) {
        score -= 5;
        reasons.push('Short FG will likely be made - protect against fake');
      } else {
        score += 10;
        reasons.push('Conservative approach on short FG');
      }
    } else if (situation === 'st_fgb_medium') {
      // Medium FG - balanced approach
      score += 5;
      reasons.push('Standard FG defense');
    } else if (situation === 'st_fgb_long') {
      // Long FG - consider all-out block
      if (isBlockRush) {
        score += 15;
        reasons.push('Block attempt valuable on long FG');
      }
    } else if (situation === 'st_fgb_game_critical') {
      // Must block to win
      if (isBlockRush) {
        score += 25;
        reasons.push('All-out block attempt - game on the line');
      }
    }

    // Opponent tendencies adjustments
    if (fg.fakeAttemptRate > 10) {
      if (isBlockRush) {
        score -= 10;
        reasons.push(`Watch for fake (${fg.fakeAttemptRate}% fake rate)`);
      } else {
        score += 10;
        reasons.push('Stay disciplined vs fake-happy team');
      }
    } else if (fg.fakeAttemptRate < 5 && isBlockRush) {
      score += 10;
      reasons.push(`All-out rush - they rarely fake (${fg.fakeAttemptRate}%)`);
    }

    // Check opponent accuracy by range
    const longAccuracy = fg.accuracyByRange?.['50+'] || fg.accuracyByRange?.['40-49'] || 0;
    if (longAccuracy < 50 && (situation === 'st_fgb_long' || situation === 'st_fgb_medium')) {
      score -= 5;
      reasons.push(`Opponent only ${longAccuracy}% on long kicks`);
    }
  }

  // ==========================================
  // PAT / 2-POINT PLAYS
  // ==========================================
  if (isPAT || is2Point) {
    const pat = opponentProfile.pat;
    const is2PointPlay = playName.includes('2') || playName.includes('two');
    const isPATPlay = !is2PointPlay;

    // Situation-specific scoring
    if (situation === 'st_pat_standard') {
      // Standard PAT - kick is preferred
      if (isPATPlay) {
        score += 20;
        reasons.push('Standard PAT is high percentage');
      } else if (is2PointPlay) {
        score -= 10;
        reasons.push('2-point not needed in standard situations');
      }
    } else if (situation === 'st_2pt_ahead') {
      // Ahead - PAT extends lead safely
      if (isPATPlay) {
        score += 15;
        reasons.push('PAT extends lead safely');
      } else if (is2PointPlay) {
        score -= 5;
        reasons.push('2-point unnecessary when ahead');
      }
    } else if (situation === 'st_2pt_behind') {
      // Behind - 2-point might be needed
      if (is2PointPlay) {
        score += 20;
        reasons.push('2-point conversion needed when trailing');
      }
    } else if (situation === 'st_2pt_tied') {
      // Tied - depends on game context
      if (isPATPlay) {
        score += 10;
        reasons.push('PAT takes safe lead');
      } else if (is2PointPlay) {
        score += 5;
        reasons.push('2-point for bigger lead');
      }
    }

    // Opponent tendencies adjustments
    if (pat.accuracy < 95 && isPATPlay) {
      score -= 5;
      reasons.push(`PAT operation ${pat.accuracy}% accuracy`);
    }

    if (is2PointPlay && pat.twoPointConversionRate < 50) {
      score -= 10;
      reasons.push(`2-point success rate only ${pat.twoPointConversionRate}%`);
    }
  }

  // Cap score between 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    playCode: play.play_code,
    score,
    confidence,
    reasoning: reasons.length > 0 ? reasons.join('. ') : 'Standard special teams play'
  };
}
