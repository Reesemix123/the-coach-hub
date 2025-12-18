/**
 * Opponent Tendencies Concept Resolver
 *
 * Analyzes opponent film to identify tendencies for practice planning.
 * Includes coverage distribution, blitz rates, and vulnerabilities.
 * Used to focus practice on situations likely to occur in upcoming games.
 */

import type { PlayData, GameData } from '../types';

export interface OpponentTendenciesResult {
  summary: string;
  opponentName: string;
  totalPlaysAnalyzed: number;
  hasData: boolean;

  // Coverage tendencies
  coverageDistribution: Array<{
    coverage: string;
    count: number;
    percentage: number;
  }>;

  // Blitz tendencies
  blitzRates: {
    overall: number;
    thirdDown: number;
    redZone: number;
    passingDowns: number;
  };

  // Vulnerabilities (where opponent struggles)
  vulnerabilities: {
    runSuccessAgainst: number;
    passSuccessAgainst: number;
    weakSide?: 'left' | 'right' | 'middle';
    exploitableFormations: string[];
  };

  // Down tendencies
  downTendencies: Array<{
    down: number;
    plays: number;
    mostCommonCoverage: string;
    blitzRate: number;
    successRateAgainst: number;
  }>;

  // Practice recommendations
  practiceRecommendations: string[];
}

/**
 * Resolve opponent tendencies for practice planning
 */
