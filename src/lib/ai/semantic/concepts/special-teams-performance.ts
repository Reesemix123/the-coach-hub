/**
 * Special Teams Performance Concept Resolver
 *
 * Analyzes special teams performance across all units.
 * Calculates kicking stats, return averages, coverage grades, and snap accuracy.
 */

import type { PlayData, PlayerData } from '../types';

// ============================================================================
// TYPES
// ============================================================================

interface KickerStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  fgAttempts: number;
  fgMade: number;
  fgPercentage: number;
  fgMadeByDistance: { [key: string]: { made: number; attempts: number } };
  patAttempts: number;
  patMade: number;
  patPercentage: number;
  kickoffs: number;
  touchbackRate: number;
  avgKickoffDistance: number;
  grade: 'Elite' | 'Excellent' | 'Good' | 'Average' | 'Developing';
}

interface PunterStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  punts: number;
  avgDistance: number;
  longestPunt: number;
  touchbackRate: number;
  insideTwentyRate: number;
  fairCatchRate: number;
  returnYardsAllowed: number;
  avgReturnYardsAllowed: number;
  grade: 'Elite' | 'Excellent' | 'Good' | 'Average' | 'Developing';
}

interface ReturnerStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  kickReturns: number;
  kickReturnYards: number;
  avgKickReturn: number;
  kickReturnTouchbacks: number;
  puntReturns: number;
  puntReturnYards: number;
  avgPuntReturn: number;
  fairCatches: number;
  muffedPunts: number;
  explosiveReturns: number;
  grade: 'Elite' | 'Excellent' | 'Good' | 'Average' | 'Developing';
}

interface LongSnapperStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  totalSnaps: number;
  goodSnaps: number;
  badSnaps: number;
  snapAccuracy: number;
  grade: 'Elite' | 'Excellent' | 'Good' | 'Average' | 'Developing';
}

interface CoverageStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  coverageTackles: number;
  gunnerTackles: number;
  totalTackles: number;
  grade: 'Elite' | 'Excellent' | 'Good' | 'Average' | 'Developing';
}

