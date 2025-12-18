/**
 * Defensive Performance Concept Resolver
 *
 * Analyzes defensive player performance across position groups.
 * Calculates tackle stats, pressure rates, coverage grades, and havoc metrics.
 */

import type { PlayData, PlayerData } from '../types';

interface DefensivePlayerStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  positionGroup: 'DL' | 'LB' | 'DB' | 'Unknown';
  tackles: number;
  soloTackles: number;
  assistedTackles: number;
  tfls: number;
  sacks: number;
  pressures: number;
  pbus: number;
  forcedFumbles: number;
  coverageSnaps: number;
  coverageWins: number;
  coverageLosses: number;
  coverageWinRate: number;
  havocPlays: number;
  havocRate: number;
  grade: 'Elite' | 'Excellent' | 'Good' | 'Average' | 'Developing';
}

interface PositionGroupStats {
  group: string;
  players: DefensivePlayerStats[];
  totalTackles: number;
  totalTfls: number;
  totalSacks: number;
  totalPressures: number;
  totalPbus: number;
  avgHavocRate: number;
}

interface DefensivePerformanceResult {
  summary: string;
  playerStats: DefensivePlayerStats[];
  positionGroups: PositionGroupStats[];
  teamStats: {
    totalPlays: number;
    totalTackles: number;
    totalTfls: number;
    totalSacks: number;
    totalPressures: number;
    totalPbus: number;
    totalForcedFumbles: number;
    havocRate: number;
    teamGrade: string;
  };
  recommendations: string[];
}

function getDefensiveGrade(havocRate: number, tackles: number): DefensivePlayerStats['grade'] {
  // Combine havoc rate and tackle production for grade
  const score = havocRate * 100 + (tackles * 2);
  if (score >= 30) return 'Elite';
  if (score >= 20) return 'Excellent';
  if (score >= 12) return 'Good';
  if (score >= 6) return 'Average';
  return 'Developing';
}

function getTeamGradeString(havocRate: number): string {
  if (havocRate >= 0.25) return 'A+';
  if (havocRate >= 0.20) return 'A';
  if (havocRate >= 0.15) return 'B';
  if (havocRate >= 0.10) return 'C';
  if (havocRate >= 0.05) return 'D';
  return 'F';
}

function getPositionGroup(player: PlayerData): DefensivePlayerStats['positionGroup'] {
  const positions = player.position_depths || {};
  const positionKeys = Object.keys(positions);

  // Check for DL positions
  if (positionKeys.some(p => ['DT', 'DE', 'NT', 'DL'].includes(p.toUpperCase()))) {
    return 'DL';
  }
  // Check for LB positions
  if (positionKeys.some(p => ['MLB', 'ILB', 'OLB', 'WLB', 'SLB', 'LB'].includes(p.toUpperCase()))) {
    return 'LB';
  }
  // Check for DB positions
  if (positionKeys.some(p => ['CB', 'FS', 'SS', 'S', 'DB', 'NB'].includes(p.toUpperCase()))) {
    return 'DB';
  }

  return 'Unknown';
}

