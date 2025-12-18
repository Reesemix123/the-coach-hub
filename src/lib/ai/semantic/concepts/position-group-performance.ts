/**
 * Position Group Performance Concept Resolver
 *
 * Aggregates performance metrics by position group for practice planning.
 * Includes OL block win rates, DB coverage success, LB tackle efficiency, etc.
 * Identifies weakest position group for targeted practice focus.
 */

import type { PlayData, PlayerData } from '../types';

export interface PositionGroupStats {
  group: string;
  groupName: string;
  totalPlays: number;
  winRate: number;
  grade: 'Excellent' | 'Good' | 'Average' | 'Needs Work' | 'Struggling' | 'No Data';
  topPerformer?: {
    playerId: string;
    playerName: string;
    jerseyNumber: string;
    winRate: number;
  };
  weakestPerformer?: {
    playerId: string;
    playerName: string;
    jerseyNumber: string;
    winRate: number;
  };
  details: string;
}

export interface PositionGroupPerformanceResult {
  summary: string;
  groups: PositionGroupStats[];
  weakestGroup: {
    group: string;
    groupName: string;
    winRate: number;
    recommendation: string;
  } | null;
  practiceRecommendations: string[];
}

function getGrade(winRate: number, hasData: boolean): PositionGroupStats['grade'] {
  if (!hasData) return 'No Data';
  if (winRate >= 75) return 'Excellent';
  if (winRate >= 65) return 'Good';
  if (winRate >= 55) return 'Average';
  if (winRate >= 45) return 'Needs Work';
  return 'Struggling';
}

function getGradeEmoji(grade: PositionGroupStats['grade']): string {
  switch (grade) {
    case 'Excellent': return '✓';
    case 'Good': return '✓';
    case 'Average': return '~';
    case 'Needs Work': return '⚠️';
    case 'Struggling': return '❌';
    case 'No Data': return '-';
  }
}

/**
 * Calculate OL position group stats
 */