interface SpecialTeamsPerformanceResult {
  summary: string;
  kickers: KickerStats[];
  punters: PunterStats[];
  returners: ReturnerStats[];
  longSnappers: LongSnapperStats[];
  coverageLeaders: CoverageStats[];
  unitStats: {
    kickoffUnit: { plays: number; touchbackRate: number; avgReturn: number };
    puntUnit: { plays: number; avgDistance: number; insideTwentyRate: number };
    fgUnit: { attempts: number; madeRate: number };
    kickReturnUnit: { returns: number; avgYards: number };
    puntReturnUnit: { returns: number; avgYards: number; fairCatchRate: number };
  };
  recommendations: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getKickerGrade(fgPct: number, touchbackRate: number): KickerStats['grade'] {
  const score = (fgPct * 0.6) + (touchbackRate * 0.4);
  if (score >= 85) return 'Elite';
  if (score >= 75) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Average';
  return 'Developing';
}

function getPunterGrade(avgDistance: number, returnYardsAllowed: number): PunterStats['grade'] {
  // 42+ yards is excellent, low return yards is good
  const distanceScore = Math.min(100, (avgDistance / 45) * 100);
  const returnScore = Math.max(0, 100 - (returnYardsAllowed * 3));
  const score = (distanceScore * 0.6) + (returnScore * 0.4);
  if (score >= 85) return 'Elite';
  if (score >= 70) return 'Excellent';
  if (score >= 55) return 'Good';
  if (score >= 40) return 'Average';
  return 'Developing';
}

function getReturnerGrade(avgKR: number, avgPR: number, muffed: number): ReturnerStats['grade'] {
  if (muffed > 1) return 'Developing';
  const krScore = Math.min(100, (avgKR / 28) * 100);
  const prScore = Math.min(100, (avgPR / 12) * 100);
  const score = (krScore * 0.6) + (prScore * 0.4);
  if (score >= 85) return 'Elite';
  if (score >= 70) return 'Excellent';
  if (score >= 55) return 'Good';
  if (score >= 40) return 'Average';
  return 'Developing';
}

function getSnapperGrade(accuracy: number): LongSnapperStats['grade'] {
  if (accuracy >= 98) return 'Elite';
  if (accuracy >= 95) return 'Excellent';
  if (accuracy >= 90) return 'Good';
  if (accuracy >= 80) return 'Average';
  return 'Developing';
}

function getCoverageGrade(tackles: number, totalPlays: number): CoverageStats['grade'] {
  const tackleRate = totalPlays > 0 ? (tackles / totalPlays) * 100 : 0;
  if (tackles >= 8 || tackleRate >= 25) return 'Elite';
  if (tackles >= 5 || tackleRate >= 15) return 'Excellent';
  if (tackles >= 3 || tackleRate >= 10) return 'Good';
  if (tackles >= 1) return 'Average';
  return 'Developing';
}

// ============================================================================
// MAIN RESOLVER
// ============================================================================

export function resolveSpecialTeamsPerformance(
  plays: PlayData[],
  players: PlayerData[]
): SpecialTeamsPerformanceResult {
  // Filter to special teams plays only
  const stPlays = plays.filter((p) => p.special_teams_unit != null);

  if (stPlays.length === 0) {
    return {
      summary: 'No special teams play data available. Tag your film with special teams plays to see performance analysis.',
      kickers: [],
      punters: [],
      returners: [],
      longSnappers: [],
      coverageLeaders: [],
      unitStats: {
        kickoffUnit: { plays: 0, touchbackRate: 0, avgReturn: 0 },
        puntUnit: { plays: 0, avgDistance: 0, insideTwentyRate: 0 },
        fgUnit: { attempts: 0, madeRate: 0 },
        kickReturnUnit: { returns: 0, avgYards: 0 },
        puntReturnUnit: { returns: 0, avgYards: 0, fairCatchRate: 0 },
      },
      recommendations: [
        'Tag your game film with special teams plays',
        'Include kicker, punter, returner, and coverage assignments',
      ],
    };
  }

  // Helper to find player info
  const findPlayer = (id: string | null | undefined) => {
    if (!id) return null;
    return players.find((p) => p.id === id);
  };

  const getPlayerName = (id: string | null | undefined) => {
    const player = findPlayer(id);
    return player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown' : 'Unknown';
  };

  const getPlayerNumber = (id: string | null | undefined) => {
    const player = findPlayer(id);
    return player?.jersey_number || '??';
  };

  // ========================================================================
  // KICKER STATS
  // ========================================================================
  const kickerMap = new Map<string, KickerStats>();

  const kickerPlays = stPlays.filter((p) =>
    p.kicker_id && (p.special_teams_unit === 'field_goal' || p.special_teams_unit === 'pat' || p.special_teams_unit === 'kickoff')
  );

  for (const play of kickerPlays) {
    const kickerId = play.kicker_id!;
    if (!kickerMap.has(kickerId)) {
      kickerMap.set(kickerId, {
        playerId: kickerId,
        playerName: getPlayerName(kickerId),
        jerseyNumber: getPlayerNumber(kickerId),
        fgAttempts: 0,
        fgMade: 0,
        fgPercentage: 0,
        fgMadeByDistance: {},
        patAttempts: 0,
        patMade: 0,
        patPercentage: 0,
        kickoffs: 0,
        touchbackRate: 0,
        avgKickoffDistance: 0,
        grade: 'Developing',
      });
    }

    const stats = kickerMap.get(kickerId)!;

    if (play.special_teams_unit === 'field_goal') {
      stats.fgAttempts++;
      if (play.kick_result === 'made') {
        stats.fgMade++;
      }
      // Track by distance
      const dist = play.kick_distance || 0;
      const distBucket = dist < 30 ? 'under30' : dist < 40 ? '30-39' : dist < 50 ? '40-49' : '50+';
      if (!stats.fgMadeByDistance[distBucket]) {
        stats.fgMadeByDistance[distBucket] = { made: 0, attempts: 0 };
      }
      stats.fgMadeByDistance[distBucket].attempts++;
      if (play.kick_result === 'made') {
        stats.fgMadeByDistance[distBucket].made++;
      }
    } else if (play.special_teams_unit === 'pat') {
      stats.patAttempts++;
      if (play.kick_result === 'made') {
        stats.patMade++;
      }
    } else if (play.special_teams_unit === 'kickoff') {
      stats.kickoffs++;
    }
  }

  // Calculate kicker percentages and grades
  const kickoffPlays = stPlays.filter((p) => p.special_teams_unit === 'kickoff');
  const touchbacks = kickoffPlays.filter((p) => p.kick_result === 'touchback').length;
  const totalKickoffDistance = kickoffPlays.reduce((sum, p) => sum + (p.kick_distance || 0), 0);

  for (const stats of kickerMap.values()) {
    stats.fgPercentage = stats.fgAttempts > 0 ? Math.round((stats.fgMade / stats.fgAttempts) * 100) : 0;
    stats.patPercentage = stats.patAttempts > 0 ? Math.round((stats.patMade / stats.patAttempts) * 100) : 0;
    stats.touchbackRate = stats.kickoffs > 0 ? Math.round((touchbacks / kickoffPlays.length) * 100) : 0;
    stats.avgKickoffDistance = stats.kickoffs > 0 ? Math.round(totalKickoffDistance / kickoffPlays.length) : 0;
    stats.grade = getKickerGrade(stats.fgPercentage, stats.touchbackRate);
  }

  // ========================================================================
  // PUNTER STATS
  // ========================================================================
  const punterMap = new Map<string, PunterStats>();

  const puntPlays = stPlays.filter((p) => p.punter_id && p.special_teams_unit === 'punt');

  for (const play of puntPlays) {
    const punterId = play.punter_id!;
    if (!punterMap.has(punterId)) {
      punterMap.set(punterId, {
        playerId: punterId,
        playerName: getPlayerName(punterId),
        jerseyNumber: getPlayerNumber(punterId),
        punts: 0,
        avgDistance: 0,
        longestPunt: 0,
        touchbackRate: 0,
        insideTwentyRate: 0,
        fairCatchRate: 0,
        returnYardsAllowed: 0,
        avgReturnYardsAllowed: 0,
        grade: 'Developing',
      });
    }

    const stats = punterMap.get(punterId)!;
    stats.punts++;
    if (play.kick_distance && play.kick_distance > stats.longestPunt) {
      stats.longestPunt = play.kick_distance;
    }
  }

  // Calculate punter stats
  for (const stats of punterMap.values()) {
    const punterPunts = puntPlays.filter((p) => p.punter_id === stats.playerId);
    const totalDistance = punterPunts.reduce((sum, p) => sum + (p.kick_distance || 0), 0);
    const touchbackPunts = punterPunts.filter((p) => p.kick_result === 'touchback').length;
    const fairCatchPunts = punterPunts.filter((p) => p.kick_result === 'fair_catch').length;
    const returnedPunts = punterPunts.filter((p) => p.kick_result === 'returned');
    const totalReturnYards = returnedPunts.reduce((sum, p) => sum + (p.return_yards || 0), 0);

    stats.avgDistance = stats.punts > 0 ? Math.round(totalDistance / stats.punts) : 0;
    stats.touchbackRate = stats.punts > 0 ? Math.round((touchbackPunts / stats.punts) * 100) : 0;
    stats.fairCatchRate = stats.punts > 0 ? Math.round((fairCatchPunts / stats.punts) * 100) : 0;
    stats.returnYardsAllowed = totalReturnYards;
    stats.avgReturnYardsAllowed = returnedPunts.length > 0 ? Math.round(totalReturnYards / returnedPunts.length) : 0;
    stats.grade = getPunterGrade(stats.avgDistance, stats.avgReturnYardsAllowed);
  }

  // ========================================================================
  // RETURNER STATS
  // ========================================================================
  const returnerMap = new Map<string, ReturnerStats>();

  const returnPlays = stPlays.filter((p) =>
    p.returner_id && (p.special_teams_unit === 'kick_return' || p.special_teams_unit === 'punt_return')
  );

  for (const play of returnPlays) {
    const returnerId = play.returner_id!;
    if (!returnerMap.has(returnerId)) {
      returnerMap.set(returnerId, {
        playerId: returnerId,
        playerName: getPlayerName(returnerId),
        jerseyNumber: getPlayerNumber(returnerId),
        kickReturns: 0,
        kickReturnYards: 0,
        avgKickReturn: 0,
        kickReturnTouchbacks: 0,
        puntReturns: 0,
        puntReturnYards: 0,
        avgPuntReturn: 0,
        fairCatches: 0,
        muffedPunts: 0,
        explosiveReturns: 0,
        grade: 'Developing',
      });
    }

    const stats = returnerMap.get(returnerId)!;

    if (play.special_teams_unit === 'kick_return') {
      if (play.is_touchback) {
        stats.kickReturnTouchbacks++;
      } else if (play.kick_result === 'returned') {
        stats.kickReturns++;
        stats.kickReturnYards += play.return_yards || 0;
        if ((play.return_yards || 0) >= 30) stats.explosiveReturns++;
      }
    } else if (play.special_teams_unit === 'punt_return') {
      if (play.is_fair_catch) {
        stats.fairCatches++;
      } else if (play.is_muffed) {
        stats.muffedPunts++;
      } else if (play.kick_result === 'returned') {
        stats.puntReturns++;
        stats.puntReturnYards += play.return_yards || 0;
        if ((play.return_yards || 0) >= 20) stats.explosiveReturns++;
      }
    }
  }

  // Calculate returner averages and grades
  for (const stats of returnerMap.values()) {
    stats.avgKickReturn = stats.kickReturns > 0 ? Math.round(stats.kickReturnYards / stats.kickReturns) : 0;
    stats.avgPuntReturn = stats.puntReturns > 0 ? Math.round(stats.puntReturnYards / stats.puntReturns) : 0;
    stats.grade = getReturnerGrade(stats.avgKickReturn, stats.avgPuntReturn, stats.muffedPunts);
  }

  // ========================================================================
  // LONG SNAPPER STATS
  // ========================================================================
  const snapperMap = new Map<string, LongSnapperStats>();

  const snapPlays = stPlays.filter((p) => p.long_snapper_id);

  for (const play of snapPlays) {
    const snapperId = play.long_snapper_id!;
    if (!snapperMap.has(snapperId)) {
      snapperMap.set(snapperId, {
        playerId: snapperId,
        playerName: getPlayerName(snapperId),
        jerseyNumber: getPlayerNumber(snapperId),
        totalSnaps: 0,
        goodSnaps: 0,
        badSnaps: 0,
        snapAccuracy: 0,
        grade: 'Developing',
      });
    }

    const stats = snapperMap.get(snapperId)!;
    stats.totalSnaps++;
    if (play.snap_quality === 'good') {
      stats.goodSnaps++;
    } else if (play.snap_quality && play.snap_quality !== 'good') {
      stats.badSnaps++;
    }
  }

  // Calculate snapper accuracy and grades
  for (const stats of snapperMap.values()) {
    stats.snapAccuracy = stats.totalSnaps > 0 ? Math.round((stats.goodSnaps / stats.totalSnaps) * 100) : 0;
    stats.grade = getSnapperGrade(stats.snapAccuracy);
  }

  // ========================================================================
  // COVERAGE STATS
  // ========================================================================
  const coverageMap = new Map<string, CoverageStats>();

  // Gunner tackles on punts
  const gunnerTacklePlays = stPlays.filter((p) => p.gunner_tackle_id);
  for (const play of gunnerTacklePlays) {
    const gunnerId = play.gunner_tackle_id!;
    if (!coverageMap.has(gunnerId)) {
      coverageMap.set(gunnerId, {
        playerId: gunnerId,
        playerName: getPlayerName(gunnerId),
        jerseyNumber: getPlayerNumber(gunnerId),
        coverageTackles: 0,
        gunnerTackles: 0,
        totalTackles: 0,
        grade: 'Developing',
      });
    }
    const stats = coverageMap.get(gunnerId)!;
    stats.gunnerTackles++;
    stats.totalTackles++;
  }

  // Coverage tackles on kickoffs
  const coverageTacklePlays = stPlays.filter((p) => p.coverage_tackler_id);
  for (const play of coverageTacklePlays) {
    const coverId = play.coverage_tackler_id!;
    if (!coverageMap.has(coverId)) {
      coverageMap.set(coverId, {
        playerId: coverId,
        playerName: getPlayerName(coverId),
        jerseyNumber: getPlayerNumber(coverId),
        coverageTackles: 0,
        gunnerTackles: 0,
        totalTackles: 0,
        grade: 'Developing',
      });
    }
    const stats = coverageMap.get(coverId)!;
    stats.coverageTackles++;
    stats.totalTackles++;
  }

  // Calculate coverage grades
  const totalCoveragePlays = kickoffPlays.length + puntPlays.length;
  for (const stats of coverageMap.values()) {
    stats.grade = getCoverageGrade(stats.totalTackles, totalCoveragePlays);
  }

  // ========================================================================
  // UNIT STATS
  // ========================================================================
  const kickReturnPlays = stPlays.filter((p) => p.special_teams_unit === 'kick_return' && p.kick_result === 'returned');
  const puntReturnPlays = stPlays.filter((p) => p.special_teams_unit === 'punt_return');
  const fgPlays = stPlays.filter((p) => p.special_teams_unit === 'field_goal');

  const unitStats = {
    kickoffUnit: {
      plays: kickoffPlays.length,
      touchbackRate: kickoffPlays.length > 0 ? Math.round((touchbacks / kickoffPlays.length) * 100) : 0,
      avgReturn: kickoffPlays.filter((p) => p.kick_result === 'returned').length > 0
        ? Math.round(kickoffPlays.filter((p) => p.kick_result === 'returned').reduce((sum, p) => sum + (p.return_yards || 0), 0) / kickoffPlays.filter((p) => p.kick_result === 'returned').length)
        : 0,
    },
    puntUnit: {
      plays: puntPlays.length,
      avgDistance: puntPlays.length > 0 ? Math.round(puntPlays.reduce((sum, p) => sum + (p.kick_distance || 0), 0) / puntPlays.length) : 0,
      insideTwentyRate: 0, // Would need yard line data
    },
    fgUnit: {
      attempts: fgPlays.length,
      madeRate: fgPlays.length > 0 ? Math.round((fgPlays.filter((p) => p.kick_result === 'made').length / fgPlays.length) * 100) : 0,
    },
    kickReturnUnit: {
      returns: kickReturnPlays.length,
      avgYards: kickReturnPlays.length > 0 ? Math.round(kickReturnPlays.reduce((sum, p) => sum + (p.return_yards || 0), 0) / kickReturnPlays.length) : 0,
    },
    puntReturnUnit: {
      returns: puntReturnPlays.filter((p) => p.kick_result === 'returned').length,
      avgYards: puntReturnPlays.filter((p) => p.kick_result === 'returned').length > 0
        ? Math.round(puntReturnPlays.filter((p) => p.kick_result === 'returned').reduce((sum, p) => sum + (p.return_yards || 0), 0) / puntReturnPlays.filter((p) => p.kick_result === 'returned').length)
        : 0,
      fairCatchRate: puntReturnPlays.length > 0 ? Math.round((puntReturnPlays.filter((p) => p.is_fair_catch).length / puntReturnPlays.length) * 100) : 0,
    },
  };

  // ========================================================================
  // RECOMMENDATIONS
  // ========================================================================
  const recommendations: string[] = [];

  // Kicker recommendations
  for (const kicker of kickerMap.values()) {
    if (kicker.fgAttempts >= 3 && kicker.fgPercentage < 70) {
      recommendations.push(`Kicker ${kicker.playerName} (#${kicker.jerseyNumber}) struggling at ${kicker.fgPercentage}% FG - extra practice needed`);
    }
    if (kicker.touchbackRate < 50 && kicker.kickoffs >= 5) {
      recommendations.push(`Consider improving kickoff depth - only ${kicker.touchbackRate}% touchback rate`);
    }
  }

  // Punter recommendations
  for (const punter of punterMap.values()) {
    if (punter.avgDistance < 38 && punter.punts >= 5) {
      recommendations.push(`Punter ${punter.playerName} averaging only ${punter.avgDistance} yards - work on leg strength`);
    }
    if (punter.avgReturnYardsAllowed > 10) {
      recommendations.push(`Punt coverage allowing ${punter.avgReturnYardsAllowed} yards per return - tighten coverage lanes`);
    }
  }

  // Returner recommendations
  for (const returner of returnerMap.values()) {
    if (returner.muffedPunts > 0) {
      recommendations.push(`${returner.playerName} has ${returner.muffedPunts} muffed punt(s) - consider backup returner or fair catch emphasis`);
    }
    if (returner.kickReturns >= 5 && returner.avgKickReturn < 18) {
      recommendations.push(`Kick return average of ${returner.avgKickReturn} yards is below average - review blocking scheme`);
    }
    if (returner.explosiveReturns > 0) {
      recommendations.push(`${returner.playerName} has ${returner.explosiveReturns} explosive returns - keep featuring on returns`);
    }
  }

  // Snapper recommendations
  for (const snapper of snapperMap.values()) {
    if (snapper.snapAccuracy < 90) {
      recommendations.push(`Long snapper ${snapper.playerName} at ${snapper.snapAccuracy}% accuracy - critical skill, extra reps needed`);
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Special teams units are performing well across the board');
  }

  // ========================================================================
  // BUILD SUMMARY
  // ========================================================================
  let summary = `**Special Teams Performance (${stPlays.length} plays analyzed)**\n\n`;

  // Kicking
  const kickers = Array.from(kickerMap.values());
  if (kickers.length > 0) {
    summary += `**Kicking:**\n`;
    for (const k of kickers) {
      summary += `- **${k.playerName}** (#${k.jerseyNumber}): `;
      if (k.fgAttempts > 0) summary += `FG ${k.fgMade}/${k.fgAttempts} (${k.fgPercentage}%)`;
      if (k.patAttempts > 0) summary += `, PAT ${k.patMade}/${k.patAttempts} (${k.patPercentage}%)`;
      if (k.kickoffs > 0) summary += `, ${k.touchbackRate}% TB rate`;
      summary += ` - ${k.grade}\n`;
    }
    summary += '\n';
  }

  // Punting
  const punters = Array.from(punterMap.values());
  if (punters.length > 0) {
    summary += `**Punting:**\n`;
    for (const p of punters) {
      summary += `- **${p.playerName}** (#${p.jerseyNumber}): ${p.punts} punts, ${p.avgDistance} yd avg, ${p.avgReturnYardsAllowed} yd return avg - ${p.grade}\n`;
    }
    summary += '\n';
  }

  // Returns
  const returners = Array.from(returnerMap.values()).sort((a, b) => (b.kickReturnYards + b.puntReturnYards) - (a.kickReturnYards + a.puntReturnYards));
  if (returners.length > 0) {
    summary += `**Returns:**\n`;
    for (const r of returners.slice(0, 3)) {
      const parts = [];
      if (r.kickReturns > 0) parts.push(`KR ${r.avgKickReturn} yd avg`);
      if (r.puntReturns > 0) parts.push(`PR ${r.avgPuntReturn} yd avg`);
      if (r.fairCatches > 0) parts.push(`${r.fairCatches} FC`);
      if (r.explosiveReturns > 0) parts.push(`${r.explosiveReturns} explosive`);
      summary += `- **${r.playerName}** (#${r.jerseyNumber}): ${parts.join(', ')} - ${r.grade}\n`;
    }
    summary += '\n';
  }

  // Coverage leaders
  const coverageLeaders = Array.from(coverageMap.values()).sort((a, b) => b.totalTackles - a.totalTackles);
  if (coverageLeaders.length > 0 && coverageLeaders[0].totalTackles > 0) {
    summary += `**Coverage Leaders:**\n`;
    for (const c of coverageLeaders.slice(0, 3)) {
      if (c.totalTackles > 0) {
        summary += `- **${c.playerName}** (#${c.jerseyNumber}): ${c.totalTackles} tackles (${c.gunnerTackles} gunner, ${c.coverageTackles} KO) - ${c.grade}\n`;
      }
    }
    summary += '\n';
  }

  // Long snapping
  const snappers = Array.from(snapperMap.values());
  if (snappers.length > 0) {
    summary += `**Long Snapping:**\n`;
    for (const s of snappers) {
      summary += `- **${s.playerName}** (#${s.jerseyNumber}): ${s.snapAccuracy}% accuracy (${s.totalSnaps} snaps) - ${s.grade}\n`;
    }
  }

  return {
    summary,
    kickers,
    punters,
    returners,
    longSnappers: Array.from(snapperMap.values()),
    coverageLeaders,
    unitStats,
    recommendations,
  };
}