export function resolveDefensivePerformance(
  plays: PlayData[],
  players: PlayerData[]
): DefensivePerformanceResult {
  // Filter to opponent plays (where we're on defense)
  const defensivePlays = plays.filter((p) => p.is_opponent_play === true);

  if (defensivePlays.length === 0) {
    return {
      summary: 'No defensive play data available. Tag opponent plays in your film to see defensive performance analysis.',
      playerStats: [],
      positionGroups: [],
      teamStats: {
        totalPlays: 0,
        totalTackles: 0,
        totalTfls: 0,
        totalSacks: 0,
        totalPressures: 0,
        totalPbus: 0,
        totalForcedFumbles: 0,
        havocRate: 0,
        teamGrade: 'N/A',
      },
      recommendations: [
        'Tag opponent plays with defensive player attribution',
        'Mark tacklers, pressure players, and coverage results for each defensive play',
      ],
    };
  }

  // Build player stat map
  const playerStatsMap = new Map<string, DefensivePlayerStats>();

  // Helper to find player info
  const findPlayer = (id: string | null | undefined) => {
    if (!id) return null;
    return players.find((p) => p.id === id);
  };

  // Initialize or get player stats
  const getOrCreateStats = (playerId: string): DefensivePlayerStats | null => {
    if (playerStatsMap.has(playerId)) {
      return playerStatsMap.get(playerId)!;
    }

    const player = findPlayer(playerId);
    if (!player) return null;

    const stats: DefensivePlayerStats = {
      playerId,
      playerName: `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown',
      jerseyNumber: player.jersey_number || '??',
      positionGroup: getPositionGroup(player),
      tackles: 0,
      soloTackles: 0,
      assistedTackles: 0,
      tfls: 0,
      sacks: 0,
      pressures: 0,
      pbus: 0,
      forcedFumbles: 0,
      coverageSnaps: 0,
      coverageWins: 0,
      coverageLosses: 0,
      coverageWinRate: 0,
      havocPlays: 0,
      havocRate: 0,
      grade: 'Developing',
    };
    playerStatsMap.set(playerId, stats);
    return stats;
  };

  // Process each defensive play
  for (const play of defensivePlays) {
    // Process tacklers
    if (play.tackler_ids && play.tackler_ids.length > 0) {
      const isSoloTackle = play.tackler_ids.length === 1;

      for (const tacklerId of play.tackler_ids) {
        const stats = getOrCreateStats(tacklerId);
        if (stats) {
          stats.tackles++;
          if (isSoloTackle) {
            stats.soloTackles++;
          } else {
            stats.assistedTackles++;
          }

          // Check for TFL
          if (play.is_tfl) {
            stats.tfls++;
            stats.havocPlays++;
          }
        }
      }
    }

    // Process sacks
    if (play.is_sack && play.tackler_ids && play.tackler_ids.length > 0) {
      for (const tacklerId of play.tackler_ids) {
        const stats = getOrCreateStats(tacklerId);
        if (stats) {
          stats.sacks++;
          stats.havocPlays++;
        }
      }
    }

    // Process pressures
    if (play.pressure_player_ids && play.pressure_player_ids.length > 0) {
      for (const pressureId of play.pressure_player_ids) {
        const stats = getOrCreateStats(pressureId);
        if (stats) {
          stats.pressures++;
        }
      }
    }

    // Process coverage
    if (play.coverage_player_id) {
      const stats = getOrCreateStats(play.coverage_player_id);
      if (stats) {
        stats.coverageSnaps++;
        if (play.coverage_result === 'win') {
          stats.coverageWins++;
        } else if (play.coverage_result === 'loss') {
          stats.coverageLosses++;
        }

        // PBU counts as havoc
        if (play.is_pbu) {
          stats.pbus++;
          stats.havocPlays++;
        }
      }
    }

    // Process forced fumbles
    if (play.is_forced_fumble && play.tackler_ids && play.tackler_ids.length > 0) {
      // Attribute forced fumble to first tackler
      const stats = getOrCreateStats(play.tackler_ids[0]);
      if (stats) {
        stats.forcedFumbles++;
        stats.havocPlays++;
      }
    }
  }

  // Calculate derived stats and grades
  const playerStats: DefensivePlayerStats[] = [];
  for (const stats of playerStatsMap.values()) {
    // Calculate coverage win rate
    if (stats.coverageSnaps > 0) {
      stats.coverageWinRate = Math.round((stats.coverageWins / stats.coverageSnaps) * 100);
    }

    // Calculate havoc rate (havoc plays / total defensive plays)
    stats.havocRate = Math.round((stats.havocPlays / defensivePlays.length) * 1000) / 10;

    // Assign grade
    stats.grade = getDefensiveGrade(stats.havocPlays / defensivePlays.length, stats.tackles);

    playerStats.push(stats);
  }

  // Sort by tackles + havoc
  playerStats.sort((a, b) => (b.tackles + b.havocPlays) - (a.tackles + a.havocPlays));

  // Group by position
  const dlPlayers = playerStats.filter(p => p.positionGroup === 'DL');
  const lbPlayers = playerStats.filter(p => p.positionGroup === 'LB');
  const dbPlayers = playerStats.filter(p => p.positionGroup === 'DB');

  const createGroupStats = (group: string, players: DefensivePlayerStats[]): PositionGroupStats => ({
    group,
    players,
    totalTackles: players.reduce((sum, p) => sum + p.tackles, 0),
    totalTfls: players.reduce((sum, p) => sum + p.tfls, 0),
    totalSacks: players.reduce((sum, p) => sum + p.sacks, 0),
    totalPressures: players.reduce((sum, p) => sum + p.pressures, 0),
    totalPbus: players.reduce((sum, p) => sum + p.pbus, 0),
    avgHavocRate: players.length > 0
      ? Math.round((players.reduce((sum, p) => sum + p.havocRate, 0) / players.length) * 10) / 10
      : 0,
  });

  const positionGroups: PositionGroupStats[] = [
    createGroupStats('Defensive Line', dlPlayers),
    createGroupStats('Linebackers', lbPlayers),
    createGroupStats('Defensive Backs', dbPlayers),
  ].filter(g => g.players.length > 0);

  // Calculate team stats
  const totalTackles = playerStats.reduce((sum, p) => sum + p.tackles, 0);
  const totalTfls = playerStats.reduce((sum, p) => sum + p.tfls, 0);
  const totalSacks = playerStats.reduce((sum, p) => sum + p.sacks, 0);
  const totalPressures = playerStats.reduce((sum, p) => sum + p.pressures, 0);
  const totalPbus = playerStats.reduce((sum, p) => sum + p.pbus, 0);
  const totalForcedFumbles = playerStats.reduce((sum, p) => sum + p.forcedFumbles, 0);

  // Havoc plays: TFL, sack, PBU, INT, forced fumble
  const havocPlays = defensivePlays.filter(
    p => p.is_tfl || p.is_sack || p.is_pbu || p.is_forced_fumble
  ).length;
  const havocRate = defensivePlays.length > 0 ? havocPlays / defensivePlays.length : 0;

  // Generate recommendations
  const recommendations: string[] = [];

  // Find tackle leaders and promote
  const tackleLeader = playerStats.find(p => p.tackles === Math.max(...playerStats.map(s => s.tackles)));
  if (tackleLeader && tackleLeader.tackles > 0) {
    if (tackleLeader.positionGroup === 'DB') {
      recommendations.push(
        `${tackleLeader.playerName} (#${tackleLeader.jerseyNumber}) leads in tackles from DB - good run support, but consider gap discipline up front`
      );
    }
  }

  // Check pass rush effectiveness
  const totalPassPlays = defensivePlays.filter(p => p.play_type === 'pass').length;
  const pressureRate = totalPassPlays > 0 ? (totalPressures + totalSacks) / totalPassPlays : 0;
  if (pressureRate < 0.20 && totalPassPlays > 5) {
    recommendations.push(
      `Pass rush pressure rate is ${Math.round(pressureRate * 100)}% - consider adding more blitz packages`
    );
  } else if (pressureRate >= 0.30) {
    recommendations.push(
      `Excellent pass rush pressure (${Math.round(pressureRate * 100)}%) - defensive front is dominating`
    );
  }

  // Check coverage grades
  const coveragePlayers = playerStats.filter(p => p.coverageSnaps > 3);
  const strugglingCoverage = coveragePlayers.filter(p => p.coverageWinRate < 40);
  for (const player of strugglingCoverage) {
    recommendations.push(
      `${player.playerName} (#${player.jerseyNumber}) struggling in coverage (${player.coverageWinRate}% win rate) - extra DB drills recommended`
    );
  }

  // Check DL production
  const dlGroup = positionGroups.find(g => g.group === 'Defensive Line');
  if (dlGroup && dlGroup.players.length > 0 && dlGroup.totalTfls + dlGroup.totalSacks < 2) {
    recommendations.push(
      'Defensive line needs more disruptive plays - focus on gap penetration and pass rush technique'
    );
  }

  // Overall havoc rate feedback
  if (havocRate >= 0.20) {
    recommendations.push(`Defensive havoc rate of ${Math.round(havocRate * 100)}% is excellent - keep the pressure on`);
  } else if (havocRate < 0.10 && defensivePlays.length > 10) {
    recommendations.push(`Defensive havoc rate of ${Math.round(havocRate * 100)}% is low - create more negative plays with blitzes and aggressive techniques`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Defense is performing solidly - maintain current schemes and techniques');
  }

  // Build summary
  let summary = `**Defensive Performance (${defensivePlays.length} plays analyzed)**\n\n`;
  summary += `Team Havoc Grade: **${getTeamGradeString(havocRate)}** (${Math.round(havocRate * 100)}% havoc rate)\n\n`;

  summary += `**Team Totals:**\n`;
  summary += `- Tackles: ${totalTackles}\n`;
  summary += `- TFLs: ${totalTfls}\n`;
  summary += `- Sacks: ${totalSacks}\n`;
  summary += `- Pressures: ${totalPressures}\n`;
  summary += `- Pass Breakups: ${totalPbus}\n`;
  summary += `- Forced Fumbles: ${totalForcedFumbles}\n\n`;

  // Top performers
  const topPerformers = playerStats.slice(0, 5);
  if (topPerformers.length > 0) {
    summary += `**Top Performers:**\n`;
    for (const player of topPerformers) {
      const highlights = [];
      if (player.tackles > 0) highlights.push(`${player.tackles} TKL`);
      if (player.tfls > 0) highlights.push(`${player.tfls} TFL`);
      if (player.sacks > 0) highlights.push(`${player.sacks} SACK`);
      if (player.pbus > 0) highlights.push(`${player.pbus} PBU`);
      if (player.pressures > 0) highlights.push(`${player.pressures} PRESS`);

      summary += `- **${player.playerName}** (#${player.jerseyNumber}, ${player.positionGroup}): ${highlights.join(', ')} - ${player.grade}\n`;
    }
  }

  // Position group breakdown
  if (positionGroups.length > 0) {
    summary += `\n**By Position Group:**\n`;
    for (const group of positionGroups) {
      summary += `- **${group.group}:** ${group.totalTackles} TKL, ${group.totalTfls} TFL, ${group.totalSacks} SACK, ${group.avgHavocRate}% havoc\n`;
    }
  }

  return {
    summary,
    playerStats,
    positionGroups,
    teamStats: {
      totalPlays: defensivePlays.length,
      totalTackles,
      totalTfls,
      totalSacks,
      totalPressures,
      totalPbus,
      totalForcedFumbles,
      havocRate: Math.round(havocRate * 1000) / 10,
      teamGrade: getTeamGradeString(havocRate),
    },
    recommendations,
  };
}