function calculateOLStats(plays: PlayData[], players: PlayerData[]): PositionGroupStats {
  const olPlays = plays.filter(
    (p) => p.lt_id || p.lg_id || p.c_id || p.rg_id || p.rt_id
  );

  if (olPlays.length === 0) {
    return {
      group: 'OL',
      groupName: 'Offensive Line',
      totalPlays: 0,
      winRate: 0,
      grade: 'No Data',
      details: 'No OL attribution data - tag film with OL assignments',
    };
  }

  const findPlayer = (id: string | null | undefined) => {
    if (!id) return null;
    return players.find((p) => p.id === id);
  };

  // Calculate per-position stats
  const positionStats = [
    { pos: 'LT', idKey: 'lt_id' as keyof PlayData, resultKey: 'lt_block_result' as keyof PlayData },
    { pos: 'LG', idKey: 'lg_id' as keyof PlayData, resultKey: 'lg_block_result' as keyof PlayData },
    { pos: 'C', idKey: 'c_id' as keyof PlayData, resultKey: 'c_block_result' as keyof PlayData },
    { pos: 'RG', idKey: 'rg_id' as keyof PlayData, resultKey: 'rg_block_result' as keyof PlayData },
    { pos: 'RT', idKey: 'rt_id' as keyof PlayData, resultKey: 'rt_block_result' as keyof PlayData },
  ].map(({ pos, idKey, resultKey }) => {
    const posPlays = olPlays.filter((p) => p[idKey]);
    const playerId = posPlays.length > 0 ? (posPlays[0][idKey] as string) : null;
    const player = findPlayer(playerId);
    const wins = posPlays.filter((p) => p[resultKey] === 'win').length;
    const total = posPlays.length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;

    return {
      pos,
      playerId,
      playerName: player ? `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown' : 'Unknown',
      jerseyNumber: player?.jersey_number || '??',
      totalPlays: total,
      wins,
      winRate,
    };
  }).filter((s) => s.totalPlays > 0);

  const totalWins = positionStats.reduce((sum, s) => sum + s.wins, 0);
  const totalPlays = positionStats.reduce((sum, s) => sum + s.totalPlays, 0);
  const avgWinRate = totalPlays > 0 ? (totalWins / totalPlays) * 100 : 0;

  const sorted = [...positionStats].sort((a, b) => b.winRate - a.winRate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  let details = `Block Win Rates: `;
  details += positionStats.map((s) => `${s.pos}: ${Math.round(s.winRate)}%`).join(' | ');

  return {
    group: 'OL',
    groupName: 'Offensive Line',
    totalPlays: olPlays.length,
    winRate: Math.round(avgWinRate * 10) / 10,
    grade: getGrade(avgWinRate, true),
    topPerformer: best && best.playerId ? {
      playerId: best.playerId,
      playerName: best.playerName,
      jerseyNumber: best.jerseyNumber,
      winRate: Math.round(best.winRate * 10) / 10,
    } : undefined,
    weakestPerformer: worst && worst.playerId && worst !== best ? {
      playerId: worst.playerId,
      playerName: worst.playerName,
      jerseyNumber: worst.jerseyNumber,
      winRate: Math.round(worst.winRate * 10) / 10,
    } : undefined,
    details,
  };
}

/**
 * Calculate DB coverage stats
 */
function calculateDBStats(plays: PlayData[], players: PlayerData[]): PositionGroupStats {
  // DBs are tracked via coverage_player_id and coverage_result
  const coveragePlays = plays.filter((p) => p.coverage_player_id && p.coverage_result);

  if (coveragePlays.length === 0) {
    return {
      group: 'DB',
      groupName: 'Defensive Backs',
      totalPlays: 0,
      winRate: 0,
      grade: 'No Data',
      details: 'No DB coverage data - tag film with coverage assignments',
    };
  }

  const findPlayer = (id: string | null | undefined) => {
    if (!id) return null;
    return players.find((p) => p.id === id);
  };

  // Group by player
  const playerStats = new Map<string, { wins: number; total: number; player: PlayerData | null }>();

  for (const play of coveragePlays) {
    const playerId = play.coverage_player_id!;
    const existing = playerStats.get(playerId) || { wins: 0, total: 0, player: findPlayer(playerId) };
    existing.total++;
    if (play.coverage_result === 'win') {
      existing.wins++;
    }
    playerStats.set(playerId, existing);
  }

  const stats = Array.from(playerStats.entries()).map(([playerId, data]) => ({
    playerId,
    playerName: data.player ? `${data.player.first_name || ''} ${data.player.last_name || ''}`.trim() || 'Unknown' : 'Unknown',
    jerseyNumber: data.player?.jersey_number || '??',
    totalPlays: data.total,
    wins: data.wins,
    winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
  }));

  const totalWins = stats.reduce((sum, s) => sum + s.wins, 0);
  const totalPlays = stats.reduce((sum, s) => sum + s.totalPlays, 0);
  const avgWinRate = totalPlays > 0 ? (totalWins / totalPlays) * 100 : 0;

  const sorted = [...stats].sort((a, b) => b.winRate - a.winRate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const coverageWins = coveragePlays.filter((p) => p.coverage_result === 'win').length;
  const pbuCount = plays.filter((p) => p.is_pbu).length;
  let details = `Coverage Success: ${Math.round((coverageWins / coveragePlays.length) * 100)}%`;
  if (pbuCount > 0) {
    details += ` | PBUs: ${pbuCount}`;
  }

  return {
    group: 'DB',
    groupName: 'Defensive Backs',
    totalPlays: coveragePlays.length,
    winRate: Math.round(avgWinRate * 10) / 10,
    grade: getGrade(avgWinRate, true),
    topPerformer: best ? {
      playerId: best.playerId,
      playerName: best.playerName,
      jerseyNumber: best.jerseyNumber,
      winRate: Math.round(best.winRate * 10) / 10,
    } : undefined,
    weakestPerformer: worst && worst !== best ? {
      playerId: worst.playerId,
      playerName: worst.playerName,
      jerseyNumber: worst.jerseyNumber,
      winRate: Math.round(worst.winRate * 10) / 10,
    } : undefined,
    details,
  };
}

/**
 * Calculate LB performance stats (tackle efficiency)
 */
function calculateLBStats(plays: PlayData[], players: PlayerData[]): PositionGroupStats {
  // LBs tracked via tackler_ids, pressure_player_ids
  const defensivePlays = plays.filter((p) => p.is_opponent_play === false);
  const tacklePlays = defensivePlays.filter((p) => p.tackler_ids && p.tackler_ids.length > 0);
  const missedTacklePlays = defensivePlays.filter((p) =>
    (p as PlayData & { missed_tackle_ids?: string[] }).missed_tackle_ids &&
    ((p as PlayData & { missed_tackle_ids?: string[] }).missed_tackle_ids?.length ?? 0) > 0
  );

  if (tacklePlays.length === 0 && missedTacklePlays.length === 0) {
    return {
      group: 'LB',
      groupName: 'Linebackers',
      totalPlays: 0,
      winRate: 0,
      grade: 'No Data',
      details: 'No LB tackle data - tag film with tackler assignments',
    };
  }

  // For simplicity, calculate tackle efficiency as tackles / (tackles + missed tackles)
  const allTacklerIds = tacklePlays.flatMap((p) => p.tackler_ids || []);
  const totalTackles = allTacklerIds.length;
  const totalMissed = missedTacklePlays.reduce((sum, p) => {
    const missed = (p as PlayData & { missed_tackle_ids?: string[] }).missed_tackle_ids;
    return sum + (missed?.length || 0);
  }, 0);

  const tackleRate = totalTackles + totalMissed > 0
    ? (totalTackles / (totalTackles + totalMissed)) * 100
    : 0;

  const tflCount = defensivePlays.filter((p) => p.is_tfl).length;
  let details = `Tackle Rate: ${Math.round(tackleRate)}% | Total Tackles: ${totalTackles}`;
  if (tflCount > 0) {
    details += ` | TFLs: ${tflCount}`;
  }

  return {
    group: 'LB',
    groupName: 'Linebackers',
    totalPlays: tacklePlays.length,
    winRate: Math.round(tackleRate * 10) / 10,
    grade: getGrade(tackleRate, tacklePlays.length > 0),
    details,
  };
}

/**
 * Calculate DL performance stats (pressure rate)
 */
function calculateDLStats(plays: PlayData[]): PositionGroupStats {
  // DL tracked via pressure_player_ids, sacks
  const passPlays = plays.filter((p) => p.play_type === 'pass' && p.is_opponent_play === false);

  if (passPlays.length === 0) {
    return {
      group: 'DL',
      groupName: 'Defensive Line',
      totalPlays: 0,
      winRate: 0,
      grade: 'No Data',
      details: 'No defensive pass plays - tag film with pressure assignments',
    };
  }

  const pressurePlays = passPlays.filter((p) => p.pressure_player_ids && p.pressure_player_ids.length > 0);
  const sackPlays = passPlays.filter((p) => p.is_sack);

  const pressureRate = passPlays.length > 0 ? (pressurePlays.length / passPlays.length) * 100 : 0;
  const sackRate = passPlays.length > 0 ? (sackPlays.length / passPlays.length) * 100 : 0;

  let details = `Pressure Rate: ${Math.round(pressureRate)}% | Sacks: ${sackPlays.length}`;
  if (sackPlays.length > 0) {
    details += ` (${Math.round(sackRate)}% sack rate)`;
  }

  return {
    group: 'DL',
    groupName: 'Defensive Line',
    totalPlays: passPlays.length,
    winRate: Math.round(pressureRate * 10) / 10,
    grade: getGrade(pressureRate, passPlays.length > 0),
    details,
  };
}

/**
 * Calculate skill position stats (RB/WR success rate)
 */
function calculateSkillStats(plays: PlayData[], players: PlayerData[]): PositionGroupStats {
  const skillPlays = plays.filter((p) =>
    (p.ball_carrier_id || p.target_id) &&
    p.is_opponent_play !== true
  );

  if (skillPlays.length === 0) {
    return {
      group: 'SKILL',
      groupName: 'Skill Positions (RB/WR/TE)',
      totalPlays: 0,
      winRate: 0,
      grade: 'No Data',
      details: 'No skill position data - tag film with ball carriers and targets',
    };
  }

  const successPlays = skillPlays.filter((p) => p.success === true);
  const explosivePlays = skillPlays.filter((p) => p.explosive === true);
  const successRate = (successPlays.length / skillPlays.length) * 100;

  let details = `Success Rate: ${Math.round(successRate)}% | Explosive: ${explosivePlays.length}`;
  details += ` (${Math.round((explosivePlays.length / skillPlays.length) * 100)}% explosive rate)`;

  return {
    group: 'SKILL',
    groupName: 'Skill Positions (RB/WR/TE)',
    totalPlays: skillPlays.length,
    winRate: Math.round(successRate * 10) / 10,
    grade: getGrade(successRate, true),
    details,
  };
}

/**
 * Resolve position group performance for practice planning
 */
export function resolvePositionGroupPerformance(
  plays: PlayData[],
  players: PlayerData[]
): PositionGroupPerformanceResult {
  // Filter to team plays (not opponent)
  const teamPlays = plays.filter((p) => p.is_opponent_play !== true);

  if (teamPlays.length === 0) {
    return {
      summary: 'No play data available. Tag game film to see position group performance.',
      groups: [],
      weakestGroup: null,
      practiceRecommendations: [
        'Tag your game film with player assignments to unlock position group analysis',
      ],
    };
  }

  // Calculate stats for each position group
  const groups: PositionGroupStats[] = [
    calculateOLStats(teamPlays, players),
    calculateSkillStats(teamPlays, players),
    calculateDLStats(teamPlays),
    calculateLBStats(teamPlays, players),
    calculateDBStats(teamPlays, players),
  ];

  // Find weakest group with actual data
  const groupsWithData = groups.filter((g) => g.grade !== 'No Data');
  const sortedGroups = [...groupsWithData].sort((a, b) => a.winRate - b.winRate);
  const weakest = sortedGroups[0];

  // Generate practice recommendations
  const practiceRecommendations: string[] = [];

  if (weakest && weakest.winRate < 65) {
    const recommendation = getRecommendation(weakest);
    practiceRecommendations.push(recommendation);
  }

  // Add recommendations for struggling groups
  for (const group of groups) {
    if (group.grade === 'Struggling' || group.grade === 'Needs Work') {
      if (group.weakestPerformer) {
        practiceRecommendations.push(
          `${group.groupName}: Focus on ${group.weakestPerformer.playerName} (#${group.weakestPerformer.jerseyNumber}) - ${group.weakestPerformer.winRate}%`
        );
      }
    }
  }

  if (practiceRecommendations.length === 0 && groupsWithData.length > 0) {
    practiceRecommendations.push('All position groups performing at acceptable levels - focus on fundamentals');
  }

  // Build summary
  let summary = `**Position Group Performance (${teamPlays.length} plays analyzed)**\n\n`;

  for (const group of groups) {
    const emoji = getGradeEmoji(group.grade);
    summary += `**${group.groupName}:** ${group.winRate}% ${emoji}`;
    if (group.grade !== 'No Data') {
      summary += ` (${group.grade})`;
    }
    summary += `\n`;
    summary += `  ${group.details}\n`;
    if (group.topPerformer && group.grade !== 'No Data') {
      summary += `  Top: ${group.topPerformer.playerName} #${group.topPerformer.jerseyNumber} (${group.topPerformer.winRate}%)\n`;
    }
    if (group.weakestPerformer && group.weakestPerformer !== group.topPerformer) {
      summary += `  Needs Work: ${group.weakestPerformer.playerName} #${group.weakestPerformer.jerseyNumber} (${group.weakestPerformer.winRate}%)\n`;
    }
    summary += '\n';
  }

  if (weakest) {
    summary += `\n**Weakest Position Group:** ${weakest.groupName} (${weakest.winRate}%)\n`;
  }

  return {
    summary,
    groups,
    weakestGroup: weakest
      ? {
          group: weakest.group,
          groupName: weakest.groupName,
          winRate: weakest.winRate,
          recommendation: getRecommendation(weakest),
        }
      : null,
    practiceRecommendations,
  };
}

function getRecommendation(group: PositionGroupStats): string {
  switch (group.group) {
    case 'OL':
      return `OL needs work (${group.winRate}% win rate) - focus on blocking drills and technique`;
    case 'DB':
      return `DB coverage needs work (${group.winRate}%) - focus on man coverage and backpedal drills`;
    case 'LB':
      return `LB tackling efficiency low (${group.winRate}%) - focus on tackle form and pursuit angles`;
    case 'DL':
      return `DL pressure rate low (${group.winRate}%) - focus on pass rush moves and get-off`;
    case 'SKILL':
      return `Skill positions struggling (${group.winRate}% success) - review route running and ball security`;
    default:
      return `${group.groupName} needs improvement (${group.winRate}%)`;
  }
}
