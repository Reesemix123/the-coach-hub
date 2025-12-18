/**
 * OL Performance Concept Resolver
 *
 * Analyzes offensive line performance by position.
 * Calculates block win rates, identifies strengths/weaknesses.
 */

import type { PlayData, PlayerData } from '../types';

interface OLPositionStats {
  position: string;
  playerId: string | null;
  playerName: string;
  jerseyNumber: string;
  totalPlays: number;
  wins: number;
  losses: number;
  neutral: number;
  winRate: number;
  lossRate: number;
  runBlockWinRate: number;
  passBlockWinRate: number;
  grade: 'Excellent' | 'Good' | 'Average' | 'Needs Work' | 'Struggling';
}

interface OLPerformanceResult {
  summary: string;
  positions: OLPositionStats[];
  unitStats: {
    totalPlays: number;
    avgWinRate: number;
    bestPosition: string;
    worstPosition: string;
    runBlockingGrade: string;
    passBlockingGrade: string;
  };
  recommendations: string[];
}

function getGrade(winRate: number): OLPositionStats['grade'] {
  if (winRate >= 75) return 'Excellent';
  if (winRate >= 65) return 'Good';
  if (winRate >= 55) return 'Average';
  if (winRate >= 45) return 'Needs Work';
  return 'Struggling';
}

function getGradeString(avgWinRate: number): string {
  if (avgWinRate >= 75) return 'A';
  if (avgWinRate >= 65) return 'B';
  if (avgWinRate >= 55) return 'C';
  if (avgWinRate >= 45) return 'D';
  return 'F';
}