export function resolveOpponentTendencies(
  plays: PlayData[],
  opponentName: string,
  games?: GameData[]
): OpponentTendenciesResult {
  // Filter to opponent plays (is_opponent_play = true)
  const opponentPlays = plays.filter((p) => p.is_opponent_play === true);

  // If we have games data, also match by opponent name
  const matchingGames = games?.filter(
    (g) => g.opponent.toLowerCase().includes(opponentName.toLowerCase())
  );

  if (opponentPlays.length === 0) {
    return {
      summary: `No film tagged for ${opponentName}. Practice plan will focus on your team's needs.`,
      opponentName,
      totalPlaysAnalyzed: 0,
      hasData: false,
      coverageDistribution: [],
      blitzRates: {
        overall: 0,
        thirdDown: 0,
        redZone: 0,
        passingDowns: 0,
      },
      vulnerabilities: {
        runSuccessAgainst: 0,
        passSuccessAgainst: 0,
        exploitableFormations: [],
      },
      downTendencies: [],
      practiceRecommendations: [
        'Scout opponent film and tag their defensive plays',
        'Focus practice on your team\'s strengths until opponent data available',
      ],
    };
  }

  // Calculate coverage distribution
  const coverageCounts = new Map<string, number>();
  const blitzPlays = { total: 0, thirdDown: 0, redZone: 0, passingDowns: 0 };
  const blitzCounts = { total: 0, thirdDown: 0, redZone: 0, passingDowns: 0 };
  const runPlays = { total: 0, success: 0 };
  const passPlays = { total: 0, success: 0 };
  const directionSuccess = { left: 0, leftTotal: 0, right: 0, rightTotal: 0, middle: 0, middleTotal: 0 };

  const downStats = new Map<number, {
    plays: number;
    coverages: Map<string, number>;
    blitzes: number;
    successAgainst: number;
  }>();

  for (const play of opponentPlays) {
    // Track coverage (from playbook_play attributes or play_concept field)
    const coverage = play.playbook_play?.attributes?.passConcept ||
      (play as PlayData & { play_concept?: string }).play_concept ||
      (play as PlayData & { coverage?: string }).coverage ||
      'Unknown';

    if (coverage && coverage !== 'Unknown') {
      coverageCounts.set(coverage, (coverageCounts.get(coverage) || 0) + 1);
    }

    // Track blitz rates
    const facingBlitz = (play as PlayData & { facing_blitz?: boolean }).facing_blitz;
    blitzCounts.total++;
    if (facingBlitz) blitzPlays.total++;

    if (play.down === 3 || play.down === 4) {
      blitzCounts.passingDowns++;
      if (facingBlitz) blitzPlays.passingDowns++;

      if (play.down === 3) {
        blitzCounts.thirdDown++;
        if (facingBlitz) blitzPlays.thirdDown++;
      }
    }

    if (play.yard_line !== null && play.yard_line <= 20) {
      blitzCounts.redZone++;
      if (facingBlitz) blitzPlays.redZone++;
    }

    // Track run/pass success against opponent
    if (play.play_type === 'run') {
      runPlays.total++;
      if (play.success) runPlays.success++;

      // Track direction
      if (play.direction === 'left') {
        directionSuccess.leftTotal++;
        if (play.success) directionSuccess.left++;
      } else if (play.direction === 'right') {
        directionSuccess.rightTotal++;
        if (play.success) directionSuccess.right++;
      } else {
        directionSuccess.middleTotal++;
        if (play.success) directionSuccess.middle++;
      }
    } else if (play.play_type === 'pass') {
      passPlays.total++;
      if (play.success) passPlays.success++;
    }

    // Track by down
    if (play.down) {
      const downData = downStats.get(play.down) || {
        plays: 0,
        coverages: new Map<string, number>(),
        blitzes: 0,
        successAgainst: 0,
      };
      downData.plays++;
      if (coverage && coverage !== 'Unknown') {
        downData.coverages.set(coverage, (downData.coverages.get(coverage) || 0) + 1);
      }
      if (facingBlitz) downData.blitzes++;
      if (play.success) downData.successAgainst++;
      downStats.set(play.down, downData);
    }
  }

  // Calculate coverage distribution
  const totalCoveragePlays = Array.from(coverageCounts.values()).reduce((a, b) => a + b, 0);
  const coverageDistribution = Array.from(coverageCounts.entries())
    .map(([coverage, count]) => ({
      coverage,
      count,
      percentage: Math.round((count / totalCoveragePlays) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Calculate blitz rates
  const blitzRates = {
    overall: blitzCounts.total > 0 ? Math.round((blitzPlays.total / blitzCounts.total) * 100) : 0,
    thirdDown: blitzCounts.thirdDown > 0 ? Math.round((blitzPlays.thirdDown / blitzCounts.thirdDown) * 100) : 0,
    redZone: blitzCounts.redZone > 0 ? Math.round((blitzPlays.redZone / blitzCounts.redZone) * 100) : 0,
    passingDowns: blitzCounts.passingDowns > 0 ? Math.round((blitzPlays.passingDowns / blitzCounts.passingDowns) * 100) : 0,
  };

  // Calculate vulnerabilities
  const runSuccessAgainst = runPlays.total > 0 ? Math.round((runPlays.success / runPlays.total) * 100) : 0;
  const passSuccessAgainst = passPlays.total > 0 ? Math.round((passPlays.success / passPlays.total) * 100) : 0;

  // Determine weak side
  let weakSide: 'left' | 'right' | 'middle' | undefined;
  const leftRate = directionSuccess.leftTotal > 0 ? directionSuccess.left / directionSuccess.leftTotal : 0;
  const rightRate = directionSuccess.rightTotal > 0 ? directionSuccess.right / directionSuccess.rightTotal : 0;
  const middleRate = directionSuccess.middleTotal > 0 ? directionSuccess.middle / directionSuccess.middleTotal : 0;

  if (leftRate > rightRate && leftRate > middleRate && leftRate > 0.5) {
    weakSide = 'left';
  } else if (rightRate > leftRate && rightRate > middleRate && rightRate > 0.5) {
    weakSide = 'right';
  } else if (middleRate > leftRate && middleRate > rightRate && middleRate > 0.5) {
    weakSide = 'middle';
  }

  // Build down tendencies
  const downTendencies = Array.from(downStats.entries())
    .sort(([a], [b]) => a - b)
    .map(([down, data]) => {
      const coverageEntries = Array.from(data.coverages.entries());
      const mostCommon = coverageEntries.sort((a, b) => b[1] - a[1])[0];
      return {
        down,
        plays: data.plays,
        mostCommonCoverage: mostCommon?.[0] || 'Unknown',
        blitzRate: data.plays > 0 ? Math.round((data.blitzes / data.plays) * 100) : 0,
        successRateAgainst: data.plays > 0 ? Math.round((data.successAgainst / data.plays) * 100) : 0,
      };
    });

  // Generate practice recommendations
  const practiceRecommendations: string[] = [];

  // Recommend based on coverage distribution
  if (coverageDistribution.length > 0) {
    const topCoverage = coverageDistribution[0];
    if (topCoverage.percentage > 40) {
      practiceRecommendations.push(
        `Drill routes that beat ${topCoverage.coverage} (${topCoverage.percentage}% of snaps)`
      );
    }
  }

  // Recommend based on blitz tendencies
  if (blitzRates.thirdDown > 50) {
    practiceRecommendations.push(
      `Practice hot routes and quick passes - opponent blitzes ${blitzRates.thirdDown}% on 3rd down`
    );
  }

  // Recommend based on vulnerabilities
  if (runSuccessAgainst > 55) {
    practiceRecommendations.push(
      `Emphasize run game - ${runSuccessAgainst}% success rate against this opponent's defense`
    );
  }
  if (passSuccessAgainst > 55) {
    practiceRecommendations.push(
      `Passing game effective - ${passSuccessAgainst}% success rate against this opponent`
    );
  }

  if (weakSide) {
    practiceRecommendations.push(
      `Run to the ${weakSide} - opponent shows weakness on that side`
    );
  }

  if (practiceRecommendations.length === 0) {
    practiceRecommendations.push('Balanced approach recommended - opponent shows no major tendencies');
  }

  // Build summary
  let summary = `**${opponentName} Defensive Tendencies (${opponentPlays.length} plays analyzed)**\n\n`;

  if (coverageDistribution.length > 0) {
    summary += `**Coverage Distribution:**\n`;
    for (const cov of coverageDistribution.slice(0, 4)) {
      summary += `• ${cov.coverage}: ${cov.percentage}% (${cov.count} plays)\n`;
    }
    summary += '\n';
  }

  summary += `**Blitz Rates:**\n`;
  summary += `• Overall: ${blitzRates.overall}%\n`;
  summary += `• 3rd Down: ${blitzRates.thirdDown}%\n`;
  summary += `• Red Zone: ${blitzRates.redZone}%\n\n`;

  summary += `**Vulnerabilities:**\n`;
  summary += `• Run Success Against: ${runSuccessAgainst}%\n`;
  summary += `• Pass Success Against: ${passSuccessAgainst}%\n`;
  if (weakSide) {
    summary += `• Weak Side: ${weakSide}\n`;
  }
  summary += '\n';

  if (downTendencies.length > 0) {
    summary += `**Down Tendencies:**\n`;
    for (const dt of downTendencies) {
      summary += `• ${dt.down}${dt.down === 1 ? 'st' : dt.down === 2 ? 'nd' : dt.down === 3 ? 'rd' : 'th'} Down: `;
      summary += `${dt.mostCommonCoverage} (${dt.blitzRate}% blitz, ${dt.successRateAgainst}% success against)\n`;
    }
  }

  return {
    summary,
    opponentName,
    totalPlaysAnalyzed: opponentPlays.length,
    hasData: true,
    coverageDistribution,
    blitzRates,
    vulnerabilities: {
      runSuccessAgainst,
      passSuccessAgainst,
      weakSide,
      exploitableFormations: [], // Would need formation-level analysis
    },
    downTendencies,
    practiceRecommendations,
  };
}