export function resolveOLPerformance(
  plays: PlayData[],
  players: PlayerData[]
): OLPerformanceResult {
  // Filter to plays with OL attribution
  const olPlays = plays.filter(
    (p) => p.lt_id || p.lg_id || p.c_id || p.rg_id || p.rt_id
  );

  if (olPlays.length === 0) {
    return {
      summary: 'No offensive line player attribution data available. Tag your film with OL assignments to see position-by-position performance.',
      positions: [],
      unitStats: {
        totalPlays: 0,
        avgWinRate: 0,
        bestPosition: 'N/A',
        worstPosition: 'N/A',
        runBlockingGrade: 'N/A',
        passBlockingGrade: 'N/A',
      },
      recommendations: [
        'Tag your game film with offensive line player assignments',
        'Mark block results (win/loss/neutral) for each lineman on each play',
      ],
    };
  }

  const runPlays = olPlays.filter((p) => p.play_type === 'run');
  const passPlays = olPlays.filter((p) => p.play_type === 'pass');

  // Helper to find player info
  const findPlayer = (id: string | null | undefined) => {
    if (!id) return null;
    return players.find((p) => p.id === id);
  };

  // Calculate stats for each position
  const calculatePositionStats = (
    position: string,
    idKey: keyof PlayData,
    resultKey: keyof PlayData
  ): OLPositionStats => {
    const positionPlays = olPlays.filter((p) => p[idKey]);
    const playerId = positionPlays.length > 0 ? (positionPlays[0][idKey] as string) : null;
    const player = findPlayer(playerId);

    const wins = positionPlays.filter((p) => p[resultKey] === 'win').length;
    const losses = positionPlays.filter((p) => p[resultKey] === 'loss').length;
    const neutral = positionPlays.filter((p) => p[resultKey] === 'neutral').length;
    const total = positionPlays.length;

    const runPositionPlays = positionPlays.filter((p) => p.play_type === 'run');
    const passPositionPlays = positionPlays.filter((p) => p.play_type === 'pass');

    const runWins = runPositionPlays.filter((p) => p[resultKey] === 'win').length;
    const passWins = passPositionPlays.filter((p) => p[resultKey] === 'win').length;

    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const runBlockWinRate = runPositionPlays.length > 0 ? (runWins / runPositionPlays.length) * 100 : 0;
    const passBlockWinRate = passPositionPlays.length > 0 ? (passWins / passPositionPlays.length) * 100 : 0;

    return {
      position,
      playerId,
      playerName: player ? `${player.first_name} ${player.last_name}` : 'Unknown',
      jerseyNumber: player?.jersey_number || '??',
      totalPlays: total,
      wins,
      losses,
      neutral,
      winRate: Math.round(winRate * 10) / 10,
      lossRate: total > 0 ? Math.round((losses / total) * 1000) / 10 : 0,
      runBlockWinRate: Math.round(runBlockWinRate * 10) / 10,
      passBlockWinRate: Math.round(passBlockWinRate * 10) / 10,
      grade: getGrade(winRate),
    };
  };

  const positions: OLPositionStats[] = [
    calculatePositionStats('LT', 'lt_id', 'lt_block_result'),
    calculatePositionStats('LG', 'lg_id', 'lg_block_result'),
    calculatePositionStats('C', 'c_id', 'c_block_result'),
    calculatePositionStats('RG', 'rg_id', 'rg_block_result'),
    calculatePositionStats('RT', 'rt_id', 'rt_block_result'),
  ];

  // Calculate unit stats
  const validPositions = positions.filter((p) => p.totalPlays > 0);
  const avgWinRate =
    validPositions.length > 0
      ? validPositions.reduce((sum, p) => sum + p.winRate, 0) / validPositions.length
      : 0;

  const sortedByWinRate = [...validPositions].sort((a, b) => b.winRate - a.winRate);
  const bestPosition = sortedByWinRate[0]?.position || 'N/A';
  const worstPosition = sortedByWinRate[sortedByWinRate.length - 1]?.position || 'N/A';

  // Calculate run/pass blocking grades
  const runWinRates = validPositions.map((p) => p.runBlockWinRate);
  const passWinRates = validPositions.map((p) => p.passBlockWinRate);
  const avgRunWinRate = runWinRates.length > 0 ? runWinRates.reduce((a, b) => a + b, 0) / runWinRates.length : 0;
  const avgPassWinRate = passWinRates.length > 0 ? passWinRates.reduce((a, b) => a + b, 0) / passWinRates.length : 0;

  // Generate recommendations
  const recommendations: string[] = [];

  // Find struggling positions
  const strugglingPositions = positions.filter((p) => p.grade === 'Struggling' || p.grade === 'Needs Work');
  if (strugglingPositions.length > 0) {
    for (const pos of strugglingPositions) {
      recommendations.push(
        `Focus individual coaching on ${pos.position} (${pos.playerName} #${pos.jerseyNumber}) - ${pos.winRate}% win rate`
      );
    }
  }

  // Check for run vs pass blocking disparity
  for (const pos of validPositions) {
    const diff = pos.runBlockWinRate - pos.passBlockWinRate;
    if (diff > 15) {
      recommendations.push(
        `${pos.position} (${pos.playerName}) struggles in pass protection - consider extra pass rush drills`
      );
    } else if (diff < -15) {
      recommendations.push(
        `${pos.position} (${pos.playerName}) struggles in run blocking - work on drive blocking technique`
      );
    }
  }

  // Check for left vs right side imbalance
  const leftSide = positions.filter((p) => p.position.includes('L'));
  const rightSide = positions.filter((p) => p.position.includes('R'));
  const leftAvg = leftSide.length > 0 ? leftSide.reduce((sum, p) => sum + p.winRate, 0) / leftSide.length : 0;
  const rightAvg = rightSide.length > 0 ? rightSide.reduce((sum, p) => sum + p.winRate, 0) / rightSide.length : 0;

  if (Math.abs(leftAvg - rightAvg) > 10) {
    const strongSide = leftAvg > rightAvg ? 'left' : 'right';
    const weakSide = leftAvg > rightAvg ? 'right' : 'left';
    recommendations.push(
      `Consider running plays to the ${strongSide} side more often (${Math.round(leftAvg > rightAvg ? leftAvg : rightAvg)}% vs ${Math.round(leftAvg > rightAvg ? rightAvg : leftAvg)}% win rate)`
    );
  }

  if (recommendations.length === 0 && avgWinRate >= 65) {
    recommendations.push('OL unit is performing well - maintain current techniques and conditioning');
  }

  // Build summary
  const bestPlayer = sortedByWinRate[0];
  const worstPlayer = sortedByWinRate[sortedByWinRate.length - 1];

  let summary = `**Offensive Line Performance (${olPlays.length} plays analyzed)**\n\n`;
  summary += `Unit Grade: **${getGradeString(avgWinRate)}** (${Math.round(avgWinRate)}% avg win rate)\n\n`;
  summary += `**By Position:**\n`;

  for (const pos of positions) {
    if (pos.totalPlays > 0) {
      summary += `- **${pos.position}** (${pos.playerName} #${pos.jerseyNumber}): ${pos.winRate}% win rate - ${pos.grade}\n`;
      summary += `  - Run: ${pos.runBlockWinRate}% | Pass: ${pos.passBlockWinRate}%\n`;
    }
  }

  if (bestPlayer && worstPlayer && bestPlayer !== worstPlayer) {
    summary += `\n**Standout:** ${bestPlayer.playerName} at ${bestPlayer.position} (${bestPlayer.winRate}% win rate)\n`;
    summary += `**Needs Work:** ${worstPlayer.playerName} at ${worstPlayer.position} (${worstPlayer.winRate}% win rate)\n`;
  }

  return {
    summary,
    positions,
    unitStats: {
      totalPlays: olPlays.length,
      avgWinRate: Math.round(avgWinRate * 10) / 10,
      bestPosition,
      worstPosition,
      runBlockingGrade: getGradeString(avgRunWinRate),
      passBlockingGrade: getGradeString(avgPassWinRate),
    },
    recommendations,
  };
}
